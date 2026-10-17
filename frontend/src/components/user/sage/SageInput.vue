<script setup>
import { useAttrs } from 'vue';
import SageField from './SageField.vue';
defineOptions({ inheritAttrs: false });
const props = defineProps({ modelValue: [String, Number], id: String, label: { type: String, required: true }, hint: String, error: String, success: String, required: Boolean, disabled: Boolean, loading: Boolean, type: { type: String, default: 'text' } });
const emit = defineEmits(['update:modelValue']);
const attrs = useAttrs();
function input(event) { const el = event.target; emit('update:modelValue', props.type === 'number' && el.value !== '' && Number.isFinite(el.valueAsNumber) ? el.valueAsNumber : el.value); }
function describedby(own) { return [attrs['aria-describedby'], own].filter(Boolean).join(' ') || undefined; }
</script>
<template>
  <SageField :id="id" :label="label" :hint="hint" :error="error" :success="success" :required="required" v-slot="field">
    <input v-bind="$attrs" :id="field.id" class="sage-control" :type="type" :value="modelValue ?? ''" :required="required" :disabled="disabled || loading" :aria-busy="loading || undefined" :aria-invalid="field.invalid" :aria-describedby="describedby(field.describedby)" @input="input" />
  </SageField>
</template>
