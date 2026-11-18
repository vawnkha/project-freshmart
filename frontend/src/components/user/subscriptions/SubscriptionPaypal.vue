<script setup>
import { onBeforeUnmount, ref } from 'vue';
import { captureAuthRequestContext, useAuthStore } from '@/stores/user/auth';
import subscriptions from '@/services/subscriptions.service';
import payments from '@/services/payments.service';
import { loadPaypalSdk } from '@/services/paypal-sdk.service';
import { userError } from '@/utils/user-error.util';
import SageButton from '@/components/user/sage/SageButton.vue';
const props = defineProps({ runId: { type: String, required: true }, paypalOrderId: String });
const emit = defineEmits(['paid', 'settled']);
const auth = useAuthStore(), container = ref(null), busy = ref(false), error = ref('');
const sourceOwner = String(auth.userId);
const storageKey = `subscription-paypal:${auth.userId}:${props.runId}`;
const pendingId = ref(sessionStorage.getItem(storageKey) || props.paypalOrderId || '');
const terminal = ref(false);
let disposed = false, buttons;
async function capture(id) {
  const context = captureAuthRequestContext();
  if (busy.value || terminal.value || String(auth.userId) !== sourceOwner || !context?.isCurrent()) return;
  busy.value = true; error.value = ''; pendingId.value = id; sessionStorage.setItem(storageKey, id);
  try {
    await payments.capturePaypalOrder({ paypalOrderId: id });
    if (!disposed && context.isCurrent()) { sessionStorage.removeItem(storageKey); pendingId.value = ''; emit('paid'); }
  } catch (cause) {
    if (!disposed && context.isCurrent()) {
      error.value = userError(cause, 'Chưa xác định kết quả thanh toán. Kiểm tra lại giao dịch này để tránh trả tiền hai lần.');
      if (cause.response?.data?.code === 'PAYPAL_PAYMENT_TERMINAL') {
        sessionStorage.removeItem(storageKey); pendingId.value = ''; terminal.value = true; emit('settled');
      }
    }
  } finally { if (!disposed) busy.value = false; }
}
async function open() {
  if (busy.value || pendingId.value || terminal.value || String(auth.userId) !== sourceOwner) return;
  const context = captureAuthRequestContext(); busy.value = true; error.value = '';
  try {
    const paypal = await loadPaypalSdk();
    if (disposed || !context?.isCurrent()) return;
    await buttons?.close();
    buttons = paypal.Buttons({
      createOrder: async () => {
        if (disposed || !context.isCurrent() || pendingId.value || terminal.value) throw new Error('Giao dịch hoặc phiên tài khoản đã thay đổi. Hãy kiểm tra giao dịch đang xử lý.');
        const result = await subscriptions.createPaypal(props.runId);
        return result.id;
      },
      onApprove: async data => { if (!disposed && context.isCurrent()) await capture(data.orderID); },
      onCancel: () => { if (!disposed) error.value = 'Bạn đã dừng phê duyệt PayPal. Chưa tự động thu tiền.'; },
      onError: cause => { if (!disposed && context.isCurrent()) error.value = userError(cause, 'Không thể hoàn tất PayPal.'); },
    });
    await buttons.render(container.value);
  } catch (cause) { if (!disposed && context?.isCurrent()) error.value = userError(cause, cause.message || 'Không thể mở PayPal.'); }
  finally { if (!disposed) busy.value = false; }
}
onBeforeUnmount(() => { disposed = true; buttons?.close(); });
</script>
<template><div class="subscription-payment"><p>Chỉ thanh toán kỳ đang chọn. PayPal yêu cầu bạn phê duyệt giao dịch mới.</p><p v-if="error" role="alert" class="subscription-error">{{ error }}</p><p v-if="terminal">Giao dịch đã kết thúc. Xem trạng thái đơn và hoàn kho trong lịch sử kỳ giao.</p><SageButton v-else-if="pendingId" :loading="busy" @click="capture(pendingId)">Kiểm tra lại giao dịch PayPal đang xử lý</SageButton><SageButton v-else variant="secondary" :loading="busy" @click="open">Mở PayPal cho kỳ này</SageButton><div v-show="!pendingId&&!terminal" ref="container" class="subscription-paypal-container"></div></div></template>
