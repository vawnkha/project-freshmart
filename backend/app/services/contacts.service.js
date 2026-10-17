const { ObjectId } = require("mongodb");
const { randomUUID } = require("node:crypto");
const OutboxService = require("./outbox.service");

class ContactsService {
  constructor(client) {
    const ResourceDeletionService = require("./resource-deletion.service");
    this.deletion = new ResourceDeletionService(client);
    this.client = client;
    this.Contact = client.db().collection("contacts");
    this.outbox = new OutboxService(client);
  }

  extractContactData(payload) {
    const contact = {
      name: payload.name?.trim(),
      email: payload.email?.trim(),
      subject: payload.subject?.trim(),
      content: payload.content?.trim(),
      status: payload.status || "pending",
      admin_reply: payload.admin_reply || "",
      replied_at: payload.replied_at || null,
      created_at: payload.created_at || new Date(),
      updated_at: new Date(),
    };

    Object.keys(contact).forEach((key) => {
      if (contact[key] === undefined) delete contact[key];
    });

    return contact;
  }

  async create(payload) {
    const document = this.extractContactData(payload);
    const session = this.client.startSession();
    let result;
    try {
      await session.withTransaction(async () => {
        result = await this.Contact.insertOne(document, { session });
        await this.outbox.enqueue(
          "notification.admin",
          {
            type: "contact",
            title: "Có liên hệ mới",
            content: `Có liên hệ mới từ ${document.email}`,
            data: {
              contactId: String(result.insertedId),
              name: document.name,
              email: document.email,
              subject: document.subject,
            },
          },
          {
            session,
            idempotencyKey: `contact-notification:${result.insertedId}`,
          },
        );
      });
    } finally {
      await session.endSession();
    }
    return {
      _id: result.insertedId,
      ...document,
    };
  }

  async find(filter = {}) {
    return await this.Contact.find(filter).sort({ created_at: -1 }).toArray();
  }

  async findById(id) {
    if (!ObjectId.isValid(id)) return null;
    return await this.Contact.findOne({ _id: new ObjectId(id) });
  }

  async update(id, payload) {
    if (!ObjectId.isValid(id)) return null;

    const updateData = this.extractContactData({
      ...payload,
      updated_at: new Date(),
    });

    delete updateData.created_at;

    const result = await this.Contact.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updateData },
      { returnDocument: "after" },
    );

    return result;
  }

  async reply(id, payload) {
    if (!ObjectId.isValid(id)) return null;

    // Distinct replies must not share a key; transaction retries reuse this key.
    const replyRequestId = randomUUID();

    const updateData = {
      admin_reply: payload.admin_reply?.trim() || "",
      status: "replied",
      replied_at: new Date(),
      updated_at: new Date(),
    };

    const session = this.client.startSession();
    let result;
    try {
      await session.withTransaction(async () => {
        const contact = await this.Contact.findOne(
          { _id: new ObjectId(id) },
          { session },
        );
        if (!contact) return;
        result = await this.Contact.findOneAndUpdate(
          { _id: contact._id },
          { $set: updateData },
          { returnDocument: "after", session },
        );
        await this.outbox.enqueue(
          "mail.contact-reply",
          {
            to: contact.email,
            name: contact.name,
            subject: contact.subject,
            originalContent: contact.content,
            adminReply: updateData.admin_reply,
          },
          {
            session,
            idempotencyKey: `contact-reply:${contact._id}:${replyRequestId}`,
          },
        );
      });
    } finally {
      await session.endSession();
    }
    return result;
  }

  async delete(id) {
    if (!ObjectId.isValid(id)) return null;
    return this.deletion.remove("contacts", id);
  }

  async deleteAll() {
    const session = this.client.startSession();
    try {
      return await session.withTransaction(async () => {
        const documents = await this.Contact.find({}, { session, projection: { _id: 1 } }).toArray();
        let deletedCount = 0;
        for (const document of documents) {
          if (await this.deletion.remove("contacts", document._id, { session })) deletedCount++;
        }
        return deletedCount;
      });
    } finally {
      await session.endSession();
    }
  }
}

module.exports = ContactsService;
