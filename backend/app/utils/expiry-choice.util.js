const { read } = require('../config/environment');
const ApiError = require('../api-error');
function normalizeChoice(value) {
  if (value == null) return null; // Existing carts/orders/subscriptions retain global FEFO.
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiError(400, 'Lựa chọn hạn dùng không hợp lệ');
  if (value.group === 'promotion' && /^[a-f\d]{24}$/i.test(String(value.discountId || ''))) return { group: 'promotion', discountId: String(value.discountId).toLowerCase() };
  if (value.group === 'long') return { group: 'long', minRemainingDays: Math.max(read('EXPIRY_LONG_MIN_DAYS'), Number.isSafeInteger(value.minRemainingDays) ? value.minRemainingDays : 0) };
  if (value.group === 'other') return { group: 'other' };
  throw new ApiError(400, 'Lựa chọn hạn dùng không hợp lệ');
}
function choiceKey(productId, value) {
  const choice = normalizeChoice(value);
  return String(productId) + (choice ? ':' + choice.group + (choice.discountId ? ':' + choice.discountId : '') : '');
}
function choiceLabel(choice) { return choice?.group === 'long' ? 'Hàng có hạn sử dụng dài' : choice?.group === 'promotion' ? 'Hàng giảm giá cận hạn' : choice?.group === 'other' ? 'Hàng hạn dùng khác' : 'Theo FEFO trước đây'; }
module.exports = { normalizeChoice, choiceKey, choiceLabel };
