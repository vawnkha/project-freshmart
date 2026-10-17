<script setup>
import { userError, userFieldErrors } from "@/utils/user-error.util";
import PasswordField from "@/components/user/auth/PasswordField.vue";
import { useAuthRequestContext } from "@/components/user/auth/useAuthRequestContext";
import AuthPanel from "@/components/user/common/AuthPanel.vue";
import { reactive, ref, watch, onBeforeUnmount } from "vue";
import { useRoute, useRouter } from "vue-router";
import authService from "@/services/auth.service";
import { resetPasswordSchema } from "@/validators/storefront-form.validator";

const route = useRoute();
const router = useRouter();

const requestContext=useAuthRequestContext();
const loading = ref(false);
const errorMessage = ref("");
const successMessage = ref("");
const errors = ref({});
const submitted = ref(false);
let redirectTimer;
let disposed=false;
let requestVersion=0;
onBeforeUnmount(() => { disposed=true;clearTimeout(redirectTimer);resetForm.newPassword="";resetForm.confirmPassword=""; });

const resetForm = reactive({
  newPassword: "",
  confirmPassword: "",
});

watch(resetForm, () => {
  errorMessage.value = "";
  if (submitted.value) validateFields();
});
function validateFields() {
  const parsed = resetPasswordSchema.safeParse(resetForm);
  errors.value = parsed.success ? {} : userFieldErrors(parsed.error);
  return parsed.success;
}

watch(()=>[route.params.userId,route.params.token],()=>{++requestVersion;submitted.value=false;clearTimeout(redirectTimer);loading.value=false;successMessage.value="";errorMessage.value="";errors.value={};resetForm.newPassword="";resetForm.confirmPassword="";},{flush:"sync"});

watch(requestContext.key,()=>{loading.value=false;errorMessage.value="";successMessage.value="";++requestVersion;clearTimeout(redirectTimer);submitted.value=false;errors.value={};resetForm.newPassword="";resetForm.confirmPassword="";},{flush:"sync"});

async function handleResetPassword() {
  if (disposed || loading.value || successMessage.value) return;
  errorMessage.value = "";
  successMessage.value = "";

  submitted.value = true;
  if (!validateFields()) return;

  const context=requestContext.capture();
  const version=++requestVersion;
  try {
    loading.value = true;

    const { userId, token } = route.params;

    const res = await authService.resetPassword(
      userId,
      token,
      resetForm.newPassword,
    );

    if (disposed || version !== requestVersion || !requestContext.current(context)) return;
    submitted.value=false;errors.value={};resetForm.newPassword="";resetForm.confirmPassword="";
    successMessage.value = res.message || "Đặt lại mật khẩu thành công";

    redirectTimer = setTimeout(() => {
      router.push({
        path: "/login",
        query: {
          status: "success",
          message: "Đặt lại mật khẩu thành công. Vui lòng đăng nhập.",
        },
      });
    }, 5000);
  } catch (error) {
    if (disposed || version !== requestVersion || !requestContext.current(context)) return;
    errors.value = { ...errors.value, ...userFieldErrors(error) };
    errorMessage.value =
      userError(error, "Không thể đặt lại mật khẩu. Liên kết có thể đã hết hạn.");
  } finally {
    if (!disposed && version === requestVersion && requestContext.current(context)) loading.value = false;
  }
}
</script>

<template>
  <AuthPanel
    title="Đặt lại mật khẩu"
    description="Tạo mật khẩu mới để tiếp tục sử dụng tài khoản."
    ><form @submit.prevent="handleResetPassword" novalidate>
      <div class="form-group">
        <label for="reset-password">Mật khẩu mới</label
        ><PasswordField
          id="reset-password"
          v-model="resetForm.newPassword" :disabled="loading"
          
          autocomplete="new-password" aria-required="true"
          :aria-invalid="!!errors.newPassword"
          aria-describedby="reset-password-error"
        />
        <p id="reset-password-error" class="form-error form-error--field" aria-live="polite">{{ errors.newPassword }}</p>
      </div>
      <div class="form-group">
        <label for="reset-confirm">Xác nhận mật khẩu</label
        ><PasswordField
          id="reset-confirm"
          v-model="resetForm.confirmPassword" :disabled="loading"
          
          autocomplete="new-password" aria-required="true"
          :aria-invalid="!!errors.confirmPassword"
          aria-describedby="reset-confirm-error"
        />
        <p id="reset-confirm-error" class="form-error form-error--field" aria-live="polite">{{ errors.confirmPassword }}</p>
      </div>
      <div v-if="errorMessage" class="alert alert-danger" role="alert">
        {{ errorMessage }}
      </div>
      <div v-if="successMessage" class="alert alert-success" role="status">
        {{ successMessage }}
      </div>
      <button
        type="submit"
        class="btn btn-primary btn-block"
        :disabled="loading || !!successMessage"
      >
        {{ loading ? "Đang xử lý..." : "Lưu mật khẩu mới" }}
      </button>
      <div class="link">
        <router-link to="/login">Quay lại đăng nhập</router-link>
      </div>
    </form></AuthPanel
  >
</template>
