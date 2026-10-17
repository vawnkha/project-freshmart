<script setup>
defineProps({ lines: { type: Number, default: 3 }, label: { type: String, default: 'Đang tải nội dung' }, media: Boolean });
</script>
<template><div class="sage-skeleton" role="status" aria-busy="true"><span class="sage-visually-hidden">{{ label }}</span><div v-if="media" class="sage-skeleton-media" aria-hidden="true"></div><div v-for="i in Math.min(12, Math.max(1, Math.floor(lines)))" :key="i" class="sage-skeleton-line" aria-hidden="true"></div></div></template>
