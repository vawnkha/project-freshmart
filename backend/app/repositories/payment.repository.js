const BaseRepository = require("./base.repository");

class PaymentRepository extends BaseRepository {
  constructor(client) {
    super(client, "payments");
  }

  findByOrderId(orderId) {
    const order_id = this.toObjectId(orderId);
    return this.findOne({ order_id });
  }

  findByTransactionId(transactionId) {
    return this.findOne({ transaction_id: transactionId });
  }
}

module.exports = PaymentRepository;
