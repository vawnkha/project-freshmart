<script setup>
import { userError, userFieldErrors, userMessage } from "@/utils/user-error.util";
import PasswordField from "@/components/user/auth/PasswordField.vue";
import { useAuthRequestContext } from "@/components/user/auth/useAuthRequestContext";
import AuthPanel from "@/components/user/common/AuthPanel.vue";
import { reactive, ref, watch, onBeforeUnmount } from "vue";
import { useRouter } from "vue-router";
import userService from "@/services/user.service";
import { emailSchema, requiredString, z } from "@/validators/common.validator";

const router = useRouter();

const registerForm = reactive({
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
});

const fieldErrors = ref({});
const submitted = ref(false);
let redirectTimer;
let disposed=false;
onBeforeUnmount(() => { disposed=true;clearTimeout(redirectTimer);registerForm.password="";registerForm.confirmPassword=""; });
const requestContext=useAuthRequestContext();
const loading = ref(false);
const errorMessage = ref("");
const successMessage = ref("");

const registerSchema = z
  .object({
    name: requiredString("Tên là bắt buộc").pipe(
      z.string().max(120, "Tên tối đa 120 ký tự"),
    ),
    email: emailSchema,
    password: z
      .string()
      .min(8, "Mật khẩu cần ít nhất 8 ký tự")
      .max(128, "Mật khẩu tối đa 128 ký tự"),
    confirmPassword: z.string().min(1, "Vui lòng xác nhận mật khẩu"),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Mật khẩu xác nhận không khớp",
  });

watch(registerForm, () => {
  errorMessage.value = "";
  if (submitted.value) validateFields();
});
function validateFields() {
  const result = registerSchema.safeParse({ ...registerForm });
  fieldErrors.value = {};
  if (!result.success)
    for (const issue of result.error.issues) {
      const key = issue.path[0];
      if (!fieldErrors.value[key]) fieldErrors.value[key] = issue.message;
    }
  return result;
}

watch(requestContext.key,()=>{loading.value=false;errorMessage.value="";successMessage.value="";clearTimeout(redirectTimer);submitted.value=false;fieldErrors.value={};registerForm.password="";registerForm.confirmPassword="";},{flush:"sync"});

async function handleRegister() {
  if (disposed || loading.value) return;
  errorMessage.value = "";
  successMessage.value = "";

  submitted.value = true;
  const parsed = validateFields();
  if (!parsed.success) {
    return;
  }
  const context=requestContext.capture();
  try {
    loading.value = true;

    const res = await userService.register({
      name: parsed.data.name,
      email: parsed.data.email,
      password: parsed.data.password,
    });

    if (disposed || !requestContext.current(context)) return;
    submitted.value=false;fieldErrors.value={};registerForm.password="";registerForm.confirmPassword="";
    successMessage.value =
      userMessage(res.message, { fallback: "Đăng ký thành công. Vui lòng kiểm tra email để kích hoạt." });
    redirectTimer = setTimeout(() => {
      router.push("/login");
    }, 5000);
  } catch (error) {
    if (disposed || !requestContext.current(context)) return;
    fieldErrors.value = userFieldErrors(error);
    errorMessage.value = userError(error, "Đăng ký thất bại");
  } finally {
    if (!disposed && requestContext.current(context)) loading.value = false;
  }
}
</script>

<template>
  <AuthPanel
    title="Tạo tài khoản"
    description="Bắt đầu mua sắm và theo dõi đơn hàng tại FreshMart."
    ><form @submit.prevent="handleRegister" novalidate>
      <div
        v-for="field in [
          { key: 'name', label: 'Họ và tên', type: 'text', auto: 'name' },
          { key: 'email', label: 'Email', type: 'email', auto: 'email' },
          {
            key: 'password',
            label: 'Mật khẩu',
            type: 'password',
            auto: 'new-password',
          },
          {
            key: 'confirmPassword',
            label: 'Xác nhận mật khẩu',
            type: 'password',
            auto: 'new-password',
          },
        ]"
        :key="field.key"
        class="form-group"
      >
        <label :for="'register-' + field.key">{{ field.label }}</label
        ><PasswordField v-if="field.type === 'password'" :id="'register-' + field.key" aria-required="true" v-model="registerForm[field.key]" :disabled="loading" :autocomplete="field.auto" :aria-invalid="!!fieldErrors[field.key]" :aria-describedby="'register-error-' + field.key" /><input v-else
          :id="'register-' + field.key" aria-required="true"
          v-model="registerForm[field.key]" :disabled="loading"
          :type="field.type"
          :autocomplete="field.auto"
          :class="{ 'is-invalid': fieldErrors[field.key] }"
          :aria-invalid="!!fieldErrors[field.key]"
          :aria-describedby="'register-error-' + field.key"
        />
        <div
          :id="'register-error-' + field.key"
          class="form-error form-error--field"
          :class="{ 'form-hint': !fieldErrors[field.key] }"
          aria-live="polite"
        >
          {{ fieldErrors[field.key] || (field.key === 'password' ? 'Sử dụng từ 8 đến 128 ký tự.' : '') }}
        </div>
      </div>
      <div v-if="errorMessage" class="alert alert-danger" role="alert">
        {{ errorMessage }}
      </div>
      <div v-if="successMessage" class="alert alert-success" role="status">
        {{ successMessage }}
      </div>
      <button
        class="btn btn-primary btn-block"
        type="submit"
        :disabled="loading"
        :aria-busy="loading"
      >
        {{ loading ? "Đang xử lý..." : "Đăng ký" }}
      </button>
      <div class="link">
        <span>Đã có tài khoản?</span
        ><router-link to="/login">Đăng nhập</router-link>
      </div>
    </form></AuthPanel
  >
</template>
