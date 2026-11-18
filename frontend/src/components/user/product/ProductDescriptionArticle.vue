<script setup>
import { computed } from 'vue';
import { productDescriptionHtml } from '@/utils/product-description.util';
import { productFields, productSpecifications, productStorage } from '@/utils/product-detail.util';
import { productTechnical } from '@/utils/product-technical.util';
import ProductTechnicalInformation from './ProductTechnicalInformation.vue';
import ProductDosageGuidance from './ProductDosageGuidance.vue';

const props = defineProps({ product: { type: Object, required: true } });
const technical = computed(() => productTechnical(props.product));
const description = computed(() => productDescriptionHtml(props.product.description, { readable: true }));
const authoredHeading = computed(() => /<h[1-4](?:\s|>)/i.test(description.value));
const info = computed(() => productFields(props.product, 'information'));
const usage = computed(() => productFields(props.product, 'usage').filter(row => row.key !== 'storage' &&
  !(technical.value.usageInstruction === row.value && ['usageInstruction','usage'].includes(row.key))));
const storage = computed(() => productStorage(props.product));
const packagingLabels = new Set(['Quy cách đóng gói','Dung lượng mỗi đơn vị bán','Đơn vị']);
const packaging = computed(() => productSpecifications(props.product).filter(row => packagingLabels.has(row.label)));
const specifications = computed(() => productSpecifications(props.product).filter(row => !packagingLabels.has(row.label)));
const sections = computed(() => Array.isArray(props.product.sections) ? props.product.sections.filter(row =>
  row && typeof row.title === 'string' && row.title.trim() && typeof row.content === 'string' && row.content.trim(),
).map(row => ({ title: row.title, content: productDescriptionHtml(row.content, { readable: true }) })) : []);
</script>

<template>
  <article class="product-description-article" aria-label="Mô tả sản phẩm">
    <header class="product-article-intro">
      <p class="product-article-eyebrow">Mô tả sản phẩm</p>
      <h2 v-if="!authoredHeading">{{ product.name }}</h2>
      <div v-if="description" class="rich-content product-article-rich" v-html="description"></div>
      <p v-else class="pdp-muted">Thông tin giới thiệu đang được cập nhật.</p>
    </header>

    <section v-for="field in info" :key="field.key" class="product-article-section">
      <h3>{{ field.label }}</h3><p class="pdp-field-text">{{ field.value }}</p>
    </section>
    <ProductTechnicalInformation v-if="technical.hasComposition" :product="product" :show-notes="false" />
    <section v-if="technical.hasPurposes" class="product-article-section">
      <h3>Công dụng và mục đích sử dụng</h3>
      <ul v-if="technical.purposes.length"><li v-for="(purpose,index) in technical.purposes" :key="index">{{ purpose }}</li></ul>
      <p v-if="technical.applicationPurpose" class="pdp-field-text">{{ technical.applicationPurpose }}</p>
    </section>
    <ProductDosageGuidance v-if="technical.hasUsage" :product="product" />
    <section v-for="field in usage" :key="field.key" class="product-article-section">
      <h3>{{ field.label }}</h3><p class="pdp-field-text">{{ field.value }}</p>
    </section>
    <section v-if="packaging.length" class="product-article-section">
      <h3>Quy cách đóng gói</h3>
      <dl class="pdp-specifications"><div v-for="row in packaging" :key="row.label"><dt>{{ row.label }}</dt><dd>{{ row.value }}</dd></div></dl>
    </section>
    <section v-if="storage.length" class="product-article-section">
      <h3>Bảo quản và hạn sử dụng</h3>
      <dl class="pdp-specifications"><div v-for="row in storage" :key="row.label"><dt>{{ row.label }}</dt><dd>{{ row.value }}</dd></div></dl>
      <p v-if="storage.some(row => row.label === 'Thời hạn sử dụng tham khảo')" class="product-article-note">Thời hạn tham khảo của sản phẩm; ngày hết hạn thực tế phụ thuộc từng lô hàng.</p>
    </section>
    <section v-if="specifications.length" class="product-article-section">
      <h3>Thông số sản phẩm</h3>
      <dl class="pdp-specifications"><div v-for="(row,index) in specifications" :key="index"><dt>{{ row.label }}</dt><dd>{{ row.value }}</dd></div></dl>
    </section>
    <section v-if="technical.notes" class="product-article-section"><h3>Ghi chú kỹ thuật</h3><p class="pdp-field-text">{{ technical.notes }}</p></section>
    <section v-for="(section,index) in sections" :key="index" class="product-article-section">
      <h3>{{ section.title }}</h3><div class="rich-content product-article-rich" v-html="section.content"></div>
    </section>
  </article>
