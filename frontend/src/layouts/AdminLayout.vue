<script setup>
import "@/assets/css/admin/admin.css";

import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { useRoute } from "vue-router";
import AdminSidebar from "@/components/admin/layout/AdminSidebar.vue";
import AdminTopbar from "@/components/admin/layout/AdminTopbar.vue";
import AdminToastContainer from "@/components/admin/common/AdminToastContainer.vue";
import { useAdminNotificationStore } from "@/stores/admin/notification";
import { useAuthStore } from "@/stores/user/auth";
import { hasAllPermissions } from "@/utils/permission.util";

const route = useRoute();
const isLoginPage = computed(() => route.name === "admin-login");
const expiryPages = ["admin-inventory-expiry", "admin-inventory-expiry-detail", "admin-promotion-proposals"];
const isExpiryPage = computed(() => expiryPages.includes(route.name));
const mobileNavigation = ref(false);
async function toggleExpiryNavigation() {
  mobileNavigation.value = !mobileNavigation.value;
  await nextTick();
  if (mobileNavigation.value) document.querySelector(".admin-sidebar a, .admin-sidebar button")?.focus();
}
watch(() => route.fullPath, () => { mobileNavigation.value = false; });

const notificationStore = useAdminNotificationStore();
const authStore = useAuthStore();
const canSubscribe = computed(() => !isLoginPage.value && authStore.isLoggedIn &&
  !!authStore.accessToken && !!authStore.userId &&
  String(authStore.user?._id || "") === String(authStore.userId) &&
  hasAllPermissions(authStore, ["admin:access", "notification:manage"]));

watch(
  [() => canSubscribe.value ? authStore.userId : null,
    () => canSubscribe.value ? authStore.accessToken : null],
  ([owner]) => {
    notificationStore.resetSession();
    if (owner) notificationStore.loadInitialData().catch(() => {
      // REST failures remain failures; allow a later initialization to retry.
    });
  },
  { immediate: true, flush: "sync" },
);
onBeforeUnmount(() => notificationStore.resetSession());
</script>

<template>
  <div class="admin-layout">
    <template v-if="isLoginPage">
      <router-view />
    </template>

    <template v-else>
      <div class="admin-shell" :class="{ 'admin-shell--expiry': isExpiryPage, 'admin-shell--menu-open': isExpiryPage && mobileNavigation }" @keydown.esc="mobileNavigation=false">
        <AdminSidebar />
        <button v-if="isExpiryPage && mobileNavigation" class="expiry-navigation-backdrop" aria-label="Đóng điều hướng" @click="mobileNavigation=false"></button>
        <div class="admin-content">
          <button v-if="isExpiryPage" class="expiry-navigation-toggle admin-btn admin-btn--secondary" :aria-expanded="mobileNavigation" @click="toggleExpiryNavigation">{{ mobileNavigation ? 'Đóng điều hướng' : 'Mở điều hướng quản trị' }}</button>
          <AdminTopbar />
          <AdminToastContainer />
          <main class="admin-page">
            <router-view />
          </main>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.expiry-navigation-toggle,.expiry-navigation-backdrop{display:none}
@media(max-width:767px){
  .admin-shell--expiry .admin-content{margin-left:0;width:100%;min-width:0}
  .admin-shell--expiry :deep(.admin-sidebar){visibility:hidden;transform:translateX(-100%);width:min(280px,85vw)}
  .admin-shell--menu-open :deep(.admin-sidebar){visibility:visible;transform:none;z-index:1100}
  .expiry-navigation-toggle{display:block;margin:10px 18px}
  .expiry-navigation-backdrop{display:block;position:fixed;inset:0;background:#0008;border:0;z-index:1050}
  .admin-shell--expiry main.admin-page{padding:12px}
}
</style>
