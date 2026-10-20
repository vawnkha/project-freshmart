<script setup>
import { onBeforeUnmount, onMounted, reactive, ref } from "vue";
import expiryService from "@/services/expiry.service";
import AdminPagination from "@/components/admin/common/AdminPagination.vue";
import { proposalLabels, expiryDate, money, vietnamInput } from "@/utils/expiry.util";
const rows = ref([]), total = ref(0), page = ref(1), status = ref(""), loading = ref(true), busy = ref(false), error = ref(""), message = ref(""), selected = ref(null);
const terms = reactive({ percent: 0, quantity: 1, startDate: "", endDate: "", reason: "" });
let version = 0;
async function load() {
  const run = ++version; loading.value = true; error.value = "";
  try { const data = await expiryService.proposals({ page: page.value, limit: 12, ...(status.value ? { status: status.value } : {}) }); if (run === version) {
    const lastPage = Math.max(1, Math.ceil(data.total / 12));
    if (page.value > lastPage) { page.value = lastPage; return await load(); }
    rows.value = data.data; total.value = data.total;
  } }
  catch (cause) { if (run === version) error.value = cause.response?.data?.message || "Không thể tải danh sách đề xuất."; }
  finally { if (run === version) loading.value = false; }
}
function select(row) {
  selected.value = row; error.value = "";
  Object.assign(terms, { percent: row.percent, quantity: row.quantity, startDate: vietnamInput(row.startDate), endDate: vietnamInput(row.endDate), reason: "" });
}
async function act(action) {
  if (busy.value || !selected.value) return;
  if (action === "reject" && !terms.reason.trim()) { error.value = "Cần nhập lý do từ chối."; return; }
  busy.value = true; error.value = "";
  try {
    const id = selected.value._id;
    if (action === "approve") await expiryService.approve(id, { percent: Number(terms.percent), quantity: Number(terms.quantity), startDate: `${terms.startDate}:00+07:00`, endDate: `${terms.endDate}:00+07:00` });
    else if (action === "reject") await expiryService.reject(id, terms.reason);
    else await expiryService.cancel(id);
    message.value = action === "approve" ? "Đã phê duyệt và liên kết mã giảm giá theo lô." : action === "reject" ? "Đã từ chối đề xuất." : "Đã hủy đề xuất / khuyến mãi.";
    selected.value = null; await load();
  } catch (cause) { error.value = cause.response?.data?.message || "Thao tác chưa thành công."; }
  finally { busy.value = false; }
}
onMounted(load);
onBeforeUnmount(() => { ++version; });
</script>
<template>
  <div class="admin-page"><RouterLink to="/admin/discounts">← Mã giảm giá</RouterLink><h1 class="admin-page-title">Đề xuất giảm giá theo lô</h1>
    <p v-if="message" role="status">{{ message }}</p><p v-if="error" role="alert" class="text-danger">{{ error }}</p>
    <section class="admin-panel"><div class="admin-panel__body">
      <label>Trạng thái<select v-model="status" class="form-select" :disabled="busy" @change="page=1; load()"><option value="">Tất cả</option><option v-for="(label,key) in proposalLabels" :key="key" :value="key">{{ label }}</option></select></label>
      <p v-if="loading" class="admin-empty-state" role="status">Đang tải đề xuất…</p><p v-else-if="!rows.length" class="admin-empty-state">Chưa có đề xuất phù hợp.</p>
      <div v-else class="table-responsive" role="region" tabindex="0" aria-label="Bảng đề xuất giảm giá, có thể cuộn ngang"><table class="admin-table"><thead><tr><th>Người tạo / ngày tạo</th><th>Sản phẩm / lô</th><th>Giá gốc</th><th>Sau giảm</th><th>Mức giảm</th><th>HSD</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>
        <tr v-for="row in rows" :key="row._id"><td>{{ row.creatorName || row.createdBy }}<br />{{ expiryDate(row.createdAt) }}</td><td>{{ row.product?.name }}<br />{{ row.batch?.batchNumber }}</td><td>{{ money(row.originalPrice) }}</td><td>{{ money(row.discountedPrice) }}</td><td>{{ row.percent }}%</td><td>{{ expiryDate(row.batch?.expiryDate) }}</td><td>{{ proposalLabels[row.status] }}</td><td><button class="admin-btn admin-btn--secondary" :disabled="busy" @click="select(row)">Xem / xử lý</button></td></tr>
      </tbody></table></div>
      <AdminPagination v-model="page" :total-items="total" :page-size="12" @change="load" /><button v-if="error && !selected" class="admin-btn admin-btn--secondary" @click="load">Thử tải lại</button>
    </div></section>
    <section v-if="selected" class="admin-panel mt-3" aria-labelledby="review-heading"><div class="admin-panel__body">
      <h2 id="review-heading">{{ selected.product?.name }} · Lô {{ selected.batch?.batchNumber }}</h2>
      <p>{{ proposalLabels[selected.status] }} · Tồn hiện tại: {{ selected.batch?.quantity }} {{ selected.batch?.unit }} · HSD {{ expiryDate(selected.batch?.expiryDate) }}</p><p>Ghi chú: {{ selected.note || 'Không có' }}</p><p v-if="selected.discountCode">Mã: <strong>{{ selected.discountCode }}</strong></p><p v-if="selected.rejectionReason">Lý do từ chối: {{ selected.rejectionReason }}</p>
      <form v-if="selected.status === 'pending'" @submit.prevent="act('approve')">
        <div class="proposal-review-grid"><label>Mức giảm duyệt (%)<input v-model.number="terms.percent" type="number" step="0.01" min="0.01" max="100" required class="form-control" /></label><label>Số lượng duyệt<input v-model.number="terms.quantity" type="number" min="1" :max="selected.batch?.quantity" required class="form-control" /></label><label>Bắt đầu (giờ VN)<input v-model="terms.startDate" type="datetime-local" required class="form-control" /></label><label>Kết thúc (giờ VN)<input v-model="terms.endDate" type="datetime-local" required class="form-control" /></label></div>
        <p>Máy chủ kiểm tra lại giá, tồn kho, giới hạn giảm và thời điểm ngừng bán trước khi duyệt.</p>
        <button class="admin-btn admin-btn--primary" :disabled="busy">{{ busy ? 'Đang xử lý…' : 'Chấp thuận' }}</button>
        <label class="d-block mt-3">Lý do từ chối<textarea v-model="terms.reason" maxlength="2000" class="form-control" /></label><button type="button" class="admin-btn admin-btn--danger mt-2" :disabled="busy || !terms.reason.trim()" @click="act('reject')">Từ chối</button>
      </form>
      <button v-if="selected.open" class="admin-btn admin-btn--danger mt-3" :disabled="busy" @click="act('cancel')">Hủy đề xuất / dừng khuyến mãi</button>
      <details class="mt-3"><summary>Lịch sử thay đổi</summary><ul><li v-for="(event,index) in selected.history" :key="index">{{ expiryDate(event.at) }} · {{ event.action }} · {{ event.actorId || 'Hệ thống' }}<span v-if="event.percent"> · {{ event.percent }}%</span><span v-if="event.reason"> · {{ event.reason }}</span></li></ul></details>
    </div></section>
  </div>
</template>
<style scoped>.admin-page{padding:0;min-width:0}.proposal-review-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:16px;margin-bottom:16px}h2{font-size:1.2rem}.table-responsive{max-width:100%;overflow:auto}.admin-table{min-width:900px}input,select,textarea{display:block;width:100%;font:inherit;padding:9px;border:1px solid var(--admin-border);border-radius:4px;background:white}</style>
