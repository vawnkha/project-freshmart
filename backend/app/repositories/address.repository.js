const BaseRepository = require("./base.repository");

class AddressRepository extends BaseRepository {
  constructor(client) {
    super(client, "addresses");
  }

  findByUserId(userId) {
    const user_id = this.toObjectId(userId);
    return this.findList({ user_id }, { sort: { created_at: -1 } });
  }
}

module.exports = AddressRepository;
