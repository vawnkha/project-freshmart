import { normalizeId } from './id.util.js';
import { publicSearchProducts } from './storefront-shell.util.js';
import { catalogStock, catalogResponse } from './catalog-query.util.js';

export const detailId = value => normalizeId(value);
export const validDetailId = value => /^[a-f\d]{24}$/i.test(detailId(value));
const text = value => typeof value === 'string' ? value.trim() : '';

export function productGallery(product) {
  const images = Array.isArray(product?.images) ? product.images : [product?.images];
  return [...new Set([product?.thumbnail, ...images].map(text).filter(Boolean))];
}

export function detailProduct(response, requestedId) {
  if (!response || typeof response !== 'object' || Array.isArray(response) ||
      detailId(response._id || response.id) !== detailId(requestedId)) {
    throw new TypeError('Unexpected public product detail response');
  }
  return publicSearchProducts([response])[0] || null;
}

export function categoryProducts(response, product) {
  const category = detailId(product.category_id);
  return catalogResponse(response).filter(row =>
    detailId(row._id || row.id) !== detailId(product._id || product.id) &&
    detailId(row.category_id) === category,
  ).slice(0, 4);
}

export function quantityMessage(value, max) {
  const raw = String(value ?? '').trim(), quantity = Number(raw);
  if (!raw || !Number.isSafeInteger(quantity) || quantity < 1) return 'Nhập số lượng nguyên từ 1 trở lên.';
  if (max === null) return 'Chưa xác định số lượng khả dụng. Vui lòng tải lại sản phẩm.';
  if (quantity > max) return max < 1
    ? 'Không còn số lượng có thể thêm vào giỏ.'
    : 'Chỉ có thể thêm tối đa ' + max + ' sản phẩm với giỏ hàng hiện tại.';
  return '';
}

export function detailStock(product) {
  return catalogStock(product);
}

export function productFields(product, group) {
  const fields = group === 'usage'
    ? [['usageInstruction', 'Hướng dẫn sử dụng'], ['dosage', 'Liều lượng'], ['storage', 'Bảo quản']]
    : [['ingredients', 'Thành phần'], ['usagePurpose', 'Công dụng'], ['targetSpecies', 'Đối tượng sử dụng'], ['suitableStage', 'Giai đoạn phù hợp'], ['certification', 'Chứng nhận']];
  const rows = fields.flatMap(([key, label]) => text(product?.[key]) ? [{ key, label, value: text(product[key]) }] : []);
  // Preserve the existing legacy reader without writing legacy fields.
  if (group === 'usage' && !text(product?.usageInstruction) && text(product?.usage)) {
    rows.unshift({ key: 'usage', label: 'Hướng dẫn sử dụng', value: text(product.usage) });
  }
  return rows;
}

export function productSpecifications(product) {
  const scalar = value => typeof value === 'string' || typeof value === 'number'
    ? String(value).trim() : '';
  const rows = [['productCode', 'Mã sản phẩm'], ['unit', 'Đơn vị'], ['origin', 'Xuất xứ']]
    .flatMap(([key, label]) => scalar(product?.[key]) ? [{ label, value: scalar(product[key]) }] : []);
  const packageSize = scalar(product?.packageSize ?? product?.inventoryItem?.packageSize);
  if (packageSize) rows.push({ label: 'Quy cách đóng gói', value: packageSize });
  const specs = product?.specifications;
  if (Array.isArray(specs)) {
    for (const row of specs) {
      const label = text(row?.label || row?.name), value = scalar(row?.value);
      if (label && value) rows.push({ label, value });
    }
  } else if (specs && typeof specs === 'object') {
    for (const [label, value] of Object.entries(specs)) {
      if (scalar(value)) rows.push({ label, value: scalar(value) });
    }
  } else if (text(specs)) rows.push({ label: 'Thông số sản phẩm', value: text(specs) });
  return rows;
}

export function reviewResponse(response) {
  if (!Array.isArray(response?.reviews) || !response.stars ||
      response.reviews.some(row => !row || !Number.isInteger(Number(row.rating)) || Number(row.rating) < 1 || Number(row.rating) > 5)) {
    throw new TypeError('Unexpected product reviews response');
  }
  const total = Number(response.stars.total_reviews), average = Number(response.stars.average_rating);
  if (!Number.isSafeInteger(total) || total < 0 || !Number.isFinite(average) || average < 0 || average > 5) {
    throw new TypeError('Unexpected product rating summary');
  }
  return { items: response.reviews, summary: { total, average } };
}

export function reviewErrors(form) {
  const errors = {}, rating = Number(form.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) errors.rating = 'Chọn số sao từ 1 đến 5.';
  if (!text(form.comment)) errors.comment = 'Vui lòng nhập nội dung đánh giá.';
  else if (form.comment.length > 5000) errors.comment = 'Nội dung không được vượt quá 5.000 ký tự.';
  return errors;
}
