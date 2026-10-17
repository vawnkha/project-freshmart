<script setup>
import { onMounted, ref, watch } from "vue";
import { useWishlistStore } from "@/stores/user/wishlist";
import { useAuthStore } from "@/stores/user/auth";
import ProductGrid from "@/components/user/product/ProductGrid.vue";
import PageHeading from "@/components/user/common/PageHeading.vue";
import AppState from "@/components/user/common/AppState.vue";
const auth = useAuthStore();
const wishlist = useWishlistStore();
const error = ref("");
async function load() {
  if (!auth.userId) return;
  error.value = "";
  try {
    await wishlist.fetchWishlist(auth.userId);
  } catch {
    error.value = "Không thể tải sản phẩm yêu thích. Vui lòng thử lại.";
  }
}
watch(() => auth.userId, load);
onMounted(load);
</script>
<template>
  <div class="site-content sage-wishlist">
    <PageHeading
      title="Sản phẩm yêu thích"
      description="Lưu lại những sản phẩm bạn quan tâm."
    />
    <div class="container">
      <div class="wishlist-toolbar"><p v-if="!wishlist.loading && !error" class="sage-numeric" role="status">{{ wishlist.items.length }} sản phẩm đã lưu</p><RouterLink to="/products" class="text-link">Khám phá sản phẩm <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></RouterLink></div>
      <ProductGrid v-if="wishlist.loading" loading /><AppState
        v-else-if="error"
        kind="error"
        :title="error"
        retry
        @retry="load"
      /><AppState
        v-else-if="!wishlist.items.length"
        title="Chưa có sản phẩm yêu thích"
        description="Nhấn biểu tượng trái tim trên sản phẩm để lưu vào danh sách."
        to="/products"
      /><ProductGrid v-else :products="wishlist.items" />
    </div>
  </div>
</template>
