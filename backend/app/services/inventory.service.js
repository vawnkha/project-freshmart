const { ObjectId } = require("mongodb");
const ApiError = require("../api-error");
const InventoryStockService = require("./inventory-stock.service");
const {
  FEFO_SORT,
  buildAvailableBatchFefoFilter,
  toObjectId,
} = require("../utils/inventory-query.util");

class InventoryService {
  constructor(client) {
    const ResourceDeletionService = require("./resource-deletion.service");
    this.deletion = new ResourceDeletionService(client);
    const db = client.db();
    this.InventoryItem = db.collection("inventory_items");
    this.InventoryBatch = db.collection("inventory_batches");
    this.InventorySummary = db.collection("inventory_summaries");
    this.InventoryTransaction = db.collection("inventory_transactions");
    this.stockService = new InventoryStockService(client);
  }

  getActorId(user) {
    return toObjectId(user?.id || user?._id) || null;
  }

  async increaseSummary(inventoryItem, quantity, options = {}) {
    const itemId = toObjectId(
      inventoryItem.inventoryItemId || inventoryItem._id,
    );
    if (!itemId) throw new ApiError(400, "inventoryItemId khong hop le");

    const amount = Number(quantity || 0);
    if (amount <= 0) throw new ApiError(400, "So luong nhap khong hop le");

    const summary = await this.stockService.syncSummary(itemId, options);
    const afterQuantity = summary.availableQuantity;
    const beforeQuantity = options.beforeQuantity ?? afterQuantity - amount;

    return {
      summary,
      beforeQuantity,
      afterQuantity,
    };
  }

  async createImportTransaction(data, options = {}) {
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

    const result = await this.deletion.withReferences([{ collection: "users", id: transaction.createdBy }],
      (session) => this.InventoryTransaction.insertOne(transaction, { session }), options);
    return {
      _id: result.insertedId,
      ...transaction,
    };
  }

