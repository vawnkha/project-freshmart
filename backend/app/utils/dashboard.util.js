const ApiError = require("../api-error");
const {
  calendarDate,
  localDay,
  TIMEZONE,
} = require("./subscription-schedule.util");
const DAY = 86400000;

function resolvePeriod(query = {}, now = new Date()) {
  const today = localDay(now);
  const midnight = new Date(`${today}T00:00:00+07:00`);
  const preset = query.preset || "month";
  let start = midnight,
    end = new Date(+midnight + DAY);
  if (preset === "7days" || preset === "30days")
    start = new Date(+end - (preset === "7days" ? 7 : 30) * DAY);
  else if (preset === "month")
    start = new Date(`${today.slice(0, 7)}-01T00:00:00+07:00`);
  else if (preset === "year")
    start = new Date(`${today.slice(0, 4)}-01-01T00:00:00+07:00`);
  else if (preset === "custom") {
    calendarDate(query.from);
    calendarDate(query.to);
    start = new Date(`${query.from}T00:00:00+07:00`);
    end = new Date(+new Date(`${query.to}T00:00:00+07:00`) + DAY);
  } else if (preset !== "today")
    throw new ApiError(400, "Khoảng thống kê không hợp lệ");
  const days = Math.round((end - start) / DAY);
  if (days < 1 || days > 366)
    throw new ApiError(400, "Khoảng thống kê phải từ 1 đến 366 ngày");
  const previousStart = new Date(+start - days * DAY);
  return {
    preset,
    from: localDay(start),
    to: localDay(new Date(+end - 1)),
    start,
    end,
    previousStart,
    previousEnd: start,
    days,
    groupBy: days > 62 ? "month" : "day",
    timezone: TIMEZONE,
  };
}

function growth(current, previous) {
  return previous === 0
    ? null
    : ((current - previous) / Math.abs(previous)) * 100;
}

function fillSeries(rows, period, { costsComplete = true } = {}) {
  const map = new Map(rows.map((row) => [row._id, row]));
  const result = [],
    seen = new Set();
  for (let time = +period.start; time < +period.end; time += DAY) {
    const day = localDay(new Date(time));
    const key = period.groupBy === "month" ? day.slice(0, 7) : day;
    if (seen.has(key)) continue;
    seen.add(key);
    const row = map.get(key);
    const revenue = row?.revenue || 0;
    const cogs = costsComplete ? row?.cogs || 0 : null;
    result.push({
      date: key,
      revenue,
      cogs,
      profit: cogs === null ? null : revenue - cogs,
    });
  }
  return result;
}

module.exports = { resolvePeriod, growth, fillSeries, DAY, TIMEZONE };
