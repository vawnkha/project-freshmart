<script setup>
import { useAttrs } from 'vue';
import SageField from './SageField.vue';
defineOptions({ inheritAttrs: false });
defineProps({ modelValue: String, id: String, label: { type: String, required: true }, hint: String, error: String, success: String, required: Boolean, disabled: Boolean, loading: Boolean, rows: { type: [String, Number], default: 4 } });
const emit = defineEmits(['update:modelValue']);
const attrs = useAttrs();
</script>
<template>
  <SageField :id="id" :label="label" :hint="hint" :error="error" :success="success" :required="required" v-slot="field">
    <textarea v-bind="$attrs" :id="field.id" class="sage-control" :value="modelValue ?? ''" :rows="rows" :required="required" :disabled="disabled || loading" :aria-busy="loading || undefined" :aria-invalid="field.invalid" :aria-describedby="[attrs['aria-describedby'], field.describedby].filter(Boolean).join(' ') || undefined" @input="emit('update:modelValue', $event.target.value)"></textarea>
  </SageField>
</template>
