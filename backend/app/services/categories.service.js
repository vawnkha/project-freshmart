const { ObjectId } = require("mongodb");
const ResourceDeletionService = require("./resource-deletion.service");

class CategoriesService {
  constructor(client) {
    this.deletion = new ResourceDeletionService(client);
    this.Category = client.db().collection("categories");
  }
  extractCreate(payload) {
    const category = {
      name: payload.name,
      slug: payload.slug,
      description: payload.description,
      image_url: payload.image_url,
      status: payload.status || "active",
      created_at: new Date(),
      updated_at: new Date(),
    };
    Object.keys(category).forEach(
      (k) => category[k] === undefined && delete category[k],
    );
    return category;
  }

  extractUpdate(payload) {
    const category = {
      name: payload.name,
      slug: payload.slug,
      description: payload.description,
      image_url: payload.image_url,
      status: payload.status,
      updated_at: new Date(),
    };
    Object.keys(category).forEach(
      (k) => category[k] === undefined && delete category[k],
    );
    return category;
  }

  async create(payload) {
    const data = this.extractCreate(payload);
    const result = await this.Category.insertOne(data);
    return { insertedId: result.insertedId, ...data };
  }

  async find(filter = {}, options = {}) {
    const cursor = await this.Category.find(filter, options);
    return await cursor.toArray();
  }

  async findByName(name) {
    return await this.find({
      name: { $regex: new RegExp(name), $options: "i" },
    });
  }

  async findBySlug(slug) {
    return this.Category.findOne({ slug });
  }

  async findById(id) {
    return this.Category.findOne({
      _id: ObjectId.isValid(id) ? new ObjectId(id) : null,
    });
  }

  async update(id, payload) {
    const filter = {
      _id: ObjectId.isValid(id) ? new ObjectId(id) : null,
    };
    const update = this.extractUpdate(payload);
    const result = await this.Category.findOneAndUpdate(
      filter,
      { $set: update },
      { returnDocument: "after" },
    );
    return result;
  }

  async delete(id) {
    return this.deletion.remove("categories", id);
  }
}

module.exports = CategoriesService;
