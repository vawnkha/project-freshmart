const BaseRepository = require("./base.repository");

class OrderRepository extends BaseRepository {
  constructor(client) {
    super(client, "orders");
  }

  findByUserId(userId) {
    const user_id = this.toObjectId(userId);
    return this.findList({ user_id }, { sort: { created_at: -1 } });
  }
}

module.exports = OrderRepository;
