<script setup>
defineProps({
  saving: Boolean,
  addresses: {
    type: Array,
    required: true,
  },
});

const emit = defineEmits([
  "open-address-modal",
  "remove-address",
  "set-default-address",
]);
</script>
<template>
  <div class="profile-content-box">
    <h2 class="profile-section-title">Địa chỉ nhận hàng</h2>
    <div class="address-note">
      Các địa chỉ sau sẽ được sử dụng trên trang thanh toán theo mặc định.
    </div>

    <p v-if="!addresses.length" class="address-note">
      Chưa có địa chỉ. Thêm địa chỉ nhận hàng để sử dụng khi thanh toán.
    </p>
    <div v-else class="approved-address-grid" :aria-busy="saving">
      <article v-for="item in addresses" :key="item.id" class="approved-address-card">
        <h3>{{ item.full_name }}</h3>
        <span v-if="item.isDefault" class="default-badge">Mặc định</span>
        <p>{{ item.phone }}</p>
        <p>{{ item.address }}, {{ item.city }}</p>
        <div class="approved-account-actions">
          <button class="btn" :disabled="saving" @click="$emit('open-address-modal', item)">Sửa</button>
          <button class="btn" :disabled="saving" @click="$emit('remove-address', item.id)">Xóa</button>
          <button v-if="!item.isDefault" class="btn" :disabled="saving" @click="$emit('set-default-address', item.id)">Đặt mặc định</button>
        </div>
      </article>
    </div>
    <p v-if="saving" role="status">Đang cập nhật địa chỉ...</p>
    <button class="btn btn-primary" :disabled="saving" @click="$emit('open-address-modal')">
      Thêm địa chỉ mới
    </button>
  </div>
</template>
