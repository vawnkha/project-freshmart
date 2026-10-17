const { ObjectId } = require("mongodb");
const ApiError = require("../api-error");
const InventoryStockService = require("./inventory-stock.service");

const reference = (collection, fields, message) => ({
  collection,
  fields,
  message,
});
// Check every lifecycle state: inactive, archived and canceled records can still
// own historical references. Both Mongo IDs and legacy string IDs are supported.
const POLICIES = {
  categories: [
    reference("products", ["category_id", "categoryId"], "sản phẩm liên quan"),
    reference(
      "inventory_items",
      ["categoryId", "category_id"],
      "hàng kho liên quan",
    ),
    reference(
      "discounts",
      ["applicable.categoryIds", "categoryIds"],
      "mã giảm giá liên quan",
    ),
    reference(
      "orders",
      ["items.category_id", "items.categoryId"],
      "lịch sử đơn hàng liên quan",
    ),
  ],
  products: [
    reference(
      "orders",
      ["items.product_id", "items.productId"],
      "đơn hàng liên quan",
    ),
    reference(
      "order_items",
      ["product_id", "productId"],
      "chi tiết đơn hàng liên quan",
    ),
    reference(
      "carts",
      ["items.product_id", "items.productId", "product_id", "productId"],
      "giỏ hàng liên quan",
    ),
    reference(
      "wishlists",
      [
        "items",
        "items.product_id",
        "items.productId",
        "product_id",
        "productId",
        "productIds",
        "products",
      ],
      "danh sách yêu thích liên quan",
    ),
    reference("reviews", ["product_id", "productId"], "đánh giá liên quan"),
    reference(
      "discounts",
      ["applicable.productIds", "productIds"],
      "mã giảm giá liên quan",
    ),
    reference(
      "inventory_batches",
      ["productId", "product_id"],
      "lô hàng liên quan",
    ),
    reference(
      "inventory_items",
      ["productId", "product_id"],
      "hàng kho tham chiếu sản phẩm",
    ),
    reference(
      "payment_intents",
      ["items.productId", "items.product_id"],
      "giao dịch thanh toán liên quan",
    ),
  ],
  inventory_items: [
    reference(
      "inventory_batches",
      ["inventoryItemId", "inventory_item_id"],
      "lô hàng liên quan",
    ),
    reference(
      "inventory_transactions",
      ["inventoryItemId", "inventory_item_id"],
      "giao dịch nhập/xuất liên quan",
    ),
    reference(
      "products",
      ["inventoryItemId", "inventory_item_id"],
      "sản phẩm website tham chiếu",
    ),
    reference(
      "carts",
      ["items.inventoryItemId", "items.inventory_item_id"],
      "giỏ hàng tham chiếu hàng kho",
    ),
    reference(
      "purchase_orders",
      ["items.inventoryItemId", "items.inventory_item_id"],
      "phiếu nhập liên quan",
    ),
    reference(
      "orders",
      ["items.inventoryItemId", "items.batchAllocations.inventoryItemId"],
      "đơn hàng hoặc phân bổ lô liên quan",
    ),
    reference(
      "payment_intents",
      ["items.inventoryItemId"],
      "giao dịch thanh toán liên quan",
    ),
  ],
  brands: [
    reference("products", ["brandId", "brand_id"], "sản phẩm liên quan"),
    reference("inventory_items", ["brandId", "brand_id"], "hàng kho liên quan"),
  ],
  manufacturers: [
    reference(
      "products",
      ["manufacturerId", "manufacturer_id"],
      "sản phẩm liên quan",
    ),
    reference(
      "inventory_items",
      ["manufacturerId", "manufacturer_id"],
      "hàng kho liên quan",
    ),
  ],
  suppliers: [
    reference(
      "purchase_orders",
      ["supplierId", "supplier_id"],
      "phiếu nhập liên quan",
    ),
    reference(
      "inventory_batches",
      ["supplierId", "supplier_id"],
      "lô hàng liên quan",
    ),
    reference(
      "inventory_transactions",
      ["supplierId", "supplier_id"],
      "lịch sử nhập/xuất liên quan",
    ),
  ],
  discounts: [
    reference(
      "orders",
      ["discount.discount_id", "discount._id", "discountId", "discount_id"],
      "đơn hàng liên quan",
    ),
    reference(
      "user_discounts",
      ["discountId", "discount_id"],
      "lịch sử sử dụng mã giảm giá",
    ),
  ],
  shipping_methods: [
    reference(
      "orders",
      ["shipping_method_id", "shippingMethodId", "shipping_method._id"],
      "đơn hàng liên quan",
    ),
    reference(
      "payment_intents",
      ["shippingMethodId", "shipping_method_id"],
      "giao dịch thanh toán liên quan",
    ),
  ],
  news_categories: [
    reference("news", ["categoryId", "category_id"], "bài viết liên quan"),
  ],
  news: [],
  addresses: [
    reference("orders", ["address_id", "addressId"], "đơn hàng liên quan"),
    reference(
      "payment_intents",
      ["addressId", "address_id"],
      "giao dịch thanh toán liên quan",
    ),
  ],
  users: [
    reference("orders", ["user_id", "userId"], "đơn hàng liên quan"),
    reference("payments", ["user_id", "userId"], "thanh toán liên quan"),
    reference(
      "payment_intents",
      ["userId", "user_id"],
      "giao dịch thanh toán liên quan",
    ),
    reference(
      "user_discounts",
      ["userId", "user_id"],
      "lịch sử sử dụng mã giảm giá",
    ),
    reference("addresses", ["user_id", "userId"], "địa chỉ liên quan"),
    reference("carts", ["user_id", "userId"], "giỏ hàng liên quan"),
    reference(
      "wishlists",
      ["user_id", "userId"],
      "danh sách yêu thích liên quan",
    ),
    reference("reviews", ["user_id", "userId"], "đánh giá liên quan"),
    reference("news", ["createdBy", "updatedBy"], "bài viết đã biên tập"),
    reference("banners", ["createdBy", "updatedBy"], "banner đã biên tập"),
    reference(
      "purchase_orders",
      ["createdBy", "confirmedBy", "cancelledBy"],
      "lịch sử phiếu nhập",
    ),
    reference(
      "inventory_transactions",
      ["createdBy", "userId", "user_id"],
      "lịch sử nhập/xuất",
    ),
    reference(
      "notifications",
      ["userId", "user_id", "recipientId"],
      "thông báo liên quan",
    ),
    reference(
      "contacts",
      ["user_id", "userId", "handledBy"],
      "liên hệ liên quan",
    ),
    reference(
      "outbox_events",
      ["userId", "user_id", "aggregateId"],
      "tác vụ đang lưu trong outbox",
    ),
  ],
  roles: [
    reference("users", ["role_id", "roleId"], "người dùng đang được gán role"),
  ],
  contacts: [
    reference(
      "notifications",
      ["data.contactId", "contactId"],
      "thông báo tham chiếu liên hệ",
    ),
  ],
};
const LABELS = {
  categories: "danh mục",
  products: "sản phẩm",
  inventory_items: "sản phẩm kho",
  brands: "thương hiệu",
  manufacturers: "nhà sản xuất",
  suppliers: "nhà cung cấp",
  discounts: "mã giảm giá",
  shipping_methods: "phương thức vận chuyển",
  news_categories: "danh mục tin tức",
  news: "bài viết",
  addresses: "địa chỉ",
  users: "người dùng",
  roles: "role",
  contacts: "liên hệ",
};

