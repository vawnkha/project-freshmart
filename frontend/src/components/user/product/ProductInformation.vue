<script setup>
import { computed, ref, watch } from 'vue';
import DOMPurify from 'dompurify';
import SageTabs from '@/components/user/sage/SageTabs.vue';
import SageAccordion from '@/components/user/sage/SageAccordion.vue';
import { productFields, productSpecifications } from '@/utils/product-detail.util';
const props = defineProps({ product: { type: Object, required: true }, reviewCount: Number });
const active = ref('information');
const info = computed(() => productFields(props.product, 'information')), usage = computed(() => productFields(props.product, 'usage'));
const specs = computed(() => productSpecifications(props.product));
const description = computed(() => DOMPurify.sanitize(typeof props.product.description === 'string' ? props.product.description : ''));
const sections = computed(() => Array.isArray(props.product.sections) ? props.product.sections.filter(row =>
  row && typeof row.title === 'string' && row.title.trim() && typeof row.content === 'string' && row.content.trim(),
).map(row => ({ title: row.title, content: DOMPurify.sanitize(row.content) })) : []);
const tabs = computed(() => [{ value: 'information', label: 'Thông tin sản phẩm' },
  ...(usage.value.length ? [{ value: 'usage', label: 'Hướng dẫn sử dụng' }] : []),
  ...(specs.value.length ? [{ value: 'specifications', label: 'Thông số' }] : []),
  { value: 'reviews', label: 'Đánh giá' + (props.reviewCount == null ? '' : ' (' + props.reviewCount + ')') }]);
watch(() => props.product._id, () => { active.value = 'information'; });
</script>
<template>
  <section class="pdp-information">
    <h2 class="pdp-section-title">Tìm hiểu sản phẩm</h2>
    <SageTabs v-model="active" :items="tabs" label="Thông tin chi tiết sản phẩm">
      <template #information>
        <div v-if="description" class="rich-content pdp-description" v-html="description"></div>
        <p v-else class="pdp-muted">Thông tin chi tiết đang được cập nhật.</p>
        <SageAccordion v-for="(field, index) in info" :key="field.key" :title="field.label" :default-open="index === 0">
          <p class="pdp-field-text">{{ field.value }}</p>
        </SageAccordion>
        <SageAccordion v-for="(section, index) in sections" :key="index" :title="section.title">
          <div class="rich-content" v-html="section.content"></div>
        </SageAccordion>
      </template>
      <template #usage>
        <SageAccordion v-for="field in usage" :key="field.key" :title="field.label" default-open><p class="pdp-field-text">{{ field.value }}</p></SageAccordion>
      </template>
      <template #specifications>
        <dl class="pdp-specifications"><div v-for="(row, index) in specs" :key="index"><dt>{{ row.label }}</dt><dd>{{ row.value }}</dd></div></dl>
      </template>
      <template #reviews><slot name="reviews" /></template>
    </SageTabs>
  </section>
</template>
