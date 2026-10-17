<script setup>
import { onMounted } from "vue";
import { useAuthStore } from "./stores/user/auth";
import { useCartStore } from "./stores/user/cart";
import { useWishlistStore } from "./stores/user/wishlist";

const authStore = useAuthStore();
const cartStore = useCartStore();
const wishlistStore = useWishlistStore();

onMounted(async () => {
  if (!authStore.accessToken) return;

  try {
    await authStore.fetchProfile();
    await Promise.all([
      cartStore.fetchCart(authStore.userId),
      wishlistStore.fetchWishlist(authStore.userId),
    ]);
  } catch (error) {
    console.warn("Không thể khởi tạo dữ liệu tài khoản:", error.message);
  }
});
</script>

<template>
  <router-view />
</template>
