const { ObjectId } = require("mongodb");

class PaymentsService {
  constructor(client) {
    this.Payment = client.db().collection("payments");
  }

  async findByOrderId(orderId) {
    return await this.Payment.findOne({
      order_id: ObjectId.isValid(orderId) ? new ObjectId(orderId) : null,
    });
  }

  async findByTransactionId(paypalOrderId) {
    return await this.Payment.findOne({
      transaction_id: paypalOrderId,
    });
  }

  async setMethodAndTransaction(orderId, method, transactionId) {
    const oid = ObjectId.isValid(orderId) ? new ObjectId(orderId) : null;
    if (!oid) return null;

    return await this.Payment.findOneAndUpdate(
      { order_id: oid },
      {
        $set: {
          method,
          transaction_id: transactionId,
          updated_at: new Date(),
        },
      },
      { returnDocument: "after" },
    );
  }

  async markFailedByOrderId(orderId, note = "") {
    const oid = ObjectId.isValid(orderId) ? new ObjectId(orderId) : null;
    if (!oid) return null;

    return await this.Payment.findOneAndUpdate(
      { order_id: oid },
      {
        $set: {
          status: "failed",
          fail_note: note,
          updated_at: new Date(),
        },
      },
      { returnDocument: "after" },
    );
  }

  async markCompletedByPaypalOrderId(paypalOrderId) {
    return await this.Payment.findOneAndUpdate(
      { transaction_id: paypalOrderId },
      {
        $set: {
          status: "completed",
          paid_at: new Date(),
          updated_at: new Date(),
        },
      },
      { returnDocument: "after" },
    );
  }
}

module.exports = PaymentsService;
