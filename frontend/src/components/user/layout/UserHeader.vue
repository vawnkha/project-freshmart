<script setup>
import { computed, onMounted, onBeforeUnmount, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { useRouter } from "vue-router";
import { useCartStore } from "@/stores/user/cart";
import { useAuthStore } from "@/stores/user/auth";
import { useWishlistStore } from "@/stores/user/wishlist";

const router = useRouter();

const isTopbarOpen = ref(false);
const isMobileMenuOpen = ref(false);
const isAccountOpen = ref(false);
const isCartOpen = ref(false);
const searchKeyword = ref("");

const headerRef = ref(null);
const accountRef = ref(null);
const cartRef = ref(null);

const authStore = useAuthStore();
const cartStore = useCartStore();
const wishlistStore = useWishlistStore();

const { cartCount, cartTotal, items } = storeToRefs(cartStore);

const isLoggedIn = computed(() => authStore.isLoggedIn);
const user = computed(() => authStore.user);
const displayName = computed(() => user.value?.name || "Người Dùng");

const menuItems = [
  { label: "Trang Chủ", to: "/" },
  { label: "Sản Phẩm", to: "/products" },
  { label: "Blog", to: "/blog" },
  { label: "Giới Thiệu", to: "/about" },
  { label: "Liên Hệ", to: "/contact" },
];

const cartPreviewItems = computed(() => items.value.slice(0, 3));

async function bootstrapUserData() {
  if (!authStore.accessToken) {
    cartStore.items = [];
    wishlistStore.items = [];
    return;
  }

  try {
    if (!authStore.userId) {
      const decoded = JSON.parse(atob(authStore.accessToken.split(".")[1]));
      authStore.userId = decoded.id;
    }

    if (!authStore.user) {
      await authStore.fetchProfile();
    }

    await Promise.all([
      cartStore.fetchCart(authStore.userId),
      wishlistStore.fetchWishlist?.(authStore.userId),
    ]);
  } catch (error) {
    console.error(error.message);
  }
}

onMounted(async () => {
  await bootstrapUserData();
  document.addEventListener("click", handleClickOutside);
});

onBeforeUnmount(() => {
  document.removeEventListener("click", handleClickOutside);
});

watch(
  () => authStore.userId,
  async (newUserId, oldUserId) => {
    if (newUserId && newUserId !== oldUserId) {
      await bootstrapUserData();
    }

    if (!newUserId) {
      isAccountOpen.value = false;
      isCartOpen.value = false;
      cartStore.items = [];
      cartStore.subtotal = 0;
      wishlistStore.items = [];
    }
  },
);

function toggleTopbar() {
  isTopbarOpen.value = !isTopbarOpen.value;
}

function closeTopbar() {
  isTopbarOpen.value = false;
}

function toggleAccount() {
  isAccountOpen.value = !isAccountOpen.value;
  if (isAccountOpen.value) isCartOpen.value = false;
}

function toggleCart() {
  isCartOpen.value = !isCartOpen.value;
  if (isCartOpen.value) isAccountOpen.value = false;
}

function handleClickOutside(event) {
  const target = event.target;

  if (accountRef.value && !accountRef.value.contains(target)) {
    isAccountOpen.value = false;
  }

  if (cartRef.value && !cartRef.value.contains(target)) {
    isCartOpen.value = false;
  }
}

async function handleLogout() {
  try {
    authStore.logout();
    isAccountOpen.value = false;
    isCartOpen.value = false;
    router.push("/login");
  } catch (error) {
    console.error(error.message);
  }
}

async function handleRemoveFromCart(productId) {
  if (!authStore.userId) return;

  try {
    await cartStore.removeFromCart(authStore.userId, productId);
  } catch (error) {
    alert(error.message);
  }
}

function submitSearch() {
  const q = searchKeyword.value.trim();

  router.push({
    path: "/products",
    query: q ? { q } : {},
  });

  isMobileMenuOpen.value = false;
}

function goToPage(path) {
  isMobileMenuOpen.value = false;
  isAccountOpen.value = false;
  isCartOpen.value = false;
  router.push(path);
}
</script>

<template>
  <header
    id="header"
    ref="headerRef"
    :class="{ 'no-border-top': isTopbarOpen }"
  >
    <div class="topbar">
      <div v-if="isTopbarOpen" class="close-topbar" @click="closeTopbar">
        <i class="zmdi zmdi-close"></i>
      </div>

      <div
        v-if="isTopbarOpen"
        class="container topbar-content"
        :style="{ display: isTopbarOpen ? 'block' : 'none' }"
      >
        <div class="row">
          <div class="col-md-7 col-sm-7 col-xs-12">
            <div class="topbar-left d-flex">
              <div class="email">
                <i class="fa fa-envelope" aria-hidden="true"></i>
                Email: nvkha@gmail.com
              </div>
              <div class="skype">
                <i class="fa fa-skype" aria-hidden="true"></i>
                Skype: freshmart
              </div>
            </div>
          </div>

          <div class="col-md-5 col-sm-5 col-xs-12">
            <div class="topbar-right d-flex justify-content-end">
              <div
                ref="accountRef"
                class="dropdown account"
                :class="{ open: isAccountOpen }"
              >
                <div
                  class="dropdown-toggle"
                  @click.stop="toggleAccount"
                  :aria-expanded="isAccountOpen"
                >
                  Tài Khoản
                </div>

                <transition name="fade-dropdown">
                  <div class="dropdown-menu" v-show="isAccountOpen">
                    <template v-if="isLoggedIn">
                      <div class="item">
                        <router-link
                          to="/profile"
                          @click="isAccountOpen = false"
                        >
                          <i class="fa fa-user"></i>{{ displayName }}
                        </router-link>
                      </div>

                      <div class="item">
                        <router-link
                          to="/wishlist"
                          @click="isAccountOpen = false"
                        >
                          <i class="fa fa-heart"></i>Yêu Thích
                        </router-link>
                      </div>

                      <div class="item">
                        <a href="#" @click.prevent="handleLogout">
                          <i class="fa fa-sign-out"></i> Đăng Xuất
                        </a>
                      </div>
                    </template>

                    <template v-else>
                      <div class="item">
                        <router-link to="/login" @click="isAccountOpen = false">
                          <i class="fa fa-sign-in"></i>Đăng Nhập
                        </router-link>
                      </div>

                      <div class="item">
                        <router-link
                          to="/register"
                          @click="isAccountOpen = false"
                        >
                          <i class="fa fa-user"></i>Đăng Ký
                        </router-link>
                      </div>
                    </template>
                  </div>
                </transition>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="container active">
        <div
          id="toggle-topbar"
          @click="toggleTopbar"
          :style="{ display: isTopbarOpen ? 'none' : 'block' }"
        >
          <i class="zmdi zmdi-plus"></i>
        </div>
      </div>
    </div>

    <div class="header-top">
      <div class="container">
        <div class="row">
          <div class="col-lg-4 col-md-4 col-sm-12 col-xs-12">
            <div class="form-search">
              <form @submit.prevent="submitSearch">
                <input
                  v-model="searchKeyword"
                  type="text"
                  class="form-input"
                  placeholder="Tìm Kiếm..."
                />
                <button type="submit" class="fa fa-search"></button>
              </form>
            </div>
          </div>

          <div class="col-lg-4 col-md-4 col-sm-12 col-xs-12">
            <div class="logo">
              <router-link to="/">
                <img class="img-responsive" src="/img/logo.png" alt="Logo" />
              </router-link>
            </div>

            <span
              id="toggle-mobile-menu"
              @click="isMobileMenuOpen = !isMobileMenuOpen"
            >
              <i class="zmdi zmdi-menu"></i>
            </span>
          </div>

          <div class="col-lg-4 col-md-4 col-sm-12 col-xs-12">
            <div
              ref="cartRef"
              class="block-cart dropdown"
              :class="{ open: isCartOpen }"
            >
              <div class="cart-title" @click.stop="toggleCart">
                <i class="fa fa-shopping-basket"></i>
                <span class="cart-count cart-badge-animate">{{
                  cartCount
                }}</span>
              </div>

              <transition name="fade-dropdown">
                <div v-show="isCartOpen" class="dropdown-content">
                  <div class="cart-content">
                    <table>
                      <tbody>
                        <tr v-if="!cartPreviewItems.length">
                          <td colspan="3">Chưa có sản phẩm trong giỏ hàng</td>
                        </tr>

                        <tr
                          v-for="item in cartPreviewItems"
                          :key="item.product_id"
                        >
                          <td class="product-image">
                            <router-link
                              :to="`/products/${item.product_id}`"
                              @click="isCartOpen = false"
                            >
                              <img :src="item.thumbnail" :alt="item.name" />
                            </router-link>
                          </td>

                          <td>
                            <div class="product-name">
                              <router-link
                                :to="`/products/${item.product_id}`"
                                @click="isCartOpen = false"
                              >
                                {{ item.name }}
                              </router-link>
                            </div>

                            <div>
                              {{ item.quantity }} x
                              <span class="product-price">
                                {{ Number(item.price).toLocaleString("vi-VN") }}
                                đ
                              </span>
                            </div>

                            <div>
                              <span class="product-price">
                                {{
                                  Number(
                                    item.price * item.quantity,
                                  ).toLocaleString("vi-VN")
                                }}
                                đ
                              </span>
                            </div>
                          </td>

                          <td class="action">
                            <a
                              class="remove"
                              href="#"
                              @click.prevent="
                                handleRemoveFromCart(item.product_id)
                              "
                            >
                              <i
                                class="fa-solid fa-trash-can"
                                aria-hidden="true"
                              ></i>
                            </a>
                          </td>
                        </tr>

                        <tr class="total">
                          <td>Tổng:</td>
                          <td colspan="2">
                            {{ Number(cartTotal).toLocaleString("vi-VN") }} đ
                          </td>
                        </tr>

                        <tr>
                          <td colspan="3">
                            <div class="cart-button">
                              <router-link
                                class="btn btn-primary"
                                to="/cart"
                                @click="isCartOpen = false"
                              >
                                Giỏ Hàng
                              </router-link>
                              <router-link
                                class="btn btn-primary"
                                to="/checkout"
                                @click="isCartOpen = false"
                              >
                                Thanh Toán
                              </router-link>
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </transition>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div id="main-menu">
      <ul class="menu">
        <li v-for="item in menuItems" :key="item.to">
          <router-link :to="item.to">{{ item.label }}</router-link>
        </li>
      </ul>
    </div>

    <transition name="slide-mobile">
      <div v-show="isMobileMenuOpen" class="mobile-menu-wrapper">
        <div class="container">
          <ul class="menu">
            <li v-for="item in menuItems" :key="`mobile-${item.to}`">
              <a href="#" @click.prevent="goToPage(item.to)">
                {{ item.label }}
              </a>
            </li>
          </ul>
        </div>
      </div>
    </transition>
  </header>
</template>

<style>
#header.no-border-top {
  border-top-width: 0 !important;
}

.fade-dropdown-enter-active,
.fade-dropdown-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.fade-dropdown-enter-from,
.fade-dropdown-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

.slide-mobile-enter-active,
.slide-mobile-leave-active {
  transition: all 0.25s ease;
}

.slide-mobile-enter-from,
.slide-mobile-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.cart-badge-animate {
  animation: pulseCart 0.35s ease;
}

@keyframes pulseCart {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.18);
  }
  100% {
    transform: scale(1);
  }
}
</style>
