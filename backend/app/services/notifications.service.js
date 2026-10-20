const { ObjectId } = require("mongodb");

class NotificationsService {
  constructor(client) {
    const ResourceDeletionService = require("./resource-deletion.service");
    this.deletion = new ResourceDeletionService(client);
    this.Notification = client.db().collection("notifications");
  }

  extractNotificationData(payload) {
    const notification = {
      type: payload.type,
      title: payload.title?.trim(),
      content: payload.content?.trim(),
      data: payload.data || {},
      outbox_event_id: payload.outbox_event_id,
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
    if (document.outbox_event_id) {
      const existing = await this.Notification.findOne({
        outbox_event_id: document.outbox_event_id,
      });
      if (existing) return existing;
    }
    let result;
    try {
      result = await this.deletion.withReferences([{ collection: "contacts", id: document.data?.contactId }],
        (session) => this.Notification.insertOne(document, { session }));
    } catch (error) {
      if (error.code === 11000 && document.outbox_event_id) {
        return this.Notification.findOne({
          outbox_event_id: document.outbox_event_id,
        });
      }
      throw error;
    }
    return {
      _id: result.insertedId,
      ...document,
    };
  }

  async find(filter = {}) {
    const items = await this.Notification.find(filter)
      .sort({ created_at: -1 })
      .toArray();

    // Keep the original milestone/history, while exposing current stock on reads.
    for (const item of items) if (item.type === "inventory_expiry" && ObjectId.isValid(item.data?.batchId)) {
      const batch = await this.deletion.db.collection("inventory_batches").findOne({ _id: new ObjectId(item.data.batchId) });
      if (batch) item.data.current = { quantity: batch.quantity, ...require("../utils/expiry.util").classifyExpiry(batch.expiryDate) };
    }

    return { items };
  }

  async findById(id) {
    if (!ObjectId.isValid(id)) return null;
    return await this.Notification.findOne({ _id: new ObjectId(id) });
  }

  async update(id, payload) {
    if (!ObjectId.isValid(id)) return null;

    const updateData = { updated_at: new Date() };
    for (const field of ["type", "title", "content", "data", "is_read"]) {
      if (payload[field] !== undefined) updateData[field] = payload[field];
    }

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