  async createImportFromPurchaseOrder(purchaseOrder, user, options = {}) {
    if (!options.session)
      return this.stockService.withTransaction(options, (session) =>
        this.createImportFromPurchaseOrder(purchaseOrder, user, {
          ...options,
          session,
        }),
      );
    if (!purchaseOrder?._id) {
      throw new ApiError(400, "Phieu nhap khong hop le");
    }

    const imported = [];
    const createdBy =
      this.getActorId(user) || toObjectId(purchaseOrder.createdBy);

    for (const item of purchaseOrder.items || []) {
      const inventoryItemId = toObjectId(item.inventoryItemId);
      if (!inventoryItemId) {
        throw new ApiError(400, "inventoryItemId khong hop le");
      }

      const quantity = Number(item.quantity || 0);
      if (!Number.isFinite(quantity) || quantity <= 0)
        throw new ApiError(400, "So luong nhap khong hop le");
      await this.stockService.acquireItem(inventoryItemId, options.session, {
        requireActive: true,
      });
      const beforeQuantity = (
        await this.stockService.getTotals(inventoryItemId, options)
      ).availableQuantity;

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

      const batchResult = await this.InventoryBatch.insertOne(batch, {
        session: options.session,
      });
      const summaryResult = await this.increaseSummary(
        {
          _id: inventoryItemId,
          itemCode: item.itemCode,
          itemName: item.itemName,
          unit: item.unit,
        },
        quantity,
        { ...options, beforeQuantity },
      );

      const transaction = await this.createImportTransaction(
        {
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
        },
        options,
      );

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
    if (!Number.isFinite(requiredQuantity) || requiredQuantity <= 0) {
      throw new ApiError(400, "So luong xuat khong hop le");
    }

    const batches = await this.InventoryBatch.aggregate(
      [
        {
          $match: buildAvailableBatchFefoFilter(
            itemId,
            options.now || new Date(),
          ),
        },
        {
          $addFields: {
            fefoExpiry: {
              $ifNull: ["$expiryDate", new Date("9999-12-31T00:00:00Z")],
            },
          },
        },
        { $sort: FEFO_SORT },
      ],
      { session: options.session },
    ).toArray();

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
    if (!options.session)
      return this.stockService.withTransaction(options, (session) =>
        this.exportAllocation(allocation, reference, user, {
          ...options,
          session,
        }),
      );
    const rows = Array.isArray(allocation) ? allocation : [allocation];
    const createdBy = this.getActorId(user);
    const results = [];
    const session = options.session;

    for (const row of rows) {
      const batchId = toObjectId(row.batchId);
      const inventoryItemId = toObjectId(row.inventoryItemId);
      const quantity = Number(row.quantity || 0);
      if (
        !batchId ||
        !inventoryItemId ||
        !Number.isFinite(quantity) ||
        quantity <= 0
      ) {
        throw new ApiError(400, "Allocation khong hop le");
      }

      await this.stockService.acquireItem(inventoryItemId, session, {
        requireActive: true,
      });
      const filter = {
        ...buildAvailableBatchFefoFilter(inventoryItemId),
        _id: batchId,
        quantity: { $gte: quantity },
      };
      const beforeQuantity = (
        await this.stockService.getTotals(inventoryItemId, { session })
      ).availableQuantity;
      const batch = await this.InventoryBatch.findOne(filter, { session });
      if (!batch || Number(batch.quantity || 0) < quantity) {
        throw new ApiError(409, "Lo hang khong kha dung hoac khong du ton kho");
      }

      const nextBatchQuantity = Number(batch.quantity || 0) - quantity;
      const batchUpdate = await this.InventoryBatch.updateOne(
        filter,
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

      const summary = await this.stockService.syncSummary(inventoryItemId, {
        session,
      });
      const afterQuantity = summary.availableQuantity;

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

      const transactionResult = await this.deletion.withReferences([{ collection: "users", id: createdBy }],
        () => this.InventoryTransaction.insertOne(transaction, { session }), { session });
      results.push({
        _id: transactionResult.insertedId,
        ...transaction,
      });
    }

    return results;
  }

  async restoreAllocation(allocation, reference, user, options = {}) {
    if (!options.session)
      return this.stockService.withTransaction(options, (session) =>
        this.restoreAllocation(allocation, reference, user, {
          ...options,
          session,
        }),
      );
    const rows = Array.isArray(allocation) ? allocation : [allocation];
    const createdBy = this.getActorId(user);
    const results = [];
    const session = options.session;

    for (const row of rows) {
      const batchId = toObjectId(row.batchId);
      const inventoryItemId = toObjectId(row.inventoryItemId);
      const quantity = Number(row.quantity || 0);
      if (
        !batchId ||
        !inventoryItemId ||
        !Number.isFinite(quantity) ||
        quantity <= 0
      ) {
        throw new ApiError(400, "Allocation khong hop le");
      }

      await this.stockService.acquireItem(inventoryItemId, session);
      const beforeQuantity = (
        await this.stockService.getTotals(inventoryItemId, { session })
      ).availableQuantity;
      const batch = await this.InventoryBatch.findOne(
        { _id: batchId, inventoryItemId },
        { session },
      );
      if (!batch) throw new ApiError(409, "Lo hang hoan kho khong ton tai");
      // Returning an order never unlocks a quarantined/disabled batch.
      const expired =
        batch.expiryDate && new Date(batch.expiryDate) < new Date();
      const restoredStatus = ["available", "sold_out"].includes(batch.status)
        ? expired
          ? "expired"
          : "available"
        : batch.status;
      await this.InventoryBatch.updateOne(
        { _id: batchId, inventoryItemId },
        {
          $inc: { quantity },
          $set: {
            status: restoredStatus,
            updatedAt: new Date(),
          },
        },
        { session },
      );

      const summary = await this.stockService.syncSummary(inventoryItemId, {
        session,
      });
      const afterQuantity = summary.availableQuantity;

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

      const transactionResult = await this.deletion.withReferences([{ collection: "users", id: createdBy }],
        () => this.InventoryTransaction.insertOne(transaction, { session }), { session });
      results.push({
        _id: transactionResult.insertedId,
        ...transaction,
      });
    }

    return results;
  }
}

module.exports = InventoryService;
