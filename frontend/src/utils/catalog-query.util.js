import { availableStock, productPrice, sortProducts } from './storefront.util.js';
import { publicSearchProducts } from './storefront-shell.util.js';

export const CATALOG_PAGE_SIZE = 12;
export function catalogStock(product) {
  // Linked inventory requires the aggregate's availableStock. Never fall back
  // to cached Product.stock if that authoritative field is missing.
  if (product?.inventoryItemId && product?.availableStock == null) return null;
  const raw = product?.availableStock ?? product?.stock;
  if (raw == null || raw === '' || !Number.isFinite(Number(raw))) return null;
  return product?.inStock === false ? 0 : availableStock(product);
}
export const CATALOG_SORTS = Object.freeze([
  { value: 'newest', label: 'Mới nhất' }, { value: 'price-asc', label: 'Giá: thấp đến cao' },
  { value: 'price-desc', label: 'Giá: cao đến thấp' }, { value: 'name-asc', label: 'Tên: A–Z' }, { value: 'name-desc', label: 'Tên: Z–A' },
]);
const scalar = value => String((Array.isArray(value) ? value[0] : value) ?? '').trim();
export function catalogUnits(value) {
  return [...new Set((Array.isArray(value) ? value : [value]).filter(item => typeof item === 'string').map(item => item.trim().normalize('NFC')).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi'));
}
export function catalogUnitOptions(response, rows) {
  if (response?.units !== undefined && (!Array.isArray(response.units) || response.units.some(unit => typeof unit !== 'string'))) throw new TypeError('Unexpected catalog unit options');
  return catalogUnits(response?.units ?? rows.map(product => product.unit));
}
export function validateCatalogFilters(value) {
  const errors = {};
  if (value.category_id && !/^[a-f\d]{24}$/i.test(scalar(value.category_id))) errors.category_id = 'Danh mục không hợp lệ. Hãy chọn lại danh mục.';
  for (const key of ['min_price', 'max_price']) {
    const raw = scalar(value[key]);
    if (raw && (!/^\d+(\.\d{1,2})?$/.test(raw) || !Number.isSafeInteger(Math.round(Number(raw) * 100)))) errors[key] = 'Nhập giá không âm hợp lệ (đơn vị đồng).';
  }
  if (!errors.min_price && !errors.max_price && scalar(value.min_price) && scalar(value.max_price) && Number(value.min_price) > Number(value.max_price)) errors.max_price = 'Giá đến phải lớn hơn hoặc bằng giá từ.';
  return errors;
}
export function readCatalogQuery(query = {}) {
  const state = { q: scalar(query.q), category_id: scalar(query.category_id).toLowerCase(), min_price: scalar(query.min_price), max_price: scalar(query.max_price),
    unit: catalogUnits(query.unit),
    sort: CATALOG_SORTS.some(item => item.value === scalar(query.sort)) ? scalar(query.sort) : 'newest',
    page: /^\d+$/.test(scalar(query.page)) && Number.isSafeInteger(Number(query.page)) && Number(query.page) > 0 ? Number(query.page) : 1,
    view: scalar(query.view) === 'list' ? 'list' : 'grid' };
  return { ...state, errors: validateCatalogFilters(state) };
}
export function catalogQuery(query, patch = {}) {
  const state = { ...readCatalogQuery(query), ...patch }, next = { ...query };
  for (const key of ['q', 'category_id', 'min_price', 'max_price', 'availability', 'unit', 'sort', 'page', 'view']) delete next[key];
  for (const key of ['q', 'category_id', 'min_price', 'max_price']) { const value = scalar(state[key]); if (value) next[key] = value; }
  const units = catalogUnits(state.unit);
  if (units.length) next.unit = units;
  if (state.sort !== 'newest') next.sort = state.sort;
  if (state.page > 1) next.page = String(state.page);
  if (state.view === 'list') next.view = 'list';
  return next;
}
export function catalogResponse(response) {
  const rows = Array.isArray(response) ? response : response?.data;
  if (!Array.isArray(rows) || rows.some(row => !row || typeof row !== 'object')) throw new TypeError('Unexpected public catalog response');
  // Current backend returns the complete matching set. Refuse a future partial
  // envelope rather than presenting page-local filters as the whole catalog.
  const total = response?.total ?? response?.meta?.total;
  if ((total != null && Number(total) > rows.length) || response?.meta?.hasMore === true) throw new TypeError('Partial catalog requires server pagination support');
  return publicSearchProducts(rows);
}
export function catalogResults(products, state) {
  const filtered = products.filter(product => {
    const price = productPrice(product);
    if ((state.min_price !== '' || state.max_price !== '') && price === null) return false;
    return (state.min_price === '' || price >= Number(state.min_price)) && (state.max_price === '' || price <= Number(state.max_price)) &&
      (!state.unit.length || state.unit.includes(catalogUnits(product.unit)[0]));
  });
  const sorted = sortProducts(filtered, state.sort), pages = Math.max(1, Math.ceil(sorted.length / CATALOG_PAGE_SIZE)), page = Math.min(state.page, pages);
  return { total: sorted.length, pages, page, items: sorted.slice((page - 1) * CATALOG_PAGE_SIZE, page * CATALOG_PAGE_SIZE),
    start: sorted.length ? (page - 1) * CATALOG_PAGE_SIZE + 1 : 0, end: Math.min(page * CATALOG_PAGE_SIZE, sorted.length) };
}
