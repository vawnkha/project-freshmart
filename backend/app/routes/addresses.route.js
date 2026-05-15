const express = require("express");
const router = express.Router();
const addresses = require("../controllers/addresses.controller");
const authMiddleware = require("../middlewares/auth.middleware");

router.use(authMiddleware);

router.get(
  "/",
  authMiddleware.authorizeOwnerOrPermissions(
    (req) => req.query.userId,
    "address:manage:any",
  ),
  addresses.findByUser,
);
router.post(
  "/",
  authMiddleware.authorizeOwnerOrPermissions(
    (req) => req.body.user_id,
    "address:manage:any",
  ),
  addresses.create,
);
router.put("/:id", addresses.update);
router.delete("/:id", addresses.delete);

module.exports = router;
