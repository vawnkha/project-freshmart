<script setup>
import SageOverlay from './SageOverlay.vue';
defineOptions({ inheritAttrs: false });
defineProps({ modelValue: Boolean, title: { type: String, required: true }, edge: { type: String, default: 'right' } });
const emit = defineEmits(['update:modelValue', 'closed']);
</script>
<template><SageOverlay v-bind="$attrs" :model-value="modelValue" :title="title" :edge="edge" kind="drawer" @update:model-value="emit('update:modelValue', $event)" @closed="emit('closed')"><slot /><template v-if="$slots.footer" #footer><slot name="footer" /></template></SageOverlay></template>
