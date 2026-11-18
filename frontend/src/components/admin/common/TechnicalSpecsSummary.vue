<script setup>
import { computed } from 'vue';
import { technicalRows } from '@/utils/product-comparison.util';
const props = defineProps({ specs: Object });
const rows = computed(() => technicalRows(props.specs || {}));
</script>
<template><dl class="technical-summary"><div v-for="[key,label,value] in rows" :key="key"><dt>{{ label }}</dt><dd>{{ value }}</dd></div></dl></template>
<style scoped>.technical-summary dd { white-space: pre-line; overflow-wrap: anywhere; }.technical-summary div { margin: 12px 0; }</style>
