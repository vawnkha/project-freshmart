const { ObjectId } = require("mongodb");

class NotificationsService {
  constructor(client) {
    this.Notification = client.db().collection("notifications");
  }

  extractNotificationData(payload) {
    const notification = {
      type: payload.type,
      title: payload.title?.trim(),
      content: payload.content?.trim(),
      data: payload.data || {},
      is_read: payload.is_read ?? false,
      created_at: payload.created_at || new Date(),
      updated_at: new Date(),
    };

    Object.keys(notification).forEach((key) => {
      if (notification[key] === undefined) delete notification[key];
    });

    return notification;
  }

  buildFilter(query) {
    const filter = {};

    if (query.type) {
      filter.type = query.type;
    }

    if (query.is_read === "true") {
      filter.is_read = true;
    } else if (query.is_read === "false") {
      filter.is_read = false;
    }

    if (query.keyword) {
      const keyword = String(query.keyword).trim();
      filter.$or = [
        { title: { $regex: keyword, $options: "i" } },
        { content: { $regex: keyword, $options: "i" } },
      ];
    }

    return filter;
  }

  async create(payload) {
    const document = this.extractNotificationData(payload);
    const result = await this.Notification.insertOne(document);
    return {
      _id: result.insertedId,
      ...document,
    };
  }

  async find(filter = {}) {
    const items = await this.Notification.find(filter)
      .sort({ created_at: -1 })
      .toArray();

    return { items };
  }

  async findById(id) {
    if (!ObjectId.isValid(id)) return null;
    return await this.Notification.findOne({ _id: new ObjectId(id) });
  }

  async update(id, payload) {
    if (!ObjectId.isValid(id)) return null;

    const updateData = this.extractNotificationData(payload);
    delete updateData.created_at;

    return await this.Notification.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updateData },
      { returnDocument: "after" },
    );
  }

  async markAsRead(id) {
    if (!ObjectId.isValid(id)) return null;

    return await this.Notification.findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $set: {
          is_read: true,
          updated_at: new Date(),
        },
      },
      { returnDocument: "after" },
    );
  }

  async markAllAsRead(filter = {}) {
    const result = await this.Notification.updateMany(filter, {
      $set: {
        is_read: true,
        updated_at: new Date(),
      },
    });

    return result.modifiedCount;
  }

  async delete(id) {
    if (!ObjectId.isValid(id)) return null;
    return await this.Notification.findOneAndDelete({
      _id: new ObjectId(id),
    });
  }

  async deleteManyByIds(ids = []) {
    const objectIds = ids
      .filter((id) => ObjectId.isValid(id))
      .map((id) => new ObjectId(id));

    if (!objectIds.length) return 0;

    const result = await this.Notification.deleteMany({
      _id: { $in: objectIds },
    });

    return result.deletedCount;
  }

  async deleteAll(filter = {}) {
    const result = await this.Notification.deleteMany(filter);
    return result.deletedCount;
  }

  async countUnread() {
    return await this.Notification.countDocuments({ is_read: false });
  }
}

module.exports = NotificationsService;
