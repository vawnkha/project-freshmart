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
      { key: { transaction_id: 1 } },
      { key: { status: 1, created_at: -1 } },
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
