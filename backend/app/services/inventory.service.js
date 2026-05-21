const { ObjectId } = require("mongodb");
const ApiError = require("../api-error");
const {
  FEFO_SORT,
  buildAvailableBatchFefoFilter,
  toObjectId,
} = require("../utils/inventory-query.util");

class InventoryService {
  constructor(client) {
    const db = client.db();
    this.InventoryItem = db.collection("inventory_items");
    this.InventoryBatch = db.collection("inventory_batches");
    this.InventorySummary = db.collection("inventory_summaries");
    this.InventoryTransaction = db.collection("inventory_transactions");
  }

  getActorId(user) {
    return toObjectId(user?.id || user?._id) || null;
  }

  async increaseSummary(inventoryItem, quantity) {
    const itemId = toObjectId(inventoryItem.inventoryItemId || inventoryItem._id);
    if (!itemId) throw new ApiError(400, "inventoryItemId khong hop le");

    const amount = Number(quantity || 0);
    if (amount <= 0) throw new ApiError(400, "So luong nhap khong hop le");

    const current = await this.InventorySummary.findOne({
      inventoryItemId: itemId,
    });
    const beforeQuantity = Number(current?.availableQuantity || 0);
    const afterQuantity = beforeQuantity + amount;

    await this.InventorySummary.updateOne(
      { inventoryItemId: itemId },
      {
        $set: {
          itemCode: inventoryItem.itemCode,
          itemName: inventoryItem.itemName,
          unit: inventoryItem.unit,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          inventoryItemId: itemId,
          lockedQuantity: 0,
          expiredQuantity: 0,
          minQuantity: Number(inventoryItem.minQuantity || 10),
        },
        $inc: {
          quantity: amount,
          availableQuantity: amount,
        },
      },
      { upsert: true },
    );

    const summary = await this.InventorySummary.findOne({
      inventoryItemId: itemId,
    });

    return {
      summary,
      beforeQuantity,
      afterQuantity,
    };
  }

  async createImportTransaction(data) {
    const transaction = {
      inventoryItemId: toObjectId(data.inventoryItemId),
      batchId: toObjectId(data.batchId),
      itemCode: data.itemCode,
      itemName: data.itemName,
      type: "import",
      quantity: Number(data.quantity || 0),
      beforeQuantity: Number(data.beforeQuantity || 0),
      afterQuantity: Number(data.afterQuantity || 0),
      reference: data.reference || null,
      note: data.note || "",
      createdBy: toObjectId(data.createdBy),
      createdAt: new Date(),
    };

    const result = await this.InventoryTransaction.insertOne(transaction);
    return {
      _id: result.insertedId,
      ...transaction,
    };
  }

