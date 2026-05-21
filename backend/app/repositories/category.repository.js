const BaseRepository = require("./base.repository");

class CategoryRepository extends BaseRepository {
  constructor(client) {
    super(client, "categories");
  }

  findBySlug(slug) {
    return this.findOne({ slug });
  }
}

module.exports = CategoryRepository;
