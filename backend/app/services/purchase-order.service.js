const { ObjectId } = require("mongodb");
const ApiError = require("../api-error");
const PurchaseOrderRepository = require("../repositories/purchase-order.repository");
const InventoryItemRepository = require("../repositories/inventory-item.repository");
const InventoryService = require("./inventory.service");
const validator = require("../validators/purchase-order.validator");

function toObjectId(id) {
  if (id instanceof ObjectId) return id;
  return ObjectId.isValid(id) ? new ObjectId(id) : null;
}

function makePurchaseCode() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const suffix = `${now.getHours()}${now.getMinutes()}${now.getSeconds()}${Math.floor(
    Math.random() * 1000,
  )}`;
  return `PN${y}${m}${d}-${suffix}`;
}

class PurchaseOrderService {
  constructor(client) {
    this.repository = new PurchaseOrderRepository(client);
    this.inventoryItemRepository = new InventoryItemRepository(client);
    this.inventoryService = new InventoryService(client);
  }

  getActorId(user, payload = {}) {
    return toObjectId(user?.id || user?._id || payload.createdBy) || null;
  }

  async normalizeItems(items = []) {
    const normalized = [];

    for (const item of items) {
      const inventoryItemId = toObjectId(item.inventoryItemId);
      if (!inventoryItemId) throw new ApiError(400, "inventoryItemId khong hop le");

      const inventoryItem =
        await this.inventoryItemRepository.findById(inventoryItemId);
      if (!inventoryItem || inventoryItem.status === "inactive") {
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
        payload.supplierId !== undefined ? toObjectId(payload.supplierId) : undefined,
      createdBy: includeCreatedAt ? this.getActorId(user, payload) : undefined,
      note: payload.note !== undefined ? String(payload.note).trim() : undefined,
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
      data.purchaseCode = data.purchaseCode || makePurchaseCode();
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
    const duplicate = await this.repository.findByPurchaseCode(data.purchaseCode);
    if (duplicate) throw new ApiError(400, "purchaseCode da ton tai");

    return this.repository.create(data);
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
      const duplicate = await this.repository.findByPurchaseCode(data.purchaseCode);
      if (duplicate && String(duplicate._id) !== String(current._id)) {
        throw new ApiError(400, "purchaseCode da ton tai");
      }
    }

    return this.repository.updateById(id, data);
  }

  async confirmImport(id, user) {
    const purchaseOrder = await this.findById(id);
    if (!purchaseOrder) return null;

    if (purchaseOrder.status === "imported") {
      throw new ApiError(400, "Phieu nhap da duoc nhap kho");
    }

    if (purchaseOrder.status === "cancelled") {
      throw new ApiError(400, "Phieu nhap da bi huy");
    }

    const imported = await this.inventoryService.createImportFromPurchaseOrder(
      purchaseOrder,
      user,
    );

    const updated = await this.repository.updateById(id, {
      status: "imported",
      importedAt: new Date(),
      updatedAt: new Date(),
    });

    return {
      purchaseOrder: updated,
      imported,
    };
  }

  async cancel(id) {
    const purchaseOrder = await this.findById(id);
    if (!purchaseOrder) return null;

    if (purchaseOrder.status === "imported") {
      throw new ApiError(400, "Phieu nhap da nhap kho khong the huy o buoc nay");
    }

    return this.repository.updateById(id, {
      status: "cancelled",
      updatedAt: new Date(),
    });
  }
}

module.exports = PurchaseOrderService;
