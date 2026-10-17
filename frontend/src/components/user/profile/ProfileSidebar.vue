<script setup>
import { useAuthStore } from "@/stores/user/auth";
import { useCartStore } from "@/stores/user/cart";
import { useWishlistStore } from "@/stores/user/wishlist";
import { useRouter } from "vue-router";
defineProps({
  menuItems: { type: Array, required: true },
  activeTab: { type: String, required: true },
});
defineEmits(["change-tab"]);
const auth = useAuthStore();
const cart = useCartStore();
const wishlist = useWishlistStore();
const router = useRouter();
function logout() {
  auth.logout();
  cart.items = [];
  cart.subtotal = 0;
  wishlist.items = [];
  router.push("/login");
}
</script>
<template>
  <nav class="profile-sidebar" aria-label="Quản lý tài khoản">
    <button
      v-for="item in menuItems"
      :key="item.key"
      class="profile-menu-item"
      :class="{ active: activeTab === item.key }"
      :aria-current="activeTab === item.key ? 'page' : undefined"
      @click="$emit('change-tab', item.key)"
    >
      <i :class="item.icon" aria-hidden="true"></i><span>{{ item.label }}</span></button
    ><button class="profile-menu-item" @click="logout">
      <span>Đăng xuất</span
      ><i class="fa-solid fa-arrow-right-from-bracket" aria-hidden="true"></i>
    </button>
  </nav>
</template>
