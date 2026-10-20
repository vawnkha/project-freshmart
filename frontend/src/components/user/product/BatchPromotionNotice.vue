<script setup>
import { computed, onBeforeUnmount, onMounted } from "vue";
import { useBatchPromotionStore } from "@/stores/user/batch-promotions";
import { expiryDate, money } from "@/utils/expiry.util";
const props = defineProps({ productId: { type: String, required: true }, promotions: { type: Array, default: () => [] }, compact: Boolean });
const store = useBatchPromotionStore();
const offers = computed(() => (store.hasRefreshed ? store.offers.filter(row => String(row.productId) === props.productId) : props.promotions).slice(0, props.compact ? 1 : undefined));
let unsubscribe;
onMounted(() => { unsubscribe = store.subscribe(); });
onBeforeUnmount(() => unsubscribe?.());
</script>
<template>
  <aside v-for="offer in offers" :key="offer._id" class="batch-offer" aria-label="Ưu đãi lô sắp hết hạn">
    <strong>Ưu đãi lô sắp hết hạn: −{{ offer.value }}%</strong>
    <p>Giá với mã: <del>{{ money(offer.originalPrice) }}</del> <b>{{ money(offer.discountedPrice) }}</b></p>
    <p>Lô {{ offer.batchNumber }} · HSD {{ expiryDate(offer.expiryDate) }} · Còn {{ offer.availableQuantity }} suất.</p>
    <p v-if="!compact">Nhập mã <strong class="batch-code">{{ offer.code }}</strong> tại thanh toán. Chỉ áp dụng phần hàng từ lô này, không cộng dồn mã khác. Dừng lúc {{ new Date(offer.endDate).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) }} (giờ VN).</p>
    <RouterLink v-else :to="`/products/${productId}`">Xem mã và điều kiện theo lô</RouterLink>
  </aside>
</template>
<style scoped>.batch-offer{background:#fff8e8;border:1px solid #dfbb73;border-radius:8px;padding:12px;margin:12px 0;font-size:.85rem;line-height:1.5;color:#664715}.batch-offer p{margin:5px 0}.batch-offer del{margin-right:6px}.batch-code{overflow-wrap:anywhere}</style>
