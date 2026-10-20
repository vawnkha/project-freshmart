export const expiryLabels = { normal: "Bình thường", warning: "Sắp hết hạn", urgent: "Gần hết hạn", expired: "Hết hạn", unknown: "Thiếu hạn sử dụng" };
export const proposalLabels = { draft: "Nháp", pending: "Chờ duyệt", approved: "Đã duyệt / chờ bắt đầu", active: "Đang áp dụng", rejected: "Từ chối", expired: "Đã kết thúc", cancelled: "Đã hủy" };
export const expiryClass = status => ({ normal: "admin-badge--info", warning: "admin-badge--warning", urgent: "admin-badge--danger", expired: "admin-badge--danger", unknown: "admin-badge--warning" }[status]);
export const expiryDate = value => value ? new Date(value).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "Chưa xác định";
export const money = value => Number(value || 0).toLocaleString("vi-VN") + " ₫";
export function vietnamInput(value) {
  if (!value) return "";
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value)).map(part => [part.type, part.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
export function proposalPayload(form, recommendation) {
  const percent = Number(form.percent), quantity = Number(form.quantity);
  if (!(percent > 0 && percent <= recommendation.maxPercent)) throw new Error(`Mức giảm phải lớn hơn 0 và không quá ${recommendation.maxPercent}%.`);
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > recommendation.availableQuantity) throw new Error("Số lượng phải là số nguyên dương và không vượt tồn kho.");
  const startDate = `${form.startDate}:00+07:00`, endDate = `${form.endDate}:00+07:00`;
  if (!form.startDate || !form.endDate || !Number.isFinite(Date.parse(startDate)) || !Number.isFinite(Date.parse(endDate)) || Date.parse(endDate) <= Date.parse(startDate)
    || Date.parse(endDate) > Date.parse(recommendation.sellableUntil) || Date.parse(endDate) <= Date.now()) throw new Error("Kiểm tra thời gian: kết thúc sau bắt đầu và không vượt 00:00 ngày hết hạn (giờ Việt Nam).");
  return { percent, quantity, startDate, endDate, note: form.note, status: form.status };
}
