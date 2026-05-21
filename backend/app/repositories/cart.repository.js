const BaseRepository = require("./base.repository");

class CartRepository extends BaseRepository {
  constructor(client) {
    super(client, "carts");
  }

  findByUserId(userId) {
    const user_id = this.toObjectId(userId);
    return this.findOne({ user_id });
  }
}

module.exports = CartRepository;
