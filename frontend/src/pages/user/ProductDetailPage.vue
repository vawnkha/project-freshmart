<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useProductDetail } from '@/composables/useProductDetail';
import { useProductPurchase } from '@/composables/useProductPurchase';
import { useProductReviews } from '@/composables/useProductReviews';
import { detailId, detailStock, productSpecifications, quantityMessage } from '@/utils/product-detail.util';
import { productPrice } from '@/utils/storefront.util';
import StorefrontBreadcrumb from '@/components/user/common/StorefrontBreadcrumb.vue';
import ProductPrice from '@/components/user/product/ProductPrice.vue';
import BatchPromotionNotice from '@/components/user/product/BatchPromotionNotice.vue';
import ProductGallery from '@/components/user/product/ProductGallery.vue';
import ProductInformation from '@/components/user/product/ProductInformation.vue';
import ProductReviews from '@/components/user/product/ProductReviews.vue';
import QuantityControl from '@/components/user/product/QuantityControl.vue';
import CatalogProductCard from '@/components/user/catalog/CatalogProductCard.vue';
import SageButton from '@/components/user/sage/SageButton.vue';
import SageSkeleton from '@/components/user/sage/SageSkeleton.vue';
import SageErrorState from '@/components/user/sage/SageErrorState.vue';
import SageEmptyState from '@/components/user/sage/SageEmptyState.vue';
const route = useRoute();
const { product, loading, error, notFound, unavailable, related, relatedLoading, relatedError, load, loadRelated } = useProductDetail(() => route.params.id);
const purchase = useProductPurchase();
const reviews = useProductReviews(computed(() => detailId(product.value?._id || product.value?.id)));
const quantity = ref(1), touched = ref(false), feedback = ref(null);
const stock = computed(() => detailStock(product.value)), maximum = computed(() => purchase.maximum(product.value));
const packageSize = computed(() => productSpecifications(product.value).find(row => row.label === 'Quy cách đóng gói')?.value);
const quantityError = computed(() => touched.value && stock.value >= 1 ? quantityMessage(quantity.value, maximum.value) : '');
const stockLabel = computed(() => stock.value === null ? 'Chưa xác định tồn kho' : stock.value >= 1 ? 'Còn ' + stock.value + ' ' + (product.value?.unit || 'sản phẩm') : 'Hết hàng');
const addLabel = computed(() => stock.value === null ? 'Chưa xác định tồn kho' : stock.value < 1 ? 'Hết hàng' : productPrice(product.value) === null ? 'Chưa có giá' : maximum.value < 1 ? 'Đã đủ trong giỏ' : 'Thêm vào giỏ hàng');
const quantityHint = computed(() => stock.value === null ? 'Tải lại thông tin để kiểm tra khả dụng.' : 'Đã có ' + purchase.quantity(product.value) + ' trong giỏ. Có thể thêm tối đa ' + (maximum.value ?? 0) + '.');
const catalogLink = computed(() => ({ path: '/products', query: { ...route.query } }));
const categoryLink = computed(() => ({ path: '/products', query: { ...route.query, category_id: detailId(product.value?.category_id), page: undefined } }));
const crumbs = computed(() => [{ label: 'Trang chủ', to: '/' }, { label: 'Sản phẩm', to: catalogLink.value },
  ...(product.value?.category_name && product.value.category_id ? [{ label: product.value.category_name, to: categoryLink.value }] : []),
  { label: product.value?.name || 'Chi tiết sản phẩm' }]);
