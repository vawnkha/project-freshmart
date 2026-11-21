const ApiError = require('../api-error');
const InventoryItemRepository = require('../repositories/inventory-item.repository');
const { warehouseProductStages, latestImportPriceStages } = require('../utils/warehouse-product.util');
const { buildBatchStockLookup, EMPTY_STOCK } = require('../utils/inventory-query.util');

class InventoryItemService {
  constructor(client) {
    this.repository = new InventoryItemRepository(client);
    this.client = client;
  }

  async find(query = {}) {
    const rows = await this.repository.collection().aggregate([
      ...warehouseProductStages(),
      buildBatchStockLookup('_id'),
      { $set: { totals: { $ifNull: [{ $arrayElemAt: ['$batchStock', 0] }, EMPTY_STOCK] } } },
      ...latestImportPriceStages('_id'),
      { $set: {
        quantity: '$totals.quantity', availableQuantity: '$totals.availableQuantity',
        lockedQuantity: '$totals.lockedQuantity', expiredQuantity: '$totals.expiredQuantity',
      } },
      { $unset: ['totals', 'batchStock', 'technicalSpecs'] },
      { $sort: { createdAt: -1, _id: -1 } },
    ]).toArray();
    const keyword = String(query.keyword || '').trim().toLocaleLowerCase();
    return rows.filter(row =>
      (!query.status || (row.status || 'active') === query.status) &&
      (!query.categoryId || String(row.categoryId) === query.categoryId) &&
      (!query.itemType || row.itemType === query.itemType) &&
      (!keyword || `${row.itemCode || ''} ${row.itemName || ''}`.toLocaleLowerCase().includes(keyword)));
  }

  async findById(id) {
    return (await this.find()).find(row => String(row._id) === String(id)) || null;
  }

  async create() {
    throw new ApiError(409, 'Tạo sản phẩm tại Quản lý sản phẩm. Hồ sơ kho được tạo tự động.');
  }

  async update() {
    throw new ApiError(409, 'Thông tin sản phẩm được chỉnh sửa tại Quản lý sản phẩm.');
  }

  async delete(id) {
    return new (require('./resource-deletion.service'))(this.client).remove('inventory_items', id);
  }
}

module.exports = InventoryItemService;
