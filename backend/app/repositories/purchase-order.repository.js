const BaseRepository = require("./base.repository");
const { ObjectId } = require("mongodb");

class PurchaseOrderRepository extends BaseRepository {
  constructor(client) {
    super(client, "purchase_orders");
  }

  findByPurchaseCode(purchaseCode) {
    return this.findOne({ purchaseCode });
  }

  claimDraftForImport(id, options = {}) {
    const _id = id instanceof ObjectId ? id : this.toObjectId(id);
    if (!_id) return null;
    return this.collection().findOneAndUpdate(
      { _id, status: "draft" },
      { $set: { status: "importing", updatedAt: new Date() } },
      { ...options, returnDocument: "after" },
    );
  }

  updateDraftById(id, data, options = {}) {
    const _id = this.toObjectId(id);
    if (!_id) return null;
    return this.collection().findOneAndUpdate(
      { _id, status: "draft" }, { $set: data }, { ...options, returnDocument: "after" },
    );
  }
}

module.exports = PurchaseOrderRepository;
