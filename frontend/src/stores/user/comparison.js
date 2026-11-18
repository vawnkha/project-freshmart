import { defineStore } from 'pinia';
import { ref, computed, watch, onScopeDispose } from 'vue';
import productService from '@/services/product.service';
import { normalizeId } from '@/utils/id.util';
const KEY = 'product-comparison-ids';
const valid = id => typeof id === 'string' && /^[a-f\d]{24}$/i.test(id);
export const useComparisonStore = defineStore('product-comparison', () => {
  function restore() {
    try { const saved = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(saved) ? [...new Set(saved.filter(valid).map(id => id.toLowerCase()))].slice(0,3) : []; } catch { return []; }
  }
  const ids = ref(restore()), records = ref([]), loading = ref(false), error = ref('');
  let generation = 0, alive = true;
  const canCompare = computed(() => ids.value.length >= 2 && ids.value.length <= 3);
  const selected = id => ids.value.includes(String(id).toLowerCase());
  function setIds(values) {
    if (!Array.isArray(values) || !values.every(valid)) { error.value = 'Product ID không hợp lệ.'; return false; }
    const unique = [...new Set(values.map(id => id.toLowerCase()))];
    if (unique.length > 3) { error.value = 'Chỉ so sánh tối đa 3 sản phẩm. Hãy bỏ chọn một sản phẩm trước.'; return false; }
    if (unique.join(',') !== ids.value.join(',')) ids.value = unique;
    error.value = ''; return true;
  }
  function toggle(product) {
    const id = normalizeId(product?._id || product?.id || product);
    if (selected(id)) return setIds(ids.value.filter(value => value !== id));
    if (product?.status !== 'active') { error.value = 'Chỉ so sánh sản phẩm đã xuất bản.'; return false; }
    return setIds([...ids.value,id]);
  }
  const remove = id => setIds(ids.value.filter(value => value !== id));
  const clear = () => setIds([]);
  function replace(id, product) {
    const next = normalizeId(product?._id || product?.id);
    if (!valid(next) || product.status !== 'active' || selected(next)) { error.value = 'Hãy chọn sản phẩm đã xuất bản và chưa có trong danh sách.'; return false; }
    return setIds(ids.value.map(value => value === id ? next : value));
  }
  async function refresh() {
    const run = ++generation, selection = [...ids.value];
    records.value = []; error.value = '';
    if (!selection.length) { loading.value = false; return; }
    loading.value = true;
    try {
      const response = selection.length >= 2 ? await productService.compare(selection) : { data: [await productService.getById(selection[0])] };
      if (!alive || run !== generation) return;
      if (!Array.isArray(response.data) || response.data.length !== selection.length || response.data.some((p,i) => normalizeId(p._id) !== selection[i] || p.status !== 'active')) throw new Error('Sản phẩm không còn được xuất bản.');
      records.value = response.data;
    } catch (cause) {
      if (alive && run === generation) error.value = cause.response?.status === 404 ? 'Có sản phẩm không còn được xuất bản. Hãy bỏ chọn hoặc thay thế sản phẩm.' : 'Không tải được dữ liệu so sánh mới nhất. Vui lòng thử lại.';
    } finally { if (alive && run === generation) loading.value = false; }
  }
  watch(ids, () => { try { localStorage.setItem(KEY, JSON.stringify(ids.value)); } catch { /* Comparison still works when browser storage is unavailable. */ } }, { flush: 'sync' });
  onScopeDispose(() => { alive = false; ++generation; });
  return { ids, records, loading, error, canCompare, selected, setIds, toggle, remove, clear, replace, refresh };
});
