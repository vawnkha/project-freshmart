<script setup>
defineProps({ variant: { type: String, default: 'primary' }, loading: Boolean, disabled: Boolean, state: { type: String, default: 'default' }, type: { type: String, default: 'button' } });
</script>
<template>
  <button :type="type" class="sage-button" :class="['sage-button--' + variant, { 'is-loading': loading }]" :disabled="disabled || loading" :aria-busy="loading || undefined" :data-state="state">
    <span class="sage-button-label"><slot /></span>
    <span v-if="loading" class="sage-loading-dots" aria-hidden="true"></span>
  </button>
</template>
