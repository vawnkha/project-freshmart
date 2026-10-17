export function pendingPaypalKey(userId) { return `pending-paypal:${userId}`; }

export function readPendingPaypal(storage, userId) {
  const raw = storage.getItem(pendingPaypalKey(userId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed?.id === "string" && parsed.id && ["created", "capture"].includes(parsed.phase) ? parsed : null;
  } catch {
    return null; // Corrupt browser state is never submitted as a payment ID.
  }
}

export function savePendingPaypal(storage, userId, payment) {
  if (payment) storage.setItem(pendingPaypalKey(userId), JSON.stringify(payment));
  else storage.removeItem(pendingPaypalKey(userId));
}
