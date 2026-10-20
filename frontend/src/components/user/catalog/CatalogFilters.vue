<script setup>
import { computed, ref, watch } from 'vue';
import { normalizeId } from '@/utils/id.util';
import SageInput from '@/components/user/sage/SageInput.vue';
import SageAccordion from '@/components/user/sage/SageAccordion.vue';
import SageButton from '@/components/user/sage/SageButton.vue';
const props = defineProps({ modelValue: Object, categories: Array, units: Array, prefix: String, errors: Object, categoryLoading: Boolean, categoryError: String, unitLoading: Boolean, unitError: String });
const emit = defineEmits(['update:modelValue', 'commit', 'retry', 'retry-units']);
const expanded = ref({ price: true, category_id: true, unit: true });
watch(() => props.errors, errors => {
  if (errors.min_price || errors.max_price) expanded.value.price = true;
  if (errors.category_id) expanded.value.category_id = true;
});
function update(model, key, value) { emit('update:modelValue', { ...model, [key]: value }); }
const priceRanges = [
  { id: 'under-200', label: 'Dưới 200.000đ', min: '', max: '199999.99' },
  { id: '200-300', label: '200.000đ – 300.000đ', min: '200000', max: '300000' },
  { id: '300-400', label: '300.000đ – 400.000đ', min: '300000', max: '400000' },
  { id: '400-500', label: '400.000đ – 500.000đ', min: '400000', max: '500000' },
  { id: 'over-500', label: 'Trên 500.000đ', min: '500000.01', max: '' },
];
function sameAmount(a, b) { return a === '' || b === '' ? a === b : Number(a) === Number(b); }
function matchesRange(range) { return sameAmount(props.modelValue.min_price, range.min) && sameAmount(props.modelValue.max_price, range.max); }
const customPrice = computed(() => (props.modelValue.min_price !== '' || props.modelValue.max_price !== '') && !priceRanges.some(matchesRange));
const customOpen = ref(false);
watch([customPrice, () => props.errors], ([custom, errors]) => {
  if (custom || errors.min_price || errors.max_price) customOpen.value = true;
}, { immediate: true });
const groups = computed(() => {
  const options = [{ id: 'all', value: '', label: 'Tất cả danh mục' }, ...props.categories.map(category => ({ id: normalizeId(category._id || category.id), value: normalizeId(category._id || category.id), label: category.name }))];
  if (props.modelValue.category_id && !options.some(option => option.value === props.modelValue.category_id)) options.push({ id: 'current', value: props.modelValue.category_id, label: 'Danh mục theo liên kết hiện tại' });
  return [
    { id: 'category', key: 'category_id', title: 'Danh mục', hint: 'Chọn một danh mục.', options, loading: props.categoryLoading, error: props.errors.category_id },
    { id: 'price', key: 'price', title: 'Lọc giá' },
    { id: 'unit', key: 'unit', title: 'Đóng gói', hint: 'Có thể chọn nhiều đơn vị.', options: props.units.map((unit, index) => ({ id: String(index), value: unit, label: unit })), loading: props.unitLoading && !props.units.length },
  ];
});
function choosePrice(range, checked) {
  customOpen.value = false;
  emit('update:modelValue', { ...props.modelValue, min_price: checked ? range.min : '', max_price: checked ? range.max : '' });
  emit('commit');
}
// Categories retain the existing single-value URL/filter contract.
function chooseSingle(key, value, event) {
  update(props.modelValue, key, event.target.checked ? value : '');
  if (!value) event.target.checked = true;
  emit('commit');
}
function chooseUnit(value, checked) {
  const units = checked ? [...new Set([...props.modelValue.unit, value])] : props.modelValue.unit.filter(unit => unit !== value);
  emit('update:modelValue', { ...props.modelValue, unit: units });
  emit('commit');
}
</script>
<template>
  <form :id="prefix + '-form'" class="catalog-filter-form" novalidate aria-label="Bộ lọc sản phẩm" @submit.prevent="emit('commit', true)">
    <SageAccordion v-for="group in groups" :key="group.key" v-model="expanded[group.key]" :title="group.title" class="catalog-filter-panel">
      <template v-if="group.key === 'price'">
        <fieldset class="catalog-filter-options">
          <legend class="sage-visually-hidden">Lọc giá</legend>
          <p class="catalog-filter-hint">Chọn một khoảng giá.</p>
          <label v-for="range in priceRanges" :key="range.id" class="catalog-filter-option" :for="prefix + '-price-' + range.id">
            <input :id="prefix + '-price-' + range.id" type="checkbox" :name="prefix + '-price'" :checked="matchesRange(range)" @change="choosePrice(range, $event.target.checked)" />
            <span>{{ range.label }}</span>
          </label>
        </fieldset>
        <details class="catalog-custom-price" :open="customOpen" @toggle="customOpen = $event.target.open">
          <summary>Khoảng giá tùy chọn <i class="fa-solid fa-chevron-down" aria-hidden="true"></i></summary>
          <div class="catalog-custom-price-inputs">
            <SageInput :id="prefix + '-min'" label="Giá từ" type="number" min="0" step="0.01" inputmode="decimal" placeholder="Không giới hạn" :model-value="modelValue.min_price" :error="errors.min_price" @update:model-value="update(modelValue, 'min_price', $event)" @blur="emit('commit')" />
            <SageInput :id="prefix + '-max'" label="Giá đến" type="number" min="0" step="0.01" inputmode="decimal" placeholder="Không giới hạn" :model-value="modelValue.max_price" :error="errors.max_price" @update:model-value="update(modelValue, 'max_price', $event)" @blur="emit('commit')" />
          </div>
        </details>
      </template>
      <template v-else>
        <fieldset class="catalog-filter-options" :aria-busy="group.loading || undefined" :aria-describedby="group.error ? prefix + '-' + group.id + '-error' : undefined">
          <legend class="sage-visually-hidden">{{ group.title }}</legend>
          <p v-if="group.hint" class="catalog-filter-hint">{{ group.hint }}</p>
          <label v-for="option in group.options" :key="option.id" class="catalog-filter-option" :for="prefix + '-' + group.id + '-' + option.id">
            <input :id="prefix + '-' + group.id + '-' + option.id" type="checkbox" :name="prefix + '-' + group.id" :value="option.value" :checked="group.key === 'unit' ? modelValue.unit.includes(option.value) : modelValue[group.key] === option.value" :disabled="group.loading" :aria-invalid="group.error && option.id === 'all' ? true : undefined" :aria-describedby="group.error ? prefix + '-' + group.id + '-error' : undefined" @change="group.key === 'unit' ? chooseUnit(option.value, $event.target.checked) : chooseSingle(group.key, option.value, $event)" />
            <span>{{ option.label }}</span>
          </label>
          <p v-if="group.loading" class="catalog-filter-hint" role="status">{{ group.key === 'unit' ? 'Đang tải đóng gói…' : 'Đang tải danh mục…' }}</p>
          <p v-if="group.key === 'unit' && !units.length && !unitLoading && !unitError" class="catalog-filter-hint">Chưa có dữ liệu đóng gói.</p>
          <p v-if="group.error" :id="prefix + '-' + group.id + '-error'" class="sage-field-error" role="alert">{{ group.error }}</p>
        </fieldset>
        <p v-if="group.key === 'category_id' && categoryError" class="catalog-category-error" role="status">{{ categoryError }} <SageButton variant="ghost" :loading="categoryLoading" @click="emit('retry')">Thử lại danh mục</SageButton></p>
        <p v-if="group.key === 'unit' && unitError" class="catalog-category-error" role="status">Chưa tải được đóng gói. <SageButton variant="ghost" :loading="unitLoading" @click="emit('retry-units')">Thử lại đóng gói</SageButton></p>
      </template>
    </SageAccordion>
    <p class="catalog-filter-hint">Chọn điều kiện để tự động cập nhật sản phẩm.</p>
  </form>
</template>
