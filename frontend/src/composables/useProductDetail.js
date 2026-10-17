import { onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import productService from '@/services/product.service';
import { validDetailId, detailProduct, detailId, categoryProducts } from '@/utils/product-detail.util';

export function useProductDetail(id) {
  const product = shallowRef(null), loading = ref(true), error = ref(''), notFound = ref(false), unavailable = ref(false);
  const related = shallowRef([]), relatedLoading = ref(false), relatedError = ref('');
  let version = 0, relatedVersion = 0, disposed = false;
  const current = run => !disposed && run === version;
  async function loadRelated() {
    const item = product.value, run = version, request = ++relatedVersion;
    related.value = []; relatedError.value = ''; relatedLoading.value = false;
    if (!item || !validDetailId(item.category_id)) return;
    relatedLoading.value = true;
    try {
      const data = await productService.getByCategory(detailId(item.category_id));
      if (current(run) && request === relatedVersion) related.value = categoryProducts(data, item);
    } catch (cause) {
      if (current(run) && request === relatedVersion) relatedError.value = 'Chưa tải được sản phẩm cùng danh mục.';
    } finally { if (current(run) && request === relatedVersion) relatedLoading.value = false; }
  }
  async function load() {
    const run = ++version, requested = detailId(id()); ++relatedVersion;
    loading.value = true; product.value = null; error.value = ''; notFound.value = false; unavailable.value = false;
    related.value = []; relatedError.value = ''; relatedLoading.value = false;
    if (!validDetailId(requested)) { notFound.value = true; loading.value = false; return; }
    try {
      const data = detailProduct(await productService.getById(requested), requested);
      if (!current(run)) return;
      if (!data) unavailable.value = true;
      else { product.value = data; void loadRelated(); }
    } catch (cause) {
      if (current(run)) {
        notFound.value = cause.response?.status === 404 || cause.response?.status === 400;
        unavailable.value = cause.response?.status === 403;
        if (!notFound.value && !unavailable.value) {
          error.value = 'Không thể tải sản phẩm. Vui lòng thử lại.';
          console.warn('[PDP] Public detail GET failed', { name: cause.name, status: cause.response?.status });
        }
      }
    } finally { if (current(run)) loading.value = false; }
  }
  watch(id, load, { immediate: true });
  onBeforeUnmount(() => { disposed = true; ++version; ++relatedVersion; });
  return { product, loading, error, notFound, unavailable, related, relatedLoading, relatedError, load, loadRelated };
}
