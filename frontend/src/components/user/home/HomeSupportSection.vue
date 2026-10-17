<script setup>
import { inject } from 'vue';
import SageButton from '@/components/user/sage/SageButton.vue';
import SageIcon from '@/components/user/sage/SageIcon.vue';
const openSupport = inject('client-support', null);
</script>
<template>
  <section class="home-sage-section home-support" aria-labelledby="home-support-title">
    <div class="container">
      <div class="section-heading">
        <div><span class="eyebrow">Hỗ trợ</span><h2 id="home-support-title">Bắt đầu bằng một câu hỏi.</h2></div>
        <SageButton v-if="openSupport" variant="secondary" @click="openSupport">Mở trợ lý sản phẩm <SageIcon name="arrow-up-right" /></SageButton>
        <RouterLink v-else to="/contact" class="sage-button sage-button--secondary">Liên hệ cửa hàng</RouterLink>
      </div>
      <p class="home-support-lead">Tìm theo từ khóa và mở thông tin sản phẩm liên quan. Trợ lý AI hỗ trợ tra cứu; kết quả chỉ để tham khảo.</p>
    </div>
  </section>
</template>
