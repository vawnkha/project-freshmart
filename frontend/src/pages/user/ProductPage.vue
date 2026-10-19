<script setup>
import { computed, nextTick, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import PageHeading from '@/components/user/common/PageHeading.vue';
import SageButton from '@/components/user/sage/SageButton.vue';
import SageSelect from '@/components/user/sage/SageSelect.vue';
import SageDrawer from '@/components/user/sage/SageDrawer.vue';
import SageSkeleton from '@/components/user/sage/SageSkeleton.vue';
import SageEmptyState from '@/components/user/sage/SageEmptyState.vue';
import SageErrorState from '@/components/user/sage/SageErrorState.vue';
import CatalogFilters from '@/components/user/catalog/CatalogFilters.vue';
import CatalogProductCard from '@/components/user/catalog/CatalogProductCard.vue';
import SageIcon from '@/components/user/sage/SageIcon.vue';
import { useCatalog } from '@/composables/useCatalog';
import { useCatalogProducts } from '@/composables/useCatalogProducts';
import { useCatalogActions } from '@/composables/useCatalogActions';
import { normalizeId } from '@/utils/id.util';
import { CATALOG_SORTS, readCatalogQuery, catalogQuery, catalogResults, validateCatalogFilters } from '@/utils/catalog-query.util';

const route = useRoute(), router = useRouter(), root = ref(), resultHeading = ref(), filterTrigger = ref();
const state = computed(() => readCatalogQuery(route.query));
const { categories, loading: categoryLoading, error: categoryError, loadCategories } = useCatalog();
const { products, units, loading, error, load } = useCatalogProducts(state);
const actions = useCatalogActions();
const results = computed(() => catalogResults(products.value, state.value));
const invalid = computed(() => Object.keys(state.value.errors).length > 0);
const category = computed(() => categories.value.find(item => normalizeId(item._id || item.id) === state.value.category_id));
const title = computed(() => category.value?.name || 'Sản phẩm');
const search = ref(state.value.q), filtersOpen = ref(false);
const filterValues = () => Object.fromEntries(['category_id', 'min_price', 'max_price', 'unit'].map(key => [key, state.value[key]]));
const filters = ref(filterValues()), formErrors = ref({ ...state.value.errors });
const pendingQuery = ref(null);
let priceTimer, filterVersion = 0, syncingFilters = false, priceDirty = false;
const gridKey = computed(() => JSON.stringify([state.value.q, state.value.category_id, state.value.min_price, state.value.max_price, state.value.unit, state.value.sort, results.value.page, state.value.view]));
const pageNumbers = computed(() => Array.from({ length: Math.min(5, results.value.pages) }, (_, index) => Math.min(Math.max(1, results.value.page - 2), Math.max(1, results.value.pages - 4)) + index));
const chips = computed(() => [
  state.value.q && { key: 'q', label: 'Từ khóa: ' + state.value.q },
  state.value.category_id && { key: 'category_id', label: 'Danh mục: ' + (state.value.errors.category_id ? 'chưa hợp lệ' : category.value?.name || 'Đã chọn') },
  state.value.min_price !== '' && { key: 'min_price', label: state.value.errors.min_price ? 'Giá từ: chưa hợp lệ' : 'Từ ' + Number(state.value.min_price).toLocaleString('vi-VN') + ' đ' },
  state.value.max_price !== '' && { key: 'max_price', label: state.value.errors.max_price ? 'Giá đến: chưa hợp lệ' : 'Đến ' + Number(state.value.max_price).toLocaleString('vi-VN') + ' đ' },
  ...state.value.unit.map(unit => ({ key: 'unit:' + unit, unit, label: 'Đóng gói: ' + unit })),
].filter(Boolean));
function update(patch, replace = false) { return router[replace ? 'replace' : 'push']({ path: '/products', query: catalogQuery(pendingQuery.value || route.query, patch) }); }
function submitSearch() { update({ q: search.value.trim(), page: 1 }); }
function openFilters() { filtersOpen.value = true; }
async function restoreFilterFocus() {
  await nextTick();
  if (!filtersOpen.value && !document.querySelector('dialog[open]')) filterTrigger.value?.$el?.focus({ preventScroll: true });
}
async function applyFilters(focusErrors = false) {
  clearTimeout(priceTimer);
  formErrors.value = validateCatalogFilters(filters.value);
  if (Object.keys(formErrors.value).length) {
    if (focusErrors) {
      await nextTick();
      (filtersOpen.value ? root.value?.querySelector('dialog[open]') : root.value?.querySelector('.catalog-rail'))?.querySelector('[aria-invalid="true"]')?.focus();
    }
    return;
  }
  priceDirty = false;
  const query = catalogQuery(pendingQuery.value || route.query, { ...filters.value, page: 1 });
  const target = router.resolve({ path: '/products', query }).fullPath;
  if (target === route.fullPath && !pendingQuery.value) return;
  const version = ++filterVersion;
  pendingQuery.value = query;
  try { await router.push({ path: '/products', query }); }
  finally { if (version === filterVersion) { pendingQuery.value = null; syncFilters(priceDirty); } }
}
function syncFilters(preservePrice = false) {
  if (!preservePrice) { clearTimeout(priceTimer); priceDirty = false; }
  const values = filterValues();
  if (preservePrice) { values.min_price = filters.value.min_price; values.max_price = filters.value.max_price; }
  syncingFilters = true;
  filters.value = values;
  formErrors.value = preservePrice ? validateCatalogFilters(values) : { ...state.value.errors };
  syncingFilters = false;
}
watch([() => filters.value.min_price, () => filters.value.max_price], () => {
  if (syncingFilters) return;
  priceDirty = true;
  clearTimeout(priceTimer);
  formErrors.value = validateCatalogFilters(filters.value);
  if (!Object.keys(formErrors.value).length) priceTimer = setTimeout(applyFilters, 400);
}, { flush: 'sync' });
function removeChip(chip) {
  update({ ...(chip.unit ? { unit: state.value.unit.filter(unit => unit !== chip.unit) } : { [chip.key]: '' }), page: 1 });
}
function resetFilters(all = false) {
  clearTimeout(priceTimer);
  ++filterVersion; pendingQuery.value = null;
  filtersOpen.value = false;
  update({ category_id: '', min_price: '', max_price: '', unit: [], ...(all ? { q: '' } : {}), page: 1 });
}
let focusFrame;
async function goToPage(page) {
  if (page < 1 || page > results.value.pages) return;
  await update({ page }); await nextTick();
  // Focus the updated results after navigation and rendering have completed.
  const destination = route.fullPath;
  cancelAnimationFrame(focusFrame);
  focusFrame = requestAnimationFrame(() => {
    if (!root.value?.isConnected || route.fullPath !== destination) return;
    resultHeading.value?.focus({ preventScroll: true });
    resultHeading.value?.scrollIntoView?.({ behavior: 'auto', block: 'start' });
  });
}
watch(() => route.fullPath, () => {
  search.value = state.value.q;
  if (!pendingQuery.value) syncFilters();
  else if (router.resolve({ path: '/products', query: pendingQuery.value }).fullPath === route.fullPath) syncFilters(priceDirty);
  if ('availability' in route.query) update({}, true);
}, { immediate: true });
watch(() => route.path, () => { filtersOpen.value = false; });
watch([loading, () => results.value.page, () => state.value.page], () => {
  if (!loading.value && !error.value && !invalid.value && state.value.page !== results.value.page) update({ page: results.value.page }, true);
});
let wide;
const desktopSearch = ref(false);
function onWide(event) { desktopSearch.value = event.matches; if (event.matches) filtersOpen.value = false; }
onMounted(() => { loadCategories(); wide = window.matchMedia('(min-width: 1025px)'); desktopSearch.value = wide.matches; wide.addEventListener?.('change', onWide); });
onBeforeUnmount(() => { wide?.removeEventListener?.('change', onWide); cancelAnimationFrame(focusFrame); clearTimeout(priceTimer); ++filterVersion; });
</script>
<template>
  <div ref="root" class="site-content sage-catalog">
    <PageHeading title="Chọn cho ao nuôi." :breadcrumb-title="title" split :parent="category ? 'Sản phẩm' : undefined" :parent-to="category ? { path: '/products', query: catalogQuery(pendingQuery || route.query, { category_id: '', page: 1 }) } : undefined" description="Tra cứu, so sánh và xem kỹ thông tin sản phẩm." />
    <div class="container catalog-container">
      <div id="catalog-mobile-search-host" class="catalog-mobile-search-host"></div>
      <Teleport defer :to="desktopSearch ? '#catalog-desktop-search-host' : '#catalog-mobile-search-host'">
      <form class="catalog-search" role="search" @submit.prevent="submitSearch">
        <label class="sage-visually-hidden" for="catalog-search-input">Tìm kiếm sản phẩm</label>
        <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
        <input id="catalog-search-input" v-model="search" type="search" placeholder="Tìm tên sản phẩm…" autocomplete="off" />
        <SageButton type="submit" aria-label="Tìm kiếm"><SageIcon name="search" /></SageButton>
      </form>
      </Teleport>
      <div class="catalog-bar">
          <nav class="catalog-category-nav" aria-label="Danh mục sản phẩm">
            <h2>Danh mục sản phẩm</h2>
            <RouterLink :to="{ path: '/products', query: catalogQuery(pendingQuery || route.query, { category_id: '', page: 1 }) }" :class="{ selected: !state.category_id }" :aria-current="!state.category_id ? 'page' : undefined">Tất cả sản phẩm</RouterLink>
            <RouterLink v-for="item in categories" :key="normalizeId(item._id || item.id)" :to="{ path: '/products', query: catalogQuery(pendingQuery || route.query, { category_id: normalizeId(item._id || item.id), page: 1 }) }" :class="{ selected: state.category_id === normalizeId(item._id || item.id) }" :aria-current="state.category_id === normalizeId(item._id || item.id) ? 'page' : undefined">{{ item.name }}</RouterLink>
          </nav>
<div class="catalog-sort-tools">
              <SageButton ref="filterTrigger" class="catalog-mobile-filter" variant="secondary" aria-haspopup="dialog" aria-controls="catalog-filter-sheet" :aria-expanded="filtersOpen" @click="openFilters"><i class="fa-solid fa-sliders" aria-hidden="true"></i>Bộ lọc<span v-if="chips.length"> ({{ chips.length }})</span></SageButton>
              <SageSelect id="catalog-sort" label="Sắp xếp" :model-value="state.sort" :options="CATALOG_SORTS" @update:model-value="update({ sort: $event, page: 1 })" />
              <div class="catalog-view-tools" role="group" aria-label="Cách hiển thị sản phẩm">
                <SageButton variant="ghost" class="sage-icon-button" :aria-pressed="state.view === 'grid'" aria-label="Xem dạng lưới" @click="update({ view: 'grid' })"><i class="fa-solid fa-table-cells-large" aria-hidden="true"></i></SageButton>
                <SageButton variant="ghost" class="sage-icon-button" :aria-pressed="state.view === 'list'" aria-label="Xem dạng danh sách" @click="update({ view: 'list' })"><i class="fa-solid fa-list" aria-hidden="true"></i></SageButton>
              </div>
            </div>
      </div>
      <div class="catalog-workspace">
        <aside class="catalog-rail" aria-label="Bộ lọc sản phẩm">
          <div id="catalog-desktop-search-host"></div>
          <CatalogFilters v-model="filters" prefix="catalog-desktop" :categories="categories" :units="units" :errors="formErrors" :category-loading="categoryLoading" :category-error="categoryError" :unit-loading="loading" :unit-error="error" @commit="applyFilters" @retry="loadCategories(true)" @retry-units="load" />
        </aside>
        <section class="catalog-results" aria-label="Kết quả sản phẩm" :aria-busy="loading">
          <div class="catalog-results-toolbar">
            <div ref="resultHeading" class="catalog-result-count" tabindex="-1" role="status" aria-live="polite">
              <strong>{{ loading ? 'Đang tải sản phẩm…' : error || invalid ? 'Chưa có kết quả' : results.total ? results.start + '–' + results.end + ' / ' + results.total + ' sản phẩm' : '0 sản phẩm' }}</strong>
              <span v-if="state.q">Kết quả cho “{{ state.q }}”</span>
            </div>
            
          </div>
          <div v-if="chips.length" class="catalog-active-filters" aria-label="Bộ lọc đang áp dụng">
            <button v-for="chip in chips" :key="chip.key" type="button" :aria-label="'Bỏ bộ lọc ' + chip.label" @click="removeChip(chip)">{{ chip.label }}<span aria-hidden="true">×</span></button>
            <SageButton variant="ghost" @click="resetFilters(true)">Xóa tất cả</SageButton>
          </div>
          <div v-if="actions.state.error || actions.state.success" class="catalog-action-feedback" :class="{ 'has-error': actions.state.error }" :role="actions.state.error ? 'alert' : 'status'">
            <p>{{ actions.state.error || actions.state.success }}</p>
            <template v-if="actions.state.uncertain">
              <RouterLink :to="actions.state.uncertain === 'cart' ? '/cart' : '/wishlist'">Xem dữ liệu mới nhất</RouterLink>
              <SageButton v-if="!actions.state.fresh" variant="secondary" :loading="!!actions.state.busy" @click="actions.refresh">Tải lại dữ liệu</SageButton>
              <SageButton v-else variant="secondary" :disabled="!!actions.state.busy" @click="actions.acknowledge">Đã kiểm tra, tiếp tục</SageButton>
            </template>
          </div>
          <SageErrorState v-if="invalid" title="Bộ lọc chưa hợp lệ" description="Kiểm tra danh mục và khoảng giá trong bộ lọc." retry-label="Đặt lại điều kiện" @retry="resetFilters()" />
          <div v-else-if="loading" class="catalog-product-grid catalog-loading"><SageSkeleton v-for="n in 12" :key="n" aria-hidden="true" media :lines="3" label="Đang tải sản phẩm" /></div>
          <SageErrorState v-else-if="error" :title="error" @retry="load" />
          <SageEmptyState v-else-if="!results.total" title="Chưa tìm thấy sản phẩm phù hợp" description="Hãy thử từ khóa khác hoặc điều chỉnh bộ lọc." action-label="Xóa tất cả bộ lọc" @action="resetFilters(true)" />
          <div v-else :key="gridKey" class="catalog-product-grid" :class="{ 'is-list': state.view === 'list' }">
            <CatalogProductCard v-for="product in results.items" :key="normalizeId(product._id || product.id)" :product="product" :actions="actions" />
          </div>
          <nav v-if="results.pages > 1 && !loading && !error && !invalid" class="catalog-pagination" aria-label="Phân trang sản phẩm">
            <SageButton variant="secondary" :disabled="results.page <= 1" @click="goToPage(results.page - 1)">Trước</SageButton>
            <SageButton v-for="n in pageNumbers" :key="n" :variant="results.page === n ? 'primary' : 'ghost'" :aria-label="'Trang ' + n" :aria-current="results.page === n ? 'page' : undefined" @click="goToPage(n)">{{ n }}</SageButton>
            <SageButton variant="secondary" :disabled="results.page >= results.pages" @click="goToPage(results.page + 1)">Sau</SageButton>
          </nav>
        </section>
      </div>
    </div>
    <SageDrawer id="catalog-filter-sheet" v-model="filtersOpen" class="catalog-filter-sheet" edge="bottom" title="Bộ lọc sản phẩm" @closed="restoreFilterFocus">
      <CatalogFilters v-model="filters" prefix="catalog-mobile" :categories="categories" :units="units" :errors="formErrors" :category-loading="categoryLoading" :category-error="categoryError" :unit-loading="loading" :unit-error="error" @commit="applyFilters" @retry="loadCategories(true)" @retry-units="load" />
    </SageDrawer>
  </div>
</template>
