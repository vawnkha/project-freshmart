<script setup>
import { productPath } from "@/utils/product-route.util";
import { computed, ref, watch, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useComparisonStore } from '@/stores/user/comparison';
import { useProductPurchase } from '@/composables/useProductPurchase';
import { comparisonRows } from '@/utils/product-comparison.util';
import productService from '@/services/product.service';
import ResponsiveImage from '@/components/user/common/ResponsiveImage.vue';
import BatchPromotionNotice from '@/components/user/product/BatchPromotionNotice.vue';
import DosageCalculatorLink from '@/components/user/product/DosageCalculatorLink.vue';
const comparison = useComparisonStore(), purchase = useProductPurchase(), route = useRoute(), router = useRouter();
const differencesOnly = ref(false), routeError = ref(''), picker = ref(false), replacing = ref(''), candidates = ref([]), search = ref(''), candidateId = ref(''), pickerError = ref(''), pickerLoading = ref(false);
let pickerGeneration = 0;
const rows = computed(() => comparisonRows(comparison.records).filter(row => !differencesOnly.value || new Set(row.values).size > 1));
const options = computed(() => candidates.value.filter(p => !comparison.selected(String(p._id)) && p.name.toLocaleLowerCase().includes(search.value.trim().toLocaleLowerCase())));
function applyRoute() {
  if (route.query.ids === undefined) return;
  const value = route.query.ids;
  const ids = typeof value === 'string' && value.length <= 120 ? value.split(',').map(id => id.trim()) : null;
  if (!ids || ids.some(id => !/^[a-f\d]{24}$/i.test(id)) || new Set(ids.map(id => id.toLowerCase())).size > 3) { routeError.value = 'Đường dẫn so sánh không hợp lệ. Chọn tối đa 3 sản phẩm.'; return; }
  routeError.value = ''; comparison.setIds(ids);
}
watch(() => route.query.ids, applyRoute, { immediate: true });
watch(() => comparison.ids.join(','), () => {
  if (routeError.value) return;
  router.replace({ path: '/compare', query: comparison.ids.length ? { ids: comparison.ids.join(',') } : {} });
  comparison.refresh();
}, { immediate: true });
async function openPicker(id = '') {
  replacing.value = id; search.value = ''; candidateId.value = ''; pickerError.value = ''; picker.value = true; pickerLoading.value = true;
  const run = ++pickerGeneration;
  try {
    const response = await productService.getAll();
    if (run === pickerGeneration) candidates.value = (response.data || []).filter(p => p.status === 'active');
  } catch { if (run === pickerGeneration) pickerError.value = 'Không tải được sản phẩm. Vui lòng thử lại.'; }
  finally { if (run === pickerGeneration) pickerLoading.value = false; }
}
function choose() {
  const product = candidates.value.find(p => String(p._id) === candidateId.value);
  if (!product) return;
  if (replacing.value ? comparison.replace(replacing.value, product) : comparison.toggle(product)) picker.value = false;
}
function clearInvalidLink() { routeError.value = ''; comparison.clear(); router.replace('/compare'); }
onBeforeUnmount(() => { ++pickerGeneration; });
</script>
<template>
  <div class="site-content compare-page"><div class="container">
    <nav aria-label="Đường dẫn"><RouterLink to="/products">Sản phẩm</RouterLink> / So sánh</nav>
    <h1>So sánh sản phẩm</h1>
    <p>Đối chiếu thông số được công bố để chọn chế phẩm phù hợp. Giá và số lượng được kiểm tra lại khi thêm giỏ và thanh toán.</p>
    <div v-if="routeError" role="alert"><p>{{ routeError }}</p><button type="button" @click="clearInvalidLink">Chọn lại sản phẩm</button></div>
    <template v-else>
      <div class="compare-toolbar">
        <strong>Đã chọn {{ comparison.ids.length }}/3</strong>
        <button v-if="comparison.ids.length < 3" type="button" @click="openPicker()">Thêm sản phẩm so sánh</button>
        <button v-if="comparison.ids.length" type="button" @click="comparison.clear">Xóa tất cả</button>
        <button v-if="comparison.canCompare" type="button" :disabled="comparison.loading" @click="comparison.refresh">Cập nhật giá và tồn kho</button>
        <label><input v-model="differencesOnly" type="checkbox" /> Chỉ hiển thị thông số khác nhau</label>
      </div>
      <ul class="compare-selection"><li v-for="(id,index) in comparison.ids" :key="id">
        <span>{{ comparison.records.find(p => String(p._id) === id)?.name || 'Sản phẩm ' + (index + 1) }}</span>
        <button type="button" :aria-label="'Bỏ sản phẩm ' + (index + 1)" @click="comparison.remove(id)"><i class="fa-solid fa-xmark"></i></button>
        <button type="button" :aria-label="'Thay sản phẩm ' + (index + 1)" @click="openPicker(id)"><i class="fa-solid fa-repeat"></i></button>
      </li></ul>
      <section v-if="picker" class="compare-picker" aria-label="Chọn sản phẩm so sánh">
        <h2>{{ replacing ? 'Thay thế sản phẩm' : 'Thêm sản phẩm' }}</h2>
        <p v-if="pickerLoading" role="status">Đang tải sản phẩm…</p><p v-if="pickerError" role="alert">{{ pickerError }}</p>
        <label>Tìm trong sản phẩm đã xuất bản<input v-model="search" type="search" maxlength="200" /></label>
        <label for="compare-candidate">Sản phẩm</label><select id="compare-candidate" v-model="candidateId"><option value="">Chọn sản phẩm</option><option v-for="p in options" :key="p._id" :value="String(p._id)">{{ p.name }}</option></select>
        <p v-if="!pickerLoading && !pickerError && !options.length">Không có sản phẩm phù hợp.</p>
        <button type="button" :disabled="!candidateId || pickerLoading" @click="choose">Xác nhận chọn</button><button type="button" @click="picker = false; ++pickerGeneration">Đóng lựa chọn</button>
      </section>
      <p v-if="comparison.loading" role="status">Đang tải thông tin mới nhất…</p>
      <div v-else-if="comparison.error" role="alert"><p>{{ comparison.error }}</p><button type="button" @click="comparison.refresh">Thử lại</button></div>
      <p v-else-if="!comparison.canCompare">Chọn từ 2 đến 3 sản phẩm để bắt đầu so sánh.</p>
      <template v-else-if="comparison.records.length >= 2">
        <p id="compare-scroll-hint">Trên màn hình nhỏ, vuốt ngang bảng để xem các sản phẩm.</p>
        <div class="compare-table-scroll" tabindex="0" role="region" aria-label="Bảng so sánh sản phẩm" aria-describedby="compare-scroll-hint">
          <table class="compare-table"><caption>Thông tin sản phẩm và thông số do nhà sản xuất công bố</caption>
            <thead><tr><th scope="col">Tiêu chí</th><th v-for="p in comparison.records" :key="p._id" scope="col">
              <ResponsiveImage :src="p.thumbnail" :alt="p.name" /><RouterLink :to="productPath(p)">{{ p.name }}</RouterLink>
              <DosageCalculatorLink :product="p" />
              <button type="button" :disabled="!purchase.canAdd(p)" :aria-label="'Thêm vào giỏ ' + p.name" @click="purchase.add(p)">{{ p.inStock ? 'Thêm vào giỏ hàng' : 'Hết hàng' }}</button>
              <BatchPromotionNotice :product-id="String(p._id)" :promotions="p.batchPromotions" />
            </th></tr></thead>
            <tbody><tr v-for="row in rows" :key="row.key" :data-criterion="row.key"><th scope="row">{{ row.label }}</th><td v-for="(value,index) in row.values" :key="comparison.records[index]._id">{{ value }}</td></tr></tbody>
          </table>
        </div>
        <p v-if="differencesOnly && !rows.length" role="status">Các thông số đang hiển thị giống nhau.</p>
        <p class="compare-note">Giá quy đổi làm tròn đến đồng/kg hoặc đồng/L. Thời hạn tham khảo thuộc hồ sơ mặt hàng; hạn dùng thực tế thuộc từng lô. Ưu đãi theo lô chỉ áp dụng cho số lượng đủ điều kiện tại thanh toán.</p>
      </template>
      <div v-if="purchase.state.error" role="alert"><p>{{ purchase.state.error }}</p><template v-if="purchase.state.uncertain"><button type="button" :disabled="!!purchase.state.busy" @click="purchase.refresh">Tải lại giỏ để đối soát</button><button v-if="purchase.state.fresh" type="button" @click="purchase.acknowledge">Đã kiểm tra, tiếp tục</button></template></div>
    </template>
  </div></div>
