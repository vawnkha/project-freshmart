const express = require("express");
const router = express.Router();
const addresses = require("../controllers/addresses.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  addressIdParamSchema,
  addressByUserQuerySchema,
  createAddressSchema,
  updateAddressSchema,
} = require("../validators/address.validator");

router.use(authMiddleware);

router.get(
  "/",
  validate({ query: addressByUserQuerySchema }),
  authMiddleware.authorizeOwnerOrPermissions(
    (req) => req.query.userId,
    "address:manage:any",
  ),
  addresses.findByUser,
);
router.post(
  "/",
  validate({ body: createAddressSchema }),
  authMiddleware.authorizeOwnerOrPermissions(
    (req) => req.body.user_id,
    "address:manage:any",
  ),
  addresses.create,
);
router.put("/:id", validate({ params: addressIdParamSchema, body: updateAddressSchema }), addresses.update);
router.delete("/:id", validate({ params: addressIdParamSchema }), addresses.delete);

module.exports = router;
