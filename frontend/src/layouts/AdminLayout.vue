<script setup>
import "@/assets/css/admin/admin.css";

import { computed, onBeforeUnmount, watch } from "vue";
import { useRoute } from "vue-router";
import AdminSidebar from "@/components/admin/layout/AdminSidebar.vue";
import AdminTopbar from "@/components/admin/layout/AdminTopbar.vue";
import AdminToastContainer from "@/components/admin/common/AdminToastContainer.vue";
import { useAdminNotificationStore } from "@/stores/admin/notification";
import { useAuthStore } from "@/stores/user/auth";
import { hasAllPermissions } from "@/utils/permission.util";

const route = useRoute();
const isLoginPage = computed(() => route.name === "admin-login");

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
      <div class="admin-shell">
        <AdminSidebar />
        <div class="admin-content">
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
