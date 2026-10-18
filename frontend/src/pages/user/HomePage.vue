<script setup>
import HomeSageHero from '@/components/user/home/HomeSageHero.vue';
import HomeHeroSlider from '@/components/user/home/HomeHeroSlider.vue';
import HomeCategorySection from '@/components/user/home/HomeCategorySection.vue';
import HomeVoucherSection from '@/components/user/home/HomeVoucherSection.vue';
import HomeProductSection from '@/components/user/home/HomeProductSection.vue';
import HomeGuidanceSection from '@/components/user/home/HomeGuidanceSection.vue';
import HomeKnowledgeSection from '@/components/user/home/HomeKnowledgeSection.vue';
import HomeBanners from '@/components/user/home/HomeBanners.vue';
import HomeFinalCta from '@/components/user/home/HomeFinalCta.vue';
import HomeBenefitsSection from '@/components/user/home/HomeBenefitsSection.vue';
</script>
<template>
  <div class="site-content home-page sage-home">
    <HomeSageHero />
    <HomeHeroSlider />
    <HomeCategorySection />
    <HomeVoucherSection />
    
    <HomeProductSection />
    <HomeBenefitsSection />
    <HomeBanners position="home_middle" />
    <HomeGuidanceSection />
    <HomeKnowledgeSection />
    <HomeBanners position="home_bottom" />
    <HomeFinalCta />
  </div>
</template>
