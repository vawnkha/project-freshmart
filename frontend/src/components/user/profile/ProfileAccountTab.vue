<script setup>
import { notify } from "@/composables/useStorefrontNotice";
import { ref } from "vue";

defineProps({
  errors: { type: Object, default: () => ({}) },
  saving: Boolean,
  avatarSaving: Boolean,
  userProfile: {
    type: Object,
    required: true,
  },
  accountForm: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(["update-account", "update-avatar"]);
const fileInput = ref(null);

function triggerchooseAvatar() {
  fileInput.value?.click();
}
function handleAvatarChange(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    notify("Vui lòng chọn file ảnh hợp lệ");
    return;
  }

  emit("update-avatar", file);
}
</script>
<template>
  <form class="profile-content-box" @submit.prevent="$emit('update-account')" novalidate>
    <h2 class="profile-section-title">Thông tin cá nhân</h2>
    <div class="account-avatar-wrap">
      <img
        :src="userProfile.avatar || '/img/avatar.jpg'"
        @error="$event.target.src = '/img/avatar.jpg'"
        alt="Ảnh đại diện"
        class="account-avatar"
      />

      <div class="account-avatar-actions">
        <input
          ref="fileInput"
          type="file"
          accept="image/*"
          class="account-avatar-input"
          hidden
          @change="handleAvatarChange"
        />
        <button
          type="button"
          class="btn btn-primary"
          :disabled="avatarSaving"
          :aria-busy="avatarSaving"
          @click="triggerchooseAvatar"
        >
          {{ avatarSaving ? 'Đang tải ảnh...' : 'Đổi ảnh đại diện' }}
        </button>
      </div>
    </div>

    <fieldset :disabled="saving" class="approved-account-fieldset"><legend class="sr-only">Thông tin hồ sơ</legend>
    <div class="row account-fields">
      <div class="col-md-6">
        <label for="profileaccounttab-field-1">Họ và Tên</label>
        <input
          id="profileaccounttab-field-1"
          type="text" autocomplete="name" aria-required="true"
          :value="accountForm.name"
          @input="accountForm.name = $event.target.value"
          class="form-control"
          :aria-invalid="!!errors.name"
          :aria-describedby="errors.name ? 'profileaccounttab-field-1-error' : undefined"
        />
            <p id="profileaccounttab-field-1-error" class="form-error form-error--field" role="alert">
              {{ errors.name }}
            </p>
      </div>

      <div class="col-md-6">
        <label for="profileaccounttab-field-2">Số điện thoại</label>
        <input
          id="profileaccounttab-field-2"
          type="tel" autocomplete="tel"
          :value="accountForm.phone"
          @input="accountForm.phone = $event.target.value"
          class="form-control"
          :aria-invalid="!!errors.phone"
          :aria-describedby="errors.phone ? 'profileaccounttab-field-2-error' : undefined"
        />
            <p id="profileaccounttab-field-2-error" class="form-error form-error--field" role="alert">
              {{ errors.phone }}
            </p>
      </div>
    </div>
    <div class="row account-fields">
      <div class="col-md-6">
        <label for="profileaccounttab-field-3"
          >Email (không được thay đổi)</label
        >
        <input
          id="profileaccounttab-field-3"
          type="email"
          :value="accountForm.email"
          class="form-control"
          disabled
        />
      </div>
      <div class="col-md-6">
        <label for="profileaccounttab-field-4">Địa chỉ</label>
        <input
          id="profileaccounttab-field-4"
          type="text"
          :value="accountForm.address"
          @input="accountForm.address = $event.target.value"
          class="form-control"
          :aria-invalid="!!errors.address"
          :aria-describedby="errors.address ? 'profileaccounttab-field-4-error' : undefined"
        />
            <p id="profileaccounttab-field-4-error" class="form-error form-error--field" role="alert">
              {{ errors.address }}
            </p>
      </div>
    </div>
    </fieldset>
    <div class="account-form-actions">
      <button type="submit" class="btn btn-primary" :disabled="saving" :aria-busy="saving">
        {{ saving ? 'Đang lưu...' : 'Lưu thay đổi' }}
      </button>
    </div>
  </form>
</template>
