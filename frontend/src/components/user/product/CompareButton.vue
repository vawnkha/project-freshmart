<script setup>
import { computed } from 'vue';
import { useComparisonStore } from '@/stores/user/comparison';
import { normalizeId } from '@/utils/id.util';
import { notify } from '@/composables/useStorefrontNotice';
const props = defineProps({ product: { type: Object, required: true }, detail: Boolean });
const comparison = useComparisonStore();
const selected = computed(() => comparison.selected(normalizeId(props.product._id || props.product.id)));
function toggle() { if (!comparison.toggle(props.product)) notify(comparison.error, 'error'); }
</script>
<template><button type="button" class="product-compare-button" :aria-label="`${selected ? 'Bỏ so sánh' : 'So sánh'} ${product.name}`" :aria-pressed="selected" :disabled="!selected && product.status !== 'active'" @click="toggle">{{ selected ? 'Đã chọn so sánh · Bỏ chọn' : detail ? 'Thêm vào so sánh' : 'So sánh' }}</button></template>
<style scoped>
.product-compare-button { display:inline-flex; align-items:center; justify-content:center; width:fit-content; max-width:100%; min-height:44px; padding:8px 12px; margin:0; border:1px solid var(--input-border); border-radius:var(--radius-input); background:var(--surface); color:var(--ink); font:500 14px/1.4 var(--font-body); cursor:pointer; }
.product-compare-button[aria-pressed="true"] { background:var(--sage-tint); border-color:var(--sage); }
.product-compare-button:hover:not(:disabled) { border-color:var(--sage); color:var(--accent); }
.product-compare-button:focus-visible { outline:var(--focus-width) solid var(--focus); outline-offset:var(--focus-offset); }
.product-compare-button:disabled { color:var(--text-secondary); background:var(--mist); cursor:not-allowed; }
</style>
