<script setup>
import SageDialog from "@/components/user/sage/SageDialog.vue";
import SageButton from "@/components/user/sage/SageButton.vue";
import { formatMoney } from "@/utils/storefront.util";
import { batchOfferCustomName, expiryDateTime } from "@/utils/expiry.util";

defineProps({
  open: Boolean, loading: Boolean, error: String, appliedCode: String, recurring: Boolean,
  offers: { type: Array, default: () => [] },
});
const emit = defineEmits(["close", "retry", "select"]);
const scopes = {
  order: "Giảm trên tiền hàng của đơn",
  product: "Giảm trên sản phẩm đủ điều kiện",
  category: "Giảm trên sản phẩm thuộc danh mục ưu đãi",
  batch: "Giảm trên hàng thuộc lô ưu đãi",
};
function offerTitle(offer) {
  if (!offer.batchOffer) return offer.name || offer.code;
  return batchOfferCustomName(offer.batchOffer) || offer.batchOffer.productName || offer.name || offer.code;
}
</script>

<template>
  <SageDialog
    :model-value="open" class="checkout-voucher-dialog" title="Chọn mã giảm giá"
    @update:model-value="!$event && emit('close')"
  >
    <p v-if="loading" role="status">{{ recurring ? 'Đang kiểm tra mã cho các sản phẩm đã chọn…' : 'Đang kiểm tra mã cho giỏ hàng…' }}</p>
    <div v-else-if="error" class="voucher-picker-state">
      <p role="alert">{{ error }}</p>
      <SageButton variant="secondary" @click="emit('retry')">Thử lại</SageButton>
    </div>
    <p v-else-if="!offers.length">{{ recurring
      ? 'Hiện chưa có mã công khai phù hợp với các sản phẩm đã chọn. Bạn vẫn có thể nhập mã riêng.'
      : 'Hiện chưa có mã công khai phù hợp với giỏ hàng. Nếu có mã riêng, bạn có thể nhập mã ở trang thanh toán.' }}</p>
    <template v-else>
      <p class="voucher-picker-hint">{{ recurring
        ? 'Mức giảm tính theo giá và tồn kho hiện tại. Mã sẽ được kiểm tra lại ở từng kỳ.'
        : 'Chọn một mã để áp dụng cho đơn này.' }}</p>
      <ul class="voucher-picker-list" aria-label="Mã giảm giá khả dụng">
        <li v-for="offer in offers" :key="offer.code" class="voucher-picker-card">
          <div class="voucher-picker-row">
            <strong>{{ offerTitle(offer) }}</strong>
            <strong class="voucher-picker-saving">{{ recurring ? 'Dự kiến giảm' : 'Giảm' }} {{ formatMoney(offer.discountAmount) }}</strong>
          </div>
          <p v-if="offer.batchOffer">Giảm {{ offer.value }}% cho {{ offer.eligibleQuantity }} sản phẩm<span v-if="offer.batchOffer.productName && offerTitle(offer) !== offer.batchOffer.productName"> {{ offer.batchOffer.productName }}</span>{{ recurring ? ' thuộc lô ưu đãi.' : ' trong giỏ từ lô ưu đãi.' }}</p>
          <p v-else>{{ scopes[offer.scope] }}</p>
          <p v-if="offer.minOrderValue > 0 || offer.endDate" class="voucher-picker-meta">
            <span v-if="offer.minOrderValue > 0">Đơn từ {{ formatMoney(offer.minOrderValue) }}</span>
            <span v-if="offer.endDate">Dùng trước {{ expiryDateTime(offer.endDate) }}</span>
          </p>
          <div class="voucher-picker-row">
            <code>{{ offer.code }}</code>
            <SageButton :disabled="appliedCode === offer.code" @click="emit('select', offer.code)">
              {{ appliedCode === offer.code ? 'Đang áp dụng' : 'Dùng mã' }}
            </SageButton>
          </div>
        </li>
      </ul>
    </template>
  </SageDialog>
</template>

<style scoped>
.voucher-picker-hint { margin: 0 0 var(--space-3); color: var(--muted); }
.voucher-picker-list { display: grid; gap: var(--space-3); margin: 0; padding: 0; list-style: none; }
.voucher-picker-card {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-4);
  border: 1px solid var(--line-2);
  border-radius: var(--radius-input);
  background: var(--surface);
  overflow-wrap: anywhere;
}
.voucher-picker-row, .voucher-picker-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-3);
}
.voucher-picker-card p, .voucher-picker-state p { margin: 0; }
.voucher-picker-card p { font-size: 14px; color: var(--muted); }
.voucher-picker-meta { justify-content: flex-start; }
.voucher-picker-card code { color: var(--ink); background: var(--mist); padding: var(--space-1) var(--space-2); }
.voucher-picker-row .sage-button { margin-inline-start: auto; }
.voucher-picker-saving { color: var(--sage-deep); }
.voucher-picker-state { display: grid; justify-items: start; gap: var(--space-3); }
</style>
