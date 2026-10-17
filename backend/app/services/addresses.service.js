const { ObjectId } = require("mongodb");
const ResourceDeletionService = require("./resource-deletion.service");

class AddressService {
  constructor(client) {
    this.deletion = new ResourceDeletionService(client);
    this.Address = client.db().collection("addresses");
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
    const result = await this.deletion.withReferences(this.deletion.referencesFor("addresses", data), async (session) => {
      if (data.is_default) {
        await this.Address.updateMany(
          { user_id: data.user_id }, { $set: { is_default: false } }, { session },
        );
      }
      return this.Address.insertOne(data, { session });
    });
    return { _id: result.insertedId, insertedId: result.insertedId, ...data };
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
    const existed = await this.Address.findOne(filter);
    if (!existed) return null;
    return this.deletion.withReferences(
      [{ collection: "users", id: existed.user_id }],
      async (session) => {
        const current = await this.Address.findOne(filter, { session });
        if (!current) return null;
        if (update.is_default === true) {
        await this.Address.updateMany(
          { user_id: current.user_id },
          { $set: { is_default: false } },
          { session },
        );
        }
        return this.Address.findOneAndUpdate(filter, { $set: update }, { returnDocument: "after", session });
      }
    );
  }

  async delete(id) {
    return this.deletion.remove("addresses", id);
  }
}

module.exports = AddressService;
