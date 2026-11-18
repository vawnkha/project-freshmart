<script setup>
import { onBeforeUnmount, ref, useId } from "vue";
defineProps({
  label: { type: String, required: true },
  text: { type: String, required: true },
});
const id = useId(),
  open = ref(false);
let timer, closing;
function enter() {
  clearTimeout(closing);
  timer = setTimeout(() => {
    open.value = true;
  }, 800);
}
function leave() {
  clearTimeout(timer);
  closing = setTimeout(() => {
    open.value = false;
  }, 200);
}
function focus() {
  clearTimeout(timer);
  clearTimeout(closing);
  open.value = true;
}
function close() {
  clearTimeout(timer);
  clearTimeout(closing);
  open.value = false;
}
onBeforeUnmount(close);
</script>
<template>
  <span class="fm-hint"
    ><span
      class="fm-tip"
      tabindex="0"
      :aria-label="'Giải thích: ' + label"
      :aria-describedby="id"
      @mouseenter="enter"
      @mouseleave="leave"
      @focus="focus"
      @blur="close"
      @keydown.esc.stop="close"
      ><i class="fa-regular fa-circle-question" aria-hidden="true"></i></span
    ><span
      v-show="open"
      :id="id"
      role="tooltip"
      class="fm-tip-text"
      @mouseenter="focus"
      @mouseleave="leave"
      >{{ text }}</span
    ></span
  >
</template>
