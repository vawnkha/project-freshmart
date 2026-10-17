<script setup>
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import { Swiper, SwiperSlide } from 'swiper/vue';
import { Autoplay, Pagination, A11y } from 'swiper/modules';
import bannerService from '@/services/banner.service';
import { useHomeResource } from '@/composables/useHomeResource';
import { useSageReducedMotion } from '@/composables/useSageReducedMotion';
import { homeBanner } from '@/utils/home-content.util';
import HomeBannerCard from './HomeBannerCard.vue';
import SageSkeleton from '@/components/user/sage/SageSkeleton.vue';
import SageErrorState from '@/components/user/sage/SageErrorState.vue';
import SageButton from '@/components/user/sage/SageButton.vue';
import 'swiper/css';
import 'swiper/css/pagination';
const modules = [Autoplay, Pagination, A11y];
const { data: slides, loading, error, load } = useHomeResource(() => bannerService.getPublic({ position: 'home_hero' }), 'Banner tạm thời chưa tải được.', rows => rows.map(homeBanner));
const reduced = useSageReducedMotion();
const swiper = shallowRef(null);
const active = ref(0);
const pausedByUser = ref(false), hovered = ref(false), focused = ref(false);
const rotating = computed(() => slides.value.length > 1 && !reduced.value && !pausedByUser.value && !hovered.value && !focused.value);
function syncRotation() {
  const autoplay = swiper.value?.autoplay;
  if (!autoplay) return;
  if (rotating.value) autoplay.start(); else autoplay.stop();
}
function ready(instance) { swiper.value = instance; active.value = instance.realIndex; syncRotation(); }
function focusOut(event) { if (!event.currentTarget.contains(event.relatedTarget)) focused.value = false; }
watch(rotating, syncRotation);
onBeforeUnmount(() => { swiper.value?.autoplay?.stop(); swiper.value = null; });
</script>
<template>
  <section v-if="loading || error || slides.length" class="home-sage-section home-sage-campaigns" aria-labelledby="home-campaign-title" :aria-busy="loading" @mouseenter="hovered = true" @mouseleave="hovered = false" @focusin="focused = true" @focusout="focusOut">
    <div class="container">
      <div class="home-sage-campaign-heading"><h2 id="home-campaign-title">Thông tin từ cửa hàng</h2>
        <div v-if="slides.length > 1" class="home-sage-carousel-controls">
          <SageButton variant="secondary" class="sage-icon-button" aria-label="Banner trước" @click="swiper?.slidePrev()"><i class="fa-solid fa-arrow-left" aria-hidden="true"></i></SageButton>
          <span class="sage-numeric" aria-live="off">{{ active + 1 }} / {{ slides.length }}</span>
          <SageButton variant="secondary" class="sage-icon-button" aria-label="Banner tiếp theo" @click="swiper?.slideNext()"><i class="fa-solid fa-arrow-right" aria-hidden="true"></i></SageButton>
          <SageButton v-if="!reduced" variant="ghost" :aria-pressed="pausedByUser" @click="pausedByUser = !pausedByUser">{{ pausedByUser ? 'Bật chuyển tự động' : 'Dừng chuyển tự động' }}</SageButton>
        </div>
      </div>
      <SageSkeleton v-if="loading" :lines="2" label="Đang tải banner" />
      <SageErrorState v-else-if="error" heading-tag="h3" :title="error" @retry="load" />
      <Swiper v-else :modules="modules" :slides-per-view="1" :loop="slides.length > 1" :speed="reduced ? 0 : 300" :autoplay="{ delay: 3000, disableOnInteraction: false }" :pagination="{ clickable: true }" :a11y="{ paginationBulletMessage: 'Chuyển đến banner {{index}}', slideLabelMessage: 'Banner {{index}} trên {{slidesLength}}' }" class="home-sage-campaign-swiper" @swiper="ready" @slide-change="active = $event.realIndex">
        <SwiperSlide v-for="(slide, index) in slides" :key="slide.id" :inert="index !== active || undefined" :aria-hidden="index !== active || undefined"><HomeBannerCard :banner="slide" :eager="index === 0" /></SwiperSlide>
      </Swiper>
    </div>
  </section>
</template>
