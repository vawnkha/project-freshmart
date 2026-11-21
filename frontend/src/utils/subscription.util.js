export const subscriptionLabels = Object.freeze({ active: 'Đang hoạt động', paused: 'Tạm dừng', cancelled: 'Đã hủy', completed: 'Đã hoàn tất' });
export const runLabels = Object.freeze({ scheduled: 'Chưa đến kỳ', processing: 'Đang xử lý', order_created: 'Đã tạo đơn', pending_payment: 'Chờ thanh toán', pending_confirmation: 'Cần xác nhận giá', failed: 'Xử lý thất bại', skipped: 'Đã bỏ qua' });
export const frequencyLabel = value => value === 'monthly' ? 'Hằng tháng' : 'Mỗi 14 ngày';
export const subscriptionPaymentLabel = value => ({ pending: 'Chờ thanh toán', awaiting_capture: 'Chờ hoàn tất PayPal', capture_unknown: 'Cần kiểm tra kết quả PayPal', completed: 'Đã thanh toán', paid: 'Đã thanh toán', failed: 'Thanh toán chưa hoàn tất', refunded: 'Đã hoàn tiền', refund_pending: 'Đang hoàn tiền', canceled: 'Đã hủy thanh toán' })[value] || 'Chưa xác định';
export const subscriptionMoney = value => Number.isFinite(Number(value)) ? Number(value).toLocaleString('vi-VN') + ' đ' : 'Chưa xác định';
export function subscriptionDate(value) {
  if (!value) return '—';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(value + 'T00:00:00+07:00') : new Date(value);
  return Number.isNaN(+date) ? '—' : date.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' });
}
export function subscriptionPayload(form) {
  return {
    items: form.items.map(item => ({ productId: String(item.productId), quantity: Number(item.quantity) })),
    frequency: form.frequency, startDate: form.startDate,
    ...(form.endMode === 'date' ? { endDate: form.endDate } : { maxOccurrences: Number(form.maxOccurrences) }),
    addressId: form.addressId, shippingMethodId: form.shippingMethodId, paymentMethod: form.paymentMethod,
    notes: String(form.notes || '').trim(), discountCode: String(form.discountCode || '').trim(),
    maximumTotal: Number(form.maximumTotal), consent: true,
  };
}
export function subscriptionItemsProblem(items) {
  if (!items.length) return 'Chọn ít nhất một sản phẩm.';
  if (items.some(item => !/^[a-f\d]{24}$/i.test(item.productId) || !Number.isSafeInteger(Number(item.quantity)) || Number(item.quantity) < 1 || Number(item.quantity) > 10000)) return 'Số lượng mỗi kỳ phải là số nguyên từ 1 đến 10.000.';
  if (new Set(items.map(item => item.productId)).size !== items.length) return 'Không chọn trùng sản phẩm.';
  return '';
}
export function subscriptionFormProblem(form) {
  const itemsProblem = subscriptionItemsProblem(form.items);
  if (itemsProblem) return itemsProblem;
  if (!form.startDate || (form.endMode === 'date' && (!form.endDate || form.endDate < form.startDate))) return 'Kiểm tra ngày bắt đầu và kết thúc.';
  if (form.endMode !== 'date' && (!Number.isSafeInteger(Number(form.maxOccurrences)) || Number(form.maxOccurrences) < 1 || Number(form.maxOccurrences) > 120)) return 'Số kỳ phải từ 1 đến 120.';
  if (!form.addressId || !form.shippingMethodId) return 'Chọn địa chỉ và phương thức vận chuyển.';
  if (!Number.isSafeInteger(Number(form.maximumTotal)) || Number(form.maximumTotal) < 1) return 'Nhập giới hạn tổng tiền mỗi kỳ.';
  return '';
}
export function subscriptionLoginReturn(value) {
  if (typeof value !== 'string' || value.length > 2048 || /[\\\u0000-\u001f]/.test(value)) return null;
  if (!/^\/account\/subscriptions\/new(?:\?[^#]*)?$/.test(value)) return null;
  const url = new URL(value, 'https://freshmart.local');
  for (const key of url.searchParams.keys()) if (!['productId', 'quantity'].includes(key)) return null;
  if (url.searchParams.has('productId') && !/^[a-f\d]{24}$/i.test(url.searchParams.get('productId'))) return null;
  if (url.searchParams.has('quantity') && (!/^\d+$/.test(url.searchParams.get('quantity')) || Number(url.searchParams.get('quantity')) < 1 || Number(url.searchParams.get('quantity')) > 10000)) return null;
  return url.pathname + url.search;
}
