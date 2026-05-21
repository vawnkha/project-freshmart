const BaseRepository = require("./base.repository");

class WishlistRepository extends BaseRepository {
  constructor(client) {
    super(client, "wishlists");
  }

  findByUserId(userId) {
    const user_id = this.toObjectId(userId);
    return this.findOne({ user_id });
  }
}

module.exports = WishlistRepository;
