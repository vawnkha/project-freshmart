<script setup>
import { reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/user/auth";
import { decodeJwtPayload, hasJwtPermission } from "@/utils/jwt.util";

const router = useRouter();
const authStore = useAuthStore();

const loading = ref(false);
const errorMessage = ref("");

const form = reactive({
  email: "",
  password: "",
});

async function handleLogin() {
  errorMessage.value = "";
  loading.value = true;

  try {
    const res = await authStore.login(form);

    const token = res.accessToken;
    const decoded = decodeJwtPayload(token);

    if (!hasJwtPermission(decoded, "admin:access")) {
      authStore.logout();
      errorMessage.value = "Tài khoản không có quyền admin";
      return;
    }

    router.push({ name: "admin-dashboard" });
  } catch (error) {
    errorMessage.value = error?.response?.data?.message || "Đăng nhập thất bại";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="admin-login-page">
    <form @submit.prevent="handleLogin" class="admin-login-form">
      <h2 class="admin-login-title">Đăng nhập</h2>

      <input
        v-model="form.email"
        type="email"
        class="admin-login-input form-control"
        placeholder="Email"
      />

      <input
        v-model="form.password"
        type="password"
        class="admin-login-input form-control"
        placeholder="Mật khẩu"
      />

      <button
        type="submit"
        class="admin-login-btn text-decoration-none"
        :disabled="loading"
      >
        {{ loading ? "Đang đăng nhập..." : "Đăng nhập" }}
      </button>

      <div v-if="errorMessage" class="admin-login-error">
        {{ errorMessage }}
      </div>

      <hr class="admin-login-divider" />

      <div class="admin-login-brand">FRESH MART!</div>
      <div class="admin-login-copy">
        ©2026 All Rights Reserved. Privacy and Terms
      </div>
    </form>
  </div>
</template>
