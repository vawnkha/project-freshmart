<script setup>
import {computed} from 'vue';
import {densityParts,densityText} from '@/utils/product-comparison.util';
const props=defineProps({value:Object});const parts=computed(()=>densityParts(props.value));
</script>
<template><span v-if="parts" class="scientific-density" :aria-label="densityText(value)">{{parts.coefficient}} × 10<sup>{{parts.exponent}}</sup> {{parts.unit}}</span><span v-else>Chưa công bố</span></template>
<style scoped>.scientific-density { overflow-wrap:anywhere; }.scientific-density sup { font-size:.75em; }</style>
