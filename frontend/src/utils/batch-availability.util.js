export function effectiveBatchStatus(batch, item, now = Date.now()) {
  if (batch.status !== "available") return batch.status;
  if (Number(batch.quantity || 0) <= 0) return "sold_out";
  if (batch.expiryDate != null) {
    const expiry = new Date(batch.expiryDate).getTime();
    if (!Number.isFinite(expiry) || expiry < now) return "expired";
  }
  if (!item || (item.status && item.status !== "active")) return "unavailable";
  return "available";
}
