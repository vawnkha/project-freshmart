const BaseRepository = require("./base.repository");

class DiscountRepository extends BaseRepository {
  constructor(client) {
    super(client, "discounts");
  }

  findByCode(code) {
    return this.findOne({ code });
  }
}

module.exports = DiscountRepository;
