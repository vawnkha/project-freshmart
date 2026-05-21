const BaseRepository = require("./base.repository");

class ProductRepository extends BaseRepository {
  constructor(client) {
    super(client, "products");
  }

  findByCategoryId(categoryId, options = {}) {
    const category_id = this.toObjectId(categoryId);
    return this.findList({ category_id }, options);
  }

  findByInventoryItemId(inventoryItemId, options = {}) {
    const itemId = this.toObjectId(inventoryItemId);
    if (!itemId) return null;
    return this.findOne({ inventoryItemId: itemId }, options);
  }

  findByInventoryItemIdExcept(inventoryItemId, productId, options = {}) {
    const itemId = this.toObjectId(inventoryItemId);
    const excludedId = this.toObjectId(productId);
    if (!itemId) return null;

    const filter = { inventoryItemId: itemId };
    if (excludedId) filter._id = { $ne: excludedId };

    return this.findOne(filter, options);
  }
}

module.exports = ProductRepository;
