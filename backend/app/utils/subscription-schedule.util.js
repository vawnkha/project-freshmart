const ApiError = require("../api-error");
const DAY = 86400000;
const TIMEZONE = "Asia/Ho_Chi_Minh";

function calendarDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new ApiError(400, "Ngày phải có dạng YYYY-MM-DD");
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(+date) || date.toISOString().slice(0, 10) !== value || date.getUTCFullYear() < 2000 || date.getUTCFullYear() > 2100) {
    throw new ApiError(400, "Ngày lịch không hợp lệ");
  }
  return date;
}

function localDay(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function buildSchedule({ frequency, startDate, endDate, maxOccurrences }, { leadDays = 0, limit = 120 } = {}) {
  const start = calendarDate(startDate);
  if (!["every_14_days", "monthly"].includes(frequency)) throw new ApiError(400, "Chu kỳ không hợp lệ");
  if (Boolean(endDate) === Boolean(maxOccurrences)) throw new ApiError(400, "Chọn ngày kết thúc hoặc số kỳ giao, chỉ một điều kiện");
  const end = endDate ? calendarDate(endDate) : null;
  if (end && +end < +start) throw new ApiError(400, "Ngày kết thúc phải từ ngày bắt đầu");
  if (maxOccurrences && (!Number.isSafeInteger(maxOccurrences) || maxOccurrences < 1 || maxOccurrences > limit)) throw new ApiError(400, `Số kỳ phải từ 1 đến ${limit}`);
  const rows = [];
  for (let n = 0; n <= limit; n++) {
    let target;
    if (frequency === "every_14_days") target = new Date(+start + n * 14 * DAY);
    else {
      const first = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + n, 1));
      const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
      target = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(start.getUTCDate(), lastDay)));
    }
    if ((end && +target > +end) || (maxOccurrences && n >= maxOccurrences)) break;
    if (n === limit) throw new ApiError(400, `Lịch giao không được vượt quá ${limit} kỳ`);
    const wishDate = target.toISOString().slice(0, 10);
    // Vietnam midnight, independent of the Node host's timezone.
    const scheduledDate = new Date(`${wishDate}T00:00:00+07:00`);
    rows.push({ occurrenceNumber: n + 1, wishDate, scheduledDate, processAt: new Date(+scheduledDate - leadDays * DAY) });
  }
  return rows;
}

module.exports = { buildSchedule, calendarDate, localDay, TIMEZONE };
