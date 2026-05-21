const BaseRepository = require("./base.repository");

class PurchaseOrderRepository extends BaseRepository {
  constructor(client) {
    super(client, "purchase_orders");
  }

  findByPurchaseCode(purchaseCode) {
    return this.findOne({ purchaseCode });
  }
}

module.exports = PurchaseOrderRepository;
