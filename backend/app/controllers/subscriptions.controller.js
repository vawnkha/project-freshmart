const MongoDB = require("../utils/mongodb.util");
const SubscriptionsService = require("../services/subscriptions.service");
const PaypalCheckoutService = require("../services/paypal-checkout.service");

const handler = work => async (req, res, next) => {
  try { return res.send(await work(new SubscriptionsService(MongoDB.client), req)); }
  catch (error) { return next(error); }
};
exports.policy = handler((service, req) => service.policy(req.query.productId));
exports.catalog = handler((service, req) => service.catalog(req.query.keyword));
exports.preview = handler((service, req) => service.preview(req.user.id, req.body, { editing: req.query.editing === "true", subscriptionId: req.query.subscriptionId }));
exports.create = handler((service, req) => service.create(req.user.id, req.body));
exports.list = handler((service, req) => service.list(req.user.id, req.query));
exports.detail = handler((service, req) => service.detail(req.params.id, req.user.id));
exports.runs = handler(async (service, req) => ({ items: (await service.detail(req.params.id, req.user.id)).runs }));
exports.edit = handler(async (service, req) => { await service.edit(req.params.id, req.user.id, req.body); return service.detail(req.params.id, req.user.id); });
exports.lifecycle = handler(async (service, req) => { await service.lifecycle(req.params.id, req.user.id, req.params.action); return service.detail(req.params.id, req.user.id); });
exports.runQuote = handler((service, req) => service.runQuote(req.params.id, req.user.id, req.body.maximumTotal));
exports.confirmRun = handler((service, req) => service.confirmRun(req.params.id, req.user.id, req.body));
exports.rejectRun = handler((service, req) => service.rejectRun(req.params.id, req.user.id));
exports.paypalCreate = handler((_service, req) => new PaypalCheckoutService(MongoDB.client).createSubscriptionOrder({ userId: req.user.id, runId: req.params.id }));
exports.adminList = handler((service, req) => service.list(req.user.id, req.query, { admin: true }));
exports.adminDetail = handler((service, req) => service.detail(req.params.id, req.user.id, { admin: true }));
exports.summary = handler(service => service.summary());
exports.adminAction = handler(async (service, req) => { await service.adminRunAction(req.params.id, req.params.action, req.body.reason, req.user.id); return { ok: true }; });
exports.adminRuns = handler(async (service, req) => {
  const filter = req.query.runStatus ? { status: req.query.runStatus } : {};
  const [items, total] = await Promise.all([
    service.repo.runs.find(filter, { projection: { leaseToken: 0 } }).sort({ scheduledDate: -1 }).skip((req.query.page - 1) * req.query.limit).limit(req.query.limit).toArray(),
    service.repo.runs.countDocuments(filter),
  ]);
  return { items, total, page: req.query.page, limit: req.query.limit };
});
