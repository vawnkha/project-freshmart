import { ref, shallowRef, watch, onBeforeUnmount } from 'vue';
import productService from '@/services/product.service';
import { catalogResponse } from '@/utils/catalog-query.util';
export function useCatalogProducts(state) {
  const products = shallowRef([]), loading = ref(true), error = ref('');
  let version = 0, disposed = false;
  async function load() {
    if (disposed) return;
    const current = ++version; loading.value = true; error.value = ''; products.value = [];
    if (state.value.errors.category_id) { loading.value = false; return; }
    const params = { q: state.value.q || undefined, category_id: state.value.category_id || undefined };
    try {
      const result = catalogResponse(await productService.getAll(params));
      if (!disposed && current === version) products.value = result;
    } catch (cause) {
      if (!disposed && current === version) {
        error.value = 'Không thể tải danh sách sản phẩm. Vui lòng thử lại.';
        console.warn('[Catalog] Public GET failed', { name: cause.name, status: cause.response?.status, message: cause.message });
      }
    } finally { if (!disposed && current === version) loading.value = false; }
  }
  watch([() => state.value.q, () => state.value.category_id], load, { immediate: true });
  onBeforeUnmount(() => { disposed = true; ++version; });
  return { products, loading, error, load };
}
