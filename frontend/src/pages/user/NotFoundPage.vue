<script setup>
import { ref } from "vue";
import { useStorefrontMotion } from "@/composables/useStorefrontMotion";
import "@/assets/css/user/storefront.css";
import UserHeader from "@/components/user/layout/UserHeader.vue";
import UserFooter from "@/components/user/layout/UserFooter.vue";
import AppState from "@/components/user/common/AppState.vue";
import PageHeading from "@/components/user/common/PageHeading.vue";
const storefrontRoot = ref(null);
useStorefrontMotion(storefrontRoot);
</script>
<template>
  <div class="user-app sage-storefront" ref="storefrontRoot">
    <a href="#main-content" class="skip-link">Đi đến nội dung</a>
    <UserHeader />
    <main id="main-content" tabindex="-1" class="site-content approved-not-found">
      <PageHeading title="Không tìm thấy trang" breadcrumb-title="404" />
      <div class="container">
      <AppState
        title="Đường dẫn không còn ở đây."
        heading-tag="h2"
        description="Đường dẫn có thể đã thay đổi. Hãy quay về trang chủ để tiếp tục."
        to="/"
        action="Về trang chủ"
      />
      </div>
    </main>
    <UserFooter />
  </div>
</template>