function objectId(value) {
  return value instanceof ObjectId
    ? value
    : ObjectId.isValid(value)
      ? new ObjectId(value)
      : null;
}
function idFilter(fields, id) {
  const values = [id, String(id), new RegExp(`^${String(id)}$`, "i")];
  return { $or: fields.map((field) => ({ [field]: { $in: values } })) };
}
const escapeRegex = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

class ResourceDeletionService {
  constructor(client) {
    this.client = client;
    this.db = client.db();
    this.stockService = new InventoryStockService(client);
  }

  conflict(collection, reason) {
    return new ApiError(
      409,
      `Không thể xóa ${LABELS[collection]} vì đang tồn tại ${reason}.`,
      "RESOURCE_IN_USE",
    );
  }

  referencesFor(collection, data = {}) {
    const refs = [];
    const add = (name, ...ids) =>
      ids
        .flat()
        .filter(Boolean)
        .forEach((id) => refs.push({ collection: name, id }));
    if (["inventory_items", "products"].includes(collection)) {
      add("categories", data.categoryId || data.category_id);
      add("brands", data.brandId || data.brand_id);
      add("manufacturers", data.manufacturerId || data.manufacturer_id);
    }
    if (collection === "products") add("inventory_items", data.inventoryItemId);
    if (collection === "purchase_orders") {
      add("suppliers", data.supplierId);
      add(
        "inventory_items",
        (data.items || []).map((item) => item.inventoryItemId),
      );
      add("users", data.createdBy);
    }
    if (collection === "news") add("news_categories", data.categoryId);
    if (["news", "banners"].includes(collection))
      add("users", data.createdBy, data.updatedBy);
    if (collection === "discounts") {
      add("products", data.applicable?.productIds);
      add("categories", data.applicable?.categoryIds);
    }
    if (collection === "addresses") add("users", data.user_id);
    if (collection === "users") {
      add("roles", data.role_id);
      if (data.role) refs.push({ collection: "roles", code: data.role });
    }
    if (collection === "orders") {
      add("users", data.user_id);
      add("addresses", data.address_id);
      add("shipping_methods", data.shipping_method_id);
      add("discounts", data.discount?.discount_id);
      add(
        "products",
        (data.items || []).map((item) => item.product_id || item.productId),
      );
    }
    if (["products", "news", "banners"].includes(collection)) {
      const content = [
        data.link,
        data.content,
        data.summary,
        data.description,
        data.shortDescription,
      ]
        .filter(Boolean)
        .join(" ");
      for (const match of content.matchAll(
        /\/(products|blog)\/([a-zA-Z0-9_-]+)(?=[/?#\s"'<>]|$)/g,
      )) {
        const name = match[1] === "products" ? "products" : "news";
        if (name === collection && data.slug === match[2]) continue;
        refs.push(
          ObjectId.isValid(match[2])
            ? { collection: name, id: match[2] }
            : { collection: name, slug: match[2] },
        );
      }
      for (const match of content.matchAll(
        /(?:[?&]|&amp;)category_id=([a-fA-F0-9]{24})(?=[&#\s"'<>]|$)/g,
      ))
        add("categories", match[1]);
      for (const match of content.matchAll(
        /\/blog\?[^\s"'<>]*category=([a-fA-F0-9]{24})(?=[&#\s"'<>]|$)/g,
      ))
        add("news_categories", match[1]);
    }
    return refs;
  }

  // Reference writers and DELETE must conflict on the same Mongo document.
  // Snapshot reads alone cannot prevent a concurrent insert becoming an orphan.
  async withReferences(references, callback, options = {}) {
    const work = async (session) => {
      const unique = new Map();
      for (const ref of references) {
        if (!ref.id && !ref.slug && !ref.code) continue;
        const key = ref.slug ? "slug" : ref.code ? "code" : null;
        const target = key
          ? await this.db
              .collection(ref.collection)
              .findOne({ [key]: ref[key] }, { session, projection: { _id: 1 } })
          : null;
        const id = key ? target?._id : objectId(ref.id);
        if (key && !id)
          throw new ApiError(
            409,
            `Không thể lưu vì ${LABELS[ref.collection]} tham chiếu không còn tồn tại.`,
            "REFERENCE_NOT_FOUND",
          );
        if (!id || !Object.hasOwn(POLICIES, ref.collection))
          throw new ApiError(
            400,
            "Tham chiếu dữ liệu không hợp lệ.",
            "INVALID_REFERENCE",
          );
        unique.set(`${ref.collection}:${id}`, { ...ref, id });
      }
      for (const [, ref] of [...unique].sort(([a], [b]) =>
        a.localeCompare(b),
      )) {
        const result = await this.db
          .collection(ref.collection)
          .updateOne(
            { _id: ref.id },
            { $inc: { referenceVersion: 1 } },
            { session },
          );
        if (!result.matchedCount)
          throw new ApiError(
            409,
            `Không thể lưu vì ${LABELS[ref.collection]} tham chiếu không còn tồn tại.`,
            "REFERENCE_NOT_FOUND",
          );
      }
      return callback(session);
    };
    if (options.session) return work(options.session);
    const session = this.client.startSession();
    try {
      return await session.withTransaction(() => work(session));
    } finally {
      await session.endSession();
    }
  }

  async assertReferences(collection, document, session) {
    const id = document._id;
    for (const rule of POLICIES[collection]) {
      const found = await this.db
        .collection(rule.collection)
        .findOne(idFilter(rule.fields, id), {
          session,
          projection: { _id: 1 },
        });
      if (found) throw this.conflict(collection, rule.message);
    }
    if (collection === "roles") {
      if (document.is_system)
        throw new ApiError(
          409,
          "Không thể xóa role hệ thống.",
          "RESOURCE_PROTECTED",
        );
      if (
        await this.db
          .collection("users")
          .findOne({ role: document.code }, { session, projection: { _id: 1 } })
      )
        throw this.conflict(collection, "người dùng đang được gán role");
    }
    if (collection === "discounts") {
      if (Number(document.usedCount || 0) > 0)
        throw this.conflict(collection, "lịch sử sử dụng mã giảm giá");
      if (document.code) {
        for (const [name, fields] of [
          ["orders", ["discount.code", "discountCode", "discount_code"]],
          ["payment_intents", ["discountCode"]],
          ["user_discounts", ["code"]],
        ]) {
          if (
            await this.db
              .collection(name)
              .findOne(
                { $or: fields.map((field) => ({ [field]: document.code })) },
                { session, projection: { _id: 1 } },
              )
          )
            throw this.conflict(
              collection,
              "đơn hàng hoặc thanh toán sử dụng mã giảm giá",
            );
        }
      }
    }
    if (["users", "contacts"].includes(collection)) {
      const prefix =
        collection === "users"
          ? `^(?:activation:${id}$|password-reset:${id}:)`
          : `^(?:contact-notification:${id}$|contact-reply:${id}:)`;
      if (
        await this.db
          .collection("outbox_events")
          .findOne(
            { idempotencyKey: new RegExp(prefix) },
            { session, projection: { _id: 1 } },
          )
      )
        throw this.conflict(collection, "lịch sử hoặc tác vụ outbox liên quan");
    }
    if (collection === "inventory_items") {
      const summaries = await this.db
        .collection("inventory_summaries")
        .find(idFilter(["inventoryItemId", "inventory_item_id"], id), {
          session,
        })
        .toArray();
      if (
        summaries.some((summary) =>
          [
            "quantity",
            "totalQuantity",
            "availableQuantity",
            "lockedQuantity",
            "expiredQuantity",
          ].some(
            (field) =>
              summary[field] != null &&
              (!Number.isFinite(Number(summary[field])) ||
                Number(summary[field]) !== 0),
          ),
        )
      )
        throw this.conflict(collection, "số dư tồn kho cần được đối chiếu");
    }
    await this.assertCmsLinks(collection, document, session);
  }

  async assertCmsLinks(collection, document, session) {
    if (
      !["products", "categories", "news", "news_categories"].includes(
        collection,
      )
    )
      return;
    const id = String(document._id);
    let patterns;
    if (collection === "categories")
      patterns = [`category_id=${escapeRegex(id)}(?:[&#"'\\s<>]|$)`];
    else if (collection === "news_categories")
      patterns = [
        `/blog\\?[^"'<>\\s]*category=${escapeRegex(id)}(?:[&#"'\\s<>]|$)`,
      ];
    else {
      const prefix = collection === "products" ? "products" : "blog";
      patterns = [id, document.slug]
        .filter(Boolean)
        .map((value) => `/${prefix}/${escapeRegex(value)}(?:[/?#"'\\s<>]|$)`);
    }
    const regex = new RegExp(patterns.join("|"), "i");
    for (const [name, fields] of [
      ["banners", ["link"]],
      ["news", ["content", "summary"]],
      ["products", ["description", "shortDescription"]],
    ]) {
      const filter = { $or: fields.map((field) => ({ [field]: regex })) };
      if (name === collection) filter._id = { $ne: document._id };
      if (
        await this.db
          .collection(name)
          .findOne(filter, { session, projection: { _id: 1 } })
      )
        throw this.conflict(collection, "liên kết CMS tham chiếu dữ liệu này");
    }
  }

  async remove(collection, value, options = {}) {
    if (!Object.hasOwn(POLICIES, collection))
      throw new ApiError(
        400,
        "Không cho phép xóa dữ liệu lịch sử.",
        "DELETE_NOT_ALLOWED",
      );
    const id = objectId(value);
    if (!id) return null;
    const remove = async (session) => {
      const document = await this.db
        .collection(collection)
        .findOne({ _id: id }, { session });
      if (!document) return null;
      if (collection === "users" && String(options.actorId) === String(id))
        throw new ApiError(
          409,
          "Không thể xóa tài khoản đang đăng nhập.",
          "RESOURCE_PROTECTED",
        );
      // Share the inventory serialization lock with import/export/checkout.
      // A rejected deletion rolls back the version write as well as cleanup.
      if (collection === "inventory_items")
        await this.stockService.acquireItem(id, session);
      if (collection === "products" && objectId(document.inventoryItemId)) {
        const parent = await this.db
          .collection("inventory_items")
          .findOne({ _id: objectId(document.inventoryItemId) }, { session });
        if (parent) await this.stockService.acquireItem(parent._id, session);
      }
      await this.assertReferences(collection, document, session);
      if (collection === "inventory_items")
        await this.db
          .collection("inventory_summaries")
          .deleteMany(idFilter(["inventoryItemId", "inventory_item_id"], id), {
            session,
          });
      if (collection === "roles")
        await this.db
          .collection("role_permissions")
          .deleteMany(idFilter(["role_id", "roleId"], id), { session });
      return this.db
        .collection(collection)
        .findOneAndDelete({ _id: id }, { session });
    };
    if (options.session) return remove(options.session);
    const session = this.client.startSession();
    try {
      return await session.withTransaction(() => remove(session));
    } finally {
      await session.endSession();
    }
  }
}

module.exports = ResourceDeletionService;
