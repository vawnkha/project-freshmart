<script setup>
import { computed, nextTick, ref, useId } from 'vue';
defineOptions({ inheritAttrs: false });
const props = defineProps({ modelValue: String, items: { type: Array, required: true }, label: { type: String, required: true } });
const emit = defineEmits(['update:modelValue']);
const uid = 'sage-tabs-' + useId();
const buttons = ref([]);
const activeIndex = computed(() => { const index = props.items.findIndex(item => item.value === props.modelValue && !item.disabled); return index >= 0 ? index : props.items.findIndex(item => !item.disabled); });
const current = computed(() => props.items[activeIndex.value]);
async function move(event, index) {
  const enabled = props.items.map((item, i) => item.disabled ? -1 : i).filter(i => i >= 0);
  let next;
  if (event.key === 'Home') next = enabled[0];
  else if (event.key === 'End') next = enabled.at(-1);
  else if (['ArrowLeft', 'ArrowRight'].includes(event.key)) { const offset = event.key === 'ArrowRight' ? 1 : -1; next = enabled[(enabled.indexOf(index) + offset + enabled.length) % enabled.length]; }
  else return;
  event.preventDefault();
  if (next === undefined) return;
  emit('update:modelValue', props.items[next].value);
  await nextTick(); buttons.value[next]?.focus();
}
</script>
<template>
  <div class="sage-tabs" v-bind="$attrs">
    <div class="sage-tablist" role="tablist" :aria-label="label">
      <button v-for="(item, index) in items" :key="item.value" :ref="el => buttons[index] = el" type="button" role="tab" :id="uid + '-tab-' + index" :aria-controls="uid + '-panel'" :aria-selected="index === activeIndex" :tabindex="index === activeIndex ? 0 : -1" :disabled="item.disabled" @click="emit('update:modelValue', item.value)" @keydown="move($event, index)">{{ item.label }}</button>
    </div>
    <div v-if="current" :id="uid + '-panel'" role="tabpanel" :aria-labelledby="uid + '-tab-' + activeIndex" tabindex="0" class="sage-tabpanel">
      <div :key="current.value" class="sage-panel-in"><slot :name="current.value" :item="current"><slot :item="current" /></slot></div>
    </div>
  </div>
</template>
