<script setup>
import ProductCard from "./ProductCard.vue";
defineProps({
  products: { type: Array, default: () => [] },
  loading: Boolean,
  list: Boolean,
});
</script>
<template>
  <div
    class="product-grid approved-product-grid"
    :class="{ 'product-grid-list': list }"
    :aria-busy="loading"
  >
    <template v-if="loading"
      ><div v-for="n in 4" :key="n" class="product-skeleton" aria-hidden="true">
        <div></div>
        <span></span><span></span><span></span></div
    ></template>
    <ProductCard
      v-else
      v-for="product in products"
      :key="product._id || product.id || product.product_id"
      :product="product"
    />
  </div>
</template>
