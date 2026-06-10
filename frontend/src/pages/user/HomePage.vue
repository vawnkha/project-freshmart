<script setup>
import { onMounted, ref } from "vue";
import HomeHeroSlider from "@/components/user/home/HomeHeroSlider.vue";
import HomeProductTabs from "@/components/user/home/HomeProductTabs.vue";
import HomeProductCarouselSection from "@/components/user/home/HomeProductCarouselSection.vue";
import HomeBlogSection from "@/components/user/home/HomeBlogSection.vue";
import HomeIntro from "@/components/user/home/HomeIntro.vue";
import HomeBanners from "@/components/user/home/HomeBanners.vue";
import productService from "@/services/product.service";
import newsService from "@/services/news.service";

const featuredProducts = ref([]);
const bestSellerProducts = ref([]);
const blogPosts = ref([]);

function normalizeList(res) {
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res)) return res;
  return [];
}

function normalizeId(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value.$oid) return value.$oid;
  return String(value);
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("vi-VN");
}

function normalizeBlogPost(item) {
  return {
    id: normalizeId(item._id || item.id),
    slug: item.slug || normalizeId(item._id || item.id),
    title: item.title || "Bài viết chưa có tiêu đề",
    image: item.thumbnail || item.images?.[0] || "",
    date: formatDate(item.publishedAt || item.createdAt),
    excerpt: item.summary || "",
  };
}

async function loadProducts() {
  const latest = await productService.getAll();
  const items = latest.data || [];
  featuredProducts.value = items.slice(0, 6);
  bestSellerProducts.value = items.slice(6, 12);
}

async function loadNews() {
  const newsRes = await newsService.getPublicNews();
  blogPosts.value = normalizeList(newsRes).slice(0, 3).map(normalizeBlogPost);
}

onMounted(async () => {
  try {
    await loadProducts();
  } catch (error) {
    console.error(error.message);
  }

  try {
    await loadNews();
  } catch (error) {
    console.error(error.message);
    blogPosts.value = [];
  }
});
</script>

<template>
  <div id="content" class="site-content">
    <HomeHeroSlider />
    <HomeProductTabs />
    <HomeIntro />

    <div class="two-column">
      <div class="row">
        <div class="col-lg-6 col-md-6 col-sm-12 col-xs-12">
          <HomeProductCarouselSection
            title="Nổi bật"
            highlight="Sản phẩm"
            subtitle="Sản phẩm nổi bật từ cửa hàng"
            :products="featuredProducts"
          />
        </div>

        <div class="col-lg-6 col-md-6 col-sm-12 col-xs-12">
          <HomeProductCarouselSection
            title="Nhất"
            highlight="Bán chạy"
            subtitle="Sản phẩm bán chạy nhất của cửa hàng"
            :products="bestSellerProducts"
          />
        </div>
      </div>
    </div>

    <HomeBanners />
    <HomeBlogSection v-if="blogPosts.length" :posts="blogPosts" />
  </div>
</template>

<style>
.swiper-button-prev .swiper-navigation-icon,
.swiper-button-next .swiper-navigation-icon {
  height: 70%;
  color: #78b144;
}
</style>
