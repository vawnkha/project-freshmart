<script setup>
import { reactive, ref, onMounted } from "vue";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import { useRouter, useRoute } from "vue-router";
import { useAuthStore } from "@/stores/user/auth";
import { emailSchema, passwordSchema, z } from "@/validators/common.validator";
import { mapBackendValidationErrors } from "@/utils/validation-error.util";

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

const { errors, setErrors, setValues, validate } = useForm({
  validationSchema: loginSchema,
});

const loading = ref(false);
const errorMessage = ref("");
const successMessage = ref("");

onMounted(() => {
  if (route.query.status === "success") {
    successMessage.value = route.query.message || "Thao tác thành công";
  }

  if (route.query.status === "error") {
    errorMessage.value = route.query.message || "Có lỗi xảy ra";
  }
});

async function handleLogin() {
  errorMessage.value = "";
  successMessage.value = "";
  setValues({ ...loginForm });
  const result = await validate();
  if (!result.valid) return;

  try {
    loading.value = true;

    await authStore.login({
      email: loginForm.email,
      password: loginForm.password,
    });

    router.push("/");
  } catch (error) {
    setErrors(mapBackendValidationErrors(error));
    errorMessage.value = error?.response?.data?.message || "Đăng nhập thất bại";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div id="content" class="site-content">
    <div id="breadcrumb">
      <div class="container">
        <h2 class="title">Đăng Nhập</h2>

        <ul class="breadcrumb">
          <li><router-link to="/">Trang Chủ</router-link></li>
          <li><span>Đăng Nhập</span></li>
        </ul>
      </div>
    </div>

    <div class="container">
      <div class="login-page">
        <div class="login-form form">
          <div class="block-title">
            <h2 class="title"><span>Đăng Nhập</span></h2>
          </div>

          <form @submit.prevent="handleLogin">
            <div class="form-group">
              <label>Email</label>
              <input
                v-model="loginForm.email"
                type="email"
                name="email"
                :class="{ 'is-invalid': errors.email }"
              />
              <div v-if="errors.email" class="form-error">{{ errors.email }}</div>
            </div>

            <div class="form-group">
              <label>Mật Khẩu</label>
              <input
                v-model="loginForm.password"
                type="password"
                name="password"
                :class="{ 'is-invalid': errors.password }"
              />
              <div v-if="errors.password" class="form-error">{{ errors.password }}</div>
            </div>

            <div v-if="successMessage" class="alert alert-success">
              {{ successMessage }}
            </div>

            <div v-if="errorMessage" class="alert alert-danger">
              {{ errorMessage }}
            </div>

            <div class="form-group text-center">
              <div class="link">
                <router-link to="/forgot-password">Quên mật khẩu?</router-link>
                <router-link to="/register">Đăng Ký?</router-link>
              </div>
            </div>

            <div class="form-group text-center">
              <input
                type="submit"
                class="btn btn-primary"
                :value="loading ? 'Đang Đăng Nhập...' : 'Đăng Nhập'"
                :disabled="loading"
              />
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>
