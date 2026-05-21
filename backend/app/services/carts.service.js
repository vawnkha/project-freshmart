const { ObjectId } = require("mongodb");

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
    const db = client.db();
    this.Cart = db.collection("carts");
    this.Product = db.collection("products");
    this.InventoryItem = db.collection("inventory_items");
    this.InventorySummary = db.collection("inventory_summaries");
  }

  async getOrCreate(userId) {
    const uid = toObjectId(userId);
    let cart = await this.Cart.findOne({ user_id: uid });
    if (cart) return cart;
    const document = { user_id: uid, items: [], updated_at: new Date() };
    await this.Cart.insertOne(document);
    return document;
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
    if (Array.isArray(product.images) && product.images[0]) return product.images[0];
    return "";
  }

  getSummaryStock(summary) {
    if (!summary) return 0;
    if (summary.availableQuantity !== undefined) {
      return Number(summary.availableQuantity || 0);
    }
    return Number(summary.quantity || 0);
  }

  getProductPrice(product = {}) {
    if (product.sellingPrice !== undefined) return Number(product.sellingPrice || 0);
    return Number(product.price || 0);
  }

  buildStockExceededError(stock, currentQty, requestedQty, nextQty, mode = "add") {
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

  async getCartProductContext(productId) {
    const pid = toObjectId(productId);
    if (!pid) return { error: "userId hoặc productId không hợp lệ" };

    const product = await this.Product.findOne({ _id: pid });
    if (!product) return { error: "Sản phẩm không tồn tại" };

    const inventoryItemId = toObjectId(product.inventoryItemId);
    if (inventoryItemId) {
      if (!this.isInventoryProductActive(product)) {
        return { error: "Sản phẩm chưa được kích hoạt" };
      }

      const inventoryItem = await this.InventoryItem.findOne({
        _id: inventoryItemId,
      });

      if (!inventoryItem || inventoryItem.status === "inactive") {
        return { error: "Hàng kho của sản phẩm không tồn tại hoặc không hoạt động" };
      }

      const inventorySummary = await this.InventorySummary.findOne({
        inventoryItemId,
      });
      const stock = this.getSummaryStock(inventorySummary);

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

  buildItemSet(snapshot, prefix = "items.$.") {
    const set = {};
    Object.keys(snapshot).forEach((key) => {
      if (key === "product_id" || key === "quantity") return;
      set[`${prefix}${key}`] = snapshot[key];
    });
    return set;
  }

  async addItem(userId, productId, quantity = 1) {
    const uid = toObjectId(userId);
    const pid = toObjectId(productId);
    if (!uid || !pid) return { error: "userId hoặc productId không hợp lệ" };

    const q = Math.max(parseInt(quantity, 10) || 1, 1);
    const context = await this.getCartProductContext(pid);
    if (context.error) return context;

    const stock = Number(context.stock || 0);
    if (stock <= 0) return { error: "Sản phẩm đã hết hàng" };

    const cart = await this.Cart.findOne(
      { user_id: uid },
      { projection: { items: 1 } },
    );

    const existedItem = cart?.items?.find(
      (it) => String(it.product_id) === String(pid),
    );
    const currentQty = existedItem ? Number(existedItem.quantity || 0) : 0;
    const nextQty = currentQty + q;

    if (nextQty > stock) {
      return this.buildStockExceededError(stock, currentQty, q, nextQty, "add");
    }

    const snapshot = this.buildCartItemSnapshot(context, nextQty, existedItem);
    if (existedItem) {
      await this.Cart.updateOne(
        { user_id: uid, "items.product_id": pid },
        {
          $inc: { "items.$.quantity": q },
          $set: {
            ...this.buildItemSet(snapshot),
            updated_at: new Date(),
          },
        },
      );
    } else {
      await this.Cart.updateOne(
        { user_id: uid },
        {
          $setOnInsert: { user_id: uid },
          $push: { items: snapshot },
          $set: { updated_at: new Date() },
        },
        { upsert: true },
      );
    }

    return { ok: true, stock, quantity: nextQty };
  }

  async updateItem(userId, productId, quantity) {
    const uid = toObjectId(userId);
    const pid = toObjectId(productId);
    const q = parseInt(quantity, 10);

    if (!uid || !pid) return { error: "userId hoặc productId không hợp lệ" };

    if (!Number.isFinite(q) || q <= 0) {
      await this.Cart.updateOne(
        { user_id: uid },
        {
          $pull: { items: { product_id: pid } },
          $set: { updated_at: new Date() },
        },
      );
      return { ok: true };
    }

    const context = await this.getCartProductContext(pid);
    if (context.error) return context;

    const stock = Number(context.stock || 0);
    if (stock <= 0) return { error: "Sản phẩm đã hết hàng" };

    if (q > stock) {
      return this.buildStockExceededError(stock, 0, q, q, "update");
    }

    const cart = await this.Cart.findOne(
      { user_id: uid },
      { projection: { items: 1 } },
    );
    const existedItem = cart?.items?.find(
      (it) => String(it.product_id) === String(pid),
    );
    const snapshot = this.buildCartItemSnapshot(context, q, existedItem);

    const rs = await this.Cart.updateOne(
      {
        user_id: uid,
        items: {
          $elemMatch: {
            product_id: pid,
          },
        },
      },
      {
        $set: {
          "items.$.quantity": q,
          ...this.buildItemSet(snapshot),
          updated_at: new Date(),
        },
      },
    );

    if (rs.matchedCount === 0) {
      return { error: "Sản phẩm chưa có trong giỏ hàng" };
    }

    return { ok: true, stock, quantity: q };
  }

  async removeItem(userId, productId) {
    const uid = toObjectId(userId);
    const pid = toObjectId(productId);
    await this.Cart.updateOne(
      { user_id: uid },
      {
        $pull: { items: { product_id: pid } },
        $set: { updated_at: new Date() },
      },
    );
    return { ok: true };
  }

  async clearCart(userId) {
    const uid = toObjectId(userId);
    await this.Cart.updateOne(
      { user_id: uid },
      { $set: { items: [], updated_at: new Date() } },
      { upsert: true },
    );
    return { ok: true };
  }

  async getDetailedCart(userId) {
    const uid = toObjectId(userId);
    const cart = await this.Cart.findOne({ user_id: uid });
    if (!cart) return { items: [], updated_at: null };

    const ids = (cart.items || []).map((i) => i.product_id).filter(Boolean);
    const products = await this.Product.find({ _id: { $in: ids } }).toArray();
    const productMap = new Map(products.map((p) => [String(p._id), p]));

    const inventoryIds = products
      .map((product) => toObjectId(product.inventoryItemId))
      .filter(Boolean);

    const [inventoryItems, inventorySummaries] = await Promise.all([
      inventoryIds.length
        ? this.InventoryItem.find({ _id: { $in: inventoryIds } }).toArray()
        : [],
      inventoryIds.length
        ? this.InventorySummary.find({
            inventoryItemId: { $in: inventoryIds },
          }).toArray()
        : [],
    ]);

    const inventoryItemMap = new Map(
      inventoryItems.map((item) => [String(item._id), item]),
    );
    const inventorySummaryMap = new Map(
      inventorySummaries.map((summary) => [
        String(summary.inventoryItemId),
        summary,
      ]),
    );

    const items = (cart.items || [])
      .map((cartItem) => {
        const product = productMap.get(String(cartItem.product_id));
        if (!product) return null;

        const inventoryItemId = toObjectId(product.inventoryItemId);
        const inventoryItem = inventoryItemId
          ? inventoryItemMap.get(String(inventoryItemId))
          : null;
        const inventorySummary = inventoryItemId
          ? inventorySummaryMap.get(String(inventoryItemId))
          : null;
        const stock = inventoryItemId
          ? this.getSummaryStock(inventorySummary)
          : Number(product.stock || 0);
        const price = this.getProductPrice(product);
        const quantity = Number(cartItem.quantity || 0);
        const subtotal = price * quantity;

        return removeUndefined({
          product_id: cartItem.product_id,
          quantity: cartItem.quantity,
          name: product.name,
          price,
          stock,
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
