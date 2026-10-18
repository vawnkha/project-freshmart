<script setup>
import { computed, onMounted, onBeforeUnmount, ref, useId, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/user/auth';
import { useCartStore } from '@/stores/user/cart';
import { useWishlistStore } from '@/stores/user/wishlist';
import { useCatalog } from '@/composables/useCatalog';
import { useStorefrontShell } from '@/composables/useStorefrontShell';
import { CLIENT_NAVIGATION, isClientRouteActive, canOpenSearch } from '@/utils/storefront-shell.util';
import { notify } from '@/composables/useStorefrontNotice';
import { userError } from '@/utils/user-error.util';
import MobileNavigationDrawer from './MobileNavigationDrawer.vue';
import StorefrontSearchDialog from './StorefrontSearchDialog.vue';
import MiniCartDrawer from './MiniCartDrawer.vue';
import SageButton from '@/components/user/sage/SageButton.vue';
import SageIcon from '@/components/user/sage/SageIcon.vue';
const auth = useAuthStore(), cart = useCartStore(), wishlist = useWishlistStore();
const route = useRoute(), router = useRouter();
const { categories, loading, error, loadCategories } = useCatalog();
const shell = useStorefrontShell();
const { active, rendered } = shell;
const uid = 'client-shell-' + useId();
const searchToggle = ref(null), menuToggle = ref(null), cartToggle = ref(null), categoryMenu = ref(null), accountMenu = ref(null);
const scrolled = ref(false), categoryOpen = ref(false), accountOpen = ref(false);
const name = computed(() => auth.user?.name || 'Tài khoản');
const count = computed(() => auth.isLoggedIn ? cart.cartCount : 0);
const savedCount = computed(() => auth.isLoggedIn ? wishlist.wishlishCount : 0);
function open(panel, trigger) { closeCategory(); closeAccount(); shell.open(panel, trigger); }
function closeCategory(focus = false) { categoryOpen.value = false; if (focus) categoryMenu.value?.querySelector('summary')?.focus(); }
function closeAccount(focus = false) { accountOpen.value = false; if (focus) accountMenu.value?.querySelector('summary')?.focus(); }
function outside(event) {
  if (categoryOpen.value && !categoryMenu.value?.contains(event.target)) closeCategory();
  if (accountOpen.value && !accountMenu.value?.contains(event.target)) closeAccount();
}
function shortcut(event) {
  if (!canOpenSearch(event) || document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]')) return;
  event.preventDefault(); open('search', document.activeElement === document.body ? searchToggle.value : document.activeElement);
}
function scroll() { scrolled.value = window.scrollY > 16; }
// Preserve existing account bootstrap and logout contracts. This shell owns no
// auth token, permissions or cart/wishlist business state of its own.
let bootstrapPending;
function bootstrap() {
  if (!auth.accessToken) return;
  if (bootstrapPending) return bootstrapPending;
  bootstrapPending = loadAccount().finally(() => { bootstrapPending = undefined; });
  return bootstrapPending;
}
async function loadAccount() {
  try {
    if (!auth.user) await auth.fetchProfile();
    await Promise.all([cart.fetchCart(auth.userId), wishlist.fetchWishlist(auth.userId)]);
  } catch (error) {
    if (auth.accessToken) notify(userError(error, 'Không thể cập nhật giỏ hàng và sản phẩm yêu thích. Vui lòng thử lại.'), 'error');
  }
}
function logout() {
  closeAccount(); shell.close(); auth.logout(); cart.items = []; cart.subtotal = 0; wishlist.items = []; router.push('/login');
}
watch(() => route.fullPath, () => { closeCategory(); closeAccount(); shell.close(); });
watch(() => auth.userId, (id, old) => { if (id !== old) shell.close(); if (id && id !== old) bootstrap(); });
onMounted(() => {
  loadCategories(); bootstrap(); scroll();
  window.addEventListener('scroll', scroll, { passive: true });
  document.addEventListener('keydown', shortcut); document.addEventListener('pointerdown', outside);
});
onBeforeUnmount(() => {
  window.removeEventListener('scroll', scroll);
  document.removeEventListener('keydown', shortcut); document.removeEventListener('pointerdown', outside);
});
defineExpose({ closeShell: shell.close });
</script>
<template>
  <header class="store-header shell-header" :class="{ 'is-scrolled': scrolled }">
    <div class="container shell-header-row">
      <button ref="menuToggle" type="button" class="shell-icon-action shell-menu-toggle" aria-label="Mở menu" :aria-controls="uid + '-menu'" :aria-expanded="active === 'menu'" aria-haspopup="dialog" @click="open('menu', menuToggle)"><SageIcon name="menu" /></button>
      <div class="shell-brand-group">
        <router-link to="/" class="shell-brand" aria-label="FreshMart — Trang chủ"><img src="/img/logo.png" alt="FreshMart" width="104" height="42" /></router-link>
        <details ref="categoryMenu" class="shell-category-menu" :open="categoryOpen" @toggle="categoryOpen = $event.target.open" @keydown.esc.stop.prevent="closeCategory(true)" @focusout="!$event.currentTarget.contains($event.relatedTarget) && closeCategory()">
          <summary class="shell-icon-action" aria-label="Danh mục sản phẩm" title="Danh mục sản phẩm" :aria-expanded="categoryOpen"><i class="fa-solid fa-table-cells-large" aria-hidden="true"></i></summary>
          <nav class="shell-category-dropdown" aria-label="Danh mục sản phẩm"><p v-if="loading" role="status">Đang tải danh mục…</p><template v-else-if="error"><p role="alert">{{ error }}</p><SageButton variant="secondary" @click="loadCategories(true)">Thử lại</SageButton></template><router-link v-for="category in categories" :key="category._id" :to="{ path: '/products', query: { category_id: category._id } }" @click="closeCategory()">{{ category.name }}</router-link><router-link to="/products" @click="closeCategory()">Tất cả sản phẩm</router-link></nav>
        </details>
      </div>
      <nav class="shell-desktop-nav" aria-label="Điều hướng chính"><router-link v-for="link in CLIENT_NAVIGATION" :key="link.to" :to="link.to" :class="{ 'shell-diagnosis-link': link.to === '/chan-doan' }" :aria-current="isClientRouteActive(route.path, link.to) ? 'page' : undefined"><i v-if="link.to === '/chan-doan'" class="fa-solid fa-camera" aria-hidden="true"></i>{{ link.label }}</router-link></nav>
      <div class="shell-header-actions">
        <button ref="searchToggle" type="button" class="shell-icon-action shell-search-toggle" aria-label="Mở tìm kiếm" title="Tìm sản phẩm (/)" :aria-controls="uid + '-search'" :aria-expanded="active === 'search'" aria-haspopup="dialog" @click="open('search', searchToggle)"><SageIcon name="search" /></button>
        <details v-if="auth.isLoggedIn" ref="accountMenu" class="shell-account-menu shell-account-action" :open="accountOpen" @toggle="accountOpen = $event.target.open" @keydown.esc.stop.prevent="closeAccount(true)" @focusout="!$event.currentTarget.contains($event.relatedTarget) && closeAccount()">
          <summary class="shell-icon-action" :aria-label="'Tài khoản ' + name" :aria-expanded="accountOpen"><SageIcon name="user" /></summary>
          <div class="shell-account-dropdown"><p>{{ name }}</p><router-link to="/profile">Tài khoản &amp; đơn hàng</router-link><button type="button" class="shell-logout" @click="logout">Đăng xuất</button></div>
        </details>
        <router-link v-else to="/login" class="shell-icon-action shell-account-action" aria-label="Đăng nhập"><SageIcon name="user" /></router-link>
        <router-link to="/wishlist" class="shell-icon-action shell-wishlist-action" :aria-label="'Sản phẩm yêu thích, ' + savedCount + ' sản phẩm'"><SageIcon name="heart" /><Transition name="shell-badge"><span v-if="savedCount > 0" :key="savedCount" class="shell-badge" aria-hidden="true">{{ savedCount }}</span></Transition></router-link>
        <button ref="cartToggle" type="button" class="shell-icon-action" :aria-label="'Mở giỏ hàng, ' + count + ' sản phẩm'" :aria-controls="uid + '-cart'" :aria-expanded="active === 'cart'" aria-haspopup="dialog" @click="open('cart', cartToggle)"><SageIcon name="bag" /><Transition name="shell-badge"><span v-if="count > 0" :key="count" class="shell-badge" aria-hidden="true">{{ count }}</span></Transition></button>
      </div>
    </div>
  </header>
  <MobileNavigationDrawer v-if="rendered === 'menu'" :id="uid + '-menu'" :model-value="active === 'menu'" :logged-in="auth.isLoggedIn" :account-name="name" @update:model-value="!$event && shell.close()" @closed="shell.closed('menu')" @navigate="shell.close" @search="open('search', searchToggle)" @logout="logout" />
  <StorefrontSearchDialog v-if="rendered === 'search'" :id="uid + '-search'" :model-value="active === 'search'" @update:model-value="!$event && shell.close()" @closed="shell.closed('search')" @navigate="shell.close" />
  <MiniCartDrawer v-if="rendered === 'cart'" :id="uid + '-cart'" :model-value="active === 'cart'" @update:model-value="!$event && shell.close()" @closed="shell.closed('cart')" @navigate="shell.close" />
</template>
