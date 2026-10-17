<script setup>
import { ref, watch } from "vue";
const props = defineProps({
  src: String,
  alt: { type: String, default: "" },
  eager: Boolean,
});
const failed = ref(false);
watch(
  () => props.src,
  () => {
    failed.value = false;
  },
);
</script>
<template>
  <img
    v-if="src && !failed"
    :src="src"
    :alt="alt"
    :loading="eager ? 'eager' : 'lazy'"
    decoding="async"
    @error="failed = true"
  />
  <div
    v-else
    class="image-placeholder"
    role="img"
    :aria-label="`${alt || 'Hình ảnh'} — chưa có ảnh`"
  >
    <i class="fa-solid fa-leaf" aria-hidden="true"></i
    ><span>Chưa có hình ảnh</span>
  </div>
</template>
