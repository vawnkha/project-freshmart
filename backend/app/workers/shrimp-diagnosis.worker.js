const Service = require("../services/shrimp-diagnosis.service");
function startDiagnosisCleanup(client) {
  const service = new Service(client);
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try { await service.reconcileStorage(); }
    catch (error) { console.error("Diagnosis storage reconciliation failed", error.code || error.message); }
    finally { running = false; }
  };
  void run();
  const timer = setInterval(run, 60 * 60 * 1000);
  timer.unref();
  return () => clearInterval(timer);
}
module.exports = { startDiagnosisCleanup };
