const ResourceDeletionService = require("./resource-deletion.service");
const { ObjectId } = require("mongodb");
const ApiError = require("../api-error");
const InventoryItemRepository = require("../repositories/inventory-item.repository");
const validator = require("../validators/inventory-item.validator");

function toObjectId(id) {
  if (id instanceof ObjectId) return id;
  return ObjectId.isValid(id) ? new ObjectId(id) : null;
}

class InventoryItemService {
  constructor(client) {
    this.deletion = new ResourceDeletionService(client);
    this.repository = new InventoryItemRepository(client);
  }

  extractData(payload = {}, options = {}) {
    const includeCreatedAt = options.includeCreatedAt !== false;
    const now = new Date();
    const data = {
      categoryId:
        payload.categoryId !== undefined ? toObjectId(payload.categoryId) : undefined,
      brandId: payload.brandId !== undefined ? toObjectId(payload.brandId) : undefined,
      manufacturerId:
        payload.manufacturerId !== undefined
          ? toObjectId(payload.manufacturerId)
          : undefined,
      itemCode:
        payload.itemCode !== undefined ? String(payload.itemCode).trim() : undefined,
      itemName:
        payload.itemName !== undefined ? String(payload.itemName).trim() : undefined,
      itemType:
        payload.itemType !== undefined ? String(payload.itemType).trim() : undefined,
      barcode:
        payload.barcode !== undefined ? String(payload.barcode).trim() : undefined,
      packageSize:
        payload.packageSize !== undefined
          ? String(payload.packageSize).trim()
          : undefined,
      unit: payload.unit !== undefined ? String(payload.unit).trim() : undefined,
      storageInstruction:
        payload.storageInstruction !== undefined
          ? String(payload.storageInstruction).trim()
          : undefined,
      expiryMonths:
        payload.expiryMonths !== undefined
          ? (payload.expiryMonths === null ? null : Number(payload.expiryMonths))
          : undefined,
      note: payload.note !== undefined ? String(payload.note).trim() : undefined,
      status:
        payload.status !== undefined ? String(payload.status).trim() : undefined,
      createdAt: includeCreatedAt ? now : undefined,
      updatedAt: now,
    };

    Object.keys(data).forEach((key) => {
      if (data[key] === undefined || (data[key] === "" && includeCreatedAt)) delete data[key];
    });

    return data;
  }

  buildFilter(query = {}) {
    const filter = {};
    if (query.status) filter.status = query.status;
    if (query.itemType) filter.itemType = query.itemType;
    if (query.categoryId) filter.categoryId = toObjectId(query.categoryId);

    if (query.keyword) {
      const keyword = String(query.keyword).trim();
      filter.$or = [
        { itemCode: { $regex: keyword, $options: "i" } },
        { itemName: { $regex: keyword, $options: "i" } },
      ];
    }

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

  async create(payload) {
    const message = validator.validateCreate(payload);
    if (message) throw new ApiError(400, message);

    const data = this.extractData(payload);
    data.status = data.status || "active";

    const existed = await this.repository.findByItemCode(data.itemCode);
    if (existed) throw new ApiError(400, "itemCode da ton tai");

    return this.deletion.withReferences(this.deletion.referencesFor("inventory_items", data),
      (session) => this.repository.create(data, { session }));
  }

  async update(id, payload) {
    const message = validator.validateUpdate(payload);
    if (message) throw new ApiError(400, message);

    const current = await this.findById(id);
    if (!current) return null;

    const data = this.extractData(payload, { includeCreatedAt: false });

    if (data.itemCode && data.itemCode !== current.itemCode) {
      const duplicate = await this.repository.findByItemCode(data.itemCode);
      if (duplicate && String(duplicate._id) !== String(current._id)) {
        throw new ApiError(400, "itemCode da ton tai");
      }
    }

    return this.deletion.withReferences(this.deletion.referencesFor("inventory_items", data),
      (session) => this.repository.updateById(id, data, { session }));
  }

  async delete(id) {
    return this.deletion.remove("inventory_items", id);
  }
}

module.exports = InventoryItemService;
