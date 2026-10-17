const MongoDB = require("./mongodb.util");
const NotificationsService = require("../services/notifications.service");
const { emitAdminNotification } = require("./socket.util");

async function notifyAdmin(payload, options = {}) {
  const notificationsService = new NotificationsService(MongoDB.client);

  const notification = await notificationsService.create({
    type: payload.type,
    title: payload.title,
    content: payload.content,
    data: payload.data || {},
    is_read: false,
    outbox_event_id: options.eventId,
  });

  emitAdminNotification({
    id: String(notification._id),
    _id: String(notification._id),
    type: notification.type,
    title: notification.title,
    content: notification.content,
    data: notification.data,
    is_read: notification.is_read,
    created_at: notification.created_at,
    updated_at: notification.updated_at,
  });

  return notification;
}

module.exports = {
  notifyAdmin,
};
