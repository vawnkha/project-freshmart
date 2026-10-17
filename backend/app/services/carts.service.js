const ResourceDeletionService = require("./resource-deletion.service");
const ApiError = require("../api-error");
const { ObjectId } = require("mongodb");
const InventoryStockService = require("./inventory-stock.service");
const ProductsService = require("./products.service");
const {
  isInventoryItemActive,
  isProductSellable,
} = require("../utils/inventory-query.util");

function toObjectId(id) {
  if (id instanceof ObjectId) return id;
  return ObjectId.isValid(id) ? new ObjectId(id) : null;
}

function removeUndefined(document) {
  Object.keys(document).forEach((key) => {
    if (document[key] === undefined) delete document[key];
  });
  return document;
}

class CartService {
  constructor(client) {
    this.client = client;
    this.deletion = new ResourceDeletionService(client);
    const db = client.db();
    this.Cart = db.collection("carts");
    this.Product = db.collection("products");
    this.InventoryItem = db.collection("inventory_items");
    this.stockService = new InventoryStockService(client);
    this.productsService = new ProductsService(client);
  }

  async getOrCreate(userId) {
    const uid = toObjectId(userId);
    if (!uid) return { error: "userId hoặc productId không hợp lệ" };
    const cart = await this.Cart.findOne({ user_id: uid });
    if (cart) return { ...cart, items: this.canonicalItems(cart.items) };
    return this.withCartTransaction(uid, null, async (session) => {
      await this.Cart.updateOne(
        { user_id: uid },
        { $setOnInsert: { user_id: uid, items: [], updated_at: new Date() } },
        { upsert: true, session },
      );
      return this.Cart.findOne({ user_id: uid }, { session });
    });
  }

  isLegacyCompatibleStatus(product) {
    if (!product.status) return true;
    return ["active", "in_stock"].includes(product.status);
  }

  isInventoryProductActive(product) {
    return product.status === "active";
  }

  getProductImage(product = {}) {
    if (product.thumbnail) return product.thumbnail;
    if (Array.isArray(product.images) && product.images[0])
      return product.images[0];
    return "";
  }

  getProductPrice(product = {}) {
    if (product.sellingPrice !== undefined)
      return Number(product.sellingPrice || 0);
    return Number(product.price || 0);
  }

  buildStockExceededError(
    stock,
    currentQty,
    requestedQty,
    nextQty,
    mode = "add",
  ) {
    return {
      error:
        mode === "update"
          ? `Số lượng vượt tồn kho. Hiện chỉ còn ${stock} sản phẩm.`
          : `Số lượng vượt tồn kho. Hiện còn ${stock} sản phẩm.`,
      stock,
      currentQty,
      requestedQty,
      nextQty,
    };
  }

  async getCartProductContext(productId, { session, lockStock = false } = {}) {
    const pid = toObjectId(productId);
    if (!pid) return { error: "userId hoặc productId không hợp lệ" };

    const product = await this.Product.findOne({ _id: pid }, { session });
    if (!product) return { error: "Sản phẩm không tồn tại" };

    const inventoryItemId = toObjectId(product.inventoryItemId);
    if (product.inventoryItemId && !inventoryItemId)
      return { error: "Lien ket hang kho khong hop le" };
    if (inventoryItemId) {
      if (!this.isInventoryProductActive(product)) {
        return { error: "Sản phẩm chưa được kích hoạt" };
      }

      // Share the inventory service's Mongo lock with lock/export/checkout.
      // This increments a version only; adding to a cart never reserves stock.
      let inventoryItem;
      if (lockStock) {
        try {
          inventoryItem = await this.stockService.acquireItem(
            inventoryItemId,
            session,
          );
        } catch (error) {
          if (error.statusCode !== 404) throw error;
          return {
            error: "Hàng kho của sản phẩm không tồn tại hoặc không hoạt động",
          };
        }
      } else {
        inventoryItem = await this.InventoryItem.findOne(
          { _id: inventoryItemId },
          { session },
        );
      }

      if (!isInventoryItemActive(inventoryItem)) {
        return {
          error: "Hàng kho của sản phẩm không tồn tại hoặc không hoạt động",
        };
      }

      const inventorySummary = await this.stockService.getTotals(
        inventoryItemId,
        { session },
      );
      const stock = inventorySummary.availableQuantity;

      return {
        product,
        inventoryItem,
        inventorySummary,
        stock,
        price: this.getProductPrice(product),
      };
    }

    if (!this.isLegacyCompatibleStatus(product)) {
      return { error: "Sản phẩm chưa được kích hoạt" };
    }

    return {
      product,
      inventoryItem: null,
      inventorySummary: null,
      stock: Number(product.stock || 0),
      price: this.getProductPrice(product),
    };
  }

