const { ObjectId } = require("mongodb");

class CategoriesService {
  constructor(client) {
    this.Category = client.db().collection("categories");
  }
  extractCreate(payload) {
    const category = {
      name: payload.name,
      slug: payload.slug,
      description: payload.description,
      image_url: payload.image_url,
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
    const result = await this.Category.findOneAndDelete({
      _id: ObjectId.isValid(id) ? new ObjectId(id) : null,
    });
    return result;
  }
}

module.exports = CategoriesService;
