<script setup>
import PageHeading from "@/components/user/common/PageHeading.vue";
import ResponsiveImage from "@/components/user/common/ResponsiveImage.vue";
const photo = new URL('../../assets/images/user/approved-home/mangroves-photo.jpg', import.meta.url).href;
</script>
<template>
  <div class="site-content sage-about">
    <PageHeading
      title="Chọn kỹ. Hiểu rõ."
      description="Không gian mua sắm dành cho người tìm hiểu chế phẩm sinh học cho tôm."
    />
    <div class="container">
      <section class="approved-about-story">
        <div class="approved-about-prose">
          <h2>Từ thông tin đến lựa chọn.</h2>
          <p>Khám phá chế phẩm sinh học và các sản phẩm phục vụ nuôi tôm tại FreshMart. Tìm hiểu thông tin sản phẩm, tham khảo kiến thức và lựa chọn theo nhu cầu thực tế của ao nuôi.</p>
          <p>Tìm kiếm theo danh mục, tham khảo thông tin sản phẩm và theo dõi đơn hàng ngay trên website. Nếu cần trao đổi thêm về nhu cầu ao nuôi, hãy gửi yêu cầu qua trang liên hệ.</p>
          <ul class="approved-about-points">
            <li><h3>Tra cứu sản phẩm</h3><p>Khám phá các nhóm sản phẩm đang có trong cửa hàng.</p></li>
            <li><h3>Kiểm tra thông tin</h3><p>Xem giá và tình trạng còn hàng trước khi thêm vào giỏ.</p></li>
            <li><h3>Tham khảo kiến thức</h3><p>Đọc bài viết liên quan để tìm hiểu thêm về ao nuôi.</p></li>
          </ul>
          <RouterLink to="/products" class="sage-button">Khám phá sản phẩm <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></RouterLink>
        </div>
        <figure>
          <ResponsiveImage :src="photo" alt="Ao nuôi tại Bangladesh — ảnh bối cảnh, không phải cơ sở FreshMart" width="1280" height="853" />
          <figcaption>Ảnh: Amdadphoto · CC BY-SA 4.0. <a href="https://commons.wikimedia.org/wiki/File:Shrimp_Farm_by_the_Mangroves.jpg" target="_blank" rel="noopener noreferrer">Nguồn ảnh và giấy phép</a>.</figcaption>
        </figure>
      </section>
      <div class="approved-about-cta">
        <div><span class="eyebrow">Cùng tìm hiểu</span><h2>Một câu hỏi rõ ràng là điểm bắt đầu.</h2></div>
        <RouterLink to="/contact" class="sage-button sage-button--secondary">Liên hệ với chúng tôi <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></RouterLink>
      </div>
    </div>
  </div>
</template>
