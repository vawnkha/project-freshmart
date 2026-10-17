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
    if (options.session) findOptions.session = options.session;

    let cursor = this.collection().find(filter, findOptions);
    if (options.sort) cursor = cursor.sort(options.sort);
    if (options.skip) cursor = cursor.skip(options.skip);
    if (options.limit) cursor = cursor.limit(options.limit);

    return cursor.toArray();
  }

  async create(data, options = {}) {
    data = { ...data };
    for (const field of ["code", "barcode"]) if (data[field] === "") delete data[field];
    const result = await this.collection().insertOne(data, options);
    return {
      insertedId: result.insertedId,
      ...data,
    };
  }

  async updateById(id, data, options = {}) {
    const _id = this.toObjectId(id);
    if (!_id) return null;

    const set = { ...data };
    const unset = {};
    for (const field of ["code", "barcode"]) {
      if (set[field] === "") { delete set[field]; unset[field] = ""; }
    }
    return this.collection().findOneAndUpdate(
      { _id },
      { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) },
      { ...options, returnDocument: "after" },
    );
  }

  async deleteById(id, options = {}) {
    const _id = this.toObjectId(id);
    if (!_id) return null;

    return this.collection().findOneAndDelete({ _id }, options);
  }

  async count(filter = {}, options = {}) {
    return this.collection().countDocuments(filter, options);
  }

  async exists(filter = {}, options = {}) {
    const document = await this.collection().findOne(filter, {
      ...options,
      projection: { _id: 1 },
    });
    return Boolean(document);
  }
}

module.exports = BaseRepository;
