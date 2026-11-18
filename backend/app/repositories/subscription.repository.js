const { ObjectId } = require("mongodb");
const ApiError = require("../api-error");

function objectId(value) {
  if (value instanceof ObjectId) return value;
  if (typeof value !== "string" || !/^[a-f\d]{24}$/i.test(value)) throw new ApiError(400, "ID không hợp lệ");
  return new ObjectId(value);
}

class SubscriptionRepository {
  constructor(client) {
    this.client = client;
    const db = client.db();
    this.subscriptions = db.collection("subscriptions");
    this.runs = db.collection("subscription_runs");
    this.events = db.collection("notifications");
  }

  async transaction(work) {
    const session = this.client.startSession();
    try {
      let result;
      await session.withTransaction(async () => { result = await work(session); }, {
        readConcern: { level: "snapshot" }, writeConcern: { w: "majority" },
      });
      return result;
    } finally { await session.endSession(); }
  }

  async owned(id, userId, { admin = false, session } = {}) {
    const sub = await this.subscriptions.findOne({ _id: objectId(id), ...(admin ? {} : { userId: objectId(userId) }) }, { session });
    if (!sub) throw new ApiError(404, "Không tìm thấy đăng ký định kỳ");
    return sub;
  }
}

module.exports = { SubscriptionRepository, objectId };
