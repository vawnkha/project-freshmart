<script setup>
import { useCatalog } from '@/composables/useCatalog';
const { categories } = useCatalog();
</script>
<template>
  <footer class="store-footer shell-footer">
    <div class="container">
      <div class="shell-footer-grid">
        <div class="shell-footer-intro"><router-link to="/" class="shell-footer-brand">FreshMart</router-link><p>Chế phẩm sinh học, thông tin sản phẩm và kiến thức cho ao nuôi.</p></div>
        <nav aria-label="Sản phẩm ở chân trang"><h3>Khám phá sản phẩm</h3><router-link v-for="category in categories.slice(0, 5)" :key="category._id" :to="{ path: '/products', query: { category_id: category._id } }">{{ category.name }}</router-link><router-link to="/products">Tất cả sản phẩm</router-link></nav>
        <nav aria-label="Tài khoản ở chân trang"><h3>Dành cho bạn</h3><router-link to="/profile">Tài khoản & đơn hàng</router-link><router-link to="/wishlist">Sản phẩm yêu thích</router-link><router-link to="/cart">Giỏ hàng</router-link><router-link to="/login">Đăng nhập</router-link><router-link to="/register">Đăng ký</router-link></nav>
        <nav aria-label="Thông tin ở chân trang"><h3>Thông tin & hỗ trợ</h3><router-link to="/blog">Kiến thức & tin tức</router-link><router-link to="/about">Giới thiệu</router-link><router-link to="/contact">Liên hệ</router-link><p class="shell-footer-note">Trao đổi nhu cầu sản phẩm qua trang liên hệ.</p></nav>
      </div>
      <div class="shell-wordmark" aria-hidden="true">FRESHMART</div>
      <div class="shell-footer-bottom"><span>© {{ new Date().getFullYear() }} FreshMart</span><span>Sinh học · Môi trường · Thủy sản</span></div>
    </div>
  </footer>
</template>
