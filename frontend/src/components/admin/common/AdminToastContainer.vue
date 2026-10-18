<script setup>
import { computed } from "vue";
import { useRouter } from "vue-router";
import { useAdminNotificationStore } from "@/stores/admin/notification";

const router = useRouter();
const notificationStore = useAdminNotificationStore();

const toasts = computed(() => notificationStore.toastQueue);

function iconByType(type) {
  if (type === "order") return "fa-cart-shopping";
  if (type === "contact") return "fa-envelope";
  return "fa-bell";
}

function closeToast(id) {
  notificationStore.removeToast(id);
}

function handleToastClick(toast) {
  notificationStore.removeToast(toast.id);

  if (toast.type === "order" && toast.data?.order_id) {
    router.push(`/admin/orders/${toast.data.order_id}`);
    return;
  }

  if (toast.type === "contact") {
    router.push("/admin/contacts");
    return;
  }

  router.push("/admin/notifications");
}

function startAutoClose(id) {
  window.setTimeout(() => {
    notificationStore.removeToast(id);
  }, 5000);
}
</script>

<template>
  <div class="admin-toast-container">
    <transition-group name="admin-toast">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="admin-toast"
        :class="`admin-toast--${toast.type}`"
        @vue:mounted="startAutoClose(toast.id)"
      >
        <button class="admin-toast__close" @click="closeToast(toast.id)">
          ×
        </button>

        <div class="admin-toast__content" @click="handleToastClick(toast)">
          <div class="admin-toast__icon">
            <i :class="['fa-solid', iconByType(toast.type)]"></i>
          </div>

          <div class="admin-toast__body">
            <div class="admin-toast__title">{{ toast.title }}</div>
            <div class="admin-toast__text">{{ toast.content }}</div>
          </div>
        </div>
      </div>
    </transition-group>
  </div>
</template>

<style scoped>
.admin-toast-container {
  position: fixed;
  top: 78px;
  right: 18px;
  z-index: 5000;
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: min(360px, calc(100vw - 24px));
  pointer-events: none;
}

.admin-toast {
  position: relative;
  background: #fff;
  border: 1px solid #dfe6ee;
  border-radius: 12px;
  box-shadow: 0 12px 30px rgba(34, 58, 87, 0.14);
  overflow: hidden;
  pointer-events: auto;
}

.admin-toast::before {
  content: "";
  position: absolute;
  inset: 0 auto 0 0;
  width: 4px;
}

.admin-toast--order::before {
  background: #0d6efd;
}

.admin-toast--contact::before {
  background: #19b7a5;
}

.admin-toast--system::before {
  background: #6c757d;
}

.admin-toast__content {
  display: flex;
  gap: 12px;
  padding: 14px 16px;
  cursor: pointer;
}

.admin-toast__icon {
  font-size: 24px;
  line-height: 1;
  flex-shrink: 0;
}

.admin-toast__body {
  min-width: 0;
  flex: 1;
}

.admin-toast__title {
  font-size: 15px;
  font-weight: 700;
  color: #5f738b;
  margin-bottom: 4px;
}

.admin-toast__text {
  font-size: 13px;
  color: #7d90a6;
  line-height: 1.5;
  word-break: break-word;
}

.admin-toast__close {
  position: absolute;
  top: 8px;
  right: 10px;
  border: 0;
  background: transparent;
  color: #91a2b3;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  z-index: 1;
}

.admin-toast-enter-active,
.admin-toast-leave-active {
  transition: all 0.25s ease;
}

.admin-toast-enter-from,
.admin-toast-leave-to {
  opacity: 0;
  transform: translateX(24px) translateY(-8px);
}

@media (max-width: 768px) {
  .admin-toast-container {
    top: 70px;
    right: 12px;
    left: 12px;
    width: auto;
  }
}
</style>
