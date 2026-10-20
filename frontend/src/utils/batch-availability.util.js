export function effectiveBatchStatus(batch, item) {
  if (batch.status !== "available") return batch.status;
  if (Number(batch.quantity || 0) <= 0) return "sold_out";
  // Expiry is classified by the backend in the business timezone.
  if (batch.expiryStatus === "expired") return "expired";
  if (batch.expiryStatus === "unknown" || !batch.expiryStatus) return "unavailable";
  if (!item || (item.status && item.status !== "active")) return "unavailable";
  return "available";
}
