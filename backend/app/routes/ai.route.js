const express = require("express");
const router = express.Router();
const aiController = require("../controllers/ai.controller");
const validate = require("../middlewares/validate.middleware");
const { aiLimiter } = require("../middlewares/rate-limit.middleware");
const { aiChatBodySchema } = require("../validators/ai.validator");

router.post(
  "/chat",
  aiLimiter,
  validate({ body: aiChatBodySchema }),
  aiController.chat,
);

module.exports = router;
