<script setup>
import { computed, onMounted, ref } from "vue";
import { Swiper, SwiperSlide } from "swiper/vue";
import { Autoplay, Pagination } from "swiper/modules";
import bannerService from "@/services/banner.service";

import "swiper/css";
import "swiper/css/pagination";

const modules = [Autoplay, Pagination];
const banners = ref([]);
const failedImageIds = ref(new Set());

const slides = computed(() =>
  banners.value.filter((item) => !failedImageIds.value.has(item.id))
);
const showSlider = computed(() => slides.value.length > 0);

function normalizeList(res) {
  return Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
}

function normalizeBanner(item = {}, index = 0) {
  return {
    id: item._id || item.id || `banner-${index}`,
    imageUrl: item.imageUrl || "",
    mobileImageUrl: item.mobileImageUrl || item.imageUrl || "",
    title: item.title || "",
    subtitle: item.subtitle || "",
    description: item.description || "",
    buttonText: item.buttonText || "",
    link: item.link || "#",
  };
}

function handleImageError(slide) {
  if (!slide?.id) return;
  failedImageIds.value = new Set([...failedImageIds.value, slide.id]);
}

async function fetchHeroBanners() {
  try {
    failedImageIds.value = new Set();
    const res = await bannerService.getPublic({ position: "home_hero" });
    banners.value = normalizeList(res)
      .map(normalizeBanner)
      .filter((item) => item.imageUrl);
  } catch (error) {
    console.error("Không thể tải banner trang chủ", error);
    banners.value = [];
  }
}

onMounted(fetchHeroBanners);
</script>

<template>
  <div v-if="showSlider" class="section slideshow">
    <div class="tiva-slideshow-wrapper">
      <Swiper
        :modules="modules"
        :slides-per-view="1"
        :loop="slides.length > 1"
        :autoplay="{ delay: 3000, disableOnInteraction: false }"
        :pagination="{ clickable: true }"
        class="home-hero-swiper"
      >
        <SwiperSlide v-for="slide in slides" :key="slide.id">
          <a :href="slide.link || '#'" class="home-hero-slide">
            <picture>
              <source
                media="(max-width: 767px)"
                :srcset="slide.mobileImageUrl || slide.imageUrl"
              />
              <img
                :src="slide.imageUrl"
                :alt="slide.title || 'Banner trang chủ'"
                class="img-responsive"
                @error="handleImageError(slide)"
              />
            </picture>

            <span
              v-if="slide.title || slide.subtitle || slide.description || slide.buttonText"
              class="home-hero-slide__content"
            >
              <span v-if="slide.subtitle" class="home-hero-slide__subtitle">
                {{ slide.subtitle }}
              </span>
              <span v-if="slide.title" class="home-hero-slide__title">
                {{ slide.title }}
              </span>
              <span v-if="slide.description" class="home-hero-slide__description">
                {{ slide.description }}
              </span>
              <span v-if="slide.buttonText" class="home-hero-slide__button">
                {{ slide.buttonText }}
              </span>
            </span>
          </a>
        </SwiperSlide>
      </Swiper>
    </div>
  </div>
</template>

<style>
.tiva-slideshow-wrapper {
  position: relative;
  overflow: hidden;
  z-index: 9;
}
.swiper-pagination {
  font-size: 0px;
  position: absolute;
  bottom: 30px;
  left: 0px;
  right: 0px;
  width: 100%;
  z-index: 9;
  text-align: center;
  padding: 0;
}
.swiper-pagination-bullet {
  display: inline-block;
  vertical-align: middle;
  width: 10px;
  height: 10px;
  background-color: #ebebeb;
  border-radius: 50px;
  margin: 0px 4px;
  cursor: pointer;
  font-size: 0px;
}
.swiper-pagination-bullet-active {
  height: 1pc;
  width: 16px;
}
.home-hero-slide {
  display: block;
  position: relative;
  color: inherit;
}
.home-hero-slide picture,
.home-hero-slide img {
  display: block;
  width: 100%;
}
.home-hero-slide__content {
  position: absolute;
  top: 50%;
  left: 8%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  max-width: min(520px, 46vw);
  color: #1f2937;
  pointer-events: none;
}
.home-hero-slide__subtitle {
  font-size: 18px;
  font-weight: 600;
  color: #78b144;
}
.home-hero-slide__title {
  font-size: 42px;
  font-weight: 700;
  line-height: 1.1;
}
.home-hero-slide__description {
  font-size: 16px;
  line-height: 1.5;
}
.home-hero-slide__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 42px;
  padding: 0 20px;
  border-radius: 4px;
  background: #78b144;
  color: #fff;
  font-weight: 700;
}
@media (max-width: 767px) {
  .home-hero-slide__content {
    left: 24px;
    right: 24px;
    max-width: calc(100% - 48px);
    gap: 6px;
  }
  .home-hero-slide__subtitle {
    font-size: 13px;
  }
  .home-hero-slide__title {
    font-size: 24px;
  }
  .home-hero-slide__description {
    font-size: 13px;
  }
  .home-hero-slide__button {
    min-height: 34px;
    padding: 0 14px;
    font-size: 13px;
  }
}
</style>
