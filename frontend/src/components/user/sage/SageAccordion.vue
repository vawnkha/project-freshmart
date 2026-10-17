<script setup>
import { computed, ref, useId } from 'vue';
const props = defineProps({ title: { type: String, required: true }, modelValue: { type: Boolean, default: undefined }, defaultOpen: Boolean, disabled: Boolean, headingTag: { type: String, default: 'h3' } });
const emit = defineEmits(['update:modelValue']);
const internal = ref(props.defaultOpen);
const uid = 'sage-accordion-' + useId();
const expanded = computed(() => props.modelValue ?? internal.value);
function toggle() { if (props.disabled) return; internal.value = !expanded.value; emit('update:modelValue', internal.value); }
</script>
<template>
  <section class="sage-accordion" :class="{ 'is-open': expanded }">
    <component :is="headingTag"><button :id="uid + '-trigger'" type="button" :aria-expanded="expanded" :aria-controls="uid + '-panel'" :disabled="disabled" @click="toggle">{{ title }}<span class="sage-accordion-plus" aria-hidden="true"></span></button></component>
    <div :id="uid + '-panel'" class="sage-accordion-panel" role="region" :aria-labelledby="uid + '-trigger'" :aria-hidden="!expanded" :inert="!expanded ? '' : undefined"><div class="sage-accordion-inner"><div class="sage-accordion-content"><slot /></div></div></div>
  </section>
</template>
