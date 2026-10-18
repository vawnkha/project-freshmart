<script setup>
import { ref, provide, onMounted, onBeforeUnmount, watch, nextTick } from "vue";
import { useRoute } from "vue-router";
import "@/assets/css/user/storefront.css";
import UserHeader from "@/components/user/layout/UserHeader.vue";
import UserFooter from "@/components/user/layout/UserFooter.vue";
import AiChatBox from "@/components/user/chat/AiChatBox.vue";
import { storefrontNotice } from "@/composables/useStorefrontNotice";
import { useFormAccessibility } from "@/composables/useFormAccessibility";
import { useStorefrontMotion } from "@/composables/useStorefrontMotion";
const storefrontRoot = ref(null);
const header = ref(null);
const main = ref(null);
const support = ref(null);
provide('client-support', () => support.value?.open());
useFormAccessibility(storefrontRoot);
const motion = useStorefrontMotion(storefrontRoot);
const showGoUp = ref(false);
const route = useRoute();
let focusVersion = 0;
watch(() => route.fullPath, async (path, previous) => {
  const current = ++focusVersion;
  await header.value?.closeShell();
  await nextTick();
  if (current === focusVersion && main.value?.isConnected) {
    main.value.focus({ preventScroll: true });
    // Animate only a new page, never a filter/query update. The existing
    // motion runtime owns reduced-motion and animation cleanup.
    if (path.split(/[?#]/)[0] !== previous?.split(/[?#]/)[0]) motion.enterPage(main.value);
  }
}, { flush: 'post' });
watch(
  () => route.path,
  () => window.scrollTo({ top: 0, behavior: "instant" }),
);
const handleScroll = () => {
  showGoUp.value = window.scrollY > 500;
};
const scrollToTop = () => window.scrollTo({
  top: 0,
  behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
});
onMounted(() =>
  window.addEventListener("scroll", handleScroll, { passive: true }),
);
onBeforeUnmount(() => { ++focusVersion; window.removeEventListener("scroll", handleScroll); });
</script>
<template>
  <div class="user-app sage-storefront" ref="storefrontRoot">
    <a href="#main-content" class="skip-link">Đi đến nội dung</a>
    <UserHeader ref="header" />
    <main id="main-content" ref="main" tabindex="-1"><router-view /></main>
    <UserFooter /><AiChatBox ref="support" />
    <div
      v-if="storefrontNotice"
      class="store-notice"
      :class="storefrontNotice.type"
      role="status"
    >
      <i class="fa-solid fa-circle-info" aria-hidden="true"></i
      ><span>{{ storefrontNotice.message }}</span
      ><button aria-label="Đóng thông báo" @click="storefrontNotice = null">
        ×
      </button>
    </div>
    <button
      v-show="showGoUp"
      class="back-top"
      aria-label="Về đầu trang"
      @click="scrollToTop"
    >
      <i class="fa-solid fa-arrow-up" aria-hidden="true"></i>
    </button>
  </div>
</template>
