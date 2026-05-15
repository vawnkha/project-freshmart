const { ObjectId } = require("mongodb");

class AddressService {
  constructor(client) {
    this.Address = client.db().collection("addresses");
    this.Address.createIndex({ user_id: 1, created_at: -1 });
    this.Address.createIndex({ user_id: 1, is_default: 1 });
  }

  extractData(payload) {
    const address = {
      user_id: payload.user_id
        ? ObjectId.isValid(payload.user_id)
          ? new ObjectId(payload.user_id)
          : null
        : undefined,
      full_name: payload.full_name,
      phone: payload.phone,
      address_line: payload.address_line,
      city: payload.city,
      is_default: payload.is_default === true,
      created_at: new Date(),
    };
    Object.keys(address).forEach(
      (key) => address[key] === undefined && delete address[key],
    );
    return address;
  }

  async create(payload) {
    const data = this.extractData(payload);
    if (!data.user_id) return { error: "user_id khong hop le" };
    if (data.is_default) {
      await this.Address.updateMany(
        { user_id: data.user_id },
        { $set: { is_default: false } },
      );
    }
    const result = await this.Address.insertOne(data);
    return { insertedId: result.insertedId, ...data };
  }

  async findByUserId(userId) {
    const uid = ObjectId.isValid(userId) ? new ObjectId(userId) : null;
    if (!uid) return [];
    return await this.Address.find({ user_id: uid })
      .sort({ created_at: -1 })
      .toArray();
  }

  async findById(id) {
    return await this.Address.findOne({
      _id: ObjectId.isValid(id) ? new ObjectId(id) : null,
    });
  }

  async update(id, payload) {
    const filter = {
      _id: ObjectId.isValid(id) ? new ObjectId(id) : null,
    };
    const update = {
      full_name: payload.full_name,
      phone: payload.phone,
      address_line: payload.address_line,
      city: payload.city,
      is_default: payload.is_default,
    };
    Object.keys(update).forEach(
      (key) => update[key] === undefined && delete update[key],
    );
    if (update.is_default === true) {
      const existed = await this.Address.findOne(filter);
      if (existed?.user_id) {
        await this.Address.updateMany(
          { user_id: existed.user_id },
          { $set: { is_default: false } },
        );
      }
    }
    const result = await this.Address.findOneAndUpdate(
      filter,
      { $set: update },
      { returnDocument: "after" },
    );
    return result;
  }

  async delete(id) {
    return await this.Address.findOneAndDelete({
      _id: ObjectId.isValid(id) ? new ObjectId(id) : null,
    });
  }
}

module.exports = AddressService;
