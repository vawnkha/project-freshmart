const BaseRepository = require("./base.repository");

class RoleRepository extends BaseRepository {
  constructor(client) {
    super(client, "roles");
  }

  findByCode(code) {
    return this.findOne({ code });
  }
}

module.exports = RoleRepository;
