<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { Swiper, SwiperSlide } from "swiper/vue";
import { Navigation } from "swiper/modules";
import { useAuthStore } from "@/stores/user/auth";
import { useCartStore } from "@/stores/user/cart";
import { useWishlistStore } from "@/stores/user/wishlist";
import productService from "@/services/product.service";
import categoryService from "@/services/category.service";

import "swiper/css";
import "swiper/css/navigation";

const cartStore = useCartStore();
const wishlistStore = useWishlistStore();
const authStore = useAuthStore();
const modules = [Navigation];
const activeCategory = ref("all");
const categories = ref([]);
const products = ref([]);

async function fetchCategories() {
  const catRes = await categoryService.getAll();
  categories.value = [
    {
      _id: "all",
      name: "Tất Cả",
      image_url: "/img/product/product-category-0.png",
    },
    ...(catRes || []),
  ];
}

async function fetchProductsByCategory() {
  try {
    if (activeCategory.value === "all") {
      const productRes = await productService.getAll();
      products.value = (productRes.data || []).slice(0, 20);
    } else {
      const productRes = await productService.getByCategory(
        activeCategory.value,
      );
      products.value = (productRes.data || []).slice(0, 20);
    }
  } catch (error) {
    console.error(error.message);
  }
}

async function fetchData() {
  try {
    await fetchCategories();
    await fetchProductsByCategory();
  } catch (error) {
    console.error(error.message);
  }
}

const filteredProducts = computed(() => {
  if (activeCategory.value === "all") return products.value;
  return products.value.filter(
    (item) => String(item.category_id) === String(activeCategory.value),
  );
});

async function addToCart(productId) {
  if (!authStore.userId) {
    alert("Vui lòng đăng nhập để thêm vào giỏ hàng");
    return;
  }

  const product = products.value.find(
    (item) => String(item._id) === String(productId),
  );

  if (Number(product.stock) <= 0) {
    alert("Sản phẩm đã hết hàng");
    return;
  }

  await cartStore.addToCart(authStore.userId, productId, 1);
  alert("Đã thêm sản phẩm vào giỏ hàng");
}

async function toggleWishlistItem(productId) {
  if (!authStore.userId) return alert("Vui lòng đăng nhập");

  try {
    const res = await wishlistStore.toggleWishlist(authStore.userId, productId);
    alert(res.message);
  } catch (error) {
    alert(error.message);
  }
}

watch(activeCategory, fetchProductsByCategory);

onMounted(fetchData);
</script>

<template>
  <div class="section products-block product-tab tab-2">
    <div class="block-title">
      <h2 class="title"><span>Sản Phẩm</span> Mới</h2>
      <div class="sub-title">Sản phẩm mới nhất của cửa hàng</div>
    </div>

    <div class="block-content">
      <div class="container">
        <div class="tab-nav">
          <ul>
            <li
              v-for="category in categories"
              :key="category._id"
              :class="{ active: activeCategory === category._id }"
            >
              <a href="#" @click.prevent="activeCategory = category._id">
                <img
                  :src="category.image_url"
                  :alt="category.name"
                  style="width: 50px; height: 30px"
                />
                <span>{{ category.name }}</span>
              </a>
            </li>
          </ul>
        </div>

        <div class="tab-content">
          <div class="tab-pane fade in active">
            <Swiper
              :modules="modules"
              :slides-per-view="4"
              :space-between="20"
              :navigation="true"
              :breakpoints="{
                0: { slidesPerView: 1 },
                576: { slidesPerView: 2 },
                992: { slidesPerView: 3 },
                1200: { slidesPerView: 4 },
              }"
              class="products-swiper"
            >
              <SwiperSlide v-for="product in products" :key="product._id">
                <div class="product-item">
                  <div class="product-image">
                    <router-link :to="`/products/${product._id}`">
                      <img :src="product.thumbnail" alt="Product Image" />
                    </router-link>
                  </div>

                  <div class="product-title">
                    <router-link :to="`/products/${product._id}`">
                      {{ product.name }}
                    </router-link>
                  </div>

                  <div class="product-rating">
                    <div
                      v-for="star in 5"
                      :key="star"
                      class="star"
                      :class="{
                        on: star <= Math.round(product.average_rating || 5),
                      }"
                    ></div>
                  </div>

                  <div class="product-price">
                    <span class="sale-price">
                      {{ Number(product.price).toLocaleString("vi-VN") }} đ
                    </span>
                  </div>

                  <div class="product-buttons">
                    <a
                      class="add-to-cart"
                      href="#"
                      @click.prevent="addToCart(product._id)"
                    >
                      <i class="fa fa-shopping-basket" aria-hidden="true"></i>
                    </a>

                    <a
                      class="add-wishlist"
                      href="#"
                      @click.prevent="toggleWishlistItem(product._id)"
                    >
                      <i
                        class="fa fa-heart"
                        aria-hidden="true"
                        :style="{
                          color: wishlistStore.isInWishlist(product._id)
                            ? 'red'
                            : '',
                        }"
                      ></i>
                    </a>

                    <router-link
                      class="quickview"
                      :to="`/products/${product._id}`"
                    >
                      <i class="fa fa-eye" aria-hidden="true"></i>
                    </router-link>
                  </div>
                </div>
              </SwiperSlide>
            </Swiper>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
