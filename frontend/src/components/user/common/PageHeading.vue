<script setup>
import StorefrontBreadcrumb from './StorefrontBreadcrumb.vue';
defineProps({
  title: String,
  headingTag: { type: String, default: "h1" },
  description: String,
  breadcrumbTitle: String,
  split: Boolean,
  parent: String,
  parentTo: [String, Object],
});
</script>
<template>
  <div class="page-heading approved-page-heading" :class="{ 'page-heading--split': split }">
    <div class="container">
      <StorefrontBreadcrumb :current="breadcrumbTitle || title" :parent="parent" :parent-to="parentTo" />
      <component :is="headingTag">{{ title }}</component>
      <p v-if="description">{{ description }}</p>
    </div>
  </div>
</template>
