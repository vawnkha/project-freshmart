<script setup>defineProps({product:{type:Object,required:true}});</script>
<template><RouterLink v-if="product.dosageCalculatorAvailable" class="dosage-calculator-link" :to="{path:'/tools/dosage-calculator',query:{productId:String(product._id)}}">Tính liều lượng sử dụng</RouterLink></template>
<style scoped>
.dosage-calculator-link { display:inline-flex; align-items:center; justify-content:center; max-width:100%; min-height:44px; margin:0; padding:8px 12px; border:1px solid var(--border); border-radius:var(--radius-input); color:var(--accent); background:var(--sage-tint); font:500 14px/1.4 var(--font-body); overflow-wrap:anywhere; }
.dosage-calculator-link:hover { border-color:var(--sage); }
.dosage-calculator-link:focus-visible { outline:var(--focus-width) solid var(--focus); outline-offset:var(--focus-offset); }
</style>
