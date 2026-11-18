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
  <Teleport to="body">
    <div v-if="open" class="admin-modal-mask" @click.self="!saving && emit('close')">
      <section ref="panel" class="admin-modal admin-modal--compact" role="dialog" aria-modal="true" aria-labelledby="proposal-title" tabindex="-1">
        <header class="admin-modal__header">
          <h2 id="proposal-title" class="admin-modal__title">
            {{ props.proposal ? 'Chỉnh sửa đề xuất giảm giá' : 'Đề xuất giảm giá theo lô' }}
          </h2>
        </header>
        <form class="admin-form" :aria-busy="saving || loading" @submit.prevent="submit">
          <div class="admin-modal__body admin-form--stacked">
            <p v-if="loading" class="admin-empty-state" role="status">Đang lấy giá và tồn kho hiện tại…</p>
            <p v-if="error" class="admin-form__error" role="alert">{{ error }}</p>
            <template v-if="recommendation">
              <div>
                <p class="admin-panel__header-title">{{ recommendation.productName }} · Lô {{ recommendation.batchNumber }}</p>
                <p>Hạn sử dụng {{ expiryDate(recommendation.expiryDate) }} · Tồn kho {{ recommendation.availableQuantity }} · Gợi ý giảm {{ recommendation.suggestedPercent }}%</p>
              </div>
              <div class="admin-form__fields">
                <div class="admin-detail-card">
                  <span>Giá gốc</span>
                  <strong>{{ money(recommendation.originalPrice) }}</strong>
                </div>
                <div class="admin-detail-card">
                  <span>Giá sau giảm</span>
                  <strong>{{ money(discounted) }}</strong>
                </div>
              </div>
              <div class="admin-form__fields">
                <label class="admin-form__field">
                  Mức giảm (%)
                  <input v-model.number="form.percent" class="admin-form__control" type="number" min="0.01" :max="recommendation.maxPercent" step="0.01" required />
                </label>
                <label class="admin-form__field">
                  Số lượng áp dụng
                  <input v-model.number="form.quantity" class="admin-form__control" type="number" min="1" :max="recommendation.availableQuantity" step="1" required />
                </label>
                <label class="admin-form__field">
                  Bắt đầu (giờ Việt Nam)
                  <input v-model="form.startDate" class="admin-form__control" type="datetime-local" required />
                </label>
                <label class="admin-form__field">
                  Kết thúc (giờ Việt Nam)
                  <input v-model="form.endDate" class="admin-form__control" type="datetime-local" :max="vietnamInput(recommendation.sellableUntil)" required aria-describedby="proposal-expiry-hint" />
                </label>
              </div>
              <p id="proposal-expiry-hint" class="proposal-help">Kết thúc chậm nhất 00:00 ngày hết hạn. Mã chỉ giảm trên phần hàng thuộc lô này.</p>
              <label class="admin-form__field">
                Ghi chú
                <textarea v-model="form.note" class="admin-form__textarea" maxlength="2000" rows="3" />
              </label>
              <label class="admin-form__field">
                Gửi xử lý
                <select v-model="form.status" class="admin-form__select">
                  <option value="pending">Gửi phê duyệt</option>
                  <option value="draft">Lưu nháp</option>
                </select>
              </label>
            </template>
          </div>
          <footer class="admin-modal__footer admin-action-row">
            <button type="button" class="admin-btn admin-btn--secondary" :disabled="saving" @click="emit('close')">{{ recommendation ? 'Hủy' : 'Đóng' }}</button>
            <button v-if="recommendation" type="submit" class="admin-btn admin-btn--primary" :disabled="saving || loading">{{ saving ? 'Đang lưu…' : 'Lưu đề xuất' }}</button>
          </footer>
        </form>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.proposal-help {
  font-size: 13px;
}

.admin-form__fields {
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr));
}
</style>
