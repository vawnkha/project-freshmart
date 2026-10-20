<script setup>
import { computed, onMounted, onBeforeUnmount, ref } from 'vue';
import discountService from '@/services/discount.service';
import { useHomeResource } from '@/composables/useHomeResource';
import { useVoucherCarousel } from '@/composables/useVoucherCarousel';
import VoucherCard from './VoucherCard.vue';
import AppState from '@/components/user/common/AppState.vue';
const { data: vouchers, loading, error, load: loadVouchers } = useHomeResource(
  () => discountService.getPublic(), 'Ưu đãi tạm thời chưa tải được. Vui lòng thử lại.');
const notice = ref('');
let expiryRefresh;
onMounted(() => { expiryRefresh = setInterval(loadVouchers, 60000); expiryRefresh.unref?.(); });
onBeforeUnmount(() => clearInterval(expiryRefresh));
const rail = ref(null), previous = ref(null), next = ref(null);
const { canPrevious, canNext, move } = useVoucherCarousel(rail, previous, next, computed(() => vouchers.value.length));
</script>
<template>
  <section v-if="loading || error || vouchers.length" class="home-vouchers" :aria-busy="loading" aria-labelledby="home-voucher-title">
    <div class="container">
      <div class="home-voucher-heading">
        <h2 id="home-voucher-title">Danh sách mã giảm giá</h2>
        <div v-if="vouchers.length && !loading && !error" class="home-voucher-controls" aria-label="Điều hướng mã giảm giá">
          <button ref="previous" type="button" class="sage-button sage-button--secondary sage-icon-button" aria-label="Mã giảm giá trước" :disabled="!canPrevious" @click="move(-1)"><i class="fa-solid fa-arrow-left" aria-hidden="true"></i></button>
          <button ref="next" type="button" class="sage-button sage-button--secondary sage-icon-button" aria-label="Mã giảm giá tiếp theo" :disabled="!canNext" @click="move(1)"><i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button>
        </div>
      </div>
      <template v-if="loading">
        <p class="home-sr-only" role="status">Đang tải mã giảm giá...</p>
        <div class="home-voucher-loading" aria-hidden="true"><div v-for="index in 4" :key="index" class="home-voucher-skeleton"><div class="home-skeleton-line"></div><div class="home-skeleton-line"></div></div></div>
      </template>
      <AppState v-else-if="error" kind="error" :title="error" retry @retry="loadVouchers" />
      <div v-else ref="rail" class="home-voucher-rail" tabindex="0" role="region" aria-label="Mã giảm giá có thể cuộn ngang" aria-describedby="home-voucher-help">
        <VoucherCard v-for="voucher in vouchers" :key="voucher._id || voucher.code" :voucher="voucher" @notice="notice = $event" />
      </div>
      <p id="home-voucher-help" class="home-voucher-help">Kéo hoặc vuốt để xem thêm. Khi chọn vùng mã giảm giá bằng bàn phím, dùng phím mũi tên để di chuyển.</p>
      <p class="voucher-notice" role="status" aria-live="polite" aria-atomic="true">{{ notice }}</p>
    </div>
  </section>
</template>
