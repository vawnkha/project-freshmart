const { read } = require("./environment");

function subscriptionConfig(env = process.env) {
  const productIds = String(read("SUBSCRIPTION_PRODUCT_IDS", env)).split(",").map(id => id.trim().toLowerCase()).filter(Boolean);
  if (productIds.some(id => !/^[a-f\d]{24}$/.test(id))) throw new Error("Invalid SUBSCRIPTION_PRODUCT_IDS");
  return {
    enabled: read("SUBSCRIPTIONS_ENABLED", env),
    workerEnabled: read("SUBSCRIPTION_WORKER_ENABLED", env),
    timezone: "Asia/Ho_Chi_Minh",
    pollMs: read("SUBSCRIPTION_POLL_MS", env),
    leadDays: read("SUBSCRIPTION_LEAD_DAYS", env),
    maxAttempts: read("SUBSCRIPTION_MAX_ATTEMPTS", env),
    retryMs: read("SUBSCRIPTION_RETRY_MS", env),
    leaseMs: read("SUBSCRIPTION_LEASE_MS", env),
    priceIncreasePercent: read("SUBSCRIPTION_PRICE_INCREASE_PERCENT", env),
    maxOccurrences: 120,
    // Empty allowlist means all active, published products unless explicitly opted out.
    productIds,
  };
}

module.exports = { subscriptionConfig };
