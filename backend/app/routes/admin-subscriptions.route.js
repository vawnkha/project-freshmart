const express = require("express");
const { z } = require("zod");
const auth = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const controller = require("../controllers/subscriptions.controller");
const { listQuery, id } = require("../validators/subscription.validator");
const router = express.Router();
router.use(auth, auth.authorizePermissions("admin:access", "order:read:any"));
router.get("/summary", controller.summary);
router.get("/runs", validate({ query: listQuery }), controller.adminRuns);
router.post("/runs/:id/:action", auth.authorizePermissions("order:update"), validate({
  params: z.object({ id, action: z.enum(["retry", "skip", "confirm"]) }), body: z.object({ reason: z.string().trim().min(1).max(500) }).strict(),
}), controller.adminAction);
router.get("/", validate({ query: listQuery }), controller.adminList);
router.get("/:id", validate({ params: z.object({ id }) }), controller.adminDetail);
module.exports = router;
