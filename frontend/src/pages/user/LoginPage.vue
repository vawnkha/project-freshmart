<script setup>
import { userError, userFieldErrors, userMessage } from "@/utils/user-error.util";
import PasswordField from "@/components/user/auth/PasswordField.vue";
import { useAuthRequestContext } from "@/components/user/auth/useAuthRequestContext";
import AuthPanel from "@/components/user/common/AuthPanel.vue";
import { reactive, ref, onMounted, onBeforeUnmount } from "vue";
import { useSchemaForm } from "@/composables/useSchemaForm";
import { toTypedSchema } from "@vee-validate/zod";
import { useRouter, useRoute } from "vue-router";
import { useAuthStore, captureLoginRequestContext, isAuthRequestInvalidated } from "@/stores/user/auth";
import { emailSchema, passwordSchema, z } from "@/validators/common.validator";

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

const loginForm = reactive({
  email: "",
  password: "",
});

const loginSchema = toTypedSchema(
  z.object({
    email: emailSchema,
    password: passwordSchema,
  }),
);

const { errors, setErrors, setValues, validate } = useSchemaForm({
  validationSchema: loginSchema,
  values: () => ({ ...loginForm }),
});

let disposed=false;
onBeforeUnmount(()=>{disposed=true;loginForm.password="";});
const requestContext=useAuthRequestContext();
const loading = ref(false);
const errorMessage = ref("");
const successMessage = ref("");

onMounted(() => {
  if (route.query.status === "success") {
    successMessage.value = userMessage(route.query.message, { fallback: "Thao tác thành công" });
  }

  if (route.query.status === "error") {
    errorMessage.value = userMessage(route.query.message, { fallback: "Có lỗi xảy ra" });
  }
});

async function handleLogin() {
  if (disposed || loading.value) return;
  errorMessage.value = "";
  successMessage.value = "";
  loading.value = true;
  const credentials={...loginForm};
  const context=requestContext.capture();
  let loginRequest;
  try {
    setValues(credentials);
    const result=await validate();
    if (!result.valid || disposed || !requestContext.current(context)) return;

    const pending = authStore.login(credentials);
    loginRequest = captureLoginRequestContext(authStore);
    await pending;
    if (disposed || !loginRequest.isCurrent()) return;

    router.push("/");
  } catch (error) {
    if (disposed || isAuthRequestInvalidated(error) || (loginRequest && !loginRequest.isCurrent(false))) return;
    setErrors(userFieldErrors(error));
    errorMessage.value = userError(error, "Đăng nhập thất bại");
  } finally {
    if (!disposed) loading.value = false;
  }
}
</script>

<template>
  <AuthPanel
    title="Đăng nhập"
    description="Đăng nhập để quản lý đơn hàng và sản phẩm yêu thích."
    ><form @submit.prevent="handleLogin" novalidate>
      <div class="form-group">
        <label for="login-email">Email</label
        ><input
          id="login-email"
          v-model="loginForm.email" :disabled="loading"
          type="email" aria-required="true"
          autocomplete="email"
          :class="{ 'is-invalid': errors.email }"
          :aria-invalid="!!errors.email"
          aria-describedby="login-email-error"
        />
        <div id="login-email-error" class="form-error form-error--field" aria-live="polite">
          {{ errors.email }}
        </div>
      </div>
      <div class="form-group">
        <label for="login-password">Mật khẩu</label
        ><PasswordField
          id="login-password"
          v-model="loginForm.password" :disabled="loading"
          
          autocomplete="current-password" aria-required="true"
          :class="{ 'is-invalid': errors.password }"
          :aria-invalid="!!errors.password"
          aria-describedby="login-password-error"
        />
        <div
          id="login-password-error"
          class="form-error form-error--field"
          aria-live="polite"
        >
          {{ errors.password }}
        </div>
      </div>
      <div v-if="successMessage" class="alert alert-success" role="status">
        {{ successMessage }}
      </div>
      <div v-if="errorMessage" class="alert alert-danger" role="alert">
        {{ errorMessage }}
      </div>
      <button
        type="submit"
        class="btn btn-primary btn-block"
        :disabled="loading"
        :aria-busy="loading"
      >
        {{ loading ? "Đang đăng nhập..." : "Đăng nhập" }}
      </button>
      <div class="link">
        <router-link to="/forgot-password">Quên mật khẩu?</router-link
        ><router-link to="/register">Tạo tài khoản mới</router-link>
      </div>
    </form></AuthPanel
  >
</template>
