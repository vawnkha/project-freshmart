<script setup>
import SageButton from './SageButton.vue';
defineProps({ title: { type: String, default: 'Không tải được nội dung' }, description: String, retryLabel: { type: String, default: 'Thử lại' }, loading: Boolean, headingTag: { type: String, default: 'h2' } });
const emit = defineEmits(['retry']);
</script>
<template><section class="sage-error-state" role="alert"><component :is="headingTag">{{ title }}</component><p v-if="description">{{ description }}</p><slot /><SageButton v-if="retryLabel" variant="secondary" :loading="loading" @click="emit('retry')">{{ retryLabel }}</SageButton></section></template>
