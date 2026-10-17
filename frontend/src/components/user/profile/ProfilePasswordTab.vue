<script setup>
import PasswordField from "@/components/user/auth/PasswordField.vue";
defineProps({
  errors: { type: Object, default: () => ({}) },
  saving: Boolean,
  passwordForm: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(["change-password"]);
</script>
<template>
  <form class="profile-content-box" @submit.prevent="$emit('change-password')" novalidate>
    <h2 class="profile-section-title">Đổi mật khẩu</h2><p>Mật khẩu mới cần từ 8 đến 128 ký tự.</p>
    <fieldset :disabled="saving" class="approved-account-fieldset"><legend class="sr-only">Thay đổi mật khẩu</legend><div class="password-form-wrap">
      <div class="form-group">
        <label for="profilepasswordtab-field-1">Mật khẩu hiện tại:</label>
        <PasswordField
          id="profilepasswordtab-field-1" autocomplete="current-password"
          
          :model-value="passwordForm.currentPassword"
          @update:model-value="passwordForm.currentPassword = $event"
          class="form-control"
          :aria-invalid="!!errors.currentPassword"
          :aria-describedby="errors.currentPassword ? 'profilepasswordtab-field-1-error' : undefined"
        />
            <p id="profilepasswordtab-field-1-error" class="form-error form-error--field" role="alert">
              {{ errors.currentPassword }}
            </p>
      </div>
      <div class="form-group">
        <label for="profilepasswordtab-field-2">Mật khẩu mới:</label>
        <PasswordField
          id="profilepasswordtab-field-2" autocomplete="new-password"
          :model-value="passwordForm.newPassword"
          @update:model-value="passwordForm.newPassword = $event"
          
          class="form-control"
          :aria-invalid="!!errors.newPassword"
          :aria-describedby="errors.newPassword ? 'profilepasswordtab-field-2-error' : undefined"
        />
            <p id="profilepasswordtab-field-2-error" class="form-error form-error--field" role="alert">
              {{ errors.newPassword }}
            </p>
      </div>

      <div class="form-group">
        <label for="profilepasswordtab-field-3">Nhập lại mật khẩu mới:</label>
        <PasswordField
          id="profilepasswordtab-field-3" autocomplete="new-password"
          :model-value="passwordForm.confirmPassword"
          @update:model-value="passwordForm.confirmPassword = $event"
          
          class="form-control"
          :aria-invalid="!!errors.confirmPassword"
          :aria-describedby="errors.confirmPassword ? 'profilepasswordtab-field-3-error' : undefined"
        />
            <p id="profilepasswordtab-field-3-error" class="form-error form-error--field" role="alert">
              {{ errors.confirmPassword }}
            </p>
      </div>
    </div>
    </fieldset>
    <button type="submit" class="btn btn-primary" :disabled="saving" :aria-busy="saving">
      {{ saving ? "Đang lưu..." : "Lưu mật khẩu mới" }}
    </button>
  </form>
</template>
