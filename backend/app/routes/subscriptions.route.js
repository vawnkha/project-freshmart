const express = require("express");
const { z } = require("zod");
const auth = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const controller = require("../controllers/subscriptions.controller");
const { subscriptionBody, listQuery, id } = require("../validators/subscription.validator");
const { subscriptionLimiter } = require("../middlewares/rate-limit.middleware");
const router = express.Router();
const params = z.object({ id });
const cap = z.number().int().min(1).max(1000000000);

router.get("/policy", subscriptionLimiter, validate({ query: z.object({ productId: id.optional() }).strict() }), controller.policy);
router.get("/catalog", subscriptionLimiter, validate({ query: z.object({ keyword: z.string().trim().max(100).optional() }).strict() }), controller.catalog);
router.use(auth, subscriptionLimiter);
router.post("/preview", validate({ body: subscriptionBody, query: z.object({ editing: z.enum(["true", "false"]).optional(), subscriptionId: id.optional() }).strict()
  .refine(query => query.editing !== "true" || !!query.subscriptionId, "Cần mã đăng ký khi xem lịch chỉnh sửa") }), controller.preview);
router.post("/", auth.authorizePermissions("order:create:own"), validate({ body: subscriptionBody }), controller.create);
router.get("/", validate({ query: listQuery }), controller.list);
router.post("/runs/:id/quote", validate({ params, body: z.object({ maximumTotal: cap }).strict() }), controller.runQuote);
router.post("/runs/:id/confirm", validate({ params, body: z.object({ maximumTotal: cap, quoteToken: z.string().min(32).max(128), consent: z.literal(true) }).strict() }), controller.confirmRun);
router.post("/runs/:id/reject", validate({ params, body: z.object({}).strict() }), controller.rejectRun);
router.post("/runs/:id/paypal/create-order", auth.authorizePermissions("payment:create:own"), validate({ params, body: z.object({}).strict() }), controller.paypalCreate);
router.get("/:id/runs", validate({ params }), controller.runs);
router.get("/:id", validate({ params }), controller.detail);
router.patch("/:id", validate({ params, body: subscriptionBody }), controller.edit);
router.post("/:id/:action", validate({ params: z.object({ id, action: z.enum(["pause", "resume", "cancel"]) }), body: z.object({}).strict() }), controller.lifecycle);
module.exports = router;
