// Presentation only. Financial totals and business rules remain in the API.
const moneyFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});
const numberFormatter = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 1,
});
export const number = (value) =>
  value == null ? "—" : numberFormatter.format(value);
export const money = (value) =>
  value == null ? "Chưa có dữ liệu" : moneyFormatter.format(value);
export function date(value, options = {}) {
  if (!value) return "—";
  const parsed = new Date(
    /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00+07:00` : value,
  );
  if (!Number.isFinite(+parsed)) return "—";
  const formatter = new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...options,
  });
  if (Object.hasOwn(options, "year") && options.year === undefined) {
    const parts = Object.fromEntries(
      formatter.formatToParts(parsed).map((part) => [part.type, part.value]),
    );
    return `${parts.day}/${parts.month}`;
  }
  return formatter.format(parsed);
}
export const stamp = (value) =>
  date(value, { hour: "2-digit", minute: "2-digit" });
export const shortId = (value) =>
  value ? String(value).slice(-8).toUpperCase() : "—";
export const orderLabels = {
  awaiting_payment: "Chờ thanh toán",
  pending: "Chờ xác nhận",
  processing: "Đang xử lý",
  confirmed: "Đang xử lý",
  shipping: "Đang giao",
  completed: "Hoàn thành",
  delivered: "Hoàn thành",
  canceled: "Đã hủy",
  cancelled: "Đã hủy",
  cancel_pending: "Chờ hoàn tiền",
};
export const paymentLabels = {
  failed: "Thất bại",
  capture_unknown: "Cần đối soát PayPal",
  refund_pending: "Chờ hoàn tiền",
};
export const sectionLabels = {
  financial: "tài chính",
  cash: "dòng tiền",
  orders: "đơn hàng",
  subscriptions: "giao định kỳ",
  sales: "bán hàng",
  inventory: "kho hàng",
  purchases: "nhập hàng",
  customers: "khách hàng",
};
export function shareWidth(value, maximum) {
  return Number.isFinite(value) && maximum > 0
    ? Math.max(0, Math.min(100, (value / maximum) * 100))
    : 0;
}

export function dashboardAlerts(data) {
  if (!data) return [];
  const definitions = [
    [
      "Lô hết hạn còn tồn",
      data.inventory?.expiry.expired,
      "/admin/inventory-expiry?status=expired",
      "fa-calendar-xmark",
      "danger",
    ],
    [
      "Hết tồn khả dụng",
      data.inventory?.outOfStock,
      "/admin/inventory-summaries",
      "fa-box-open",
      "danger",
    ],
    [
      "Quá ngày giao mong muốn",
      data.subscriptions?.overdue,
      "/admin/subscriptions",
      "fa-clock",
      "danger",
    ],
    [
      "Thanh toán cần rà soát",
      data.orders?.reconciliation,
      "/admin/orders",
      "fa-credit-card",
      "danger",
    ],
    [
      "Kỳ tạo đơn thất bại",
      data.subscriptions?.failed,
      "/admin/subscriptions",
      "fa-triangle-exclamation",
      "danger",
      "Trong kỳ",
    ],
    [
      "Lô gần hết hạn",
      data.inventory?.expiry.urgent,
      "/admin/inventory-expiry?status=urgent",
      "fa-calendar-check",
      "warning",
    ],
    [
      "Kỳ có ngày mong muốn trong 7 ngày",
      data.subscriptions?.upcoming?.length ? data.subscriptions.next7days : 0,
      "/admin/subscriptions",
      "fa-calendar-days",
      "warning",
    ],
    [
      "Kỳ có ngày mong muốn hôm nay",
      data.subscriptions?.today,
      "/admin/subscriptions",
      "fa-truck-fast",
      "warning",
    ],
    [
      "Đơn mới chờ xác nhận",
      data.orders?.pendingNow,
      "/admin/orders?status=pending",
      "fa-cart-shopping",
      "warning",
    ],
    [
      "Tồn dưới ngưỡng tối thiểu",
      data.inventory?.lowStock,
      "/admin/inventory-summaries",
      "fa-boxes-stacked",
      "warning",
    ],
    [
      "Lô sắp hết hạn",
      data.inventory?.expiry.warning,
      "/admin/inventory-expiry?status=warning",
      "fa-calendar-days",
      "warning",
    ],
    [
      "Lô thiếu hạn sử dụng",
      data.inventory?.expiry.unknown,
      "/admin/inventory-expiry?status=unknown",
      "fa-circle-question",
      "warning",
    ],
  ];
  return definitions
    .map(([label, count, to, icon, tone, scope = "Hiện tại"]) => ({
      label,
      count,
      to,
      icon,
      tone,
      scope,
    }))
    .filter((item) => item.count > 0);
}
