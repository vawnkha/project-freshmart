const { ObjectId } = require("mongodb");
class ShrimpDiagnosisRepository {
  constructor(client) { this.collection = client.db().collection("shrimp_diagnoses"); }
  ownerQuery(userId) { return { userId: new ObjectId(String(userId)), $or: [{ storageState: "ready" }, { storageState: { $exists: false } }], deletedAt: { $exists: false } }; }
  async findOwned(id, userId) {
    if (!ObjectId.isValid(id)) return null;
    return this.collection.findOne({ _id: new ObjectId(String(id)), ...this.ownerQuery(userId) });
  }
  async list(userId, { page, limit, className, from, to }) {
    const query = this.ownerQuery(userId);
    if (className) query["prediction.className"] = className;
    if (from || to) query.createdAt = { ...(from ? { $gte: new Date(from) } : {}), ...(to ? { $lte: new Date(to) } : {}) };
    const [items, total] = await Promise.all([
      this.collection.find(query).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).toArray(),
      this.collection.countDocuments(query),
    ]);
    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }
}
module.exports = ShrimpDiagnosisRepository;
