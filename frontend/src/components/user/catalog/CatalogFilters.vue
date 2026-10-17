<script setup>
import { normalizeId } from '@/utils/id.util';
import SageInput from '@/components/user/sage/SageInput.vue';
import SageSelect from '@/components/user/sage/SageSelect.vue';
import SageButton from '@/components/user/sage/SageButton.vue';
defineProps({ modelValue: Object, categories: Array, prefix: String, errors: Object, categoryLoading: Boolean, categoryError: String, showActions: { type: Boolean, default: true } });
const emit = defineEmits(['update:modelValue', 'apply', 'reset', 'retry']);
function update(model, key, value) { emit('update:modelValue', { ...model, [key]: value }); }
</script>
<template>
  <form :id="prefix + '-form'" class="catalog-filter-form" novalidate aria-label="Bộ lọc sản phẩm" @submit.prevent="emit('apply')">
    <SageSelect :id="prefix + '-category'" label="Danh mục" :model-value="modelValue.category_id" :error="errors.category_id" :loading="categoryLoading" @update:model-value="update(modelValue, 'category_id', $event)">
      <option value="">Tất cả danh mục</option><option v-for="category in categories" :key="normalizeId(category._id || category.id)" :value="normalizeId(category._id || category.id)">{{ category.name }}</option>
    </SageSelect>
    <p v-if="categoryError" class="catalog-category-error" role="status">{{ categoryError }} <SageButton variant="ghost" :loading="categoryLoading" @click="emit('retry')">Thử lại danh mục</SageButton></p>
    <fieldset class="catalog-price-filter"><legend>Khoảng giá (đ)</legend>
      <SageInput :id="prefix + '-min'" label="Giá từ" type="number" min="0" step="0.01" inputmode="decimal" placeholder="Không giới hạn" :model-value="modelValue.min_price" :error="errors.min_price" @update:model-value="update(modelValue, 'min_price', $event)" />
      <SageInput :id="prefix + '-max'" label="Giá đến" type="number" min="0" step="0.01" inputmode="decimal" placeholder="Không giới hạn" :model-value="modelValue.max_price" :error="errors.max_price" @update:model-value="update(modelValue, 'max_price', $event)" />
    </fieldset>
    <SageSelect :id="prefix + '-availability'" label="Tình trạng mua hàng" :model-value="modelValue.availability" :options="[{value:'',label:'Tất cả'}, {value:'available',label:'Còn hàng'}, {value:'unavailable',label:'Hết hàng'}]" @update:model-value="update(modelValue, 'availability', $event)" />
    <p class="catalog-filter-hint">Giá và tình trạng còn hàng lấy từ dữ liệu sản phẩm. Giỏ hàng không giữ chỗ tồn kho.</p>
    <div v-if="showActions" class="catalog-filter-actions"><SageButton type="submit">Áp dụng bộ lọc</SageButton><SageButton variant="ghost" @click="emit('reset')">Xóa bộ lọc</SageButton></div>
  </form>
</template>
