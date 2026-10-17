const ResourceDeletionService = require("./resource-deletion.service");
const { ObjectId } = require("mongodb");
const ApiError = require("../api-error");
const PurchaseOrderRepository = require("../repositories/purchase-order.repository");
const InventoryItemRepository = require("../repositories/inventory-item.repository");
const InventoryService = require("./inventory.service");
const validator = require("../validators/purchase-order.validator");
const { isInventoryItemActive } = require("../utils/inventory-query.util");

function toObjectId(id) {
  if (id instanceof ObjectId) return id;
  return ObjectId.isValid(id) ? new ObjectId(id) : null;
}

function makePurchaseCode() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  // A three-digit random suffix can collide for receipts created in one second.
  const suffix = new ObjectId().toHexString();
  return `PN${y}${m}${d}-${suffix}`;
}

function isPurchaseCodeCollision(error) {
  return error?.code === 11000 &&
    (error.keyPattern?.purchaseCode || error.keyValue?.purchaseCode !== undefined ||
      /purchaseCode_1/.test(error.message || ""));
}

class PurchaseOrderService {
  constructor(client) {
    this.client = client;
    this.deletion = new ResourceDeletionService(client);
    this.repository = new PurchaseOrderRepository(client);
    this.inventoryItemRepository = new InventoryItemRepository(client);
    this.inventoryService = new InventoryService(client);
  }

  generatePurchaseCode() {
    return makePurchaseCode();
  }

  getActorId(user, payload = {}) {
    return toObjectId(user?.id || user?._id || payload.createdBy) || null;
  }

  async normalizeItems(items = []) {
    const normalized = [];

    for (const item of items) {
      const inventoryItemId = toObjectId(item.inventoryItemId);
      if (!inventoryItemId)
        throw new ApiError(400, "inventoryItemId khong hop le");

      const inventoryItem =
        await this.inventoryItemRepository.findById(inventoryItemId);
      if (!isInventoryItemActive(inventoryItem)) {
        throw new ApiError(400, "Hang kho khong ton tai hoac khong hoat dong");
      }

      const quantity = Number(item.quantity || 0);
      const importPrice = Number(item.importPrice || 0);
      const totalPrice = quantity * importPrice;

      normalized.push({
        _id: new ObjectId(),
        inventoryItemId,
        itemCode: inventoryItem.itemCode,
        itemName: inventoryItem.itemName,
        unit: inventoryItem.unit,
        packageSize: inventoryItem.packageSize || "",
        quantity,
        importPrice,
        totalPrice,
        batchNumber: String(item.batchNumber || "").trim(),
        manufacturingDate: item.manufacturingDate
          ? new Date(item.manufacturingDate)
          : null,
        expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
        warehouseLocation: String(item.warehouseLocation || "").trim(),
      });
    }

    return normalized;
  }

  async extractData(payload = {}, user = null, options = {}) {
    const includeCreatedAt = options.includeCreatedAt !== false;
    const now = new Date();
    const data = {
      purchaseCode:
        payload.purchaseCode !== undefined
          ? String(payload.purchaseCode).trim()
          : undefined,
      supplierId:
        payload.supplierId !== undefined
          ? toObjectId(payload.supplierId)
          : undefined,
      createdBy: includeCreatedAt ? this.getActorId(user, payload) : undefined,
      note:
        payload.note !== undefined ? String(payload.note).trim() : undefined,
      updatedAt: now,
    };

    if (payload.items !== undefined) {
      data.items = await this.normalizeItems(payload.items);
      data.totalAmount = data.items.reduce(
        (sum, item) => sum + Number(item.totalPrice || 0),
        0,
      );
    }

    if (includeCreatedAt) {
      data.purchaseCode = data.purchaseCode || this.generatePurchaseCode();
      data.status = "draft";
      data.importedAt = null;
      data.createdAt = now;
    }

    Object.keys(data).forEach((key) => {
      if (data[key] === undefined || data[key] === "") delete data[key];
    });

    return data;
  }

  buildFilter(query = {}) {
    const filter = {};
    if (query.status) filter.status = query.status;
    if (query.supplierId) filter.supplierId = toObjectId(query.supplierId);
    return filter;
  }

  async find(query = {}) {
    return this.repository.findList(this.buildFilter(query), {
      sort: { createdAt: -1 },
    });
  }

