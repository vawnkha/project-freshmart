<script setup>
import { computed, ref, watch } from 'vue';
import SageTabs from '@/components/user/sage/SageTabs.vue';
import ProductDescriptionArticle from './ProductDescriptionArticle.vue';
const props = defineProps({ product: { type: Object, required: true }, reviewCount: Number });
const active = ref('information');
const tabs = computed(() => [
  { value: 'information', label: 'Mô tả sản phẩm' },
  { value: 'reviews', label: 'Đánh giá' + (props.reviewCount == null ? '' : ' (' + props.reviewCount + ')') },
]);
watch(() => props.product._id, () => { active.value = 'information'; });
</script>
<template>
  <section class="pdp-information">
    <h2 class="pdp-section-title">Tìm hiểu sản phẩm</h2>
    <SageTabs v-model="active" :items="tabs" label="Thông tin chi tiết sản phẩm">
      <template #information><ProductDescriptionArticle :product="product" /></template>
      <template #reviews><slot name="reviews" /></template>
    </SageTabs>
  </section>
</template>
