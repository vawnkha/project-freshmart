const { ObjectId } = require("mongodb");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const RbacService = require("./rbac.service");

class UsersService {
  constructor(client) {
    this.client = client;
    this.User = client.db().collection("users");
    this.User.createIndex({ email: 1 }, { unique: true });
    this.User.createIndex({ created_at: -1 });
    this.User.createIndex({ role_id: 1 });
  }

  extractData(payload, options = {}) {
    const includeCreatedAt = options.includeCreatedAt !== false;
    const user = {
      name: payload.name,
      email: payload.email,
      password: payload.password,
      phone: payload.phone,
      avatar_url: payload.avatar_url,
      address: payload.address,
      role_id: payload.role_id,
      role: payload.role,
      status: payload.status,
      activation_token: payload.activation_token,
      activation_token_expires: payload.activation_token_expires,
      created_at: includeCreatedAt ? new Date() : undefined,
      updated_at: new Date(),
    };

    Object.keys(user).forEach(
      (key) => user[key] === undefined && delete user[key],
    );
    return user;
  }

  async create(payload) {
    const data = this.extractData(payload);
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    if (data.password) {
      const salt = await bcrypt.genSalt(10);
      data.password = await bcrypt.hash(data.password, salt);
    }
    const rbacService = new RbacService(this.client);
    await rbacService.ensureDefaults();
    const defaultRole = await rbacService.findRoleByCode("user");

    data.activation_token = tokenHash;
    data.activation_token_expires = expiresAt;
    data.status = "pending";
    data.role_id = defaultRole?._id;
    data.role = "user";
    data.phone = "";
    data.avatar_url = "";
    data.address = "";
    const result = await this.User.insertOne(data);
    return { insertedId: result.insertedId, rawToken };
  }

  async findByEmail(email) {
    return this.User.findOne({ email });
  }

  async activateByUserIdAndToken(userId, rawToken) {
    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    const result = await this.User.findOneAndUpdate(
      {
        _id: ObjectId.isValid(userId) ? new ObjectId(userId) : null,
        activation_token: tokenHash,
        activation_token_expires: { $gt: new Date() },
        status: "pending",
      },
      {
        $set: { status: "active", updated_at: new Date() },
        $unset: { activation_token: "", activation_token_expires: "" },
      },
      { returnDocument: "after" },
    );

    if (!result) return null;

    return {
      userId: result._id,
      status: result.status,
    };
  }

  async setResetPasswordTokenByEmail(email, expiresMinutes = 15) {
    const user = await this.User.findOne({ email });
    if (!user) return null;

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");
    const expiresAt = new Date(Date.now() + expiresMinutes * 60 * 1000);

    await this.User.updateOne(
      { _id: user._id, status: "active" },
      {
        $set: {
          resetToken: tokenHash,
          resetTokenExpiresAt: expiresAt,
          updated_at: new Date(),
        },
      },
    );

    return {
      userId: user._id,
      email: user.email,
      name: user.name,
      rawToken,
      expiresAt,
      expiresMinutes,
    };
  }

  async resetPasswordByToken(userId, rawToken, newPassword) {
    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);
    const result = await this.User.findOneAndUpdate(
      {
        _id: ObjectId.isValid(userId) ? new ObjectId(userId) : null,
        resetToken: tokenHash,
        resetTokenExpiresAt: { $gt: new Date() },
        status: "active",
      },
      {
        $set: {
          password: passwordHash,
          updated_at: new Date(),
        },
        $unset: {
          resetToken: "",
          resetTokenExpiresAt: "",
        },
      },
      { returnDocument: "after" },
    );
    if (!result) return null;

    return {
      userId: result._id,
    };
  }

  async findById(id) {
    return await this.User.findOne({
      _id: ObjectId.isValid(id) ? new ObjectId(id) : null,
    });
  }
  async findOne(filter) {
    return await this.User.findOne(filter);
  }

  async find(filter) {
    const cursor = await this.User.find(filter);
    return await cursor.toArray();
  }

  async findAll() {
    return await this.find({});
  }

  async update(id, payload) {
    const update = this.extractData(payload, { includeCreatedAt: false });

    if (update.password) {
      const salt = await bcrypt.genSalt(10);
      update.password = await bcrypt.hash(update.password, salt);
    }
    const filter = {
      _id: ObjectId.isValid(id) ? new ObjectId(id) : null,
    };
    const result = await this.User.findOneAndUpdate(
      filter,
      { $set: update },
      { returnDocument: "after" },
    );
    return result;
  }

  async delete(id) {
    const result = await this.User.findOneAndDelete({
      _id: ObjectId.isValid(id) ? new ObjectId(id) : null,
    });
    return result;
  }
}

module.exports = UsersService;
