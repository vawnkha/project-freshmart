<script setup>
import { computed, onBeforeUnmount } from "vue";
import { useRouter } from "vue-router";
import { useWishlistStore } from "@/stores/user/wishlist";
import { useCartStore } from "@/stores/user/cart";
import { useAuthStore } from "@/stores/user/auth";
import { normalizeId } from "@/utils/id.util";
import { productPrice, productComparePrice } from "@/utils/storefront.util";
import { catalogStock } from "@/utils/catalog-query.util";
import { userError } from "@/utils/user-error.util";
import { notify } from "@/composables/useStorefrontNotice";
import ResponsiveImage from "@/components/user/common/ResponsiveImage.vue";
import ProductPrice from "./ProductPrice.vue";
import BatchPromotionNotice from "./BatchPromotionNotice.vue";
import SageIcon from "@/components/user/sage/SageIcon.vue";
const props = defineProps({ product: { type: Object, required: true } });
const wishlist = useWishlistStore();
const cart = useCartStore();
const auth = useAuthStore();
const router = useRouter();
const busy = computed(() => cart.loading || wishlist.loading);
let disposed = false;
onBeforeUnmount(() => { disposed = true; });
const id = computed(() =>
  normalizeId(
    props.product.product_id || props.product._id || props.product.id,
  ),
);
const link = computed(() => `/products/${id.value}`);
const stock = computed(() => catalogStock(props.product));
const price = computed(() => productPrice(props.product));
const quantity = computed(() => cart.items.filter(item => normalizeId(item.product_id) === id.value).reduce((sum, item) => sum + Number(item.quantity || 0), 0));
const canAdd = computed(() => stock.value !== null && stock.value >= 1 && quantity.value + 1 <= stock.value && price.value !== null);
const recoveryStore = computed(() => cart.mutation.uncertain ? cart : wishlist.mutation.uncertain ? wishlist : null);
const actionLabel = computed(() => busy.value ? "Đang cập nhật..." : cart.mutation.uncertain ? "Kiểm tra lại giỏ hàng" : stock.value === null ? "Chưa xác định tồn kho" : stock.value < 1 ? "Hết hàng" : quantity.value + 1 > stock.value ? "Đã đủ trong giỏ" : "Thêm vào giỏ");
function ownerContext() { return { owner: auth.userId, cart: cart.ownerVersion, wishlist: wishlist.ownerVersion }; }
function live(context) { return !disposed && context.owner === auth.userId && context.cart === cart.ownerVersion && context.wishlist === wishlist.ownerVersion; }
async function refreshRecovery(store = recoveryStore.value) {
  if (!store || busy.value) return;
  const context = ownerContext();
  try { await store.refreshMutation(); } catch { if (live(context)) notify(store.mutation.error, "error"); }
}
const discount = computed(() =>
  productComparePrice(props.product) !== null
    ? Math.round((1 - price.value / productComparePrice(props.product)) * 100)
    : 0,
);
async function addToCart() {
  if (busy.value) return;
  if (cart.mutation.uncertain) { await refreshRecovery(cart); return; }
  if (!canAdd.value) return;
  if (!auth.userId) {
    notify("Vui lòng đăng nhập để thêm sản phẩm vào giỏ hàng.");
    router.push("/login");
    return;
  }
  const context = ownerContext();
  try {
    await cart.addToCart(auth.userId, id.value, 1);
    if (live(context)) notify("Đã thêm sản phẩm vào giỏ hàng.", "success");
  } catch (error) {
    if (!live(context)) return;
    notify(
      error.clientMutationUncertain ? "Chưa xác định kết quả thao tác. Hãy kiểm tra giỏ hàng trước khi tiếp tục." : userError(error, "Chưa thể thêm sản phẩm. Vui lòng kiểm tra giỏ hàng hoặc thử lại."),
      "error",
    );
  }
}
async function toggleWishlist() {
  if (busy.value) return;
  if (wishlist.mutation.uncertain) { await refreshRecovery(wishlist); return; }
  if (!auth.userId) {
    notify("Vui lòng đăng nhập để lưu sản phẩm yêu thích.");
    router.push("/login");
    return;
  }
  const context = ownerContext();
  try {
    await wishlist.toggleWishlist(auth.userId, id.value);
    if (live(context)) notify("Đã cập nhật danh sách yêu thích.", "success");
  } catch (error) {
    if (live(context)) notify(error.clientMutationUncertain ? "Chưa xác định kết quả thao tác. Hãy kiểm tra yêu thích trước khi tiếp tục." : "Không thể cập nhật yêu thích. Vui lòng thử lại.", "error");
  }
}
</script>
<template>
  <article class="store-product-card approved-product-card">
    <div class="card-image-wrap">
      <router-link :to="link" class="card-image" :aria-label="`Xem chi tiết ${product.name}`"
        ><ResponsiveImage
          :src="product.thumbnail || product.images?.[0]"
          :alt="product.name" /></router-link
      ><span v-if="discount" class="sale-badge">−{{ discount }}%</span><span v-else-if="stock === null || stock === 0" class="stock-flag">{{ stock === null ? 'Chưa rõ tồn' : 'Hết hàng' }}</span
      ><button
        type="button" class="card-wishlist icon-button"
        :class="{ loved: wishlist.isInWishlist(id) }"
        :aria-label="`${wishlist.isInWishlist(id) ? 'Bỏ yêu thích' : 'Yêu thích'} ${product.name}`"
        :aria-pressed="wishlist.isInWishlist(id)"
        :disabled="busy" :aria-busy="wishlist.mutation.busy"
        @click="toggleWishlist"
      >
        <SageIcon name="heart" />
      </button>
    <div class="card-actions">
        <button
          type="button" class="btn btn-primary card-add" :aria-label="`${actionLabel} ${product.name}`" :title="actionLabel" :aria-busy="busy"
          :disabled="!canAdd || busy"
          @click="addToCart"
        >
          <SageIcon name="plus" /><span class="card-add-label">{{ busy ? 'Đang cập nhật…' : cart.mutation.uncertain ? 'Đối soát giỏ' : canAdd ? 'Thêm vào giỏ' : 'Chưa thể mua' }}</span></button>
      </div>
    </div>
    <div class="card-content">
      <span class="card-category">{{
        product.category_name || product.category?.name
      }}</span>
      <h3 class="card-title">
        <router-link :to="link" :title="product.name">{{
          product.name
        }}</router-link>
      </h3>
      <BatchPromotionNotice :product-id="id" :promotions="product.batchPromotions" compact />
      <ProductPrice :product="product" /><span
        class="stock-label"
        :class="stock > 0 ? 'in-stock' : 'out-stock'"
        ><i class="fa-solid fa-circle" aria-hidden="true"></i>
        {{ stock === null ? "Chưa xác định tồn kho" : stock > 0 ? "Còn hàng" : "Hết hàng" }}</span
      >
      <div v-if="recoveryStore" class="card-recovery" role="status">
        <p>{{ recoveryStore.mutation.error }}</p>
        <button type="button" class="btn btn-secondary" :disabled="busy" @click="refreshRecovery()">Tải lại để đối soát</button>
        <button v-if="recoveryStore.mutation.fresh" type="button" class="btn btn-secondary" :disabled="busy" @click="recoveryStore.acknowledgeMutation()">Đã kiểm tra, tiếp tục</button>
      </div>
    </div>
  </article>
</template>
