<script setup>
import { watch } from 'vue';
import bannerService from '@/services/banner.service';
import { useHomeResource } from '@/composables/useHomeResource';
import { homeBanner } from '@/utils/home-content.util';
import HomeBannerCard from './HomeBannerCard.vue';
import SageSkeleton from '@/components/user/sage/SageSkeleton.vue';
import SageErrorState from '@/components/user/sage/SageErrorState.vue';
const props = defineProps({ position: { type: String, default: 'home_middle' } });
const { data: banners, loading, error, load } = useHomeResource(() => bannerService.getPublicBanners(props.position), 'Chưa tải được thông tin cửa hàng.', rows => rows.map(homeBanner));
watch(() => props.position, load);
</script>
<template>
  <section v-if="loading || error || banners.length" class="home-sage-section home-sage-banners" :aria-label="position === 'home_bottom' ? 'Thông tin cuối trang' : 'Thông tin nổi bật'" :aria-busy="loading">
    <div class="container">
      <SageSkeleton v-if="loading" :lines="2" label="Đang tải thông tin cửa hàng" />
      <SageErrorState v-else-if="error" heading-tag="h2" :title="error" @retry="load" />
      <div v-else class="home-sage-banner-grid"><div v-for="(banner, index) in banners" :key="banner.id" class="reveal" :style="{ '--i': index % 3 }"><HomeBannerCard :banner="banner" /></div></div>
    </div>
  </section>
</template>
