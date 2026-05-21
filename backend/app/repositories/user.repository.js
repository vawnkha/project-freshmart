const BaseRepository = require("./base.repository");

class UserRepository extends BaseRepository {
  constructor(client) {
    super(client, "users");
  }

  findByEmail(email) {
    return this.findOne({ email });
  }
}

module.exports = UserRepository;