  async createImportFromPurchaseOrder(purchaseOrder, user) {
    if (!purchaseOrder?._id) {
      throw new ApiError(400, "Phieu nhap khong hop le");
    }

    const imported = [];
    const createdBy = this.getActorId(user) || toObjectId(purchaseOrder.createdBy);

    for (const item of purchaseOrder.items || []) {
      const inventoryItemId = toObjectId(item.inventoryItemId);
      if (!inventoryItemId) {
        throw new ApiError(400, "inventoryItemId khong hop le");
      }

      const quantity = Number(item.quantity || 0);
      if (quantity <= 0) throw new ApiError(400, "So luong nhap khong hop le");

      const batch = {
        inventoryItemId,
        supplierId: toObjectId(purchaseOrder.supplierId),
        purchaseOrderId: purchaseOrder._id,
        purchaseOrderItemId: item._id || new ObjectId(),
        itemCode: item.itemCode,
        itemName: item.itemName,
        unit: item.unit,
        batchNumber: item.batchNumber,
        quantity,
        originalQuantity: quantity,
        importPrice: Number(item.importPrice || 0),
        manufacturingDate: item.manufacturingDate
          ? new Date(item.manufacturingDate)
          : null,
        expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
        warehouseLocation: item.warehouseLocation || "",
        status: "available",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const batchResult = await this.InventoryBatch.insertOne(batch);
      const summaryResult = await this.increaseSummary(
        {
          _id: inventoryItemId,
          itemCode: item.itemCode,
          itemName: item.itemName,
          unit: item.unit,
        },
        quantity,
      );

      const transaction = await this.createImportTransaction({
        inventoryItemId,
        batchId: batchResult.insertedId,
        itemCode: item.itemCode,
        itemName: item.itemName,
        quantity,
        beforeQuantity: summaryResult.beforeQuantity,
        afterQuantity: summaryResult.afterQuantity,
        reference: {
          type: "purchase_order",
          id: purchaseOrder._id,
          code: purchaseOrder.purchaseCode,
        },
        note: `Nhap kho tu phieu ${purchaseOrder.purchaseCode}`,
        createdBy,
      });

      imported.push({
        batch: {
          _id: batchResult.insertedId,
          ...batch,
        },
        summary: summaryResult.summary,
        transaction,
      });
    }

    return imported;
  }

  async getAvailableBatchesFEFO(inventoryItemId, quantity, options = {}) {
    const itemId = toObjectId(inventoryItemId);
    if (!itemId) throw new ApiError(400, "inventoryItemId khong hop le");

    const requiredQuantity = Number(quantity || 0);
    if (requiredQuantity <= 0) {
      throw new ApiError(400, "So luong xuat khong hop le");
    }

    const batches = await this.InventoryBatch.find(
      buildAvailableBatchFefoFilter(itemId, new Date()),
      { session: options.session },
    )
      .sort(FEFO_SORT)
      .toArray();

    let remaining = requiredQuantity;
    const allocation = [];

    for (const batch of batches) {
      if (remaining <= 0) break;

      const available = Number(batch.quantity || 0);
      const allocatedQuantity = Math.min(available, remaining);
      if (allocatedQuantity <= 0) continue;

      allocation.push({
        batchId: batch._id,
        batchNumber: batch.batchNumber,
        inventoryItemId: itemId,
        quantity: allocatedQuantity,
        expiryDate: batch.expiryDate,
        importPrice: Number(batch.importPrice || 0),
      });

      remaining -= allocatedQuantity;
    }

    if (remaining > 0) {
      return {
        ok: false,
        error: "Ton kho khong du de xuat",
        allocation,
        missingQuantity: remaining,
      };
    }

    return { ok: true, allocation };
  }

  async allocateFefo(inventoryItemId, quantity, options = {}) {
    return this.getAvailableBatchesFEFO(inventoryItemId, quantity, options);
  }

  async exportAllocation(allocation, reference, user, options = {}) {
    const rows = Array.isArray(allocation) ? allocation : [allocation];
    const createdBy = this.getActorId(user);
    const results = [];
    const session = options.session;

    for (const row of rows) {
      const batchId = toObjectId(row.batchId);
      const inventoryItemId = toObjectId(row.inventoryItemId);
      const quantity = Number(row.quantity || 0);
      if (!batchId || !inventoryItemId || quantity <= 0) {
        throw new ApiError(400, "Allocation khong hop le");
      }

      const batch = await this.InventoryBatch.findOne(
        { _id: batchId },
        { session },
      );
      if (!batch || Number(batch.quantity || 0) < quantity) {
        throw new ApiError(400, "Lo hang khong du ton kho");
      }

      const nextBatchQuantity = Number(batch.quantity || 0) - quantity;
      const batchUpdate = await this.InventoryBatch.updateOne(
        { _id: batchId, quantity: { $gte: quantity } },
        {
          $inc: { quantity: -quantity },
          $set: {
            status: nextBatchQuantity <= 0 ? "sold_out" : batch.status,
            updatedAt: new Date(),
          },
        },
        { session },
      );
      if (batchUpdate.modifiedCount !== 1) {
        throw new ApiError(400, "Lo hang khong du ton kho");
      }

      const summary = await this.InventorySummary.findOne(
        { inventoryItemId },
        { session },
      );
      const beforeQuantity = Number(summary?.availableQuantity || 0);
      const afterQuantity = beforeQuantity - quantity;

      await this.InventorySummary.updateOne(
        { inventoryItemId },
        {
          $inc: {
            quantity: -quantity,
            availableQuantity: -quantity,
          },
          $set: { updatedAt: new Date() },
        },
        { session },
      );

      const transaction = {
        inventoryItemId,
        batchId,
        itemCode: summary?.itemCode || batch.itemCode,
        itemName: summary?.itemName || batch.itemName,
        type: "export",
        quantity,
        beforeQuantity,
        afterQuantity,
        reference,
        note: "Xuat kho theo phan bo FEFO",
        createdBy,
        createdAt: new Date(),
      };

      const transactionResult = await this.InventoryTransaction.insertOne(
        transaction,
        { session },
      );
      results.push({
        _id: transactionResult.insertedId,
        ...transaction,
      });
    }

    return results;
  }

  async restoreAllocation(allocation, reference, user, options = {}) {
    const rows = Array.isArray(allocation) ? allocation : [allocation];
    const createdBy = this.getActorId(user);
    const results = [];
    const session = options.session;

    for (const row of rows) {
      const batchId = toObjectId(row.batchId);
      const inventoryItemId = toObjectId(row.inventoryItemId);
      const quantity = Number(row.quantity || 0);
      if (!batchId || !inventoryItemId || quantity <= 0) {
        throw new ApiError(400, "Allocation khong hop le");
      }

      const batch = await this.InventoryBatch.findOne(
        { _id: batchId },
        { session },
      );
      await this.InventoryBatch.updateOne(
        { _id: batchId },
        {
          $inc: { quantity },
          $set: {
            status: "available",
            updatedAt: new Date(),
          },
        },
        { session },
      );

      const summary = await this.InventorySummary.findOne(
        { inventoryItemId },
        { session },
      );
      const beforeQuantity = Number(summary?.availableQuantity || 0);
      const afterQuantity = beforeQuantity + quantity;

      await this.InventorySummary.updateOne(
        { inventoryItemId },
        {
          $inc: {
            quantity,
            availableQuantity: quantity,
          },
          $set: { updatedAt: new Date() },
        },
        { session },
      );

      const transaction = {
        inventoryItemId,
        batchId,
        itemCode: summary?.itemCode || batch?.itemCode,
        itemName: summary?.itemName || batch?.itemName,
        type: "cancel",
        quantity,
        beforeQuantity,
        afterQuantity,
        reference,
        note: "Hoan kho tu allocation",
        createdBy,
        createdAt: new Date(),
      };

      const transactionResult = await this.InventoryTransaction.insertOne(
        transaction,
        { session },
      );
      results.push({
        _id: transactionResult.insertedId,
        ...transaction,
      });
    }

    return results;
  }
}

module.exports = InventoryService;
