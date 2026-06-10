<script setup>
import { reactive, ref } from "vue";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/user/auth";
import { decodeJwtPayload, hasJwtPermission } from "@/utils/jwt.util";
import { emailSchema, passwordSchema, z } from "@/validators/common.validator";
import { mapBackendValidationErrors } from "@/utils/validation-error.util";

const router = useRouter();
const authStore = useAuthStore();

const loading = ref(false);
const errorMessage = ref("");

const form = reactive({
  email: "",
  password: "",
});

const loginSchema = toTypedSchema(
  z.object({
    email: emailSchema,
    password: passwordSchema,
  }),
);

const { errors, setErrors, setValues, validate } = useForm({
  validationSchema: loginSchema,
});

async function handleLogin() {
  errorMessage.value = "";
  setValues({ ...form });
  const result = await validate();
  if (!result.valid) return;

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
    setErrors(mapBackendValidationErrors(error));
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
        :class="{ 'is-invalid': errors.email }"
        placeholder="Email"
      />
      <div v-if="errors.email" class="form-error">{{ errors.email }}</div>

      <input
        v-model="form.password"
        type="password"
        class="admin-login-input form-control"
        :class="{ 'is-invalid': errors.password }"
        placeholder="Mật khẩu"
      />
      <div v-if="errors.password" class="form-error">{{ errors.password }}</div>

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
