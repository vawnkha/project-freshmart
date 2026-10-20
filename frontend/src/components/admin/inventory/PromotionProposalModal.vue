<script setup>
import { computed, reactive, ref, watch } from "vue";
import expiryService from "@/services/expiry.service";
import { useDialogFocus } from "@/composables/useDialogFocus";
import { expiryDate, money, vietnamInput, proposalPayload } from "@/utils/expiry.util";
const props = defineProps({ batchId: String, proposal: Object });
const emit = defineEmits(["close", "saved"]);
const open = computed(() => !!props.batchId), panel = ref(null), loading = ref(false), saving = ref(false), error = ref("");
const recommendation = ref(null);
const form = reactive({ percent: 0, quantity: 1, startDate: "", endDate: "", note: "", status: "pending" });
useDialogFocus(open, panel, () => { if (!saving.value) emit("close"); });
let version = 0;
watch(() => props.batchId, async id => {
  const run = ++version;
  recommendation.value = null; error.value = "";
  if (!id) return;
  loading.value = true;
  try {
    const data = await expiryService.recommendation(id);
    if (run !== version) return;
    recommendation.value = data;
    const draft = props.proposal;
    Object.assign(form, { percent: draft?.percent ?? data.suggestedPercent, quantity: draft?.quantity ?? data.availableQuantity,
      startDate: vietnamInput(draft?.startDate || data.startDate), endDate: vietnamInput(draft?.endDate || data.endDate), note: draft?.note || "", status: "pending" });
  } catch (cause) { if (run === version) error.value = cause.response?.data?.message || "Không thể tải đề xuất."; }
  finally { if (run === version) loading.value = false; }
});
const discounted = computed(() => recommendation.value ? recommendation.value.originalPrice - Math.floor(recommendation.value.originalPrice * Number(form.percent || 0) / 100) : 0);
async function submit() {
  if (saving.value || !recommendation.value) return;
  error.value = "";
  try {
    const payload = proposalPayload(form, recommendation.value);
    saving.value = true;
    if (props.proposal) await expiryService.edit(props.proposal._id, payload);
    else await expiryService.create(props.batchId, payload);
    emit("saved"); emit("close");
  } catch (cause) { error.value = cause.response?.data?.message || cause.message; }
  finally { saving.value = false; }
}
</script>
<template>
  <Teleport to="body"><div v-if="open" class="expiry-modal-backdrop" @click.self="!saving && emit('close')">
    <section ref="panel" class="expiry-modal admin-panel" role="dialog" aria-modal="true" aria-labelledby="proposal-title" tabindex="-1">
      <div class="admin-panel__header"><h2 id="proposal-title">Đề xuất giảm giá theo lô</h2></div>
      <div class="admin-panel__body">
        <p v-if="loading" role="status">Đang lấy giá và tồn kho hiện tại…</p>
        <p v-if="error" role="alert" class="text-danger">{{ error }}</p>
        <form v-if="recommendation" @submit.prevent="submit">
          <p><strong>{{ recommendation.productName }}</strong> · Lô {{ recommendation.batchNumber }}</p>
          <p>HSD: {{ expiryDate(recommendation.expiryDate) }} · Tồn: {{ recommendation.availableQuantity }} · Giá gốc: {{ money(recommendation.originalPrice) }}</p>
          <p>Gợi ý: {{ recommendation.suggestedPercent }}% · Sau giảm: <strong>{{ money(discounted) }}</strong></p>
          <div class="expiry-form-grid">
            <label>Mức giảm (%)<input v-model.number="form.percent" type="number" min="0.01" :max="recommendation.maxPercent" step="0.01" required class="form-control" /></label>
            <label>Số lượng áp dụng<input v-model.number="form.quantity" type="number" min="1" :max="recommendation.availableQuantity" step="1" required class="form-control" /></label>
            <label>Bắt đầu (giờ Việt Nam)<input v-model="form.startDate" type="datetime-local" required class="form-control" /></label>
            <label>Kết thúc (giờ Việt Nam)<input v-model="form.endDate" type="datetime-local" :max="vietnamInput(recommendation.sellableUntil)" required class="form-control" /></label>
          </div>
          <p>Kết thúc chậm nhất 00:00 ngày hết hạn. Mã chỉ giảm trên phần hàng thuộc lô này.</p>
          <label class="d-block">Ghi chú<textarea v-model="form.note" maxlength="2000" class="form-control" /></label>
          <label class="d-block mt-3">Gửi xử lý<select v-model="form.status" class="form-select"><option value="pending">Gửi phê duyệt</option><option value="draft">Lưu nháp</option></select></label>
          <div class="expiry-actions mt-3"><button class="admin-btn admin-btn--primary" :disabled="saving || loading">{{ saving ? 'Đang lưu…' : 'Lưu đề xuất' }}</button><button type="button" class="admin-btn admin-btn--secondary" :disabled="saving" @click="emit('close')">Hủy</button></div>
        </form>
        <button v-else type="button" class="admin-btn admin-btn--secondary" @click="emit('close')">Đóng</button>
      </div>
    </section>
  </div></Teleport>
</template>
<style scoped>
.expiry-modal-backdrop{position:fixed;inset:0;background:#0008;z-index:1100;display:grid;place-items:center;padding:16px}.expiry-modal{width:min(680px,100%);max-height:92dvh;overflow:auto;box-sizing:border-box}.expiry-modal h2{font-size:1.25rem;margin:0}.expiry-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-bottom:16px}.expiry-modal input,.expiry-modal select,.expiry-modal textarea{display:block;width:100%;box-sizing:border-box;font:inherit;padding:9px;border:1px solid var(--admin-border);border-radius:4px;background:white}.expiry-modal label{display:block}.expiry-actions{display:flex;flex-wrap:wrap;gap:10px}@media(max-width:540px){.expiry-form-grid{grid-template-columns:1fr}}
</style>
