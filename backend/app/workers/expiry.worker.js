const ExpiryMonitoringService = require("../services/expiry-monitoring.service");
const { calendarDate, startOfExpiryDay } = require("../utils/expiry.util");
// Every instance may run this job. Unique outbox keys and transactional proposal
// transitions make retries and concurrent instances safe without a fragile lease.
function startExpiryWorker(client, { intervalMs = 60000, now = () => new Date(), runOnStart = true } = {}) {
  let running = false, completedDay = null;
  async function tick() {
    const time = now(), day = calendarDate(time);
    const due = time.getTime() - startOfExpiryDay(time).getTime() >= 5 * 60000;
    if (running) return;
    running = true;
    try {
      try { await new (require("../services/orders.service"))(client).releaseExpiredPaypalHolds(time); }
      catch (error) { console.error("Expired payment hold release failed", error.message); }
      if ((completedDay === day) || (!due && !runOnStart)) return;
      const result = await new ExpiryMonitoringService(client).run(time);
      if (result.errors === 0 && due) completedDay = day;
    } catch (error) { console.error("Expiry monitoring job failed", error.message); }
    finally { running = false; runOnStart = false; }
  }
  const timer = setInterval(tick, intervalMs);
  timer.unref?.();
  if (runOnStart) void tick();
  return { stop: () => clearInterval(timer), tick };
}
module.exports = { startExpiryWorker };
