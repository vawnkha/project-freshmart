const express = require("express");
const router = express.Router();
const cart = require("../controllers/carts.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  addCartItemSchema,
  cartItemParamSchema,
  cartUserParamSchema,
  updateCartItemSchema,
} = require("../validators/cart.validator");

const canAccessCart = authMiddleware.authorizeOwnerOrPermissions(
  (req) => req.params.userId,
  "cart:manage:any",
);

router.use(authMiddleware);

router.get(
  "/:userId",
  validate({ params: cartUserParamSchema }),
  canAccessCart,
  cart.getMyCart,
);
router.get(
  "/:userId/detailed",
  validate({ params: cartUserParamSchema }),
  canAccessCart,
  cart.getMyCartDetailed,
);
router.post(
  "/:userId/items",
  validate({ params: cartUserParamSchema, body: addCartItemSchema }),
  canAccessCart,
  cart.addItem,
);
router.put(
  "/:userId/items/:productId",
  validate({ params: cartItemParamSchema, body: updateCartItemSchema }),
  canAccessCart,
  cart.updateItem,
);
router.delete(
  "/:userId/items/:productId",
  validate({ params: cartItemParamSchema }),
  canAccessCart,
  cart.removeItem,
);
router.delete(
  "/:userId/clear",
  validate({ params: cartUserParamSchema }),
  canAccessCart,
  cart.clearCart,
);

module.exports = router;
