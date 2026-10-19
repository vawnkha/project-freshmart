import { ref, shallowRef, watch, onBeforeUnmount } from 'vue';
import productService from '@/services/product.service';
import { catalogResponse, catalogUnitOptions } from '@/utils/catalog-query.util';
export function useCatalogProducts(state) {
  const products = shallowRef([]), units = shallowRef([]), loading = ref(true), error = ref('');
  let version = 0, disposed = false, controller;
  async function load() {
    if (disposed) return;
    controller?.abort();
    controller = new AbortController();
    const current = ++version; loading.value = true; error.value = ''; products.value = [];
    if (Object.keys(state.value.errors).length) { loading.value = false; return; }
    const params = { q: state.value.q || undefined, category_id: state.value.category_id || undefined, unit: state.value.unit.length ? state.value.unit : undefined, include_units: '1' };
    try {
      const response = await productService.getAll(params, { signal: controller.signal });
      const result = catalogResponse(response), options = catalogUnitOptions(response, result);
      if (!disposed && current === version) { products.value = result; units.value = options; }
    } catch (cause) {
      if (!disposed && current === version) {
        error.value = 'Không thể tải danh sách sản phẩm. Vui lòng thử lại.';
        console.warn('[Catalog] Public GET failed', { name: cause.name, status: cause.response?.status, message: cause.message });
      }
    } finally { if (!disposed && current === version) loading.value = false; }
  }
  watch([() => state.value.q, () => state.value.category_id, () => JSON.stringify(state.value.unit), () => Object.keys(state.value.errors).join(',')], load, { immediate: true });
  onBeforeUnmount(() => { disposed = true; ++version; controller?.abort(); });
  return { products, units, loading, error, load };
}
