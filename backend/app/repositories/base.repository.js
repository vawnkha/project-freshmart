const { ObjectId } = require("mongodb");

class BaseRepository {
  constructor(client, collectionName) {
    this.client = client;
    this.collectionName = collectionName;
  }

  collection() {
    return this.client.db().collection(this.collectionName);
  }

  toObjectId(id) {
    if (id instanceof ObjectId) return id;
    return ObjectId.isValid(id) ? new ObjectId(id) : null;
  }

  async findById(id, options = {}) {
    const _id = this.toObjectId(id);
    if (!_id) return null;
    return this.collection().findOne({ _id }, options);
  }

  async findOne(filter = {}, options = {}) {
    return this.collection().findOne(filter, options);
  }

  async findList(filter = {}, options = {}) {
    const findOptions = {};
    if (options.projection) findOptions.projection = options.projection;

    let cursor = this.collection().find(filter, findOptions);
    if (options.sort) cursor = cursor.sort(options.sort);

    return cursor.toArray();
  }

  async create(data) {
    const result = await this.collection().insertOne(data);
    return {
      insertedId: result.insertedId,
      ...data,
    };
  }

  async updateById(id, data) {
    const _id = this.toObjectId(id);
    if (!_id) return null;

    return this.collection().findOneAndUpdate(
      { _id },
      { $set: data },
      { returnDocument: "after" },
    );
  }

  async deleteById(id) {
    const _id = this.toObjectId(id);
    if (!_id) return null;

    return this.collection().findOneAndDelete({ _id });
  }

  async count(filter = {}) {
    return this.collection().countDocuments(filter);
  }

  async exists(filter = {}) {
    const document = await this.collection().findOne(filter, {
      projection: { _id: 1 },
    });
    return Boolean(document);
  }
}

module.exports = BaseRepository;
