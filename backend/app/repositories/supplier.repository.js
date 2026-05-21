const BaseRepository = require("./base.repository");

class SupplierRepository extends BaseRepository {
  constructor(client) {
    super(client, "suppliers");
  }

  findByCode(code) {
    return this.findOne({ code });
  }
}

module.exports = SupplierRepository;
