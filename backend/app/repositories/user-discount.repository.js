const BaseRepository = require("./base.repository");

class UserDiscountRepository extends BaseRepository {
  constructor(client) {
    super(client, "user_discounts");
  }
}

module.exports = UserDiscountRepository;
