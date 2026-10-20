const ApiError = require("../api-error");
const InventoryBatchRepository = require("../repositories/inventory-batch.repository");
const InventoryStockService = require("./inventory-stock.service");
const { classifyExpiry, normalizeExpiryDate } = require("../utils/expiry.util");

class InventoryBatchService {
  constructor(client) {
    this.repository = new InventoryBatchRepository(client);
    this.stockService = new InventoryStockService(client);
  }

  buildFilter(query = {}) {
    const filter = {};
    if (query.status) filter.status = query.status;
    if (query.inventoryItemId) {
      filter.inventoryItemId = this.repository.toObjectId(
        query.inventoryItemId,
      );
    }
    return filter;
  }

  async find(query = {}) {
    const rows = await this.repository.findList(this.buildFilter(query), {
      sort: { expiryDate: 1, createdAt: 1 },
    });
    return rows.map(row => ({ ...row, ...classifyExpiry(row.expiryDate instanceof Date ? row.expiryDate : null) }));
  }

  async findById(id) {
    return this.repository.findById(id);
  }

  async setLocked(id, locked) {
    return this.stockService.withTransaction({}, async (session) => {
      const current = await this.repository.findById(id, { session });
      if (!current) throw new ApiError(404, "Khong tim thay lo hang");
      await this.stockService.acquireItem(current.inventoryItemId, session);
      const status = locked
        ? "locked"
          : Number(current.quantity) > 0
            ? "available"
            : "sold_out";
      const batch = await this.repository.updateById(
        id,
        {
          status,
          updatedAt: new Date(),
        },
        { session },
      );
      await this.stockService.syncSummary(current.inventoryItemId, { session });
      return batch;
    });
  }

  async lock(id) {
    return this.setLocked(id, true);
  }

  async unlock(id) {
    return this.setLocked(id, false);
  }

  async correctExpiry(id, payload, user) {
    const expiryDate = normalizeExpiryDate(payload.expiryDate);
    if (!expiryDate || !String(payload.reason || "").trim()) throw new ApiError(400, "Cần hạn sử dụng hợp lệ và lý do điều chỉnh");
    return this.stockService.withTransaction({}, async session => {
      const batch = await this.repository.findById(id, { session });
      if (!batch) throw new ApiError(404, "Không tìm thấy lô");
      if (batch.manufacturingDate && expiryDate <= normalizeExpiryDate(batch.manufacturingDate)) throw new ApiError(400, "Hạn sử dụng phải sau ngày sản xuất");
      await this.stockService.acquireItem(batch.inventoryItemId, session);
      const expiry = classifyExpiry(expiryDate);
      const db = this.stockService.client.db();
      const history = { action: "expiry_corrected", before: batch.expiryDate, after: expiryDate, reason: payload.reason, actorId: require("../utils/inventory-query.util").toObjectId(user?.id || user?._id), at: new Date() };
      await db.collection("inventory_batches").updateOne({ _id: batch._id }, {
        $set: { expiryDate, updatedAt: new Date() }, $push: { history },
      }, { session });
      // Corrections can shorten an already approved offer, never silently extend it.
      await db.collection("discounts").updateMany({ batchId: batch._id, scope: "batch", status: "active" }, {
        $min: { endDate: expiry.sellableUntil }, $set: { updatedAt: new Date() },
      }, { session });
      await db.collection("promotion_proposals").updateMany({ batchId: batch._id, open: true }, {
        $min: { endDate: expiry.sellableUntil }, $push: { history }, $set: { updatedAt: new Date() },
      }, { session });
      await this.stockService.syncSummary(batch.inventoryItemId, { session });
      await new (require("./expiry-monitoring.service"))(this.stockService.client).checkBatch({ ...batch, expiryDate }, { session });
      return { ...batch, expiryDate, ...expiry };
    });
  }
}

module.exports = InventoryBatchService;
