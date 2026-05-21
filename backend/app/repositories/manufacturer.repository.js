const BaseRepository = require("./base.repository");

class ManufacturerRepository extends BaseRepository {
  constructor(client) {
    super(client, "manufacturers");
  }

  findByCode(code) {
    return this.findOne({ code });
  }
}

module.exports = ManufacturerRepository;
