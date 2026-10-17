<script setup>
import SageOverlay from './SageOverlay.vue';
defineOptions({ inheritAttrs: false });
defineProps({ modelValue: Boolean, title: { type: String, required: true } });
const emit = defineEmits(['update:modelValue', 'closed']);
</script>
<template><SageOverlay v-bind="$attrs" :model-value="modelValue" :title="title" kind="dialog" @update:model-value="emit('update:modelValue', $event)" @closed="emit('closed')"><slot /><template v-if="$slots.footer" #footer><slot name="footer" /></template></SageOverlay></template>
