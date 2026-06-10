const BaseRepository = require("./base.repository");

class BannerRepository extends BaseRepository {
  constructor(client) {
    super(client, "banners");
  }
}

module.exports = BannerRepository;
