<script setup>
import { reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import authService from "@/services/auth.service";

const route = useRoute();
const router = useRouter();

const loading = ref(false);
const errorMessage = ref("");
const successMessage = ref("");

const resetForm = reactive({
  newPassword: "",
  confirmPassword: "",
});

async function handleResetPassword() {
  errorMessage.value = "";
  successMessage.value = "";

  if (!resetForm.newPassword.trim() || !resetForm.confirmPassword.trim()) {
    errorMessage.value = "Vui lòng nhập đầy đủ thông tin";
    return;
  }

  if (resetForm.newPassword !== resetForm.confirmPassword) {
    errorMessage.value = "Mật khẩu xác nhận không khớp";
    return;
  }

  try {
    loading.value = true;

    const { userId, token } = route.params;

    const res = await authService.resetPassword(
      userId,
      token,
      resetForm.newPassword,
    );

    successMessage.value = res.message || "Đặt lại mật khẩu thành công";

    setTimeout(() => {
      router.push({
        path: "/login",
        query: {
          status: "success",
          message: "Đặt lại mật khẩu thành công. Vui lòng đăng nhập.",
        },
      });
    }, 5000);
  } catch (error) {
    errorMessage.value =
      error?.response?.data?.message ||
      "Không thể đặt lại mật khẩu. Liên kết có thể đã hết hạn.";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div id="content" class="site-content">
    <div id="breadcrumb">
      <div class="container">
        <h2 class="title">Đặt Lại Mật Khẩu</h2>

        <ul class="breadcrumb">
          <li><router-link to="/">Trang Chủ</router-link></li>
          <li><span>Đặt Lại Mật Khẩu</span></li>
        </ul>
      </div>
    </div>

    <div class="container">
      <div class="login-page">
        <div class="login-form form">
          <div class="block-title">
            <h2 class="title"><span>Đặt Lại Mật Khẩu</span></h2>
          </div>

          <form @submit.prevent="handleResetPassword">
            <div class="form-group">
              <label>Mật khẩu mới</label>
              <input
                v-model="resetForm.newPassword"
                type="password"
                placeholder="Nhập mật khẩu mới"
              />
            </div>

            <div class="form-group">
              <label>Xác nhận mật khẩu</label>
              <input
                v-model="resetForm.confirmPassword"
                type="password"
                placeholder="Nhập mật khẩu mới"
              />
            </div>

            <div v-if="errorMessage" class="alert alert-danger">
              {{ errorMessage }}
            </div>

            <div v-if="successMessage" class="alert alert-success">
              {{ successMessage }}
            </div>

            <div class="form-group text-center">
              <input
                type="submit"
                class="btn btn-primary"
                :value="loading ? 'Đang xử lý' : 'Đặt Lại Mật Khẩu'"
                :disabled="loading"
              />
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>
<style>
#breadcrumb {
  background: url("/img/bg-breadcrumb.jpg") no-repeat scroll 0 0 !important;
}
</style>
