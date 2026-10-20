function number(name, fallback, min, max) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(`Invalid ${name}`);
  return value;
}
const warningDays = number("EXPIRY_WARNING_DAYS", 60, 2, 3650);
const urgentDays = number("EXPIRY_URGENT_DAYS", 30, 1, warningDays - 1);
module.exports = Object.freeze({
  timezone: "Asia/Ho_Chi_Minh", warningDays, urgentDays,
  warningDiscount: number("EXPIRY_WARNING_DISCOUNT", 10, 1, 100),
  urgentDiscount: number("EXPIRY_URGENT_DISCOUNT", 20, 1, 100),
  maxDiscount: number("EXPIRY_MAX_DISCOUNT", 20, 1, 100),
});
