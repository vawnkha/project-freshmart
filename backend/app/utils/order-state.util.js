const ApiError = require("../api-error");

const STATUS_ALIASES = {
  cancelled: "canceled",
  delivered: "completed",
  confirmed: "processing",
};

const TRANSITIONS = {
  awaiting_payment: new Set(["pending", "canceled"]),
  pending: new Set(["processing", "canceled"]),
  processing: new Set(["shipping", "canceled"]),
  shipping: new Set(["completed"]),
  completed: new Set(),
  canceled: new Set(),
  cancel_pending: new Set(["canceled"]),
};

function normalizeOrderStatus(status) {
  const normalized = String(status || "")
    .trim()
    .toLowerCase();
  return STATUS_ALIASES[normalized] || normalized;
}

function assertOrderTransition(currentStatus, requestedStatus) {
  const current = normalizeOrderStatus(currentStatus);
  const next = normalizeOrderStatus(requestedStatus);
  if (!TRANSITIONS[current]?.has(next)) {
    throw new ApiError(
      409,
      `Không thể chuyển trạng thái đơn hàng từ ${current || "unknown"} sang ${next || "unknown"}`,
    );
  }
  return next;
}

module.exports = { TRANSITIONS, assertOrderTransition, normalizeOrderStatus };
