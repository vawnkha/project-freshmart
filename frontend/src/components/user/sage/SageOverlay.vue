<script setup>
import { computed, useId } from 'vue';
import SageButton from './SageButton.vue';
import { useSageOverlay } from '@/composables/useSageOverlay';
import { useSageReducedMotion } from '@/composables/useSageReducedMotion';
import { SAGE_MOTION } from '@/utils/storefront-motion.util';
defineOptions({ inheritAttrs: false });
const props = defineProps({ modelValue: Boolean, title: { type: String, required: true }, description: String, kind: { type: String, default: 'dialog' }, edge: { type: String, default: 'right' }, dismissible: { type: Boolean, default: true } });
const emit = defineEmits(['update:modelValue', 'closed']);
const uid = 'sage-overlay-' + useId();
const reduced = useSageReducedMotion();
const duration = computed(() => reduced.value ? 1 : props.kind === 'drawer' ? SAGE_MOTION.drawer : SAGE_MOTION.base);
function requestClose() { if (props.dismissible) emit('update:modelValue', false); }
const { panel, enter, release, trap } = useSageOverlay(requestClose);
function afterLeave() { release(); emit('closed'); }
</script>
<template>
  <Transition name="sage-overlay" appear :duration="duration" @enter="enter" @after-leave="afterLeave">
    <dialog v-show="modelValue" v-bind="$attrs" class="sage-overlay" :class="['sage-overlay--' + kind, 'sage-overlay--' + edge]" :aria-labelledby="uid + '-title'" :aria-describedby="description ? uid + '-description' : undefined" aria-modal="true" @keydown="trap" @keydown.esc.stop.prevent="requestClose" @cancel.prevent="requestClose" @click.self="requestClose" @close="modelValue && emit('update:modelValue', false)">
      <div ref="panel" class="sage-overlay-panel" tabindex="-1">
        <header class="sage-overlay-header"><h2 :id="uid + '-title'">{{ title }}</h2><SageButton v-if="dismissible" variant="ghost" class="sage-icon-button" aria-label="Đóng" @click="requestClose">×</SageButton></header>
        <p v-if="description" :id="uid + '-description'" class="sage-overlay-description">{{ description }}</p>
        <div class="sage-overlay-content"><slot /></div>
        <footer v-if="$slots.footer" class="sage-overlay-footer"><slot name="footer" /></footer>
      </div>
    </dialog>
  </Transition>
</template>
