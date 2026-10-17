<script setup>
import { onBeforeUnmount, ref, watch } from 'vue';
import { useSageReducedMotion } from '@/composables/useSageReducedMotion';
import { SAGE_MOTION } from '@/utils/storefront-motion.util';
const props = defineProps({ modelValue: Boolean, message: { type: String, required: true }, tone: { type: String, default: 'neutral' }, duration: { type: Number, default: SAGE_MOTION.toastVisible } });
const emit = defineEmits(['update:modelValue', 'closed']);
const reduced = useSageReducedMotion();
const pauses = new Set();
let timer; let started; let remaining;
const toast = ref(null);
function close() { clearTimeout(timer); emit('update:modelValue', false); }
function resume(source) { pauses.delete(source); if (pauses.size || !props.modelValue || props.duration <= 0) return; clearTimeout(timer); started = Date.now(); timer = setTimeout(close, Math.max(0, remaining)); }
function pause(source) { if (pauses.has(source)) return; if (!pauses.size && timer) { remaining = Math.max(0, remaining - (Date.now() - started)); clearTimeout(timer); timer = undefined; } pauses.add(source); }
watch(() => [props.modelValue, props.message, props.duration], () => { clearTimeout(timer); remaining = props.duration; if (!props.modelValue) pauses.clear(); else resume(); }, { immediate: true });
function focusOut(event) { if (!toast.value?.contains(event.relatedTarget)) resume('focus'); }
onBeforeUnmount(() => clearTimeout(timer));
</script>
<template>
  <Transition name="sage-toast" :duration="reduced ? 1 : { enter: SAGE_MOTION.toastEnter, leave: SAGE_MOTION.toastCleanup }" @after-leave="emit('closed')">
    <div v-if="modelValue" ref="toast" class="sage-toast" :class="'sage-toast--' + tone" :role="tone === 'danger' ? 'alert' : 'status'" @mouseenter="pause('hover')" @mouseleave="resume('hover')" @focusin="pause('focus')" @focusout="focusOut">
      <span>{{ message }}</span><button type="button" aria-label="Đóng thông báo" @click="close">×</button>
    </div>
  </Transition>
</template>
