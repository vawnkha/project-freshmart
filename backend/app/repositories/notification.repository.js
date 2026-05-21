const BaseRepository = require("./base.repository");

class NotificationRepository extends BaseRepository {
  constructor(client) {
    super(client, "notifications");
  }

  findUnread() {
    return this.findList({ is_read: false }, { sort: { created_at: -1 } });
  }
}

module.exports = NotificationRepository;
