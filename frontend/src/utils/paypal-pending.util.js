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

export function paypalTerminalKey(userId) { return `paypal-terminal:${userId}`; }

export function readPaypalTerminal(storage, userId) {
  const raw = storage.getItem(paypalTerminalKey(userId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const createdAt = new Date(parsed?.createdAt).getTime();
    if (!parsed?.message || !Number.isFinite(createdAt) || Date.now() - createdAt > 7 * 24 * 60 * 60 * 1000) {
      storage.removeItem(paypalTerminalKey(userId));
      return null;
    }
    return parsed;
  } catch {
    storage.removeItem(paypalTerminalKey(userId));
    return null;
  }
}

export function savePaypalTerminal(storage, userId, result) {
  if (result) storage.setItem(paypalTerminalKey(userId), JSON.stringify(result));
  else storage.removeItem(paypalTerminalKey(userId));
}