  buildCartItemSnapshot(context, quantity, existedItem = null) {
    const now = new Date();
    const { product, inventoryItem, price } = context;

    return removeUndefined({
      product_id: product._id,
      quantity,
      inventoryItemId: inventoryItem?._id,
      productName: product.name,
      slug: product.slug,
      image: this.getProductImage(product),
      itemCode: inventoryItem?.itemCode,
      itemName: inventoryItem?.itemName,
      unit: inventoryItem?.unit || product.unit,
      packageSize: inventoryItem?.packageSize,
      price,
      addedAt: existedItem?.addedAt || now,
      updatedAt: now,
    });
  }

  // Embedded business key is product_id, with no variant in the contract.
  // Accept legacy string ObjectIds and preserve metadata / first-item order.
  canonicalItems(items = []) {
    const result = [];
    const positions = new Map();
    for (const item of items) {
      const id = toObjectId(item.product_id);
      const key = id ? String(id) : String(item.product_id);
      if (positions.has(key)) {
        result[positions.get(key)].quantity += Number(item.quantity || 0);
      } else {
        positions.set(key, result.length);
        result.push({
          ...item,
          product_id: id || item.product_id,
          quantity: Number(item.quantity || 0),
        });
      }
    }
    return result;
  }

  async withCartTransaction(uid, pid, callback) {
    const deadline = Date.now() + 5000;
    for (let attempt = 0; attempt < 3; attempt++) {
      const session = this.client.startSession();
      try {
        // Driver retries only aborted transient transactions / uncertain commits.
        // A finite deadline also bounds high-contention cross-instance requests.
        return await session.withTransaction(
          async () => {
            // Preserve the existing missing-product 400 contract. The read is
            // inside the attempt; reference locking still catches deletion races.
            if (
              pid &&
              !(await this.Product.findOne(
                { _id: pid },
                { session, projection: { _id: 1 } },
              ))
            ) {
              return { error: "Sản phẩm không tồn tại" };
            }
            return this.deletion.withReferences(
              [
                { collection: "users", id: uid },
                ...(pid ? [{ collection: "products", id: pid }] : []),
              ],
              callback,
              { session },
            );
          },
          {
            readConcern: { level: "snapshot" },
            writeConcern: { w: "majority" },
            timeoutMS: Math.max(1, deadline - Date.now()),
            maxCommitTimeMS: 1000,
          },
        );
      } catch (error) {
        // Only an aborted cart-creation collision is safe to repeat. Never
        // replay an additive request after an uncertain commit or HTTP timeout.
        const cartCollision =
          error.code === 11000 &&
          error.keyPattern?.user_id === 1 &&
          !error.hasErrorLabel?.("UnknownTransactionCommitResult");
        if (cartCollision && attempt < 2 && Date.now() < deadline) continue;
        if (cartCollision)
          throw new ApiError(
            409,
            "Giỏ hàng vừa thay đổi. Vui lòng tải lại giỏ hàng.",
          );
        if (
          error.name === "MongoOperationTimeoutError" ||
          error.hasErrorLabel?.("TransientTransactionError")
        ) {
          throw new ApiError(
            503,
            "Giỏ hàng đang bận. Vui lòng tải lại giỏ hàng để kiểm tra trước khi thử lại.",
          );
        }
        throw error;
      } finally {
        await session.endSession();
      }
    }
  }

  async addItem(userId, productId, quantity = 1) {
    const uid = toObjectId(userId);
    const pid = toObjectId(productId);
    if (!uid || !pid) return { error: "userId hoặc productId không hợp lệ" };

    const q = Number(quantity);
    if (!Number.isSafeInteger(q) || q <= 0)
      return { error: "quantity phải là số nguyên lớn hơn 0" };
    return this.writeItem(uid, pid, q, "add");
  }

  async updateItem(userId, productId, quantity) {
    const uid = toObjectId(userId);
    const pid = toObjectId(productId);
    const q = Number(quantity);

    if (!uid || !pid) return { error: "userId hoặc productId không hợp lệ" };

    if (!Number.isSafeInteger(q) || q < 0)
      return { error: "quantity phải là số nguyên không âm" };
    if (q === 0) return this.removeItem(uid, pid);
    return this.writeItem(uid, pid, q, "update");
  }

