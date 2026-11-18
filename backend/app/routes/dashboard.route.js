const router = require("express").Router();
const { z } = require("zod");
const auth = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const controller = require("../controllers/dashboard.controller");

router.use(auth, auth.authorizePermissions("admin:access"));
router.get(
  "/",
  validate({
    query: z
      .object({
        preset: z
          .enum(["today", "7days", "30days", "month", "year", "custom"])
          .default("month"),
        from: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        to: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
      })
      .strict(),
  }),
  controller.overview,
);
module.exports = router;
