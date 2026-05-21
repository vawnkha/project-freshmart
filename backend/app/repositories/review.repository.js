const BaseRepository = require("./base.repository");

class ReviewRepository extends BaseRepository {
  constructor(client) {
    super(client, "reviews");
  }

  findByUserAndProduct(userId, productId) {
    const user_id = this.toObjectId(userId);
    const product_id = this.toObjectId(productId);
    return this.findOne({ user_id, product_id });
  }
}

module.exports = ReviewRepository;
