<script setup>
import { onMounted, ref } from 'vue';
import brandService from '@/services/brand.service';
import manufacturerService from '@/services/manufacturer.service';
import { useAuthStore } from '@/stores/user/auth';
import { hasPermission } from '@/utils/permission.util';

defineProps({ modelValue: { type: Object, required: true } });
const brands = ref([]), manufacturers = ref([]);
const auth = useAuthStore();
const optionError = ref('');
onMounted(async () => {
  const tasks = [
    ['brand:manage', brandService, brands],
    ['manufacturer:manage', manufacturerService, manufacturers],
  ];
  await Promise.all(tasks.map(async ([permission, service, target]) => {
    if (!hasPermission(auth, permission)) return;
    try {
      const response = await service.getAll();
      target.value = response?.data || response || [];
    } catch { optionError.value = 'Không thể tải thương hiệu hoặc nhà sản xuất. Vui lòng tải lại trang để thử lại.'; }
  }));
});
</script>

<template>
  <p v-if="optionError" role="alert" class="admin-form__error">{{ optionError }}</p>
  <div class="admin-form__row">
    <label class="admin-form__label">Mã sản phẩm</label>
    <input v-model="modelValue.productCode" class="admin-form__control" maxlength="100" placeholder="Tự sinh nếu để trống khi tạo mới" />
  </div>
  <div class="admin-form__row">
    <label class="admin-form__label">Slug</label>
    <input v-model="modelValue.slug" class="admin-form__control" placeholder="Tự sinh từ tên sản phẩm" />
  </div>
  <div class="admin-form__row">
    <label class="admin-form__label">Thương hiệu</label>
    <select v-model="modelValue.brandId" class="admin-form__select">
      <option value="">Chưa thiết lập</option>
      <option v-for="item in brands" :key="item._id" :value="item._id">{{ item.name }}</option>
    </select>
  </div>
  <div class="admin-form__row">
    <label class="admin-form__label">Nhà sản xuất</label>
    <select v-model="modelValue.manufacturerId" class="admin-form__select">
      <option value="">Chưa thiết lập</option>
      <option v-for="item in manufacturers" :key="item._id" :value="item._id">{{ item.name }}</option>
    </select>
  </div>
  <div class="admin-form__row">
    <label class="admin-form__label">Ghi chú quản trị</label>
    <textarea v-model="modelValue.note" class="admin-form__textarea" rows="2"></textarea>
  </div>
  <div class="admin-form__row">
    <label class="admin-form__label">Mô tả ngắn</label>
    <textarea v-model="modelValue.shortDescription" class="admin-form__textarea" rows="3"></textarea>
  </div>
</template>
