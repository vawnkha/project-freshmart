const express = require("express");
const contacts = require("../controllers/contacts.controller");
const authMiddleware = require("../middlewares/auth.middleware");

const router = express.Router();

router
  .route("/")
  .post(contacts.create)
  .get(
    authMiddleware,
    authMiddleware.authorizePermissions("contact:read"),
    contacts.findAll,
  )
  .delete(
    authMiddleware,
    authMiddleware.authorizePermissions("contact:delete"),
    contacts.deleteAll,
  );

router
  .route("/:id")
  .get(
    authMiddleware,
    authMiddleware.authorizePermissions("contact:read"),
    contacts.findOne,
  )
  .delete(
    authMiddleware,
    authMiddleware.authorizePermissions("contact:delete"),
    contacts.delete,
  );

router
  .route("/:id/reply")
  .patch(
    authMiddleware,
    authMiddleware.authorizePermissions("contact:reply"),
    contacts.reply,
  );

module.exports = router;
