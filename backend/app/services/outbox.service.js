const { encryptOutboxPayload } = require("../utils/outbox-crypto.util");

class OutboxService {
  constructor(client) {
    this.Outbox = client.db().collection("outbox_events");
  }

  async enqueue(type, payload, options = {}) {
    const idempotencyKey = String(options.idempotencyKey || "").trim();
    if (!idempotencyKey) {
      throw new Error("Outbox idempotencyKey is required");
    }
    const now = new Date();
    await this.Outbox.updateOne(
      { idempotencyKey },
      {
        $setOnInsert: {
          type,
          payload: encryptOutboxPayload(payload),
          idempotencyKey,
          status: "pending",
          attempts: 0,
          nextAttemptAt: now,
          createdAt: now,
          updatedAt: now,
        },
      },
      { upsert: true, session: options.session },
    );
    return this.Outbox.findOne(
      { idempotencyKey },
      { session: options.session },
    );
  }
}

module.exports = OutboxService;
