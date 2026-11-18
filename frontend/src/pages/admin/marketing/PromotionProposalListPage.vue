<script setup>
import { nextTick, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import expiryService from "@/services/expiry.service";
import AdminPagination from "@/components/admin/common/AdminPagination.vue";
import { proposalLabels, expiryDate, money, vietnamInput } from "@/utils/expiry.util";
const rows = ref([]), total = ref(0), page = ref(1), status = ref(""), loading = ref(true), busy = ref(false), error = ref(""), message = ref(""), selected = ref(null);
const terms = reactive({ percent: 0, quantity: 1, startDate: "", endDate: "", reason: "" });
const reviewHeading = ref(null);
let reviewTrigger;
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
async function select(row, event) {
  reviewTrigger = event.currentTarget;
  selected.value = row; error.value = "";
  Object.assign(terms, { percent: row.percent, quantity: row.quantity, startDate: vietnamInput(row.startDate), endDate: vietnamInput(row.endDate), reason: "" });
  await nextTick();
  reviewHeading.value?.focus();
}
async function closeReview() {
  selected.value = null;
  error.value = "";
  await nextTick();
  reviewTrigger?.focus();
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
  <div class="admin-workflow-page">
    <div class="admin-page-title admin-page-title--stack">
      <RouterLink to="/admin/discounts">← Mã giảm giá</RouterLink>
      <h1>Đề xuất giảm giá theo lô</h1>
    </div>

    <p v-if="message" role="status">{{ message }}</p>
    <section class="admin-panel" aria-labelledby="proposal-list-heading">
      <h2 id="proposal-list-heading" class="admin-panel__header">Danh sách đề xuất</h2>
      <div class="admin-panel__body">
        <div class="admin-toolbar proposal-status-filter">
          <label class="admin-form__field">
            Trạng thái
            <select v-model="status" class="admin-toolbar__select" :disabled="busy" @change="page = 1; load()">
              <option value="">Tất cả</option>
              <option v-for="(label, key) in proposalLabels" :key="key" :value="key">{{ label }}</option>
            </select>
          </label>
        </div>
        <div v-if="error && !selected" class="admin-action-row" role="alert">
          <span>{{ error }}</span>
          <button type="button" class="admin-btn admin-btn--secondary" @click="load">Thử tải lại</button>
        </div>
        <p v-else-if="loading" class="admin-empty-state" role="status">Đang tải đề xuất…</p>
        <p v-else-if="!rows.length" class="admin-empty-state">Chưa có đề xuất phù hợp.</p>
        <div v-else class="table-responsive" role="region" tabindex="0" aria-label="Bảng đề xuất giảm giá, có thể cuộn ngang">
          <table class="admin-table">
            <thead>
              <tr>
                <th scope="col">Sản phẩm / lô</th>
                <th scope="col">Người tạo / ngày tạo</th>
                <th scope="col">Giá gốc</th>
                <th scope="col">Sau giảm</th>
                <th scope="col">Mức giảm</th>
                <th scope="col">Hạn sử dụng</th>
                <th scope="col">Trạng thái</th>
                <th scope="col">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in rows" :key="row._id" :class="{ 'proposal-row--selected': row._id === selected?._id }">
                <td><strong>{{ row.product?.name }}</strong><br />{{ row.batch?.batchNumber }}</td>
                <td>{{ row.creatorName || row.createdBy }}<br />{{ expiryDate(row.createdAt) }}</td>
                <td>{{ money(row.originalPrice) }}</td>
                <td>{{ money(row.discountedPrice) }}</td>
                <td>{{ row.percent }}%</td>
                <td>{{ expiryDate(row.batch?.expiryDate) }}</td>
                <td>{{ proposalLabels[row.status] }}</td>
                <td><button type="button" class="admin-btn admin-btn--secondary proposal-row-action" :disabled="busy" @click="select(row, $event)">Xem / xử lý</button></td>
              </tr>
            </tbody>
          </table>
        </div>
        <AdminPagination v-model="page" :total-items="total" :page-size="12" @change="load" />
      </div>
    </section>

    <section v-if="selected" class="admin-panel proposal-review" aria-labelledby="review-heading" :aria-busy="busy">
      <header class="admin-panel__header admin-panel__header--flex">
        <h2 id="review-heading" ref="reviewHeading" tabindex="-1">
          {{ selected.product?.name }} · Lô {{ selected.batch?.batchNumber }}
        </h2>
        <div class="admin-action-row">
          <button type="button" class="admin-btn admin-btn--secondary" :disabled="busy" @click="closeReview">Đóng chi tiết</button>
        </div>
      </header>

      <div class="admin-panel__body admin-form--stacked">
        <dl class="admin-form__fields proposal-facts">
          <div class="admin-detail-card"><dt>Trạng thái</dt><dd>{{ proposalLabels[selected.status] }}</dd></div>
          <div class="admin-detail-card"><dt>Tồn hiện tại</dt><dd>{{ selected.batch?.quantity }} {{ selected.batch?.unit }}</dd></div>
          <div class="admin-detail-card"><dt>Hạn sử dụng</dt><dd>{{ expiryDate(selected.batch?.expiryDate) }}</dd></div>
        </dl>
        <p v-if="selected.note"><strong>Ghi chú:</strong> {{ selected.note }}</p>
        <p v-if="selected.discountCode"><strong>Mã giảm giá:</strong> {{ selected.discountCode }}</p>
        <p v-if="selected.rejectionReason"><strong>Lý do từ chối:</strong> {{ selected.rejectionReason }}</p>
        <p v-if="error" class="admin-form__error" role="alert">{{ error }}</p>

        <div v-if="selected.status === 'pending'" class="proposal-review-forms">
          <form class="admin-form--stacked proposal-review-form" aria-labelledby="approve-heading" @submit.prevent="act('approve')">
            <h3 id="approve-heading" class="admin-panel__header-title">Phê duyệt</h3>
            <div class="admin-form__fields">
              <label class="admin-form__field">
                Mức giảm duyệt (%)
                <input v-model.number="terms.percent" class="admin-form__control" type="number" step="0.01" min="0.01" max="100" required />
              </label>
              <label class="admin-form__field">
                Số lượng duyệt
                <input v-model.number="terms.quantity" class="admin-form__control" type="number" min="1" :max="selected.batch?.quantity" required />
              </label>
              <label class="admin-form__field">
                Bắt đầu (giờ Việt Nam)
                <input v-model="terms.startDate" class="admin-form__control" type="datetime-local" required />
              </label>
              <label class="admin-form__field">
                Kết thúc (giờ Việt Nam)
                <input v-model="terms.endDate" class="admin-form__control" type="datetime-local" required />
              </label>
            </div>
            <p class="proposal-form-hint">Kết thúc chậm nhất 00:00 ngày hết hạn của lô.</p>
            <div class="admin-action-row">
              <button type="submit" class="admin-btn admin-btn--primary" :disabled="busy">{{ busy ? 'Đang xử lý…' : 'Chấp thuận' }}</button>
            </div>
          </form>

          <form class="admin-form--stacked proposal-review-form" aria-labelledby="reject-heading" @submit.prevent="act('reject')">
            <h3 id="reject-heading" class="admin-panel__header-title">Từ chối đề xuất</h3>
            <label class="admin-form__field">
              Lý do từ chối
              <textarea v-model="terms.reason" class="admin-form__textarea" maxlength="2000" rows="3" required />
            </label>
            <div class="admin-action-row">
              <button type="submit" class="admin-btn admin-btn--danger" :disabled="busy || !terms.reason.trim()">Từ chối</button>
            </div>
          </form>
        </div>

        <div class="proposal-review-footer">
          <details class="admin-disclosure">
            <summary>Lịch sử thay đổi</summary>
            <ul v-if="selected.history?.length">
              <li v-for="(event, index) in selected.history" :key="index">
                {{ expiryDate(event.at) }} · {{ event.action === 'discount_edited' ? 'Sửa mã giảm giá' : event.action }} · {{ event.actorId || 'Hệ thống' }}
                <span v-if="event.percent"> · {{ event.percent }}%</span>
                <span v-if="event.reason"> · {{ event.reason }}</span>
              </li>
            </ul>
            <p v-else>Chưa có lịch sử thay đổi.</p>
          </details>
          <div v-if="selected.open" class="admin-action-row">
            <button type="button" class="admin-btn admin-btn--danger" :disabled="busy" @click="act('cancel')">
              {{ ['draft', 'pending'].includes(selected.status) ? 'Hủy đề xuất' : 'Dừng khuyến mãi' }}
            </button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.admin-panel > h2,
.admin-panel__header h2 {
  margin: 0;
  font-size: inherit;
  font-weight: inherit;
}

.proposal-status-filter {
  max-width: 240px;
}

.table-responsive {
  max-width: 100%;
  overflow-x: auto;
}

.admin-table {
  min-width: 860px;
}

.proposal-row-action {
  white-space: nowrap;
}

.proposal-row--selected {
  background: var(--admin-bg);
}

.proposal-review {
  scroll-margin-top: 16px;
}

.proposal-facts {
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 140px), 1fr));
  align-items: stretch;
}

.proposal-facts dt,
.proposal-form-hint {
  font-size: 13px;
}

.proposal-facts dd {
  margin: 4px 0 0;
  color: var(--admin-sidebar);
  font-weight: 600;
}

.proposal-review-forms {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr));
  gap: 14px;
}

.proposal-review-form {
  align-content: start;
  padding: 14px;
  border: 1px solid var(--admin-border);
  border-radius: 6px;
}

.proposal-review-form .admin-form__fields {
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 205px), 1fr));
}

.proposal-review-footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: start;
  gap: 12px;
  padding-top: 14px;
  border-top: 1px solid var(--admin-border);
}
</style>
