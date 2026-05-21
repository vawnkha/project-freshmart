const BaseRepository = require("./base.repository");

class ContactRepository extends BaseRepository {
  constructor(client) {
    super(client, "contacts");
  }
}

module.exports = ContactRepository;
