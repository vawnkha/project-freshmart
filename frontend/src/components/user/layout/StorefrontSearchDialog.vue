<script setup>
import { ref, watch, onBeforeUnmount, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import productService from '@/services/product.service';
import { createStorefrontSearch } from '@/utils/storefront-shell.util';
import { normalizeId } from '@/utils/id.util';
import SageDialog from '@/components/user/sage/SageDialog.vue';
import SageInput from '@/components/user/sage/SageInput.vue';
import SageButton from '@/components/user/sage/SageButton.vue';
import SageLoading from '@/components/user/sage/SageLoading.vue';
import SageEmptyState from '@/components/user/sage/SageEmptyState.vue';
import SageErrorState from '@/components/user/sage/SageErrorState.vue';
import ResponsiveImage from '@/components/user/common/ResponsiveImage.vue';
import ProductPrice from '@/components/user/product/ProductPrice.vue';
defineProps({ modelValue: Boolean, id: String });
const emit = defineEmits(['update:modelValue', 'closed', 'navigate']);
const route = useRoute(), router = useRouter();
const keyword = ref(String(route.query.q || ''));
const state = ref({ keyword: '', products: [], status: 'idle', error: '' });
const search = createStorefrontSearch({ search: params => productService.search(params), publish: value => { state.value = value; } });
watch(keyword, value => search.update(value), { immediate: true, flush: 'sync' });
onBeforeUnmount(() => search.dispose());
const results = computed(() => state.value.products.slice(0, 6));
function submit() {
  const q = keyword.value.trim();
  if (!q) return;
  emit('navigate'); router.push({ path: '/products', query: { q } });
}
function close(value) { if (!value) search.update(''); emit('update:modelValue', value); }
function resultKeys(event) {
  if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
  const dialog = event.currentTarget;
  const links = [...dialog.querySelectorAll('.shell-search-result')];
  if (!links.length) return;
  const current = links.indexOf(dialog.ownerDocument.activeElement);
  const index = event.key === 'ArrowDown' ? (current + 1) % links.length : (current < 0 ? links.length - 1 : (current - 1 + links.length) % links.length);
  event.preventDefault(); links[index].focus();
}
</script>
<template>
  <SageDialog :id="id" class="shell-search-dialog" :model-value="modelValue" title="Tìm sản phẩm" @update:model-value="close" @closed="emit('closed')" @keydown="resultKeys">
    <form role="search" class="shell-search-form" @submit.prevent="submit">
      <SageInput v-model="keyword" label="Tên sản phẩm hoặc từ khóa" name="q" type="search" autofocus autocomplete="off" placeholder="Tìm chế phẩm, sản phẩm…" />
      <SageButton type="submit" :disabled="!keyword.trim()">Tìm kiếm</SageButton>
    </form>
    <p class="shell-search-hint">Enter để xem danh sách đầy đủ. Phím ↑ ↓ để chọn gợi ý.</p>
    <SageLoading v-if="['loading', 'waiting'].includes(state.status)" label="Đang tìm sản phẩm…" />
    <SageErrorState v-else-if="state.status === 'error'" heading-tag="h3" :description="state.error" @retry="search.retry" />
    <SageEmptyState v-else-if="state.status === 'idle'" heading-tag="h3" title="Bạn đang tìm sản phẩm nào?" description="Nhập từ khóa để tra cứu sản phẩm đang được công khai." />
    <SageEmptyState v-else-if="!results.length" heading-tag="h3" title="Không có sản phẩm phù hợp" :description="'Thử một từ khóa khác cho “' + state.keyword + '”.'" />
    <template v-else>
      <p class="shell-search-count" role="status">{{ results.length }} gợi ý cho “{{ state.keyword }}”</p>
      <ul class="shell-search-results">
        <li v-for="product in results" :key="normalizeId(product._id || product.id)">
          <router-link class="shell-search-result" :to="{ path: '/products/' + normalizeId(product._id || product.id), query: { q: state.keyword } }" @click="emit('navigate')">
            <ResponsiveImage :src="product.thumbnail || product.image" :alt="product.name || 'Sản phẩm'" />
            <div><span class="shell-result-name">{{ product.name }}</span><ProductPrice :product="product" /></div>
            <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
          </router-link>
        </li>
      </ul>
      <router-link class="shell-text-link" :to="{ path: '/products', query: { q: state.keyword } }" @click="emit('navigate')">Xem danh sách kết quả <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></router-link>
    </template>
  </SageDialog>
</template>
