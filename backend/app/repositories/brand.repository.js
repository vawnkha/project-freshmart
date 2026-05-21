const BaseRepository = require("./base.repository");

class BrandRepository extends BaseRepository {
  constructor(client) {
    super(client, "brands");
  }

  findByCode(code) {
    return this.findOne({ code });
  }
}

module.exports = BrandRepository;
