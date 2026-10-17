<script setup>
import { userError } from "@/utils/user-error.util";
import { useAuthRequestContext } from "@/components/user/auth/useAuthRequestContext";
import AuthPanel from "@/components/user/common/AuthPanel.vue";
import { ref, watch, onBeforeUnmount } from "vue";
import authService from "@/services/auth.service";
import { emailSchema } from "@/validators/common.validator";

const email = ref("");
let disposed=false;
onBeforeUnmount(()=>{disposed=true;});
const requestContext=useAuthRequestContext();
const loading = ref(false);
const errorMessage = ref("");
const successMessage = ref("");

watch(email, () => {
  errorMessage.value = "";
});

watch(requestContext.key,()=>{loading.value=false;errorMessage.value="";successMessage.value="";},{flush:"sync"});

async function handleForgotPassword() {
  if (disposed || loading.value) return;
  errorMessage.value = "";
  successMessage.value = "";

  const parsed = emailSchema.safeParse(email.value);
  if (!parsed.success) {
    errorMessage.value =
      parsed.error.issues[0]?.message || "Email không hợp lệ";
    return;
  }

  const context=requestContext.capture();
  try {
    loading.value = true;

    const res = await authService.forgotPassword(parsed.data);

    if (disposed || !requestContext.current(context)) return;
    successMessage.value =
      res.message || "vui lòng kiểm tra email để đặt lại mật khẩu.";
  } catch (error) {
    if (disposed || !requestContext.current(context)) return;
    errorMessage.value =
      userError(error, "Gửi yêu cầu thất bại");
  } finally {
    if (!disposed && requestContext.current(context)) loading.value = false;
  }
}
</script>

<template>
  <AuthPanel
    title="Quên mật khẩu"
    description="Nhập email đã đăng ký để nhận liên kết đặt lại mật khẩu."
    ><form @submit.prevent="handleForgotPassword" novalidate>
      <div class="form-group">
        <label for="forgot-email">Email</label
        ><input
          id="forgot-email"
          v-model="email" :disabled="loading"
          type="email" aria-required="true"
          autocomplete="email"
          :aria-invalid="!!errorMessage && !emailSchema.safeParse(email).success"
          aria-describedby="forgot-error"
        />
        <div
          id="forgot-error"
          class="form-error form-error--field"
          role="alert"
        >
          {{ errorMessage }}
        </div>
      </div>
      <div v-if="successMessage" class="alert alert-success" role="status">
        {{ successMessage }}
      </div>
      <button
        type="submit"
        class="btn btn-primary btn-block"
        :disabled="loading"
        :aria-busy="loading"
      >
        {{ loading ? "Đang gửi..." : "Gửi liên kết khôi phục" }}
      </button>
      <div class="link">
        <router-link to="/login">Quay lại đăng nhập</router-link>
      </div>
    </form></AuthPanel
  >
</template>
