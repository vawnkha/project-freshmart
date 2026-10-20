<script setup>
import { onMounted, onBeforeUnmount, reactive, ref, watch } from "vue";
import { useRoute } from "vue-router";
import expiryService from "@/services/expiry.service";
import AdminPagination from "@/components/admin/common/AdminPagination.vue";
import PromotionProposalModal from "@/components/admin/inventory/PromotionProposalModal.vue";
import { expiryLabels, expiryClass, expiryDate } from "@/utils/expiry.util";
const route = useRoute();
const summary = ref(null), rows = ref([]), total = ref(0), loading = ref(true), error = ref(""), message = ref(""), selected = ref(null), page = ref(1);
const filters = reactive({ keyword: "", status: "", sort_by: "expiryDate", sort_order: "asc", product_id: "" });
const limit = 12;
let version = 0, timer;
async function load() {
  const run = ++version;
  loading.value = true; error.value = "";
  try {
    const [stats, result] = await Promise.all([expiryService.summary(), expiryService.batches({ ...Object.fromEntries(Object.entries(filters).filter(([,v]) => v)), page: page.value, limit })]);
    if (run !== version) return;
    const lastPage = Math.max(1, Math.ceil(result.total / limit));
    if (page.value > lastPage) { page.value = lastPage; return await load(); }
    summary.value = stats; rows.value = result.data; total.value = result.total;
  } catch (cause) { if (run === version) error.value = cause.response?.data?.message || "Không tải được cảnh báo. Vui lòng thử lại."; }
  finally { if (run === version) loading.value = false; }
}
function search() { page.value = 1; void load(); }
function saved() { message.value = "Đã lưu đề xuất giảm giá."; void load(); }
watch(() => route.query.status, status => { filters.status = Object.hasOwn(expiryLabels, status) ? status : ""; search(); });
onMounted(() => { filters.status = Object.hasOwn(expiryLabels, route.query.status) ? route.query.status : ""; void load(); timer = setInterval(load, 60000); });
onBeforeUnmount(() => { ++version; clearInterval(timer); });
</script>
<template>
  <div class="admin-page expiry-page">
    <div class="admin-page-title admin-page-title--stack"><h1>Cảnh báo hạn sử dụng</h1><p>Theo ngày lịch Việt Nam. Lô hết hạn hôm nay ngừng bán.</p></div>
    <div v-if="summary" class="expiry-stats">
      <button v-for="[key,label] in [['total','Tổng lô còn tồn'],['warning','Sắp hết hạn'],['urgent','Gần hết hạn'],['expired','Hết hạn còn tồn']]" :key="key" class="admin-stat-card" @click="filters.status = key === 'total' ? '' : key; search()">
        <span class="admin-stat-card__label">{{ label }}</span><strong class="admin-stat-card__value">{{ summary[key] }}</strong>
      </button>
    </div>
    <p v-if="summary?.unknown" role="status">Có {{ summary.unknown }} lô thiếu hạn sử dụng cần rà soát; đang chặn xuất bán. <button class="admin-btn admin-btn--secondary" @click="filters.status='unknown'; search()">Xem các lô</button></p>
    <p v-if="message" role="status">{{ message }}</p>
    <section class="admin-panel"><div class="admin-panel__body">
      <form class="expiry-filters" @submit.prevent="search">
        <label>Tìm sản phẩm / mã lô<input v-model="filters.keyword" maxlength="150" class="form-control" type="search" /></label>
        <label>Mức cảnh báo<select v-model="filters.status" class="form-select" @change="search"><option value="">Tất cả</option><option v-for="(label,key) in expiryLabels" :key="key" :value="key">{{ label }}</option></select></label>
        <label>Sắp xếp<select v-model="filters.sort_by" class="form-select" @change="search"><option value="expiryDate">Hạn sử dụng</option><option value="quantity">Tồn kho</option><option value="createdAt">Ngày nhập</option></select></label>
        <label>Thứ tự<select v-model="filters.sort_order" class="form-select" @change="search"><option value="asc">Tăng dần</option><option value="desc">Giảm dần</option></select></label>
        <button class="admin-btn admin-btn--primary" :disabled="loading">Tìm kiếm</button>
      </form>
      <div v-if="error" role="alert"><p>{{ error }}</p><button class="admin-btn admin-btn--secondary" @click="load">Thử lại</button></div>
      <p v-else-if="loading" class="admin-empty-state" role="status">Đang tải cảnh báo…</p>
      <p v-else-if="!rows.length" class="admin-empty-state">Không có lô phù hợp bộ lọc.</p>
      <div v-else class="table-responsive" role="region" tabindex="0" aria-label="Bảng cảnh báo hạn sử dụng, có thể cuộn ngang"><table class="admin-table"><thead><tr><th>Mã lô</th><th>Sản phẩm</th><th>Ngày nhập</th><th>Hạn sử dụng</th><th>Còn lại</th><th>Tồn kho</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
        <tbody><tr v-for="batch in rows" :key="batch._id"><td>{{ batch.batchNumber }}</td><td>{{ batch.product?.name || batch.itemName }}</td><td>{{ expiryDate(batch.createdAt) }}</td><td>{{ expiryDate(batch.expiryDate) }}</td><td>{{ batch.daysRemaining === null ? 'Chưa xác định' : batch.daysRemaining + ' ngày' }}</td><td>{{ batch.quantity }} {{ batch.unit }}</td><td><span class="admin-badge" :class="expiryClass(batch.expiryStatus)">{{ expiryLabels[batch.expiryStatus] }}</span><small v-if="batch.status === 'locked'"> · Đang khóa</small></td><td><div class="expiry-actions"><RouterLink :to="`/admin/inventory-expiry/${batch._id}`" class="admin-btn admin-btn--secondary">Xem</RouterLink><button v-if="batch.sellable && ['warning','urgent'].includes(batch.expiryStatus) && batch.product" class="admin-btn admin-btn--primary" @click="selected = batch._id">Đề xuất giảm giá</button></div></td></tr></tbody>
      </table></div>
      <AdminPagination v-model="page" :total-items="total" :page-size="limit" @change="load" />
    </div></section>
    <PromotionProposalModal :batch-id="selected" @close="selected=null" @saved="saved" />
  </div>
</template>
<style scoped>
.expiry-page{min-width:0;padding:0}.expiry-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin-bottom:20px}.expiry-stats button{text-align:left;display:grid;gap:8px;color:inherit;background:var(--admin-card);border:1px solid var(--admin-border);border-radius:6px}.expiry-filters{display:flex;gap:12px;flex-wrap:wrap;align-items:end;margin-bottom:20px}.expiry-filters label{flex:1 1 145px;min-width:0}.expiry-filters input,.expiry-filters select{display:block;width:100%;padding:9px;border:1px solid var(--admin-border);border-radius:4px;font:inherit;background:white}.expiry-actions{display:flex;gap:6px;flex-wrap:wrap}.expiry-page h1{font-size:1.6rem}.table-responsive{max-width:100%;overflow:auto}.admin-table{min-width:850px}@media(max-width:800px){.expiry-stats{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:420px){.expiry-stats{gap:8px}.expiry-stats button{padding:12px}}
</style>