  async writeItem(uid, pid, q, mode) {
    return this.withCartTransaction(uid, pid, async (session) => {
      // All reads belong to this attempt. Never capture a pre-transaction cart
      // or stock value in a callback that MongoDB may run again after conflict.
      const context = await this.getCartProductContext(pid, {
        session,
        lockStock: true,
      });
      if (context.error) return context;
      const stock = Number(context.stock || 0);
      if (stock <= 0) return { error: "Sản phẩm đã hết hàng" };
      const cart = await this.Cart.findOne({ user_id: uid }, { session });
      const items = this.canonicalItems(cart?.items);
      const index = items.findIndex(
        (item) => String(item.product_id) === String(pid),
      );
      const existedItem = items[index];
      if (mode === "update" && !existedItem)
        return { error: "Sản phẩm chưa có trong giỏ hàng" };
      const currentQty = existedItem?.quantity || 0;
      if (!Number.isSafeInteger(currentQty) || currentQty < 0)
        return { error: "Số lượng trong giỏ hàng không hợp lệ" };
      const nextQty = mode === "add" ? currentQty + q : q;
      if (!Number.isSafeInteger(nextQty) || nextQty > stock) {
        return this.buildStockExceededError(
          stock,
          currentQty,
          q,
          nextQty,
          mode,
        );
      }
      const snapshot = {
        ...existedItem,
        ...this.buildCartItemSnapshot(context, nextQty, existedItem),
      };
      if (index < 0) items.push(snapshot);
      else items[index] = snapshot;
      await this.Cart.updateOne(
        { user_id: uid },
        {
          $set: { items, updated_at: new Date() },
          $setOnInsert: { user_id: uid },
        },
        { session, upsert: true },
      );
      return { ok: true, stock, quantity: nextQty };
    });
  }

  async removeItem(userId, productId) {
    const uid = toObjectId(userId);
    const pid = toObjectId(productId);
    if (!uid || !pid) return { error: "userId hoặc productId không hợp lệ" };
    await this.withCartTransaction(uid, null, async (session) => {
      const cart = await this.Cart.findOne({ user_id: uid }, { session });
      if (!cart) return;
      const items = this.canonicalItems(cart.items).filter(
        (item) => String(item.product_id) !== String(pid),
      );
      await this.Cart.updateOne(
        { user_id: uid },
        { $set: { items, updated_at: new Date() } },
        { session },
      );
    });
    return { ok: true };
  }

  async clearCart(userId) {
    const uid = toObjectId(userId);
    if (!uid) return { error: "userId hoặc productId không hợp lệ" };
    await this.withCartTransaction(uid, null, (session) =>
      this.Cart.updateOne(
        { user_id: uid },
        { $set: { items: [], updated_at: new Date() } },
        { upsert: true, session },
      ),
    );
    return { ok: true };
  }

  async getDetailedCart(userId) {
    const uid = toObjectId(userId);
    const cart = await this.Cart.findOne({ user_id: uid });
    if (!cart) return { items: [], updated_at: null };

    const cartItems = this.canonicalItems(cart.items);
    const ids = cartItems.map((i) => i.product_id).filter(Boolean);
    const products = await this.Product.aggregate(
      this.productsService.buildPopulatePipeline({
        match: { _id: { $in: ids } },
        includeInventoryDetails: true,
      }),
    ).toArray();
    const productMap = new Map(products.map((p) => [String(p._id), p]));

    const items = cartItems
      .map((cartItem) => {
        const product = productMap.get(String(cartItem.product_id));
        if (!product) return null;

        const inventoryItemId = toObjectId(product.inventoryItemId);
        const inventoryItem = product.inventoryItem;
        const stock = isProductSellable(product)
          ? Number(product.stock || 0)
          : 0;
        const price = this.getProductPrice(product);
        const quantity = Number(cartItem.quantity || 0);
        const subtotal = price * quantity;

        return removeUndefined({
          product_id: cartItem.product_id,
          quantity: cartItem.quantity,
          name: product.name,
          price,
          stock,
          availableStock: stock,
          inStock: stock > 0,
          outOfStock: stock <= 0,
          unit: inventoryItem?.unit || product.unit || cartItem.unit,
          thumbnail: this.getProductImage(product) || cartItem.image || "",
          line_total: subtotal,
          subtotal,
          inventoryItemId: inventoryItemId || cartItem.inventoryItemId,
          itemCode: inventoryItem?.itemCode || cartItem.itemCode,
          itemName: inventoryItem?.itemName || cartItem.itemName,
          packageSize: inventoryItem?.packageSize || cartItem.packageSize,
          productName: cartItem.productName || product.name,
          slug: product.slug || cartItem.slug,
          image: this.getProductImage(product) || cartItem.image || "",
        });
      })
      .filter(Boolean);

    const subtotal = items.reduce((sum, item) => sum + item.line_total, 0);
    return { items, subtotal, updated_at: cart.updated_at };
  }
}

module.exports = CartService;
