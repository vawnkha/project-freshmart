<script setup>
import { computed, ref, watch } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
const props = defineProps({ banner: { type: Object, required: true }, eager: Boolean });
const failed = ref(false);
watch(() => props.banner.imageUrl, () => { failed.value = false; });
const router = useRouter();
const external = computed(() => /^https?:\/\//i.test(props.banner.link));
const actionable = computed(() => {
  if (external.value) return true;
  if (!props.banner.link) return false;
  // Skip nonexistent/Planned routes and Admin destinations without changing CMS.
  return router.resolve(props.banner.link).matched.some(record => record.name && record.name !== 'not-found' && !record.path.startsWith('/admin'));
});
const linkAttrs = computed(() => !actionable.value ? {} : external.value
  ? { href: props.banner.link, target: '_blank', rel: 'noopener noreferrer' }
  : { to: props.banner.link });
</script>
<template>
  <component :is="actionable ? (external ? 'a' : RouterLink) : 'article'" v-bind="linkAttrs" class="home-sage-banner-card">
    <div class="home-sage-banner-image">
      <picture v-if="banner.imageUrl && !failed"><source media="(max-width: 767px)" :srcset="banner.mobileImageUrl"><img :src="banner.imageUrl" :alt="banner.title || 'Thông tin từ cửa hàng'" :loading="eager ? 'eager' : 'lazy'" :fetchpriority="eager ? 'high' : 'auto'" decoding="async" @error="failed = true"></picture>
      <div v-else class="image-placeholder" role="img" aria-label="Banner — chưa tải được ảnh"><span>Chưa tải được hình ảnh</span></div>
    </div>
    <div v-if="banner.title || banner.subtitle || banner.description || (banner.buttonText && actionable)" class="home-sage-banner-copy">
      <p v-if="banner.subtitle" class="home-sage-banner-subtitle">{{ banner.subtitle }}</p>
      <h3 v-if="banner.title">{{ banner.title }}</h3>
      <p v-if="banner.description">{{ banner.description }}</p>
      <span v-if="banner.buttonText && actionable" class="text-link">{{ banner.buttonText }} <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></span>
    </div>
  </component>
</template>
