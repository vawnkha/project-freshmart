<script setup>
import { onMounted } from 'vue';
import { useCatalog } from '@/composables/useCatalog';
import CategoryCard from './CategoryCard.vue';
import SectionHeading from '@/components/user/common/SectionHeading.vue';
import SageSkeleton from '@/components/user/sage/SageSkeleton.vue';
import SageEmptyState from '@/components/user/sage/SageEmptyState.vue';
import SageErrorState from '@/components/user/sage/SageErrorState.vue';
const { categories, loading, error, loadCategories } = useCatalog();
// Refresh each visit; Header/Footer/Hero consume the same authoritative cache.
onMounted(() => loadCategories(true));
</script>
<template>
  <section class="home-sage-section home-categories" :aria-busy="loading" aria-label="Danh mục sản phẩm">
    <div class="container">
      <SectionHeading eyebrow="Danh mục" title="Bắt đầu từ nhu cầu." description="Bắt đầu từ danh mục phù hợp với nhu cầu của bạn." to="/products" />
      <div v-if="loading" class="home-category-list"><SageSkeleton v-for="n in 6" :key="n" :lines="1" label="Đang tải danh mục" /></div>
      <SageErrorState v-else-if="error" heading-tag="h3" :title="error" @retry="loadCategories(true)" />
      <SageEmptyState v-else-if="!categories.length" heading-tag="h3" title="Danh mục đang được cập nhật" description="Bạn vẫn có thể tìm kiếm trong danh sách sản phẩm." />
      <nav v-else class="home-category-list" aria-label="Chọn danh mục"><div v-for="(category, index) in categories" :key="category._id || category.id" class="reveal" :style="{ '--i': index % 3 }"><CategoryCard :category="category" numbered :index="index" /></div></nav>
    </div>
  </section>
</template>
