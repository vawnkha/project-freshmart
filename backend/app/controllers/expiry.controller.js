const MongoDB = require("../utils/mongodb.util");
const ExpiryMonitoringService = require("../services/expiry-monitoring.service");
const PromotionProposalService = require("../services/promotion-proposal.service");
const handle = fn => async (req, res, next) => {
  try { res.set("Cache-Control", "no-store"); return await fn(req, res); } catch (error) { next(error); }
};
const expiry = () => new ExpiryMonitoringService(MongoDB.client);
const proposals = () => new PromotionProposalService(MongoDB.client);
exports.summary = handle(async (req, res) => res.send(await expiry().summary()));
exports.list = handle(async (req, res) => {
  const result = await expiry().list(req.query);
  for (const batch of result.data) await expiry().checkBatch(batch);
  return res.send(result);
});
exports.detail = handle(async (req, res) => {
  await proposals().syncLifecycle();
  const batch = await expiry().detail(req.params.id);
  await expiry().checkBatch(batch);
  return res.send(batch);
});
exports.recommendation = handle(async (req, res) => res.send(await proposals().recommendation(req.params.id)));
exports.create = handle(async (req, res) => res.status(201).send(await proposals().create(req.params.id, req.body, req.user)));
exports.proposals = handle(async (req, res) => res.send(await proposals().list(req.query)));
for (const action of ["update", "approve", "reject"]) exports[action] = handle(async (req, res) =>
  res.send(await proposals()[action](req.params.id, req.body, req.user)));
exports.cancel = handle(async (req, res) => res.send(await proposals().cancel(req.params.id, req.user)));
exports.correctExpiry = handle(async (req, res) => res.send(await new (require("../services/inventory-batch.service"))(MongoDB.client).correctExpiry(req.params.id, req.body, req.user)));
