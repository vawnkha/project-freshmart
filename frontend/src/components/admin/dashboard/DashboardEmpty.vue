<script setup>
defineProps({
  title: { type: String, required: true },
  detail: { type: String, default: "" },
  icon: { type: String, default: "fa-chart-simple" },
  compact: Boolean,
});
</script>
<template>
  <div class="fm-empty" :class="{ 'fm-empty--compact': compact }">
    <span class="fm-empty-icon" aria-hidden="true"
      ><i :class="'fa-solid ' + icon"></i></span
    ><strong>{{ title }}</strong>
    <p v-if="detail">{{ detail }}</p>
    <slot />
  </div>
</template>
