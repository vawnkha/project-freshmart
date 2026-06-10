const BaseRepository = require("./base.repository");

class ShippingMethodRepository extends BaseRepository {
  constructor(client) {
    super(client, "shipping_methods");
  }

  findByCode(code) {
    return this.findOne({ code });
  }
}

module.exports = ShippingMethodRepository;
