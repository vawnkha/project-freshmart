const {
  sendActivationEmail,
  sendContactReplyEmail,
  sendInvoiceEmail,
  sendResetPasswordEmail,
} = require("../utils/mailer.util");
const { notifyAdmin } = require("../utils/notify-admin.util");
const { decryptOutboxPayload } = require("../utils/outbox-crypto.util");
const { ObjectId } = require("mongodb");

function messageId(event) {
  return `<outbox-${event._id}@fresh-mart.local>`;
}

async function handleEvent(client, event) {
  const options = { messageId: messageId(event) };
  const payload = decryptOutboxPayload(event.payload);
  switch (event.type) {
    case "mail.activation":
      return sendActivationEmail({ ...payload, ...options });
    case "mail.reset-password":
      return sendResetPasswordEmail({ ...payload, ...options });
    case "mail.contact-reply":
      return sendContactReplyEmail({ ...payload, ...options });
    case "mail.invoice": {
      await sendInvoiceEmail({ ...payload, ...options });
      const orderId = ObjectId.isValid(payload.order?._id)
        ? new ObjectId(payload.order._id)
        : payload.order?._id;
      return client
        .db()
        .collection("orders")
        .updateOne(
          { _id: orderId, invoice_outbox_id: event._id },
          {
            $set: {
              invoice_sent: true,
              invoice_sent_at: new Date(),
              updated_at: new Date(),
            },
            $unset: { invoice_queued_at: "" },
          },
        );
    }
    case "notification.admin":
      return notifyAdmin(payload, { eventId: event._id });
    default:
      throw new Error(`Unsupported outbox event type: ${event.type}`);
  }
}

function startOutboxWorker(client, options = {}) {
  const collection = client.db().collection("outbox_events");
  const intervalMs = Number(options.intervalMs || 5000);
  let running = false;

  async function processNext() {
    if (running) return;
    running = true;
    let event;
    try {
      const now = new Date();
      event = await collection.findOneAndUpdate(
        {
          status: { $in: ["pending", "processing"] },
          nextAttemptAt: { $lte: now },
          $or: [
            { lockedAt: { $exists: false } },
            { lockedAt: { $lt: new Date(Date.now() - 5 * 60 * 1000) } },
          ],
        },
        {
          $set: { status: "processing", lockedAt: now, updatedAt: now },
          $inc: { attempts: 1 },
        },
        { sort: { createdAt: 1 }, returnDocument: "after" },
      );
      if (!event) return;

      await handleEvent(client, event);
      await collection.updateOne(
        { _id: event._id, status: "processing" },
        {
          $set: {
            status: "processed",
            processedAt: new Date(),
            updatedAt: new Date(),
          },
          $unset: { lockedAt: "", lastError: "" },
        },
      );
    } catch (error) {
      if (event?._id) {
        const delay = Math.min(
          60 * 60 * 1000,
          5000 * 2 ** Math.min(event.attempts, 8),
        );
        await collection.updateOne(
          { _id: event._id },
          {
            $set: {
              status: "pending",
              lastError: String(error.message || "Outbox handler failed").slice(
                0,
                500,
              ),
              nextAttemptAt: new Date(Date.now() + delay),
              updatedAt: new Date(),
            },
            $unset: { lockedAt: "" },
          },
        );
      }
    } finally {
      running = false;
    }
  }

  const timer = setInterval(processNext, intervalMs);
  timer.unref();
  processNext();
  return () => clearInterval(timer);
}

module.exports = { handleEvent, startOutboxWorker };
