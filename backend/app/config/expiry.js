const { read } = require("./environment");
const warningDays = read("EXPIRY_WARNING_DAYS");
const urgentDays = read("EXPIRY_URGENT_DAYS");
if (urgentDays >= warningDays) throw new Error("Invalid environment variable: EXPIRY_URGENT_DAYS");
module.exports = Object.freeze({
  timezone: "Asia/Ho_Chi_Minh", warningDays, urgentDays,
  warningDiscount: read("EXPIRY_WARNING_DISCOUNT"),
  urgentDiscount: read("EXPIRY_URGENT_DISCOUNT"),
  maxDiscount: 100,
});
