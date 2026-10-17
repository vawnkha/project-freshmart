export function normalizeList(value) {
  return Array.isArray(value?.data)
    ? value.data
    : Array.isArray(value)
      ? value
      : [];
}

// API stock is already calculated from sellable batches; never recompute batch totals here.
export function availableStock(product) {
  const value = Number(product?.availableStock ?? product?.stock ?? 0);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function productPrice(product) {
  const raw = product?.price ?? product?.sellingPrice;
  if (raw === null || raw === undefined || raw === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export function formatMoney(value) {
  return Number(value || 0).toLocaleString("vi-VN") + " đ";
}

export function productComparePrice(product) {
  const price = productPrice(product);
  const compare = Number(product?.comparePrice);
  return price !== null && Number.isFinite(compare) && compare > price ? compare : null;
}

export function sortProducts(products, sort) {
  return [...products].sort((a, b) => {
    if (sort === "price-asc")
      return (productPrice(a) ?? Infinity) - (productPrice(b) ?? Infinity);
    if (sort === "price-desc")
      return (productPrice(b) ?? -Infinity) - (productPrice(a) ?? -Infinity);
    if (sort === "name-asc")
      return String(a.name || "").localeCompare(String(b.name || ""), "vi");
    if (sort === "name-desc")
      return String(b.name || "").localeCompare(String(a.name || ""), "vi");
    return (
      (Date.parse(b.createdAt || b.created_at) || 0) -
      (Date.parse(a.createdAt || a.created_at) || 0)
    );
  });
}
export function orderStatusLabel(order) {
  return (
    {
      awaiting_payment: "Chờ thanh toán",
      pending: "Chờ xác nhận",
      confirmed: "Đã xác nhận",
      processing: "Đang xử lý",
      shipping: "Đang giao",
      delivered: "Đã giao",
      completed: "Hoàn thành",
      canceled: "Đã hủy",
      cancelled: "Đã hủy",
      cancel_pending: "Đang xử lý hủy",
    }[order.rawStatus] ||
    order.status ||
    "Chưa rõ trạng thái"
  );
}

export function orderStatusClass(order) {
  const status = order.rawStatus;
  if (["delivered", "completed"].includes(status)) return "status-success";
  if (["canceled", "cancelled", "cancel_pending"].includes(status))
    return "status-cancelled";
  if (status === "shipping") return "status-shipping";
  return ["confirmed", "processing"].includes(status)
    ? "status-processing"
    : "status-pending";
}
