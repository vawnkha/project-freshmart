const express = require("express");
const router = express.Router();
const cart = require("../controllers/carts.controller");
const authMiddleware = require("../middlewares/auth.middleware");

const canAccessCart = authMiddleware.authorizeOwnerOrPermissions(
  (req) => req.params.userId,
  "cart:manage:any",
);

router.use(authMiddleware);

router.get("/:userId", canAccessCart, cart.getMyCart);
router.get("/:userId/detailed", canAccessCart, cart.getMyCartDetailed);
router.post("/:userId/items", canAccessCart, cart.addItem);
router.put("/:userId/items/:productId", canAccessCart, cart.updateItem);
router.delete("/:userId/items/:productId", canAccessCart, cart.removeItem);
router.delete("/:userId/clear", canAccessCart, cart.clearCart);

module.exports = router;