  async findById(id) {
    return this.repository.findById(id);
  }

  async create(payload, user) {
    const message = validator.validateCreate(payload);
    if (message) throw new ApiError(400, message);

    const data = await this.extractData(payload, user);
    const generated = !String(payload.purchaseCode || "").trim();
    if (!generated && await this.repository.findByPurchaseCode(data.purchaseCode))
      throw new ApiError(400, "purchaseCode da ton tai", "DUPLICATE_PURCHASE_CODE");

    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        return await this.deletion.withReferences(this.deletion.referencesFor("purchase_orders", data),
          async (session) => {
            await this.assertActiveItems(data.items, session);
            return this.repository.create(data, { session });
          });
      } catch (error) {
        if (!isPurchaseCodeCollision(error)) throw error;
        if (!generated) throw new ApiError(400, "purchaseCode da ton tai", "DUPLICATE_PURCHASE_CODE");
        if (attempt === 4) throw new ApiError(409, "Không thể tạo mã phiếu duy nhất, vui lòng thử lại.", "PURCHASE_CODE_CONFLICT");
        // Retry the entire aborted transaction with a new code, never rename an existing receipt.
        data.purchaseCode = this.generatePurchaseCode();
      }
    }
  }

  async assertActiveItems(items = [], session) {
    for (const item of items) {
      const current = await this.inventoryItemRepository.findById(item.inventoryItemId, { session });
      if (!isInventoryItemActive(current)) throw new ApiError(400, "Hang kho khong ton tai hoac khong hoat dong");
    }
  }

  async update(id, payload, user) {
    const message = validator.validateUpdate(payload);
    if (message) throw new ApiError(400, message);

    const current = await this.findById(id);
    if (!current) return null;
    if (current.status !== "draft") {
      throw new ApiError(400, "Chi duoc cap nhat phieu nhap dang draft");
    }

    const data = await this.extractData(payload, user, {
      includeCreatedAt: false,
    });

    if (data.purchaseCode && data.purchaseCode !== current.purchaseCode) {
      const duplicate = await this.repository.findByPurchaseCode(
        data.purchaseCode,
      );
      if (duplicate && String(duplicate._id) !== String(current._id)) {
        throw new ApiError(400, "purchaseCode da ton tai");
      }
    }

    return this.deletion.withReferences(this.deletion.referencesFor("purchase_orders", data),
      async (session) => {
        const updated = await this.repository.updateDraftById(id, data, { session });
        await this.assertActiveItems(data.items, session);
        if (!updated) throw new ApiError(409, "Phieu nhap khong con o trang thai draft");
        return updated;
      });
  }

  async confirmImport(id, user) {
    const session = this.client.startSession();
    let result = null;
    try {
      await session.withTransaction(async () => {
        const purchaseOrder = await this.repository.claimDraftForImport(id, {
          session,
        });
        if (!purchaseOrder) {
          const existing = await this.repository.findById(id, { session });
          if (!existing) return;
          if (
            existing.status === "imported" ||
            existing.status === "importing"
          ) {
            throw new ApiError(409, "Phieu nhap da duoc xu ly");
          }
          throw new ApiError(400, "Phieu nhap khong o trang thai draft");
        }

        const imported =
          await this.inventoryService.createImportFromPurchaseOrder(
            purchaseOrder,
            user,
            { session },
          );
        const updated = await this.repository.updateById(
          id,
          {
            status: "imported",
            importedAt: new Date(),
            updatedAt: new Date(),
          },
          { session },
        );
        result = { purchaseOrder: updated, imported };
      });
      return result;
    } finally {
      await session.endSession();
    }
  }

  async cancel(id) {
    const purchaseOrder = await this.findById(id);
    if (!purchaseOrder) return null;

    if (purchaseOrder.status === "cancelled") return purchaseOrder;
    if (purchaseOrder.status !== "draft") {
      throw new ApiError(
        400,
        "Phieu nhap da nhap kho khong the huy o buoc nay",
      );
    }

    const updated = await this.repository.updateDraftById(id, {
      status: "cancelled",
      updatedAt: new Date(),
    });
    if (!updated) throw new ApiError(409, "Phieu nhap khong con o trang thai draft");
    return updated;
  }
}

module.exports = PurchaseOrderService;
