<script setup>
import AquacultureVisual from './AquacultureVisual.vue';
import { ref } from 'vue';
const failed = ref(false);
const illustration = new URL('../../../assets/images/user/approved-home/guidance.svg', import.meta.url).href;
</script>
<template>
  <section class="home-sage-section home-sage-guidance" aria-labelledby="home-guide-title">
    <div class="container">
      <div class="home-sage-guide-panel reveal">
        <figure class="home-sage-guide-visual"><img v-if="!failed" :src="illustration" width="900" height="600" loading="lazy" decoding="async" alt="Minh họa checklist tra cứu thông tin, không phải chứng nhận hoặc ảnh cơ sở" @error="failed = true"><AquacultureVisual v-else /></figure>
        <div class="home-sage-guide-copy">
          <p class="home-sage-eyebrow">Góc tham khảo</p><h2 id="home-guide-title">Hiểu thông tin.<br>Chọn có cơ sở.</h2>
          <p>Thông tin sản phẩm và nhu cầu thực tế của ao nuôi là điểm bắt đầu. Tra cứu công dụng, đơn vị bán và hướng dẫn sử dụng được cung cấp trên từng sản phẩm.</p>
          <div class="home-sage-guide-actions"><RouterLink to="/blog" class="sage-button">Đọc kiến thức <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></RouterLink></div>
          <p class="home-sage-guide-note">Minh họa quy trình tra cứu thông tin, không phải ảnh cơ sở.</p>
        </div>
      </div>
    </div>
  </section>
</template>
