<script setup>
import { computed, useId } from 'vue';
defineOptions({ inheritAttrs: false });
const props = defineProps({ id: String, label: { type: String, required: true }, hint: String, error: String, success: String, required: Boolean });
const uid = useId();
const fieldId = computed(() => props.id || 'sage-field-' + uid);
const describedBy = computed(() => [props.hint && fieldId.value + '-hint', props.error && fieldId.value + '-error', !props.error && props.success && fieldId.value + '-success'].filter(Boolean).join(' ') || undefined);
</script>
<template>
  <div class="sage-field" :data-state="error ? 'error' : success ? 'success' : 'default'">
    <label :for="fieldId">{{ label }}<span v-if="required"> (bắt buộc)</span></label>
    <slot :id="fieldId" :describedby="describedBy" :invalid="error ? true : undefined" />
    <p v-if="hint" :id="fieldId + '-hint'" class="sage-field-hint">{{ hint }}</p>
    <p v-if="error" :id="fieldId + '-error'" class="sage-field-error" role="alert">{{ error }}</p>
    <p v-else-if="success" :id="fieldId + '-success'" class="sage-field-success" role="status">{{ success }}</p>
    <p v-else class="sage-field-placeholder" aria-hidden="true">&nbsp;</p>
  </div>
</template>
