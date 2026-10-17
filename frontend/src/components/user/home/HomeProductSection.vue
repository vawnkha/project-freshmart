<script setup>
import { useHomeResource } from '@/composables/useHomeResource';
import productService from '@/services/product.service';
import { computed, ref } from 'vue';
import { sortProducts, productPrice } from '@/utils/storefront.util';
import { catalogStock } from '@/utils/catalog-query.util';
import { publicSearchProducts } from '@/utils/storefront-shell.util';
import ProductCard from '@/components/user/product/ProductCard.vue';
import SectionHeading from '@/components/user/common/SectionHeading.vue';
import SageSkeleton from '@/components/user/sage/SageSkeleton.vue';
import SageEmptyState from '@/components/user/sage/SageEmptyState.vue';
import SageErrorState from '@/components/user/sage/SageErrorState.vue';
import SageTabs from '@/components/user/sage/SageTabs.vue';
const { data: products, loading, error, load } = useHomeResource(
  () => productService.getAll(), 'Không thể tải sản phẩm. Vui lòng thử lại.',
  rows => sortProducts(publicSearchProducts(rows), 'newest').slice(0, 8),
);
// Views of the already loaded latest-product group, not filters over the catalog.
const view = ref('new');
const views = [{ value:'new', label:'Mới cập nhật' }, { value:'stock', label:'Còn hàng' }, { value:'price', label:'Theo giá' }];
const visibleProducts = computed(() => {
  const rows = view.value === 'stock' ? products.value.filter(p => catalogStock(p) !== null && catalogStock(p) > 0)
    : view.value === 'price' ? sortProducts(products.value.filter(p => productPrice(p) !== null), 'price-asc') : products.value;
  return rows.slice(0, 4);
});
</script>
<template>
  <section class="home-sage-section home-products" :aria-busy="loading" aria-label="Sản phẩm mới">
    <div class="container">
      <SectionHeading eyebrow="Sản phẩm" title="Dễ xem. Dễ lựa chọn." to="/products" link-text="Duyệt catalog" />
      <div v-if="loading" class="home-sage-product-grid"><SageSkeleton v-for="n in 4" :key="n" media :lines="3" label="Đang tải sản phẩm" /></div>
      <SageErrorState v-else-if="error" heading-tag="h3" :title="error" @retry="load" />
      <SageEmptyState v-else-if="!products.length" heading-tag="h3" title="Sản phẩm đang được cập nhật" description="Hãy quay lại để khám phá sản phẩm mới." />
      <SageTabs v-else v-model="view" :items="views" label="Xem trong nhóm sản phẩm mới cập nhật" class="home-product-tabs">
        <div v-if="visibleProducts.length" class="home-sage-product-grid">
          <div v-for="(product, index) in visibleProducts" :key="product._id || product.id" class="reveal" :style="{ '--i': index % 4 }"><ProductCard :product="product" /></div>
        </div>
        <SageEmptyState v-else heading-tag="h3" title="Chưa có sản phẩm trong nhóm này" description="Bạn có thể xem nhóm khác hoặc mở toàn bộ catalog." />
      </SageTabs>
    </div>
  </section>
</template>
