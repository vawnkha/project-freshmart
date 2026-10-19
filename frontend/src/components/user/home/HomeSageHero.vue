<script setup>
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useCatalog } from '@/composables/useCatalog';
import { normalizeId } from '@/utils/id.util';
import SageButton from '@/components/user/sage/SageButton.vue';
import SageCard from '@/components/user/sage/SageCard.vue';
import SageIcon from '@/components/user/sage/SageIcon.vue';
import pond from '@/assets/images/user/home-pond.svg';
const router = useRouter();
const keyword = ref('');
const photoFailed = ref(false);
const photo = new URL('../../../assets/images/user/approved-home/mangroves-photo.jpg', import.meta.url).href;
const { categories, loading, error } = useCatalog();
const links = computed(() => error.value ? [] : categories.value.slice(0, 3));
function search() {
  const q = keyword.value.trim();
  router.push({ path: '/products', query: q ? { q } : {} });
}
</script>
<template>
  <section class="home-sage-hero container" aria-labelledby="home-title">
    <div class="home-sage-hero-panel sage-dark-surface">
      <div class="home-sage-hero-copy hero-copy">
        <p class="home-sage-kicker hero-fade" style="--i:0">FreshMart · Chế phẩm sinh học cho tôm</p>
        <h1 id="home-title" class="sage-display" tabindex="-1">
          <span class="hero-line" style="--i:0"><span>Cho ao.</span></span>
          <span class="hero-line" style="--i:1"><span>Cho tôm.</span></span>
          <span class="hero-line" style="--i:2"><span>Chọn kỹ.</span></span>
        </h1>
        <p class="home-sage-hero-lead hero-fade" style="--i:1">Tìm hiểu thông tin.<br>Lựa chọn cho nhu cầu ao nuôi.</p>
        <form class="home-sage-search hero-fade" style="--i:2" role="search" aria-label="Tìm sản phẩm từ trang chủ" @submit.prevent="search">
          <label class="sage-visually-hidden" for="home-sage-search">Từ khóa sản phẩm</label>
          <input id="home-sage-search" v-model="keyword" name="q" type="search" placeholder="Bạn đang tìm sản phẩm gì?">
          <SageButton type="submit" class="sage-icon-button" aria-label="Tìm sản phẩm"><SageIcon name="search" /></SageButton>
        </form>
        <nav v-if="loading || links.length" class="home-sage-pills hero-fade" style="--i:3" aria-label="Nhóm sản phẩm" :aria-busy="loading">
          <RouterLink v-for="category in links" :key="normalizeId(category._id || category.id)" :to="{ path: '/products', query: { category_id: normalizeId(category._id || category.id) } }">{{ category.name }}</RouterLink>
        </nav>
      </div>
      <figure class="aquaculture-hero-media home-sage-hero-media">
        <img v-if="!photoFailed" :src="photo" width="1280" height="853" alt="Ao nuôi cạnh rừng ngập mặn tại Bangladesh — ảnh bối cảnh, không phải cơ sở FreshMart" fetchpriority="high" decoding="async" @error="photoFailed = true">
        <img v-else :src="pond" width="600" height="730" alt="Minh họa ao nuôi, không phải cơ sở FreshMart">
        
      </figure>
      <SageCard as="aside" class="storefront-proof home-sage-proof">
        <p class="home-sage-proof-label">Tìm hiểu trước khi mua</p>
        <ul><li><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>Tra cứu thông tin sản phẩm</li><li><i class="fa-solid fa-box" aria-hidden="true"></i>So sánh quy cách đóng gói</li><li><i class="fa-solid fa-leaf" aria-hidden="true"></i>Khám phá kiến thức tham khảo</li></ul>
      </SageCard>
    </div>
  </section>
</template>
