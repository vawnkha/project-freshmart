<script setup>
defineProps({
  title: String,
  eyebrow: String,
  description: String,
  to: String,
  linkText: { type: String, default: "Xem tất cả" },
});
</script>
<template>
  <div class="section-heading">
    <div>
      <span v-if="eyebrow" class="eyebrow">{{ eyebrow }}</span>
      <h2>{{ title }}</h2>
      <p v-if="description">{{ description }}</p>
    </div>
    <router-link v-if="to" :to="to" class="text-link"
      >{{ linkText }} <i class="fa-solid fa-arrow-right" aria-hidden="true"></i
    ></router-link>
  </div>
</template>
