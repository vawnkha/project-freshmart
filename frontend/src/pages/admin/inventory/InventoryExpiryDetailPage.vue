<script setup>
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useAuthStore } from "@/stores/user/auth";
import { hasPermission } from "@/utils/permission.util";
import expiryService from "@/services/expiry.service";
import PromotionProposalModal from "@/components/admin/inventory/PromotionProposalModal.vue";
import { expiryLabels, expiryClass, expiryDate, proposalLabels, money } from "@/utils/expiry.util";
const route = useRoute(), auth = useAuthStore();
const batch = ref(null), loading = ref(true), error = ref(""), message = ref(""), selected = ref(null), editing = ref(null);
const stockUnit = computed(() => batch.value?.product?.unit || batch.value?.unit || "");
const correctionDate = ref(""), correctionReason = ref(""), correcting = ref(false), correctionError = ref("");
async function correctExpiry() {
  if (correcting.value) return;
  correcting.value = true; correctionError.value = "";
  try {
    await expiryService.correctExpiry(batch.value._id, { expiryDate: correctionDate.value, reason: correctionReason.value });
    message.value = "Đã điều chỉnh hạn sử dụng và kiểm tra lại cảnh báo, khuyến mãi.";
    correctionReason.value = ""; await load();
  } catch (cause) { correctionError.value = cause.response?.data?.message || "Chưa thể điều chỉnh hạn sử dụng."; }
  finally { correcting.value = false; }
}
let version = 0;
async function load() {
  const run = ++version; loading.value = true; error.value = "";
  try { const data = await expiryService.batch(route.params.id); if (run === version) batch.value = data; }
  catch (cause) { if (run === version) error.value = cause.response?.data?.message || "Không thể tải chi tiết lô."; }
  finally { if (run === version) loading.value = false; }
}
function saved() { message.value = "Đã lưu đề xuất."; void load(); }
function propose(row = null) { editing.value = row; selected.value = batch.value._id; }
watch(() => route.params.id, load, { immediate: true });
onBeforeUnmount(() => { ++version; });
</script>
<template>
  <div class="admin-workflow-page">
    <div class="admin-page-title admin-page-title--stack">
      <RouterLink :to="{ name: 'admin-inventory-expiry', query: { inventoryItemId: typeof route.query.inventoryItemId === 'string' ? route.query.inventoryItemId : undefined, product_id: typeof route.query.product_id === 'string' ? route.query.product_id : undefined } }">{{ route.query.inventoryItemId || route.query.product_id ? '← Hạn sử dụng theo sản phẩm' : '← Cảnh báo hạn sử dụng' }}</RouterLink>
      <h1>Chi tiết lô hàng</h1>
    </div>
    <p v-if="message" role="status">{{ message }}</p>
    <p v-if="loading" class="admin-empty-state" role="status">Đang tải chi tiết lô…</p>
    <div v-else-if="error" class="admin-action-row" role="alert">
      <span>{{ error }}</span>
      <button type="button" class="admin-btn admin-btn--secondary" @click="load">Thử lại</button>
    </div>

    <template v-else-if="batch">
      <section class="admin-panel" aria-labelledby="batch-info-title">
        <header class="admin-panel__header admin-panel__header--flex">
          <h2 id="batch-info-title">{{ batch.product?.name || batch.itemName }} · {{ batch.batchNumber }}</h2>
          <div class="admin-action-row">
            <span class="admin-badge" :class="expiryClass(batch.expiryStatus)">{{ expiryLabels[batch.expiryStatus] }}</span>
            <button v-if="batch.sellable && ['warning', 'urgent'].includes(batch.expiryStatus)" type="button" class="admin-btn admin-btn--primary" @click="propose()">Đề xuất giảm giá</button>
          </div>
        </header>
        <div class="admin-panel__body admin-form--stacked">
          <img v-if="batch.product?.thumbnail || batch.product?.images?.[0]" :src="batch.product.thumbnail || batch.product.images[0]" :alt="batch.product.name" class="admin-thumb admin-thumb--product" width="68" height="68" />
          <dl class="admin-form__fields batch-facts">
            <div class="admin-detail-card"><dt>Ngày sản xuất</dt><dd>{{ expiryDate(batch.manufacturingDate) }}</dd></div>
            <div class="admin-detail-card"><dt>Ngày nhập kho</dt><dd>{{ expiryDate(batch.createdAt) }}</dd></div>
            <div class="admin-detail-card"><dt>Hạn sử dụng</dt><dd>{{ expiryDate(batch.expiryDate) }}</dd></div>
            <div class="admin-detail-card"><dt>Quy cách</dt><dd>{{ batch.product?.packageSize || batch.packageSize || 'Chưa ghi nhận' }}</dd></div>
            <div class="admin-detail-card"><dt>Số lượng nhập</dt><dd>{{ batch.originalQuantity ?? 'Chưa ghi nhận' }} {{ stockUnit }}</dd></div>
            <div class="admin-detail-card"><dt>Tồn chưa phân bổ</dt><dd>{{ batch.quantity }} {{ stockUnit }}</dd></div>
            <div class="admin-detail-card"><dt>Giữ riêng chưa trừ kho</dt><dd>{{ batch.reservedQuantity }} {{ stockUnit }}</dd></div>
          </dl>
          <p>{{ batch.daysRemaining === null ? 'Chưa rõ số ngày' : batch.daysRemaining + ' ngày còn lại' }} · Trạng thái kho {{ batch.status }}</p>
        </div>
      </section>

      <details class="admin-panel admin-disclosure">
        <summary class="admin-panel__header">Điều chỉnh hạn sử dụng theo chứng từ</summary>
        <form class="admin-panel__body admin-form--stacked" :aria-busy="correcting" @submit.prevent="correctExpiry">
          <label class="admin-form__field batch-expiry-field">
            Hạn sử dụng
            <input v-model="correctionDate" class="admin-form__control" type="date" required />
          </label>
          <label class="admin-form__field">
            Lý do / chứng từ
            <textarea v-model="correctionReason" class="admin-form__textarea" maxlength="2000" rows="3" required />
          </label>
          <p v-if="correctionError" class="admin-form__error" role="alert">{{ correctionError }}</p>
          <div class="admin-action-row">
            <button type="submit" class="admin-btn admin-btn--primary" :disabled="correcting">{{ correcting ? 'Đang lưu…' : 'Lưu điều chỉnh' }}</button>
          </div>
        </form>
      </details>

      <section class="admin-panel" aria-labelledby="batch-proposals-title">
        <header class="admin-panel__header admin-panel__header--flex">
          <h2 id="batch-proposals-title">Đề xuất và khuyến mãi liên quan</h2>
          <div v-if="batch.proposals.length && hasPermission(auth, 'discount:manage')" class="admin-action-row">
            <RouterLink to="/admin/discounts/proposals" class="admin-btn admin-btn--secondary">Quản lý phê duyệt</RouterLink>
          </div>
        </header>
        <div class="admin-panel__body">
          <p v-if="!batch.proposals.length" class="admin-empty-state">Chưa có đề xuất.</p>
          <article v-for="proposal in batch.proposals" :key="proposal._id" class="batch-proposal admin-form--stacked">
            <p><strong>{{ proposalLabels[proposal.status] }}</strong> · {{ proposal.percent }}% · {{ money(proposal.discountedPrice) }} · {{ proposal.quantity }} {{ stockUnit }}</p>
            <p>{{ expiryDate(proposal.startDate) }} – {{ expiryDate(proposal.endDate) }} · {{ proposal.discountCode || 'Chưa tạo mã' }}</p>
            <p v-if="proposal.rejectionReason"><strong>Lý do từ chối:</strong> {{ proposal.rejectionReason }}</p>
            <div v-if="['draft', 'pending'].includes(proposal.status) && String(proposal.createdBy) === String(auth.userId)" class="admin-action-row">
              <button type="button" class="admin-btn admin-btn--secondary" @click="propose(proposal)">Chỉnh sửa / gửi duyệt</button>
            </div>
            <details class="admin-disclosure">
              <summary>Lịch sử thay đổi</summary>
              <ul v-if="proposal.history?.length">
                <li v-for="(event, index) in proposal.history" :key="index">
                  {{ expiryDate(event.at) }} · {{ event.action === 'discount_edited' ? 'Sửa mã giảm giá' : event.action }} · {{ event.actorId || 'Hệ thống' }}
                  <span v-if="event.reason">· {{ event.reason }}</span>
                </li>
              </ul>
              <p v-else>Chưa có lịch sử thay đổi.</p>
            </details>
          </article>
        </div>
      </section>

      <section class="admin-panel" aria-labelledby="batch-alert-history">
        <h2 id="batch-alert-history" class="admin-panel__header">Lịch sử cảnh báo</h2>
        <div class="admin-panel__body">
          <p v-if="!batch.alerts.length" class="admin-empty-state">Chưa có thông báo được gửi.</p>
          <ul v-else>
            <li v-for="alert in batch.alerts" :key="alert._id">{{ expiryDate(alert.created_at) }} · {{ alert.title }} · {{ alert.content }}</li>
          </ul>
        </div>
      </section>
    </template>
    <PromotionProposalModal :batch-id="selected" :proposal="editing" @close="selected = null" @saved="saved" />
  </div>
</template>

<style scoped>
.admin-panel > h2,
.admin-panel__header h2 {
  margin: 0;
  font-size: 16px;
}

.batch-facts {
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 145px), 1fr));
  align-items: stretch;
}

.batch-facts dt {
  font-size: 13px;
}

.batch-facts dd {
  margin: 4px 0 0;
  color: var(--admin-sidebar);
  font-weight: 600;
}

.batch-expiry-field {
  max-width: 240px;
}

.batch-proposal + .batch-proposal {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid var(--admin-border);
}
</style>
