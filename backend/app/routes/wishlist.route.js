const express = require("express");
const router = express.Router();
const wishlist = require("../controllers/wishlist.controller");
const authMiddleware = require("../middlewares/auth.middleware");

const canAccessWishlist = authMiddleware.authorizeOwnerOrPermissions(
  (req) => req.params.userId,
  "wishlist:manage:any",
);

router.use(authMiddleware);

router.get("/:userId", canAccessWishlist, wishlist.getWishlistByUser);
router.post("/:userId/items", canAccessWishlist, wishlist.addItem);
router.patch(
  "/:userId/items/:productId/toggle",
  canAccessWishlist,
  wishlist.toggleItem,
);
router.delete(
  "/:userId/items/:productId",
  canAccessWishlist,
  wishlist.removeItem,
);
router.delete("/:userId/items", canAccessWishlist, wishlist.clearWishlist);

module.exports = router;
