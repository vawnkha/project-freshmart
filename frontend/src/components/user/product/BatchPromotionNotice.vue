<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useBatchPromotionStore } from "@/stores/user/batch-promotions";
import { batchOfferCustomName, expiryDate, expiryDateTime, money } from "@/utils/expiry.util";
import { copyText } from "@/utils/clipboard.util";
const props = defineProps({ productId: { type: String, required: true }, promotions: { type: Array, default: () => [] }, compact: Boolean });
const store = useBatchPromotionStore();
const offers = computed(() => (store.hasRefreshed ? store.offers.filter(row => String(row.productId) === props.productId) : props.promotions).slice(0, props.compact ? 1 : undefined));
let unsubscribe;
const copyStatus = ref(null), copying = ref(false);
async function copyCode(code) {
  if (copying.value) return;
  copying.value = true;
  try {
    const copied = await copyText(code);
    copyStatus.value = { code, message: copied ? "Đã sao chép mã." : "Hãy chọn và sao chép mã bên trên." };
  } finally {
    copying.value = false;
  }
}
onMounted(() => { unsubscribe = store.subscribe(); });
onBeforeUnmount(() => unsubscribe?.());
</script>
<template>
  <aside v-for="offer in offers" :key="offer._id" class="batch-offer" aria-label="Ưu đãi lô sắp hết hạn">
    <p v-if="batchOfferCustomName(offer)" class="batch-offer-name">{{ batchOfferCustomName(offer) }}</p>
    <strong>Giảm {{ offer.value }}%</strong>
    <p><b>{{ money(offer.discountedPrice) }}</b> mỗi sản phẩm khi dùng mã</p>
    <p>Dùng sản phẩm trước {{ expiryDate(offer.expiryDate) }} · Còn {{ offer.availableQuantity }} suất ưu đãi</p>
    <RouterLink v-if="compact" class="batch-offer-link" :to="`/products/${productId}`">Xem mã giảm giá</RouterLink>
    <template v-else>
      <p v-if="offer.publicDescription">{{ offer.publicDescription }}</p>
      <div v-if="offer.code" class="batch-offer-code">
        <code>{{ offer.code }}</code>
        <button type="button" class="sage-button sage-button--secondary" :disabled="copying" @click="copyCode(offer.code)">Sao chép mã</button>
      </div>
      <p v-if="copyStatus?.code === offer.code" role="status">{{ copyStatus.message }}</p>
      <p>Dùng mã trước {{ expiryDateTime(offer.endDate) }} (giờ Việt Nam). Mỗi đơn dùng một mã.</p>
    </template>
  </aside>
</template>
<style scoped>
.batch-offer {
  display: grid;
  gap: var(--space-1, 4px);
  margin-block: var(--space-3, 12px);
  padding: var(--space-3, 12px);
  border: 1px solid var(--line-2);
  border-radius: var(--radius-input);
  background: var(--warning-soft);
  color: var(--ink);
  font-size: 14px;
  line-height: 1.45;
  overflow-wrap: anywhere;
}
.batch-offer p { margin: 0; }
.batch-offer > strong { color: var(--warning); }
.batch-offer-name { font-weight: 700; }
.batch-offer-code { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); margin-block: var(--space-1); }
.batch-offer-code code { padding: var(--space-1) var(--space-2); background: var(--surface); color: var(--ink); overflow-wrap: anywhere; }
.batch-offer-link { justify-self: start; display: flex; align-items: center; min-height: 44px; color: var(--sage-deep); text-decoration: underline; }
.batch-offer-lot { color: var(--muted); font-size: 13px; }
</style>
