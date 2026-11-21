<script setup>
import { ref, watch, onBeforeUnmount } from 'vue';
import { useCartStore } from '@/stores/user/cart';
import products from '@/services/product.service';
import { formatMoney } from '@/utils/storefront.util';
import ExpirySelectionSummary from './ExpirySelectionSummary.vue';
const props = defineProps({ productId: String, quantity: { type: Number, default: 1 }, initialChoice: Object });
const emit = defineEmits(['change']);
const cart = useCartStore(), rows = ref([]), selected = ref(props.initialChoice ? props.initialChoice.group + (props.initialChoice.discountId || '') : ''), loading = ref(false), error = ref('');
let version = 0;
const key = choice => choice ? choice.group + (choice.discountId || '') : '';
async function load() {
  const current = ++version; loading.value = true; error.value = '';
  const previous = rows.value.find(row => key(row.choice) === selected.value);
  emit('change', { loading: true, quote: previous, choice: previous?.choice });
  try {
    const first = await products.purchaseOptions(props.productId, 1);
    if (current !== version) return;
    if (!selected.value) selected.value = key(first.defaultChoice);
    const match = first.choices.find(row => key(row.choice) === selected.value);
    const existing = match ? cart.items.filter(item => String(item.product_id) === props.productId && key(item.expiryChoice) === key(match.choice)).reduce((sum, item) => sum + Number(item.quantity), 0) : 0;
    const response = await products.purchaseOptions(props.productId, Math.max(1, Math.trunc(Number(props.quantity)) || 1) + existing);
    if (current !== version) return;
    rows.value = response.choices;
    const quote = rows.value.find(row => key(row.choice) === selected.value);
    if (selected.value && !quote) error.value = 'Nhóm đã chọn không còn hàng. Vui lòng tự chọn nhóm khác.';
    emit('change', { quote, choice: quote?.choice, loading: false, existing, error: error.value, unavailable: !!selected.value && !quote, requiresChoice: !!rows.value.length && !selected.value });
  } catch { if (current === version) { error.value = 'Chưa kiểm tra được giá và hạn dùng. Vui lòng thử lại.'; emit('change', { loading: false, error: error.value }); } }
  finally { if (current === version) loading.value = false; }
}
watch(() => [props.productId, props.quantity, cart.items], load, { immediate: true });
onBeforeUnmount(() => version++);
</script>
<template><fieldset class="expiry-choices" :aria-busy="loading"><legend>Lựa chọn hạn sử dụng</legend><p v-if="loading" role="status">Đang kiểm tra giá và hạn dùng…</p><label v-for="row in rows" :key="row.lineKey" class="expiry-choice" :class="{selected:selected===key(row.choice)}"><input v-model="selected" type="radio" :name="'expiry-'+productId" :value="key(row.choice)" @change="load"><span><strong>{{ row.label }}<template v-if="row.percent"> – Giảm {{ row.percent }}%</template></strong><span class="expiry-choice-price">{{ formatMoney(row.price) }}<del v-if="row.percent">{{ formatMoney(row.originalPrice) }}</del></span><span>Còn {{ row.availableQuantity }} sản phẩm</span><ExpirySelectionSummary :choice="row.choice" :quote="row" /></span></label><p v-if="!loading&&!rows.length&&!error">Hết hàng hợp lệ.</p><p v-if="error" role="alert">{{ error }}</p><button v-if="error" type="button" @click="load">Kiểm tra lại lựa chọn</button><p v-if="rows.length && !selected">Vui lòng chọn và kiểm tra hạn sử dụng trước khi thêm hàng cận hạn.</p></fieldset></template>
<style scoped>.expiry-choices{border:0;padding:0;margin:1.25rem 0;min-width:0}.expiry-choices legend{font-weight:700;margin-bottom:.7rem}.expiry-choice{display:flex;gap:.7rem;padding:1rem;border:1px solid #c6d8ce;border-radius:.5rem;margin:.6rem 0;cursor:pointer}.expiry-choice.selected{border:2px solid #22764d;background:#f2f8f2}.expiry-choice>span{display:grid;gap:.25rem;min-width:0}.expiry-choice input{align-self:flex-start;margin-top:.35rem}.expiry-choice-price{font-size:1.15rem;font-weight:700}.expiry-choice-price del{font-size:.85rem;font-weight:400;margin-left:.7rem}</style>
