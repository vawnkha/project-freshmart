<script setup>
import { useRoute } from 'vue-router';
import { CLIENT_NAVIGATION, isClientRouteActive } from '@/utils/storefront-shell.util';
import { useCatalog } from '@/composables/useCatalog';
import SageDrawer from '@/components/user/sage/SageDrawer.vue';
import SageButton from '@/components/user/sage/SageButton.vue';
import SageAccordion from '@/components/user/sage/SageAccordion.vue';
defineProps({ modelValue: Boolean, id: String, loggedIn: Boolean, accountName: String });
const emit = defineEmits(['update:modelValue', 'closed', 'navigate', 'search', 'logout']);
const route = useRoute();
const { categories, loading, error, loadCategories } = useCatalog();
</script>
<template>
  <SageDrawer :id="id" :model-value="modelValue" edge="left" title="Khám phá FreshMart" class="shell-mobile-drawer" @update:model-value="emit('update:modelValue', $event)" @closed="emit('closed')">
    <SageButton variant="secondary" class="shell-mobile-search" @click="emit('search')"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i> Tìm sản phẩm</SageButton>
    <nav aria-label="Điều hướng mobile" class="shell-mobile-nav">
      <router-link v-for="link in CLIENT_NAVIGATION" :key="link.to" :to="link.to" :class="{ 'shell-diagnosis-link': link.to === '/chan-doan' }" :aria-current="isClientRouteActive(route.path, link.to) ? 'page' : undefined" @click="emit('navigate')"><span><i v-if="link.to === '/chan-doan'" class="fa-solid fa-camera" aria-hidden="true"></i>{{ link.label }}</span><i class="fa-solid fa-arrow-right" aria-hidden="true"></i></router-link>
    </nav>
    <SageAccordion title="Danh mục sản phẩm">
      <p v-if="loading" role="status">Đang tải danh mục…</p>
      <div v-else-if="error" role="alert"><p>{{ error }}</p><SageButton variant="secondary" @click="loadCategories(true)">Thử lại</SageButton></div>
      <nav v-else aria-label="Danh mục mobile" class="shell-mobile-categories"><router-link v-for="category in categories" :key="category._id" :to="{ path: '/products', query: { category_id: category._id } }" @click="emit('navigate')">{{ category.name }}</router-link><router-link to="/products" @click="emit('navigate')">Tất cả sản phẩm</router-link></nav>
    </SageAccordion>
    <div class="shell-mobile-account"><router-link :to="loggedIn ? '/profile' : '/login'" @click="emit('navigate')"><i class="fa-regular fa-user" aria-hidden="true"></i> {{ loggedIn ? accountName : 'Đăng nhập' }}</router-link><router-link to="/wishlist" @click="emit('navigate')">Sản phẩm yêu thích</router-link><SageButton v-if="loggedIn" variant="ghost" @click="emit('logout')">Đăng xuất</SageButton></div>
  </SageDrawer>
</template>