function setQuantity(value) { quantity.value = value; touched.value = true; }
async function add() {
  touched.value = true;
  if (quantityError.value) { document.getElementById('pdp-quantity')?.focus(); return; }
  await purchase.add(product.value, quantity.value);
  if (purchase.state.error) { await nextTick(); feedback.value?.focus({ preventScroll: true }); }
}
watch(() => route.params.id, () => { quantity.value = 1; touched.value = false; });
</script>
<template>
  <div class="site-content sage-pdp">
    <div class="container">
      <div class="pdp-breadcrumb"><StorefrontBreadcrumb :items="crumbs" /></div>
      <template v-if="loading">
        <h1 class="pdp-state-heading">Chi tiết sản phẩm</h1><p role="status">Đang tải thông tin sản phẩm...</p>
        <div class="pdp-grid pdp-loading" aria-hidden="true"><SageSkeleton class="pdp-skeleton-image" /><div><SageSkeleton /><SageSkeleton /><SageSkeleton /></div></div>
      </template>
      <template v-else-if="notFound || unavailable">
        <h1 class="pdp-state-heading">{{ notFound ? 'Không tìm thấy sản phẩm' : 'Sản phẩm không còn khả dụng' }}</h1>
        <SageEmptyState title="Khám phá sản phẩm khác" description="Sản phẩm này không tồn tại hoặc không được phép hiển thị tại cửa hàng.">
          <RouterLink :to="catalogLink" class="sage-button">Xem sản phẩm</RouterLink>
        </SageEmptyState>
      </template>
      <template v-else-if="error">
        <h1 class="pdp-state-heading">Chi tiết sản phẩm</h1><SageErrorState :title="error" retry @retry="load" />
      </template>
      <template v-else-if="product">
        <div class="pdp-grid">
          <ProductGallery :key="detailId(product._id || product.id)" :product="product" />
          <div class="pdp-summary sage-panel-in">
            <RouterLink v-if="product.category_name && product.category_id" :to="categoryLink" class="pdp-category">{{ product.category_name }}</RouterLink>
            <h1>{{ product.name || 'Chi tiết sản phẩm' }}</h1>
            <p v-if="product.productCode" class="pdp-product-code">Mã sản phẩm: {{ product.productCode }}</p>
            <ProductPrice :product="product" />
            <BatchPromotionNotice :product-id="detailId(product._id || product.id)" :promotions="product.batchPromotions" />
            <p v-if="product.shortDescription" class="pdp-short-description">{{ product.shortDescription }}</p>
            <dl class="pdp-facts">
              <div v-if="packageSize" class="pdp-fact"><dt>Quy cách đóng gói</dt><dd>{{ packageSize }}</dd></div>
              <div class="pdp-fact"><dt>Tình trạng</dt><dd><p class="stock-label pdp-stock" :class="stock === null ? 'unknown-stock' : stock >= 1 ? 'in-stock' : 'out-stock'"><i class="fa-solid fa-circle" aria-hidden="true"></i>{{ stockLabel }}</p></dd></div>
            </dl>
            <SageButton v-if="stock === null" variant="secondary" @click="load">Tải lại sản phẩm</SageButton>
            <div class="pdp-purchase">
              <QuantityControl :model-value="quantity" :maximum="maximum" :error="quantityError" :hint="quantityHint"
                :disabled="purchase.locked() || maximum === null || maximum < 1" @update:model-value="setQuantity" />
              <div class="pdp-purchase-actions">
                <SageButton class="pdp-add" :loading="purchase.state.busy === 'cart' && purchase.state.productId === detailId(product._id || product.id)"
                  :disabled="!purchase.canAdd(product, quantity)" @click="add"><i class="fa-solid fa-bag-shopping" aria-hidden="true"></i>{{ addLabel }}</SageButton>
                <SageButton variant="secondary" class="pdp-save sage-icon-button" :aria-label="purchase.isSaved(product) ? 'Bỏ yêu thích sản phẩm' : 'Lưu sản phẩm yêu thích'"
                  :aria-pressed="purchase.isSaved(product)" :disabled="purchase.locked()" @click="purchase.toggle(product)"><i class="fa-regular fa-heart" aria-hidden="true"></i></SageButton>
              </div>
              <p class="pdp-cart-note">Giỏ hàng không giữ chỗ tồn kho. Số lượng được kiểm tra lại khi thao tác.</p>
            </div>
            <div v-if="purchase.state.error || purchase.state.success" ref="feedback" tabindex="-1" class="pdp-feedback" :class="{ 'pdp-feedback--error': purchase.state.error }" :role="purchase.state.error ? 'alert' : 'status'">
              <p>{{ purchase.state.error || purchase.state.success }}</p>
              <SageButton v-if="purchase.state.error && !purchase.state.uncertain" variant="secondary" :disabled="purchase.locked()" @click="load">Tải lại sản phẩm</SageButton>
              <template v-if="purchase.state.uncertain">
                <RouterLink :to="purchase.state.uncertain === 'cart' ? '/cart' : '/wishlist'">Xem dữ liệu mới nhất</RouterLink>
                <SageButton variant="secondary" :loading="purchase.state.busy === 'read'" @click="purchase.refresh">Tải lại dữ liệu</SageButton>
                <SageButton v-if="purchase.state.fresh" variant="secondary" :disabled="!!purchase.state.busy" @click="purchase.acknowledge">Đã kiểm tra dữ liệu mới nhất</SageButton>
              </template>
            </div>
            <p v-if="reviews.summary?.total && !reviews.state.error" class="pdp-rating-link">{{ reviews.summary.average.toFixed(1) }}/5 · {{ reviews.summary.total }} đánh giá</p>
            <RouterLink to="/contact" class="pdp-support">Cần hỗ trợ lựa chọn? Liên hệ với chúng tôi <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></RouterLink>
          </div>
        </div>
        <ProductInformation :key="detailId(product._id || product.id)" :product="product" :review-count="reviews.state.error ? undefined : reviews.summary?.total">
          <template #reviews><ProductReviews :resource="reviews" /></template>
        </ProductInformation>
        <section v-if="relatedLoading || relatedError || related.length" class="pdp-related sage-catalog sage-reveal">
          <div class="pdp-section-heading"><h2 class="pdp-section-title">Sản phẩm cùng danh mục</h2><RouterLink :to="categoryLink" class="pdp-support">Xem danh mục <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></RouterLink></div>
          <p v-if="relatedLoading" role="status">Đang tải sản phẩm cùng danh mục...</p>
          <div v-if="relatedLoading" class="catalog-product-grid" aria-hidden="true"><SageSkeleton v-for="n in 4" :key="n" class="pdp-related-skeleton" /></div>
          <SageErrorState v-else-if="relatedError" :title="relatedError" retry @retry="loadRelated" />
          <div v-else class="catalog-product-grid"><CatalogProductCard v-for="item in related" :key="detailId(item._id || item.id)" :product="item" :actions="purchase" /></div>
        </section>
      </template>
    </div>
  </div>
</template>
