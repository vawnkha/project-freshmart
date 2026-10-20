<script setup>
import { computed, nextTick, onBeforeUnmount, ref, useId } from 'vue';
import { formatMoney } from '@/utils/storefront.util';
import { copyText } from '@/utils/clipboard.util';
import SageDialog from '@/components/user/sage/SageDialog.vue';
const props = defineProps({ voucher: { type: Object, required: true } });
const emit = defineEmits(['notice']);
const summaryId = 'voucher-summary-' + useId();
const copying = ref(false), infoOpen = ref(false), manualOpen = ref(false);
const infoTrigger = ref(null), copyTrigger = ref(null);
let alive = true;
onBeforeUnmount(() => { alive = false; });
const code = computed(() => typeof props.voucher.code === 'string' ? props.voucher.code.trim() : '');
const offer = computed(() => {
  const value = Number(props.voucher.value);
  if (props.voucher.value == null || props.voucher.value === '' || !Number.isFinite(value) || value < 0) return 'Chưa có giá trị ưu đãi';
  return props.voucher.type === 'percent' ? `Giảm ${value}%`
    : props.voucher.type === 'fixed' ? `Giảm ${formatMoney(value)}` : 'Xem thông tin ưu đãi';
});
function dateLabel(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '';
}
const expiry = computed(() => dateLabel(props.voucher.endDate) || 'Chưa có ngày hết hạn');
const starts = computed(() => dateLabel(props.voucher.startDate));
const scope = computed(() => ({ order: 'Áp dụng cho đơn hàng', product: 'Áp dụng cho sản phẩm', category: 'Áp dụng cho danh mục', batch: 'Chỉ áp dụng cho lô sắp hết hạn' })[props.voucher.scope] || 'Chưa có thông tin phạm vi áp dụng');
async function restoreFallbackFocus(trigger) {
  // The shared legacy helper restores focus after its post-flush watcher. Keep
  // the Home consumer's trigger last, without altering shared/native behavior.
  await nextTick();
  const doc = trigger?.ownerDocument;
  if (alive && trigger?.isConnected && !doc.querySelector('dialog[open]') &&
      typeof doc.defaultView.HTMLDialogElement?.prototype.showModal !== 'function') trigger.focus({ preventScroll: true });
}
async function copyCode() {
  if (copying.value || !code.value) return;
  copying.value = true;
  try {
    const copied = await copyText(code.value);
    if (!alive) return;
    emit('notice', copied ? 'Đã sao chép mã giảm giá' : 'Không thể sao chép tự động. Vui lòng chọn và sao chép mã trong hộp thoại.');
    if (!copied) manualOpen.value = true;
  } finally { if (alive) copying.value = false; }
}
</script>
<template>
  <article class="voucher-card" :class="{ 'voucher-card--fixed': voucher.type === 'fixed' }" :aria-describedby="summaryId">
    <div class="voucher-card__icon" aria-hidden="true"><i :class="voucher.type === 'percent' ? 'fa-solid fa-percent' : 'fa-solid fa-tag'"></i></div>
    <div class="voucher-card__content">
      <h3>{{ voucher.name || 'Mã giảm giá' }}</h3>
      <p class="voucher-card__offer">{{ offer }}<span v-if="voucher.maxDiscountAmount > 0"> · Tối đa {{ formatMoney(voucher.maxDiscountAmount) }}</span></p>
      <p :id="summaryId" class="sage-visually-hidden">{{ scope }}<span v-if="voucher.minOrderValue > 0"> · Đơn từ {{ formatMoney(voucher.minOrderValue) }}</span><span v-if="voucher.description">. {{ voucher.description }}</span></p>
      <div class="voucher-card__bottom">
        <p v-if="voucher.scope === 'batch'" class="voucher-card__code">Lô sắp hết hạn {{ voucher.batchNumber }} · HSD lô {{ dateLabel(voucher.expiryDate) }} · Còn {{ voucher.availableQuantity }} suất.</p>
        <RouterLink v-if="voucher.scope === 'batch' && voucher.productId" :to="`/products/${voucher.productId}`">{{ voucher.productName || 'Xem sản phẩm và điều kiện theo lô' }}</RouterLink>
        <p class="voucher-card__code">Mã: <strong>{{ code || 'Chưa có mã' }}</strong></p>
        <p class="voucher-card__expiry">HSD: {{ expiry }}</p>
        <button ref="copyTrigger" type="button" class="voucher-copy" :aria-label="`Sao chép mã ${code}`" :disabled="copying || !code" :aria-busy="copying" @click="copyCode">{{ copying ? 'Đang sao chép…' : 'Sao chép mã' }}</button>
      </div>
      <button ref="infoTrigger" type="button" class="voucher-info" :aria-label="`Thông tin mã ${code || voucher.name}`" @click="infoOpen = true"><i class="fa-regular fa-circle-question" aria-hidden="true"></i></button>
    </div>
    <SageDialog v-model="infoOpen" class="home-voucher-dialog" :title="voucher.name || 'Thông tin ưu đãi'" @closed="restoreFallbackFocus(infoTrigger)">
      <dl class="home-voucher-details">
        <div><dt>Mã giảm giá</dt><dd>{{ code || 'Chưa có mã' }}</dd></div>
        <div><dt>Loại ưu đãi</dt><dd>{{ voucher.type === 'percent' ? 'Phần trăm' : voucher.type === 'fixed' ? 'Số tiền cố định' : 'Chưa có thông tin' }}</dd></div>
        <div><dt>Giá trị</dt><dd>{{ offer }}<span v-if="voucher.maxDiscountAmount > 0"> · Tối đa {{ formatMoney(voucher.maxDiscountAmount) }}</span></dd></div>
        <div><dt>Điều kiện</dt><dd class="voucher-card__conditions">{{ scope }}<span v-if="voucher.minOrderValue > 0"> · Đơn từ {{ formatMoney(voucher.minOrderValue) }}</span></dd></div>
        <div v-if="voucher.description"><dt>Mô tả</dt><dd class="voucher-card__description">{{ voucher.description }}</dd></div>
        <div><dt>Bắt đầu</dt><dd>{{ starts || 'Chưa có ngày bắt đầu' }}</dd></div>
        <div><dt>Hết hạn</dt><dd>{{ expiry }}</dd></div>
      </dl>
      <p>Phạm vi cụ thể và điều kiện cuối cùng được kiểm tra khi sử dụng mã. Sao chép mã không áp dụng ưu đãi vào giỏ hàng.</p>
    </SageDialog>
    <SageDialog v-model="manualOpen" class="home-voucher-dialog" title="Sao chép mã thủ công" @closed="restoreFallbackFocus(copyTrigger)">
      <label class="home-voucher-manual">Mã giảm giá<textarea :value="code" readonly autofocus @focus="$event.target.select()"></textarea></label>
      <p>Chọn mã rồi dùng Ctrl+C, Command+C hoặc menu sao chép trên thiết bị.</p>
    </SageDialog>
  </article>
</template>
