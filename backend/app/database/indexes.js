const INDEX_DEFINITIONS = [
  {
    collection: "users",
    indexes: [
      { key: { email: 1 }, options: { unique: true } },
      { key: { created_at: -1 } },
      { key: { role_id: 1 } },
    ],
  },
  {
    collection: "categories",
    indexes: [
      { key: { slug: 1 }, options: { unique: true } },
      { key: { created_at: -1 } },
    ],
  },
  {
    collection: "products",
    indexes: [
      { key: { created_at: -1 } },
      { key: { category_id: 1 } },
      {
        key: { inventoryItemId: 1 },
        options: {
          unique: true,
          partialFilterExpression: { inventoryItemId: { $type: "objectId" } },
        },
      },
      { key: { search_text: 1 } },
      {
        key: {
          name: "text",
          description: "text",
          search_text: "text",
          shortDescription: "text",
        },
        options: { name: "products_text_search" },
      },
    ],
  },
  {
    collection: "carts",
    indexes: [
      { key: { user_id: 1 }, options: { unique: true } },
      { key: { updated_at: -1 } },
    ],
  },
  {
    collection: "wishlists",
    indexes: [{ key: { user_id: 1 }, options: { unique: true } }],
  },
  {
    collection: "addresses",
    indexes: [
      { key: { user_id: 1, created_at: -1 } },
      { key: { user_id: 1, is_default: 1 } },
    ],
  },
  {
    collection: "orders",
    indexes: [
      { key: { user_id: 1, created_at: -1 } },
      { key: { status: 1, created_at: -1 } },
    ],
  },
  {
    collection: "payments",
    indexes: [
      { key: { order_id: 1 }, options: { unique: true, sparse: true } },
      {
        key: { transaction_id: 1 },
        options: {
          unique: true,
          partialFilterExpression: { transaction_id: { $type: "string" } },
        },
      },
      {
        key: { idempotency_key: 1 },
        options: {
          unique: true,
          partialFilterExpression: { idempotency_key: { $type: "string" } },
        },
      },
      { key: { user_id: 1, created_at: -1 } },
      { key: { status: 1, created_at: -1 } },
    ],
  },
  {
    collection: "payment_intents",
    indexes: [
      { key: { paypalOrderId: 1 }, options: { unique: true } },
      { key: { userId: 1, createdAt: -1 } },
      { key: { status: 1, updatedAt: -1 } },
      { key: { expiresAt: 1 } },
    ],
  },
  {
    collection: "reviews",
    indexes: [
      { key: { product_id: 1, created_at: -1 } },
      { key: { user_id: 1, product_id: 1 }, options: { unique: true } },
    ],
  },
  {
    collection: "roles",
    indexes: [
      {
        key: { code: 1 },
        options: {
          unique: true,
          partialFilterExpression: { code: { $type: "string" } },
        },
      },
      { key: { status: 1 } },
    ],
  },
  {
    collection: "permissions",
    indexes: [
      {
        key: { key: 1 },
        options: {
          unique: true,
          partialFilterExpression: { key: { $type: "string" } },
        },
      },
      { key: { group: 1, key: 1 } },
    ],
  },
  {
    collection: "role_permissions",
    indexes: [
      { key: { role_id: 1, permission_id: 1 }, options: { unique: true } },
      { key: { permission_id: 1 } },
    ],
  },
  {
    collection: "contacts",
    indexes: [
      { key: { status: 1, created_at: -1 } },
      { key: { email: 1, created_at: -1 } },
    ],
  },
  {
    collection: "notifications",
    indexes: [
      { key: { is_read: 1, created_at: -1 } },
      { key: { type: 1, created_at: -1 } },
      {
        key: { outbox_event_id: 1 },
        options: {
          unique: true,
          partialFilterExpression: { outbox_event_id: { $type: "objectId" } },
        },
      },
    ],
  },
  {
    collection: "outbox_events",
    indexes: [
      { key: { idempotencyKey: 1 }, options: { unique: true } },
      { key: { status: 1, nextAttemptAt: 1, createdAt: 1 } },
      { key: { processedAt: 1 } },
    ],
  },
  {
    collection: "inventory_items",
    indexes: [
      { key: { itemCode: 1 }, options: { unique: true } },
      { key: { barcode: 1 }, options: { unique: true, sparse: true } },
      { key: { categoryId: 1, status: 1 } },
      { key: { brandId: 1, status: 1 } },
      { key: { manufacturerId: 1, status: 1 } },
      { key: { status: 1 } },
      {
        key: { itemName: "text", itemCode: "text" },
        options: { name: "inventory_items_text_search" },
      },
    ],
  },
  {
    collection: "brands",
    indexes: [
      { key: { code: 1 }, options: { unique: true, sparse: true } },
      { key: { status: 1 } },
    ],
  },
  {
    collection: "manufacturers",
    indexes: [
      { key: { code: 1 }, options: { unique: true, sparse: true } },
      { key: { status: 1 } },
    ],
  },
  {
    collection: "suppliers",
    indexes: [
      { key: { code: 1 }, options: { unique: true, sparse: true } },
      { key: { status: 1 } },
    ],
  },
  {
    collection: "shipping_methods",
    indexes: [
      { key: { code: 1 }, options: { unique: true, sparse: true } },
      { key: { status: 1 } },
      { key: { fee: 1 } },
      { key: { createdAt: -1 } },
    ],
  },
  {
    collection: "discounts",
    indexes: [
      { key: { code: 1 }, options: { unique: true } },
      { key: { status: 1, startDate: 1, endDate: 1 } },
      { key: { scope: 1, status: 1 } },
      { key: { "applicable.productIds": 1 } },
      { key: { "applicable.categoryIds": 1 } },
      { key: { createdAt: -1 } },
    ],
  },
  {
    collection: "user_discounts",
    indexes: [
      { key: { userId: 1, discountId: 1 } },
      { key: { discountId: 1, usedAt: -1 } },
      { key: { userId: 1, usedAt: -1 } },
      { key: { orderId: 1 } },
    ],
  },
  {
    collection: "news_categories",
    indexes: [
      { key: { slug: 1 }, options: { unique: true } },
      { key: { status: 1 } },
      { key: { createdAt: -1 } },
    ],
  },
  {
    collection: "news",
    indexes: [
      { key: { slug: 1 }, options: { unique: true } },
      { key: { categoryId: 1 } },
      { key: { status: 1 } },
      { key: { publishedAt: -1 } },
      { key: { tags: 1 } },
      { key: { createdAt: -1 } },
    ],
  },
  {
    collection: "banners",
    indexes: [
      { key: { status: 1 } },
      { key: { position: 1 } },
      { key: { sortOrder: 1 } },
      { key: { startDate: 1 } },
      { key: { endDate: 1 } },
      { key: { position: 1, status: 1, sortOrder: 1 } },
      { key: { createdAt: -1 } },
    ],
  },
  {
    collection: "purchase_orders",
    indexes: [
      { key: { purchaseCode: 1 }, options: { unique: true } },
      { key: { supplierId: 1, createdAt: -1 } },
      { key: { createdBy: 1, createdAt: -1 } },
      { key: { status: 1, createdAt: -1 } },
      { key: { "items.inventoryItemId": 1 } },
    ],
  },
  {
    collection: "inventory_batches",
    indexes: [
      { key: { batchNumber: 1 } },
      { key: { expiryDate: 1, status: 1 } },
      { key: { supplierId: 1 } },
      { key: { purchaseOrderId: 1 } },
      {
        key: { purchaseOrderId: 1, purchaseOrderItemId: 1 },
        options: {
          unique: true,
          partialFilterExpression: {
            purchaseOrderId: { $type: "objectId" },
            purchaseOrderItemId: { $type: "objectId" },
          },
        },
      },
      { key: { inventoryItemId: 1, status: 1, expiryDate: 1 } },
      { key: { inventoryItemId: 1 } },
    ],
  },
  {
    collection: "inventory_summaries",
    indexes: [
      { key: { inventoryItemId: 1 }, options: { unique: true } },
      { key: { itemCode: 1 } },
      { key: { quantity: 1 } },
    ],
  },
  {
    collection: "inventory_transactions",
    indexes: [
      { key: { inventoryItemId: 1, createdAt: -1 } },
      { key: { batchId: 1, createdAt: -1 } },
      { key: { "reference.type": 1, "reference.id": 1 } },
      { key: { createdBy: 1, createdAt: -1 } },
      { key: { type: 1, createdAt: -1 } },
    ],
  },
];

async function ensureMongoIndexes(client) {
  const db = client.db();
  const results = [];

  for (const definition of INDEX_DEFINITIONS) {
    const collection = db.collection(definition.collection);

    for (const index of definition.indexes) {
      const name = await collection.createIndex(index.key, index.options || {});
      results.push({
        collection: definition.collection,
        name,
      });
    }
  }

  return results;
}

module.exports = {
  INDEX_DEFINITIONS,
  ensureMongoIndexes,
};
