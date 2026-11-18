<script setup>
import { computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { useRoute } from 'vue-router';
import { useComparisonStore } from '@/stores/user/comparison';
import ResponsiveImage from '@/components/user/common/ResponsiveImage.vue';
const comparison = useComparisonStore(), route = useRoute();
const items = computed(() => comparison.ids.map(id => ({ id, product: comparison.records.find(p => String(p._id) === id) })));
watch(() => comparison.ids.join(','), () => { if (route.path !== '/compare') comparison.refresh(); }, { immediate: true });
const refresh = () => comparison.refresh();
onMounted(() => window.addEventListener('focus', refresh));
onBeforeUnmount(() => window.removeEventListener('focus', refresh));
</script>
<template>
  <aside v-if="items.length && route.path !== '/compare'" class="comparison-bar" aria-label="Danh sách so sánh">
    <strong>So sánh {{ items.length }}/3</strong>
    <ul><li v-for="item in items" :key="item.id"><ResponsiveImage v-if="item.product" :src="item.product.thumbnail" :alt="item.product.name" /><span>{{ item.product?.name || (comparison.loading ? 'Đang tải…' : 'Sản phẩm đã chọn') }}</span><button type="button" :aria-label="'Bỏ so sánh ' + (item.product?.name || item.id)" @click="comparison.remove(item.id)">×</button></li></ul>
    <button type="button" @click="comparison.clear">Xóa tất cả</button>
    <RouterLink v-if="comparison.canCompare" :to="{ path: '/compare', query: { ids: comparison.ids.join(',') } }" class="sage-button">So sánh ngay</RouterLink>
    <button v-else type="button" disabled title="Chọn ít nhất 2 sản phẩm">So sánh ngay</button>
    <p v-if="comparison.error" role="status">{{ comparison.error }}</p>
  </aside>
</template>
<style scoped>
.comparison-bar { position: sticky; bottom: 0; z-index: 30; display: flex; align-items: center; flex-wrap: wrap; gap: 12px; padding: 12px max(16px,calc((100vw - 1200px)/2)); background: var(--surface); border-top: 1px solid var(--border); box-shadow: var(--shadow-2); }
.comparison-bar ul { display: flex; flex: 1; flex-wrap: wrap; gap: 12px; list-style: none; padding: 0; margin: 0; }.comparison-bar li { display: flex; align-items: center; gap: 8px; max-width: 240px; font-size: 14px; }.comparison-bar :deep(img) { width: 40px; height: 40px; object-fit: contain; }.comparison-bar button { min-height:44px; min-width:44px; padding:7px; border:1px solid var(--input-border); border-radius:var(--radius-input); background:var(--surface); color:var(--ink); }.comparison-bar p { width: 100%; margin: 0; }
@media(max-width:600px) { .comparison-bar { gap: 8px; padding: 10px; }.comparison-bar ul { flex-basis: 100%; }.comparison-bar li { max-width: 30%; }.comparison-bar li span { max-width: 80px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.comparison-bar :deep(img) { display: none; } }
</style>
