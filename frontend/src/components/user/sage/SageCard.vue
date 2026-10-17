<script setup>
defineProps({ as: { type: String, default: 'article' }, mediaHover: Boolean });
</script>
<template>
  <component :is="as" class="sage-card" :class="{ 'sage-card--media-hover': mediaHover }">
    <div v-if="$slots.media" class="sage-card-media"><slot name="media" /></div>
    <div class="sage-card-body"><slot /></div>
    <footer v-if="$slots.footer" class="sage-card-footer"><slot name="footer" /></footer>
  </component>
</template>
