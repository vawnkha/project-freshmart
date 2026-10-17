<script setup>
defineProps({ label: { type: String, default: 'Đang xử lý…' } });
</script>
<template><div class="sage-loading" role="status" aria-live="polite" aria-busy="true"><span class="sage-loading-mark" aria-hidden="true"></span><span>{{ label }}</span></div></template>
