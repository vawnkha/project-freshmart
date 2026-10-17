<script setup>
import SageButton from './SageButton.vue';
defineProps({ title: { type: String, default: 'Chưa có nội dung' }, description: String, actionLabel: String, headingTag: { type: String, default: 'h2' } });
const emit = defineEmits(['action']);
</script>
<template><section class="sage-empty-state"><component :is="headingTag">{{ title }}</component><p v-if="description">{{ description }}</p><slot /><SageButton v-if="actionLabel" variant="secondary" @click="emit('action')">{{ actionLabel }}</SageButton></section></template>
