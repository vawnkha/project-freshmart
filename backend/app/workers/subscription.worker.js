const SubscriptionsService = require("../services/subscriptions.service");
const { subscriptionConfig } = require("../config/subscriptions");

function startSubscriptionWorker(client, options = {}) {
  const config = options.config || subscriptionConfig();
  if (!config.enabled || !config.workerEnabled) return () => {};
  const service = new SubscriptionsService(client, { ...options, config });
  let running = false;
  async function poll() {
    if (running) return;
    running = true;
    try { await service.tick(); }
    catch (_) { console.error("Subscription worker: processing unavailable; durable leases will be retried"); }
    finally { running = false; }
  }
  const timer = setInterval(poll, config.pollMs);
  timer.unref();
  poll();
  return () => clearInterval(timer);
}

module.exports = { startSubscriptionWorker };
