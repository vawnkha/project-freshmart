const express = require("express");
const controller = require("../controllers/discounts.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  createDiscountSchema,
  discountIdParamSchema,
  discountQuerySchema,
  updateDiscountSchema,
  validateDiscountSchema,
} = require("../validators/discount.validator");

const router = express.Router();
const canManageDiscounts = authMiddleware.authorizePermissions("discount:manage");

router.get("/public", controller.findPublic);

router.post("/validate", validate({ body: validateDiscountSchema }), controller.validate);

router.use(authMiddleware, canManageDiscounts);

router
  .route("/")
  .get(validate({ query: discountQuerySchema }), controller.findAll)
  .post(validate({ body: createDiscountSchema }), controller.create);
router
  .route("/:id")
  .get(validate({ params: discountIdParamSchema }), controller.findOne)
  .put(
    validate({ params: discountIdParamSchema, body: updateDiscountSchema }),
    controller.update,
  )
  .delete(validate({ params: discountIdParamSchema }), controller.remove);

module.exports = router;
