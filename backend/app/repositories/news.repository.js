const BaseRepository = require("./base.repository");

class NewsRepository extends BaseRepository {
  constructor(client) {
    super(client, "news");
  }

  findBySlug(slug) {
    return this.findOne({ slug });
  }
}

module.exports = NewsRepository;
