const BaseRepository = require("./base.repository");

class PermissionRepository extends BaseRepository {
  constructor(client) {
    super(client, "permissions");
  }

  findByKey(key) {
    return this.findOne({ key });
  }
}

module.exports = PermissionRepository;
