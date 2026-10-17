const express = require("express");
const notifications = require("../controllers/notifications.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  notificationIdParamSchema,
  notificationQuerySchema,
  createNotificationSchema,
  updateNotificationSchema,
  bulkDeleteNotificationsSchema,
} = require("../validators/notification.validator");

const router = express.Router();

router.use(
  authMiddleware,
  authMiddleware.authorizePermissions("notification:manage"),
);

router
  .route("/")
  .post(validate({ body: createNotificationSchema }), notifications.create)
  .get(validate({ query: notificationQuerySchema }), notifications.findAll)
  .delete(validate({ query: notificationQuerySchema }), notifications.deleteAll);

router.get("/unread-count", notifications.countUnread);
router.patch("/mark-all-read", validate({ query: notificationQuerySchema }), notifications.markAllAsRead);
router.delete("/bulk-delete", validate({ body: bulkDeleteNotificationsSchema }), notifications.deleteMany);

router
  .route("/:id")
  .get(validate({ params: notificationIdParamSchema }), notifications.findOne)
  .patch(validate({ params: notificationIdParamSchema, body: updateNotificationSchema }), notifications.update)
  .delete(validate({ params: notificationIdParamSchema }), notifications.delete);

router.patch("/:id/read", validate({ params: notificationIdParamSchema }), notifications.markAsRead);

module.exports = router;
