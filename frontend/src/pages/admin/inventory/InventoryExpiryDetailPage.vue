<script setup>
import { onBeforeUnmount, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useAuthStore } from "@/stores/user/auth";
import { hasPermission } from "@/utils/permission.util";
import expiryService from "@/services/expiry.service";
import PromotionProposalModal from "@/components/admin/inventory/PromotionProposalModal.vue";
import { expiryLabels, expiryClass, expiryDate, proposalLabels, money } from "@/utils/expiry.util";
const route = useRoute(), auth = useAuthStore();
const batch = ref(null), loading = ref(true), error = ref(""), message = ref(""), selected = ref(null), editing = ref(null);
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
  <div class="admin-page"><RouterLink to="/admin/inventory-expiry">← Cảnh báo hạn sử dụng</RouterLink><h1 class="admin-page-title">Chi tiết lô hàng</h1>
    <p v-if="message" role="status">{{ message }}</p><p v-if="loading" role="status">Đang tải…</p>
    <div v-else-if="error" role="alert">{{ error }} <button class="admin-btn admin-btn--secondary" @click="load">Thử lại</button></div>
    <template v-else-if="batch">
      <section class="admin-panel"><div class="admin-panel__body">
        <img v-if="batch.product?.thumbnail || batch.product?.images?.[0]" :src="batch.product.thumbnail || batch.product.images[0]" :alt="batch.product.name" width="110" height="110" style="object-fit:contain" />
        <h2>{{ batch.product?.name || batch.itemName }} · {{ batch.batchNumber }}</h2>
        <dl class="expiry-detail-grid"><div><dt>Ngày sản xuất</dt><dd>{{ expiryDate(batch.manufacturingDate) }}</dd></div><div><dt>Ngày nhập kho</dt><dd>{{ expiryDate(batch.createdAt) }}</dd></div><div><dt>Hạn sử dụng</dt><dd>{{ expiryDate(batch.expiryDate) }}</dd></div><div><dt>Số lượng nhập</dt><dd>{{ batch.originalQuantity ?? 'Chưa ghi nhận' }} {{ batch.unit }}</dd></div><div><dt>Tồn chưa phân bổ</dt><dd>{{ batch.quantity }} {{ batch.unit }}</dd></div><div><dt>Giữ riêng chưa trừ kho</dt><dd>{{ batch.reservedQuantity }} (đơn đã nhận được trừ vào lô)</dd></div></dl>
        <p><span class="admin-badge" :class="expiryClass(batch.expiryStatus)">{{ expiryLabels[batch.expiryStatus] }}</span> · {{ batch.daysRemaining === null ? 'Chưa rõ số ngày' : batch.daysRemaining + ' ngày' }} · Trạng thái kho: {{ batch.status }}</p>
        <button v-if="batch.sellable && ['warning','urgent'].includes(batch.expiryStatus)" class="admin-btn admin-btn--primary" @click="propose()">Đề xuất giảm giá</button>
        <details class="mt-3"><summary>Điều chỉnh / bổ sung hạn sử dụng theo chứng từ</summary><form @submit.prevent="correctExpiry"><label>Hạn sử dụng<input v-model="correctionDate" type="date" required class="form-control" /></label><label class="d-block">Lý do / chứng từ<textarea v-model="correctionReason" required maxlength="2000" class="form-control" /></label><p v-if="correctionError" role="alert">{{ correctionError }}</p><button class="admin-btn admin-btn--primary mt-2" :disabled="correcting">{{ correcting ? 'Đang lưu…' : 'Lưu điều chỉnh' }}</button></form></details>
      </div></section>
      <section class="admin-panel mt-3"><div class="admin-panel__body"><h2>Lịch sử cảnh báo</h2><p v-if="!batch.alerts.length">Chưa có thông báo được gửi. Cảnh báo mới được chuyển qua hàng đợi thông báo.</p><ul v-else><li v-for="alert in batch.alerts" :key="alert._id">{{ expiryDate(alert.created_at) }} · {{ alert.title }} · {{ alert.content }}</li></ul></div></section>
      <section class="admin-panel mt-3"><div class="admin-panel__body"><h2>Đề xuất và khuyến mãi liên quan</h2><p v-if="!batch.proposals.length">Chưa có đề xuất.</p><div v-for="proposal in batch.proposals" :key="proposal._id" class="expiry-proposal">
        <p><strong>{{ proposalLabels[proposal.status] }}</strong> · {{ proposal.percent }}% · {{ money(proposal.discountedPrice) }} · {{ proposal.quantity }} {{ batch.unit }}</p><p>{{ expiryDate(proposal.startDate) }} – {{ expiryDate(proposal.endDate) }} · {{ proposal.discountCode || 'Chưa tạo mã' }}</p><p v-if="proposal.rejectionReason">Lý do: {{ proposal.rejectionReason }}</p>
        <button v-if="['draft','pending'].includes(proposal.status) && String(proposal.createdBy) === String(auth.userId)" class="admin-btn admin-btn--secondary" @click="propose(proposal)">Chỉnh sửa / gửi duyệt</button>
        <RouterLink v-if="hasPermission(auth,'discount:manage')" to="/admin/discounts/proposals" class="admin-btn admin-btn--secondary">Quản lý phê duyệt</RouterLink>
        <details><summary>Lịch sử thay đổi</summary><ul><li v-for="(event,index) in proposal.history" :key="index">{{ expiryDate(event.at) }} · {{ event.action }} · {{ event.actorId || 'Hệ thống' }} <span v-if="event.reason">· {{ event.reason }}</span></li></ul></details>
      </div></div></section>
    </template>
    <PromotionProposalModal :batch-id="selected" :proposal="editing" @close="selected=null" @saved="saved" />
  </div>
</template>
<style scoped>.admin-page{padding:0;min-width:0}.expiry-detail-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px}.expiry-proposal{border-top:1px solid #ddd;padding:16px 0}h2{font-size:1.2rem}dd{overflow-wrap:anywhere}input,textarea{display:block;width:100%;font:inherit;padding:9px;border:1px solid var(--admin-border);border-radius:4px;background:white}</style>