</template>
<style scoped>
.compare-page { min-width:0; padding:var(--space-6) 0 var(--space-8); color:var(--ink); font:400 16px/1.6 var(--font-body); }
.compare-page h1 { margin:var(--space-4) 0 var(--space-3); font:800 var(--text-page)/1.18 var(--font-display); overflow-wrap:anywhere; }
.compare-page h2 { font:700 22px/1.3 var(--font-display); }
.compare-toolbar,.compare-selection,.compare-selection li { display:flex; align-items:center; flex-wrap:wrap; gap:var(--space-3); }
.compare-toolbar { padding:var(--space-3) var(--space-4); background:var(--mist); border-radius:var(--radius-input); font-size:14px; }
.compare-selection { list-style:none; padding:var(--space-3) 0; margin:0; }
.compare-selection li { max-width:100%; padding:var(--space-1) var(--space-2); border:1px solid var(--border); border-radius:var(--radius-input); overflow-wrap:anywhere; }
.compare-page button,.compare-picker input,.compare-picker select { min-height:44px; max-width:100%; padding:8px 12px; border:1px solid var(--input-border); border-radius:var(--radius-input); background:var(--surface); color:var(--ink); font:500 14px/1.5 var(--font-body); }
.compare-page button { cursor:pointer; }.compare-page button:hover:not(:disabled) { border-color:var(--sage); }.compare-page button:disabled { color:var(--text-secondary); background:var(--mist); cursor:not-allowed; }
.compare-page :focus-visible { outline:var(--focus-width) solid var(--focus); outline-offset:var(--focus-offset); }
.compare-picker { padding:var(--space-4); margin:var(--space-4) 0; border:1px solid var(--border); border-radius:var(--radius-card); }
.compare-picker label { display:grid; gap:var(--space-2); margin:var(--space-3) 0; }.compare-picker button { margin-right:var(--space-2); }
.compare-table-scroll { max-width:100%; overflow-x: auto; border:1px solid var(--border); border-radius:var(--radius-card); margin:var(--space-3) 0; }
.compare-table { border-collapse:separate; border-spacing:0; width:100%; table-layout:fixed; min-width:780px; font-size:14px; }
.compare-table caption { padding:var(--space-3); text-align:left; }
.compare-table th,.compare-table td { padding:var(--space-3); text-align:left; vertical-align:top; border-top:1px solid var(--border); border-right:1px solid var(--border); white-space:pre-line; overflow-wrap:anywhere; }
.compare-table tr > :first-child { width:190px; position: sticky; left:0; z-index:1; background:var(--mist); }.compare-table thead th:not(:first-child) { width:250px; }
.compare-table :deep(img) { width:100%; height:100px; object-fit:contain; margin-bottom:var(--space-2); }.compare-table a { display:block; margin-bottom:var(--space-2); }.compare-note { font-size:14px; line-height:1.6; color:var(--text-secondary); }
@media(max-width:600px) { .compare-page { padding-top:var(--space-4); }.compare-table tr > :first-child { width:140px; }.compare-toolbar label { width:100%; } }
</style>
