<script setup>
import { computed } from "vue";
import ResponsiveImage from "@/components/user/common/ResponsiveImage.vue";
import { normalizeId } from "@/utils/id.util";
const props = defineProps({ category: { type: Object, required: true }, numbered: Boolean, index: { type: Number, default: 0 } });
const image = computed(
  () =>
    props.category.image_url ||
    props.category.image ||
    props.category.imageUrl ||
    props.category.thumbnail ||
    "",
);
const destination = computed(() => ({
  path: "/products",
  query: { category_id: normalizeId(props.category._id || props.category.id) },
}));
</script>
<template>
  <router-link :to="destination" class="category-card home-category-card" :class="{ 'home-category-card--numbered': numbered }">
    <span v-if="numbered" class="home-category-number" aria-hidden="true">{{ String(index + 1).padStart(2, '0') }}</span>
    <span v-else class="home-category-card__image"
      ><ResponsiveImage :src="image" :alt="category.name"
    /></span>
    <span class="home-category-card__name">{{ category.name }}</span>
    <i v-if="numbered" class="fa-solid fa-arrow-right" aria-hidden="true"></i>
  </router-link>
</template>
