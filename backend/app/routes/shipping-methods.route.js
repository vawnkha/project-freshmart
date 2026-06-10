const express = require("express");
const controller = require("../controllers/shipping-methods.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const { idParamSchema } = require("../validators/common.validator");
const {
  createShippingMethodSchema,
  updateShippingMethodSchema,
} = require("../validators/shipping-method.validator");

const router = express.Router();
const canManageShippingMethods =
  authMiddleware.authorizePermissions("shipping-method:manage");

router.get("/", authMiddleware.optional, controller.findAll);
router.post(
  "/",
  authMiddleware,
  canManageShippingMethods,
  validate({ body: createShippingMethodSchema }),
  controller.create,
);
router
  .route("/:id")
  .get(
    authMiddleware,
    canManageShippingMethods,
    validate({ params: idParamSchema }),
    controller.findOne,
  )
  .put(
    authMiddleware,
    canManageShippingMethods,
    validate({ params: idParamSchema, body: updateShippingMethodSchema }),
    controller.update,
  )
  .delete(
    authMiddleware,
    canManageShippingMethods,
    validate({ params: idParamSchema }),
    controller.remove,
  );

module.exports = router;
