const express = require("express");
const contacts = require("../controllers/contacts.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const { publicWriteLimiter } = require("../middlewares/rate-limit.middleware");
const validate = require("../middlewares/validate.middleware");
const { idParamSchema } = require("../validators/common.validator");
const {
  createContactSchema,
  replyContactSchema,
} = require("../validators/contact.validator");

const router = express.Router();

router
  .route("/")
  .post(
    publicWriteLimiter,
    validate({ body: createContactSchema }),
    contacts.create,
  )
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
    validate({ params: idParamSchema }),
    contacts.findOne,
  )
  .delete(
    authMiddleware,
    authMiddleware.authorizePermissions("contact:delete"),
    validate({ params: idParamSchema }),
    contacts.delete,
  );

router
  .route("/:id/reply")
  .patch(
    authMiddleware,
    authMiddleware.authorizePermissions("contact:reply"),
    validate({ params: idParamSchema, body: replyContactSchema }),
    contacts.reply,
  );

module.exports = router;
