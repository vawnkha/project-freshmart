const BaseRepository = require("./base.repository");

class NewsCategoryRepository extends BaseRepository {
  constructor(client) {
    super(client, "news_categories");
  }

  findBySlug(slug) {
    return this.findOne({ slug });
  }
}

module.exports = NewsCategoryRepository;