</template>

<style scoped>
/* Hallmark · pre-emit critique: P4 H4 E4 S5 R5 V4
 * Editorial · Long Document · existing Sage tokens · no reveal motion. */
.product-description-article { max-width:960px; min-width:0; margin-inline:auto; font-size:16px; line-height:1.65; color:var(--body-ink); overflow-wrap:anywhere; }
.product-article-intro { background:var(--mist); border-radius:var(--radius-input); padding:clamp(16px,2.5vw,24px); margin-bottom:24px; }
.product-article-eyebrow { margin:0 0 12px; color:var(--text-secondary); font:500 12px/1.6 var(--font-mono); letter-spacing:.08em; text-transform:uppercase; }
.product-article-intro > h2 { margin:0 0 16px; color:var(--ink); font:800 clamp(22px,2.5vw,28px)/1.2 var(--font-display); letter-spacing:-.025em; overflow-wrap:anywhere; }
.product-description-article :deep(h3) { border-left:3px solid var(--ink); padding-left:12px; margin:0 0 16px; font:700 clamp(20px,2vw,22px)/1.35 var(--font-display); color:var(--ink); font-style:normal; overflow-wrap:anywhere; }
.product-article-section,.product-description-article :deep(.product-technical-information > section),.product-description-article :deep(.product-dosage-guidance) { margin-block:24px; }
.product-description-article :deep(h4) { margin:16px 0 8px; font-size:16px; font-style:normal; }
.product-description-article :deep(p) { margin-block:8px; }
.product-description-article :deep(li) { padding-left:4px; margin-block:4px; }
.product-description-article :deep(ul),.product-description-article :deep(ol) { padding-left:24px; }
.product-description-article :deep(.product-article-rich) { white-space:normal; }
.product-article-rich :deep(h1),.product-article-rich :deep(h2) { font-family:var(--font-display); color:var(--ink); font-size:clamp(22px,2.4vw,28px); line-height:1.35; font-style:normal; margin:24px 0 12px; }
.product-article-rich :deep(img) { display:block; max-width:100%; height:auto; margin:24px auto; object-fit:contain; }
.product-article-rich :deep(figure) { margin:24px 0; }
.product-article-rich :deep(figcaption) { color:var(--text-secondary); font-size:14px; }
.product-article-rich :deep(table) { display:block; max-width:100%; overflow-x:auto; border-collapse:collapse; margin-block:24px; }
.product-article-rich :deep(th),.product-article-rich :deep(td) { border:1px solid var(--border); padding:12px 16px; min-width:100px; vertical-align:top; }
.product-article-rich :deep(th) { background:var(--mist); text-align:left; }
.product-article-rich :deep(blockquote) { margin:24px 0; border-left:3px solid var(--border); padding-left:20px; color:var(--text-secondary); }
.product-article-rich :deep(pre) { max-width:100%; overflow-x:auto; white-space:pre-wrap; }
.product-description-article :deep(a) { color:var(--ink); text-decoration:underline; text-underline-offset:3px; }
.product-description-article :deep(:focus-visible) { outline:2px solid var(--ink); outline-offset:4px; }
.product-article-note { color:var(--text-secondary); font-size:14px; }
@media (max-width:480px) { .product-article-intro { padding:20px 16px; }.product-description-article :deep(.pdp-specifications > div) { grid-template-columns:minmax(0,1fr); gap:4px; }.product-description-article :deep(.technical-table) { font-size:14px; } }
</style>
