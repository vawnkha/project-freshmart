const express = require("express");
const router = express.Router();
const reviews = require("../controllers/reviews.controller");
const authMiddleware = require("../middlewares/auth.middleware");

router.get("/product/:productId", reviews.findByProduct);
router.get(
  "/can-review/:userId/:productId",
  authMiddleware,
  authMiddleware.authorizeOwnerOrPermissions(
    (req) => req.params.userId,
    "review:check:any",
  ),
  reviews.canReview,
);
router.post(
  "/",
  authMiddleware,
  authMiddleware.authorizeOwnerOrPermissions(
    (req) => req.body.user_id,
    "review:create:any",
  ),
  reviews.create,
);

module.exports = router;
