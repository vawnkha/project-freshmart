<script setup>
import { useAttrs } from 'vue';
import SageField from './SageField.vue';
defineOptions({ inheritAttrs: false });
defineProps({ modelValue: [String, Number], id: String, label: { type: String, required: true }, options: { type: Array, default: () => [] }, hint: String, error: String, success: String, required: Boolean, disabled: Boolean, loading: Boolean });
const emit = defineEmits(['update:modelValue']);
const attrs = useAttrs();
</script>
<template>
  <SageField :id="id" :label="label" :hint="hint" :error="error" :success="success" :required="required" v-slot="field">
    <select v-bind="$attrs" :id="field.id" class="sage-control" :value="modelValue ?? ''" :required="required" :disabled="disabled || loading" :aria-busy="loading || undefined" :aria-invalid="field.invalid" :aria-describedby="[attrs['aria-describedby'], field.describedby].filter(Boolean).join(' ') || undefined" @change="emit('update:modelValue', $event.target.value)">
      <slot><option v-for="option in options" :key="option.value" :value="option.value" :disabled="option.disabled">{{ option.label }}</option></slot>
    </select>
  </SageField>
</template>
