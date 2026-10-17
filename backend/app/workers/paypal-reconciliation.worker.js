const PaypalCheckoutService = require("../services/paypal-checkout.service");

async function reconcilePendingPayments(client, options = {}) {
  const payments = client.db().collection("payments");
  const now = new Date();
  const candidates = await payments.find({
    method: "paypal", status: { $in: ["awaiting_capture", "capture_unknown"] },
    updated_at: { $lte: new Date(now.getTime() - (options.minAgeMs ?? 60000)) },
    $or: [{ "reconciliation.nextAttemptAt": { $exists: false } }, { "reconciliation.nextAttemptAt": { $lte: now } }],
  }).sort({ updated_at: 1 }).limit(options.limit || 20).toArray();
  const checkout = new PaypalCheckoutService(client);
  const results = [];
  for (const payment of candidates) {
    let outcome;
    try { outcome = await checkout.reconcileOrder({ userId: payment.user_id, paypalOrderId: payment.idempotency_key }); }
    catch (error) {
      outcome = { status: "error", error: error.statusCode === 502 ? "provider_unavailable" : "local_reconciliation_failed" };
      console.warn("PayPal reconciliation needs retry", String(payment._id), outcome.error);
    }
    if (["manual_review", "missing"].includes(outcome.status))
      console.warn("PayPal reconciliation requires manual review", String(payment._id), outcome.status);
    const attempts = Number(payment.reconciliation?.attempts || 0) + 1;
    const delayMs = Math.min(3600000, 60000 * 2 ** Math.min(attempts - 1, 6));
    await payments.updateOne({ _id: payment._id }, {
      $set: { "reconciliation.lastCheckedAt": now, "reconciliation.outcome": outcome.status,
        "reconciliation.providerStatus": outcome.providerStatus || null,
        "reconciliation.lastError": outcome.error || null,
        "reconciliation.nextAttemptAt": new Date(now.getTime() + delayMs) },
      $inc: { "reconciliation.attempts": 1 },
    });
    results.push({ paymentId: String(payment._id), ...outcome });
  }
  return results;
}

function startPaypalReconciliationWorker(client, options = {}) {
  let running = false;
  async function tick() {
    if (running) return;
    running = true;
    try { await reconcilePendingPayments(client, options); }
    catch (_) { console.warn("PayPal reconciliation worker could not persist its result; will retry"); }
    finally { running = false; }
  }
  const timer = setInterval(tick, options.intervalMs || 60000);
  timer.unref();
  tick();
  return () => clearInterval(timer);
}

module.exports = { reconcilePendingPayments, startPaypalReconciliationWorker };
