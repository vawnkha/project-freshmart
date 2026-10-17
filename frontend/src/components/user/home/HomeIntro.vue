<script setup>
import AquacultureVisual from "./AquacultureVisual.vue";
</script>
<template>
  <section class="store-section brand-band">
    <div class="container">
      <div class="intro-panel">
        <AquacultureVisual />
        <div>
          <span class="eyebrow">Cùng hiểu, cùng chăm sóc</span>
          <h2>Mỗi ao nuôi,<br />một giải pháp phù hợp.</h2>
          <p>
            Khám phá chế phẩm sinh học và các sản phẩm phục vụ nuôi tôm tại
            FreshMart. Tìm hiểu thông tin sản phẩm, tham khảo kiến thức và lựa
            chọn theo nhu cầu thực tế của ao nuôi.
          </p>
          <router-link to="/about" class="text-link"
            >Tìm hiểu về chúng tôi
            <i class="fa-solid fa-arrow-right" aria-hidden="true"></i
          ></router-link>
          <div class="intro-points">
            <div>
              <i class="fa-solid fa-leaf" aria-hidden="true"></i
              ><strong>Giải pháp sinh học</strong>
            </div>
            <div>
              <i class="fa-solid fa-water" aria-hidden="true"></i
              ><strong>Chăm sóc môi trường</strong>
            </div>
            <div>
              <i class="fa-solid fa-book-open" aria-hidden="true"></i
              ><strong>Kiến thức ao nuôi</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
