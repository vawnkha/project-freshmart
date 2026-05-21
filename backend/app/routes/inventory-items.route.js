const express = require("express");
const inventoryItems = require("../controllers/inventory-items.controller");
const authMiddleware = require("../middlewares/auth.middleware");

const router = express.Router();
const canManageInventory =
  authMiddleware.authorizePermissions("inventory:manage");

router.use(authMiddleware, canManageInventory);

router
  .route("/")
  .get(inventoryItems.findAll)
  .post(inventoryItems.create);

router
  .route("/:id")
  .get(inventoryItems.findOne)
  .put(inventoryItems.update)
  .delete(inventoryItems.delete);

module.exports = router;
