<script setup>
import { ref, provide, onBeforeUnmount, watch, nextTick } from "vue";
import { useRoute } from "vue-router";
import "@/assets/css/user/storefront.css";
import UserHeader from "@/components/user/layout/UserHeader.vue";
import UserFooter from "@/components/user/layout/UserFooter.vue";
import ComparisonBar from '@/components/user/product/ComparisonBar.vue';
import { useChatWidgetStore } from "@/stores/chat-widget";
import { storefrontNotice } from "@/composables/useStorefrontNotice";
import { useFormAccessibility } from "@/composables/useFormAccessibility";
import { useStorefrontMotion } from "@/composables/useStorefrontMotion";
const storefrontRoot = ref(null);
const header = ref(null);
const main = ref(null);
const chatWidget = useChatWidgetStore();
provide('client-support', () => chatWidget.open('ai'));
provide('client-live-support', () => chatWidget.open('support'));
useFormAccessibility(storefrontRoot);
const motion = useStorefrontMotion(storefrontRoot);
const route = useRoute();
let focusVersion = 0;
watch(() => route.fullPath, async (path, previous) => {
  const current = ++focusVersion;
  await header.value?.closeShell();
  await nextTick();
  // Live catalog query changes must preserve the checkbox/input or open drawer focus.
  const liveCatalogQuery = path.split(/[?#]/)[0] === previous?.split(/[?#]/)[0] && main.value?.querySelector('.sage-catalog');
  if (current === focusVersion && main.value?.isConnected && !liveCatalogQuery) {
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
onBeforeUnmount(() => { ++focusVersion; });
</script>
<template>
  <div class="user-app sage-storefront" ref="storefrontRoot">
    <a href="#main-content" class="skip-link">Đi đến nội dung</a>
    <UserHeader ref="header" />
    <main id="main-content" ref="main" tabindex="-1"><router-view /></main>
    <UserFooter />
    <ComparisonBar />
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

  </div>
</template>
