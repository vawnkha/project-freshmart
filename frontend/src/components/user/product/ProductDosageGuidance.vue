<script setup>
import {computed} from 'vue';
import {dosageText,dosageBasis,basisLabels} from '@/utils/dosage-calculator.util';
import {productTechnical} from '@/utils/product-technical.util';
const props=defineProps({product:Object});
const data=computed(()=>productTechnical(props.product));
const basis=row=>dosageBasis(row.basisUnit)==='water_volume'?'Theo thể tích nước':dosageBasis(row.basisUnit)==='feed_mass'?'Trộn thức ăn':basisLabels[row.basisUnit]||row.basisLabel||'Theo hướng dẫn sản phẩm';
</script>
<template><section v-if="data.hasUsage" class="product-dosage-guidance"><h3>Liều lượng và cách sử dụng</h3><article v-for="(row,index) in data.dosages" :key="index"><template v-if="typeof row==='object'"><h4>{{row.purpose||'Hướng dẫn sử dụng'}}</h4><p class="dosage-basis">{{basis(row)}}</p><p>{{dosageText({...row,purpose:''})}}</p></template><p v-else>{{row}}</p></article><p v-if="data.usageInstruction">{{data.usageInstruction}}</p></section></template>
<style scoped>.product-dosage-guidance p { white-space:pre-line; overflow-wrap:anywhere; }.product-dosage-guidance article { padding:12px 0; border-bottom:1px solid var(--border); }.product-dosage-guidance h4 { font-size:16px; line-height:1.4; margin:8px 0; }.dosage-basis { color:var(--text-secondary); font-size:14px; }</style>
