const config = require("../config/expiry");
const DAY = 86400000;
const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: config.timezone, year: "numeric", month: "2-digit", day: "2-digit",
});
function calendarDate(value) {
  if (value === null || value === undefined || value === "") return null;
  // A date-only form value is already a calendar date, independent of server TZ.
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : null;
  }
  if (typeof value === "string" && !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return null;
  const parts = Object.fromEntries(formatter.formatToParts(parsed).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
function normalizeExpiryDate(value) {
  const day = calendarDate(value);
  return day ? new Date(`${day}T00:00:00Z`) : null;
}
function startOfExpiryDay(value) {
  const day = calendarDate(value);
  return day ? new Date(`${day}T00:00:00+07:00`) : null;
}
function nextVietnamMidnight(now = new Date()) {
  return new Date(startOfExpiryDay(now).getTime() + DAY);
}
function classifyExpiry(value, now = new Date()) {
  const expiryCalendarDate = calendarDate(value);
  const daysRemaining = expiryCalendarDate
    ? (Date.parse(`${expiryCalendarDate}T00:00:00Z`) - Date.parse(`${calendarDate(now)}T00:00:00Z`)) / DAY : null;
  const expiryStatus = daysRemaining === null ? "unknown" : daysRemaining <= 0 ? "expired"
    : daysRemaining <= config.urgentDays ? "urgent" : daysRemaining <= config.warningDays ? "warning" : "normal";
  return { daysRemaining, expiryStatus, expiryCalendarDate, sellableUntil: startOfExpiryDay(value) };
}
function isBatchSellable(batch, now = new Date()) {
  return batch?.status === "available" && batch.expiryDate instanceof Date && Number(batch.quantity) > 0 && classifyExpiry(batch.expiryDate, now).daysRemaining > 0;
}
module.exports = { DAY, calendarDate, normalizeExpiryDate, startOfExpiryDay, nextVietnamMidnight, classifyExpiry, isBatchSellable };
