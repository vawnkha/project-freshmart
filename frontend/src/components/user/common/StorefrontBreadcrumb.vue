<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { breadcrumbParent, CLIENT_NAVIGATION } from '@/utils/storefront-shell.util';
const props = defineProps({ items: Array, current: String, parent: String, parentTo: [String, Object], hide: Boolean });
const route = useRoute();
const crumbs = computed(() => {
  if (props.items?.length) return props.items;
  if (route.meta.breadcrumbs?.length) return route.meta.breadcrumbs;
  const current = props.current || route.meta.title || CLIENT_NAVIGATION.find(link => link.to === route.path)?.label;
  if (!current || route.path === '/') return [];
  const items = [{ label: 'Trang chủ', to: '/' }];
  if (props.parent) items.push({ label: props.parent, to: breadcrumbParent(props.parentTo, route.query) });
  return [...items, { label: current }];
});
</script>
<template>
  <nav v-if="!hide && crumbs.length" class="page-crumb shell-breadcrumb" aria-label="Đường dẫn">
    <ol><li v-for="(crumb, index) in crumbs" :key="index"><span v-if="index" class="shell-crumb-separator" aria-hidden="true">/</span><router-link v-if="crumb.to && index < crumbs.length - 1" :to="crumb.to" custom v-slot="link"><a :href="link.href" @click="link.navigate">{{ crumb.label }}</a></router-link><span v-else :aria-current="index === crumbs.length - 1 ? 'page' : undefined">{{ crumb.label }}</span></li></ol>
  </nav>
</template>
