<script setup>
import { ref, nextTick, watch } from 'vue';
import { useRoute } from 'vue-router';
import UserHeader from '@/components/user/layout/UserHeader.vue';
import UserFooter from '@/components/user/layout/UserFooter.vue';
import PageHeading from '@/components/user/common/PageHeading.vue';
import SageButton from '@/components/user/sage/SageButton.vue';
import { useAuthStore } from '@/stores/user/auth';
import { useCartStore } from '@/stores/user/cart';
defineProps({ toggleFailure: Function });
const route = useRoute(), auth = useAuthStore(), cart = useCartStore();
const header = ref(null), main = ref(null), failure = ref(false);
watch(() => route.fullPath, async () => { await header.value?.closeShell(); await nextTick(); main.value?.focus(); });
async function load() { await cart.fetchCart(auth.userId); }
</script>
<template>
  <div class="user-app sage-storefront">
    <a href="#main-content" class="skip-link">Đi đến nội dung</a>
    <UserHeader ref="header" />
    <main ref="main" id="main-content" tabindex="-1">
      <PageHeading title="QA shell Client — Fixture cô lập" />
      <section class="container store-section shell-qa-content">
        <p>Chỉ kiểm thử phát triển. Dữ liệu, tài khoản và API response đều là fixture; không ghi database hoặc thu tiền. Chạy tại origin QA riêng.</p>
        <p>Route trong harness: {{ route.fullPath }}</p>
        <div class="button-row"><SageButton @click="load">Tải giỏ hàng fixture</SageButton><SageButton variant="secondary" @click="failure = toggleFailure()">{{ failure ? 'Khôi phục API fixture' : 'Mô phỏng lỗi API' }}</SageButton></div>
      </section>
    </main>
    <UserFooter />
  </div>
</template>
<style scoped>
.user-app.sage-storefront .shell-qa-content p { overflow-wrap: anywhere; }
.user-app.sage-storefront .shell-qa-content .button-row { display: flex; flex-wrap: wrap; gap: var(--space-3); }
</style>
