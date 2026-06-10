<script setup>
import { computed, onMounted, ref } from "vue";
import bannerService from "@/services/banner.service";

const POSITION = "home_middle";

const banners = ref([]);
const failedImageIds = ref(new Set());

const visibleBanners = computed(() =>
  banners.value.filter((item) => !failedImageIds.value.has(item.id)),
);
const showBanners = computed(() => visibleBanners.value.length > 0);

function normalizeList(res) {
  return Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
}

function normalizeBanner(item = {}, index = 0) {
  return {
    id: item._id || item.id || `home-banner-${index}`,
    imageUrl: item.imageUrl || "",
    mobileImageUrl: item.mobileImageUrl || item.imageUrl || "",
    title: item.title || "",
    subtitle: item.subtitle || "",
    description: item.description || "",
    buttonText: item.buttonText || "",
    link: item.link || "#",
    sortOrder: Number(item.sortOrder || 0),
  };
}

function isExternalLink(link = "") {
  return /^https?:\/\//i.test(link);
}

function handleImageError(banner) {
  if (!banner?.id) return;
  failedImageIds.value = new Set([...failedImageIds.value, banner.id]);
}

async function fetchBanners() {
  try {
    failedImageIds.value = new Set();
    const res = await bannerService.getPublicBanners(POSITION);
    banners.value = normalizeList(res)
      .map(normalizeBanner)
      .filter((item) => item.imageUrl)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  } catch (error) {
    console.error("Không thể tải banner giữa trang", error);
    banners.value = [];
  }
}

onMounted(fetchBanners);
</script>

<template>
  <div v-if="showBanners" class="section banners-block">
    <div class="row margin-0">
      <div
        v-for="banner in visibleBanners"
        :key="banner.id"
        class="col-lg-4 col-md-4 col-sm-4 col-xs-12 padding-0"
      >
        <div class="banner-item effect">
          <a
            :href="banner.link || '#'"
            :target="isExternalLink(banner.link) ? '_blank' : undefined"
            :rel="isExternalLink(banner.link) ? 'noopener noreferrer' : undefined"
          >
            <picture>
              <source
                media="(max-width: 767px)"
                :srcset="banner.mobileImageUrl || banner.imageUrl"
              />
              <img
                class="img-responsive"
                :src="banner.imageUrl"
                :alt="banner.title || 'Banner'"
                @error="handleImageError(banner)"
              />
            </picture>

            <span
              v-if="
                banner.title ||
                banner.subtitle ||
                banner.description ||
                banner.buttonText
              "
              class="home-banner-content"
            >
              <span v-if="banner.subtitle" class="home-banner-content__subtitle">
                {{ banner.subtitle }}
              </span>
              <span v-if="banner.title" class="home-banner-content__title">
                {{ banner.title }}
              </span>
              <span v-if="banner.description" class="home-banner-content__description">
                {{ banner.description }}
              </span>
              <span v-if="banner.buttonText" class="home-banner-content__button">
                {{ banner.buttonText }}
              </span>
            </span>
          </a>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.banner-item a {
  display: block;
  position: relative;
  color: inherit;
}

.banner-item picture,
.banner-item img {
  display: block;
  width: 100%;
}

.home-banner-content {
  position: absolute;
  top: 50%;
  left: 24px;
  right: 24px;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  pointer-events: none;
}

.home-banner-content__subtitle {
  font-size: 13px;
  font-weight: 600;
  color: #78b144;
}

.home-banner-content__title {
  font-size: 24px;
  line-height: 1.15;
  font-weight: 700;
}

.home-banner-content__description {
  font-size: 13px;
  line-height: 1.4;
}

.home-banner-content__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 32px;
  padding: 0 12px;
  border-radius: 4px;
  background: #78b144;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
}

@media (max-width: 767px) {
  .home-banner-content {
    left: 16px;
    right: 16px;
  }

  .home-banner-content__title {
    font-size: 20px;
  }
}
</style>
