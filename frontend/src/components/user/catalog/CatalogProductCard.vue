<script setup>
import { computed } from 'vue';
import { normalizeId } from '@/utils/id.util';
import { productPrice, productComparePrice } from '@/utils/storefront.util';
import { catalogStock } from '@/utils/catalog-query.util';
import ResponsiveImage from '@/components/user/common/ResponsiveImage.vue';
import ProductPrice from '@/components/user/product/ProductPrice.vue';
import SageButton from '@/components/user/sage/SageButton.vue';
import SageIcon from '@/components/user/sage/SageIcon.vue';
const props = defineProps({ product: { type: Object, required: true }, actions: { type: Object, required: true } });
const id = computed(() => normalizeId(props.product._id || props.product.id));
const link = computed(() => '/products/' + id.value);
const stock = computed(() => catalogStock(props.product));
const price = computed(() => productPrice(props.product));
const discount = computed(() => { const compare = productComparePrice(props.product); return compare ? Math.round((1 - price.value / compare) * 100) : 0; });
const label = computed(() => stock.value === null ? 'Chưa xác định tồn kho' : stock.value < 1 ? 'Hết hàng' : price.value === null ? 'Chưa có giá' : props.actions.quantity(props.product) + 1 > stock.value ? 'Đã đủ trong giỏ' : 'Thêm vào giỏ');
</script>
<template>
  <article class="store-product-card catalog-product-card approved-product-card">
    <div class="card-image-wrap">
      <RouterLink :to="link" class="card-image" :aria-label="`Xem chi tiết ${product.name}`"><ResponsiveImage :src="product.thumbnail || product.images?.[0]" :alt="product.name" /></RouterLink>
      <span v-if="discount > 0" class="sale-badge">−{{ discount }}%</span>
      <span v-else-if="stock === null || stock === 0" class="stock-flag">{{ stock === null ? 'Chưa rõ tồn' : 'Hết hàng' }}</span>
      <SageButton variant="ghost" class="card-wishlist sage-icon-button" :class="{ loved: actions.isSaved(product) }" :aria-label="`${actions.isSaved(product) ? 'Bỏ yêu thích' : 'Yêu thích'} ${product.name}`" :aria-pressed="actions.isSaved(product)" :disabled="actions.locked()" @click="actions.toggle(product)"><SageIcon name="heart" /></SageButton>
    <div class="card-actions">
        <SageButton class="card-add" :disabled="!actions.canAdd(product)" :loading="actions.state.busy === 'cart' && actions.state.productId === id" :aria-label="`${label} ${product.name}`" :title="label" @click="actions.add(product)"><SageIcon name="plus" /><span class="card-add-label">{{ actions.state.busy === 'cart' && actions.state.productId === id ? 'Đang cập nhật…' : actions.canAdd(product) ? 'Thêm vào giỏ' : 'Chưa thể mua' }}</span></SageButton>
      </div>
    </div>
    <div class="card-content">
      <span v-if="product.category_name || product.category?.name" class="card-category">{{ product.category_name || product.category.name }}</span>
      <h3 class="card-title"><RouterLink :to="link" :title="product.name">{{ product.name }}</RouterLink></h3>
      <ProductPrice :product="product" />
      <span class="stock-label" :class="stock >= 1 ? 'in-stock' : 'out-stock'"><i class="fa-solid fa-circle" aria-hidden="true"></i>{{ stock === null ? 'Chưa xác định tồn kho' : stock >= 1 ? 'Còn hàng' : 'Hết hàng' }}</span>
      
    </div>
  </article>
</template>
