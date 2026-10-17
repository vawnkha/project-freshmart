const express = require("express");
const router = express.Router();
const reviews = require("../controllers/reviews.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  createReviewSchema,
  reviewProductParamSchema,
  reviewUserProductParamSchema,
} = require("../validators/review.validator");

router.get("/product/:productId", validate({ params: reviewProductParamSchema }), reviews.findByProduct);
router.get(
  "/can-review/:userId/:productId",
  authMiddleware,
  validate({ params: reviewUserProductParamSchema }),
  authMiddleware.authorizeOwnerOrPermissions(
    (req) => req.params.userId,
    "review:check:any",
  ),
  reviews.canReview,
);
router.post(
  "/",
  authMiddleware,
  validate({ body: createReviewSchema }),
  authMiddleware.authorizeOwnerOrPermissions(
    (req) => req.body.user_id,
    "review:create:any",
  ),
  reviews.create,
);

module.exports = router;
