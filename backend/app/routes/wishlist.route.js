const express = require("express");
const router = express.Router();
const wishlist = require("../controllers/wishlist.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  wishlistUserParamSchema,
  wishlistItemParamSchema,
  addWishlistItemSchema,
} = require("../validators/wishlist.validator");

const canAccessWishlist = authMiddleware.authorizeOwnerOrPermissions(
  (req) => req.params.userId,
  "wishlist:manage:any",
);

router.use(authMiddleware);

router.get("/:userId", validate({ params: wishlistUserParamSchema }), canAccessWishlist, wishlist.getWishlistByUser);
router.post("/:userId/items", validate({ params: wishlistUserParamSchema, body: addWishlistItemSchema }), canAccessWishlist, wishlist.addItem);
router.patch(
  "/:userId/items/:productId/toggle",
  validate({ params: wishlistItemParamSchema }),
  canAccessWishlist,
  wishlist.toggleItem,
);
router.delete(
  "/:userId/items/:productId",
  validate({ params: wishlistItemParamSchema }),
  canAccessWishlist,
  wishlist.removeItem,
);
router.delete("/:userId/items", validate({ params: wishlistUserParamSchema }), canAccessWishlist, wishlist.clearWishlist);

module.exports = router;
