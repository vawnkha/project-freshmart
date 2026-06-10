<script setup>
import { computed, reactive, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useCartStore } from "@/stores/user/cart";
import { useWishlistStore } from "@/stores/user/wishlist";
import { useAuthStore } from "@/stores/user/auth";
import productService from "@/services/product.service";
import reviewService from "@/services/review.service";

import { Swiper, SwiperSlide } from "swiper/vue";
import { Autoplay, Navigation } from "swiper/modules";

import "swiper/css";
import "swiper/css/navigation";

const route = useRoute();
const cartStore = useCartStore();
const wishlistStore = useWishlistStore();
const authStore = useAuthStore();

const loading = ref(false);
const product = ref(null);
const relatedProducts = ref([]);
const reviews = ref([]);
const reviewStars = ref({ total_reviews: 0, average_rating: 0 });
const canReview = ref(false);
const canReviewMessage = ref("");
const quantity = ref(1);
const selectedImage = ref("");
const activeTab = ref("description");

const reviewForm = reactive({
  rating: 5,
  comment: "",
});

const swiperModules = [Navigation];
const relatedSwiperModules = [Navigation, Autoplay];

const productId = computed(() => route.params.id);
const isLoved = computed(() => wishlistStore.isInWishlist(productId.value));

const productGallery = computed(() => {
  if (!product.value) return [];
  return [
    ...new Set(
      [product.value.thumbnail, ...(product.value.images || [])].filter(
        Boolean,
      ),
    ),
  ];
});

async function fetchProductDetail() {
  loading.value = true;
  try {
    const data = await productService.getById(productId.value);
    product.value = data;
    selectedImage.value = data.thumbnail || "";

    try {
      const reviewRes = await reviewService.getByProduct(productId.value);
      reviews.value = reviewRes.reviews || [];
      reviewStars.value = reviewRes.stars || {
        total_reviews: 0,
        average_rating: 0,
      };
    } catch (error) {
      reviews.value = [];
      reviewStars.value = {
        total_reviews: 0,
        average_rating: 0,
      };
    }

    if (authStore.userId) {
      const permission = await reviewService.canReview(
        authStore.userId,
        productId.value,
      );
      canReview.value = !!permission.canReview;
      canReviewMessage.value = permission.message || "";
    }

    if (data.category_id) {
      const related = await productService.getByCategory(data.category_id);

      let list = related.data || [];

      list = list.filter((item) => String(item._id) !== String(data._id));

      if (list.length < 8) {
        const fallback = await productService.getAll();

        list = [
          ...list,
          ...(fallback.data || []).filter(
            (item) =>
              String(item._id) !== String(data._id) &&
              !list.some((p) => String(p._id) === String(item._id)),
          ),
        ];
      }

      relatedProducts.value = list.slice(0, 8);
    }
  } catch (error) {
    alert(error.message);
  } finally {
    loading.value = false;
  }
}

function changeImage(image) {
  selectedImage.value = image;
}
function increaseQty() {
  if (quantity.value < Number(product.value.stock || 0)) {
    quantity.value++;
  }
}
function decreaseQty() {
  if (quantity.value > 1) {
    quantity.value--;
  }
}

async function addCurrentProductToCart() {
  if (!authStore.userId) {
    alert("Vui lÃ²ng Ä‘Äƒng nháº­p Ä‘á»ƒ thÃªm vÃ o giá» hÃ ng");
    return;
  }

  if (!product.value || Number(product.value.stock || 0) <= 0) {
    alert("Sáº£n pháº©m Ä‘Ã£ háº¿t hÃ ng");
    return;
  }

  try {
    await cartStore.addToCart(
      authStore.userId,
      product.value._id,
      quantity.value,
    );
    alert("ÄÃ£ thÃªm sáº£n pháº©m vÃ o giá» hÃ ng");
  } catch (error) {
    alert(error.message);
  }
}

async function toggleWishlist() {
  if (!authStore.userId) {
    alert("Vui lÃ²ng Ä‘Äƒng nháº­p Ä‘á»ƒ thÃªm vÃ o yÃªu thÃ­ch");
    return;
  }

  try {
    const result = await wishlistStore.toggleWishlist(
      authStore.userId,
      productId.value,
    );
    alert(result.message);
  } catch (error) {
    alert(error.message);
  }
}

async function submitReview() {
  if (!authStore.userId) {
    alert("Vui lÃ²ng Ä‘Äƒng nháº­p Ä‘á»ƒ Ä‘Ã¡nh giÃ¡");
    return;
  }

  if (!canReview.value) {
    alert(canReviewMessage.value || "Báº¡n chÆ°a thá»ƒ Ä‘Ã¡nh giÃ¡ sáº£n pháº©m nÃ y");
    return;
  }

  if (!reviewForm.comment.trim()) {
    alert("Vui lÃ²ng nháº­p ná»™i dung Ä‘Ã¡nh giÃ¡");
    return;
  }

  try {
    await reviewService.create({
      user_id: authStore.userId,
      product_id: productId.value,
      rating: reviewForm.rating,
      comment: reviewForm.comment.trim(),
    });

    reviewForm.rating = 5;
    reviewForm.comment = "";
    activeTab.value = "review";
    await fetchProductDetail();
    alert("ÄÃ¡nh giÃ¡ sáº£n pháº©m thÃ nh cÃ´ng");
  } catch (error) {
    alert(error.message);
  }
}

function setReviewRating(star) {
  reviewForm.rating = star;
}

async function addToCart(productId) {
  if (!authStore.userId) {
    alert("Vui lÃ²ng Ä‘Äƒng nháº­p");
    return;
  }

  await cartStore.addToCart(authStore.userId, productId, 1);
}

async function toggleWishlistItem(productId) {
  if (!authStore.userId) return alert("Vui lÃ²ng Ä‘Äƒng nháº­p");

  try {
    const res = await wishlistStore.toggleWishlist(authStore.userId, productId);
    alert(res.message);
  } catch (error) {
    alert(error.message);
  }
}

watch(
  () => route.params.id,
  () => {
    quantity.value = 1;
    activeTab.value = "description";
    fetchProductDetail();
  },
  { immediate: true },
);

function printPage() {
  window.print();
}
</script>

<template>
  <div id="content" class="site-content">
    <!-- Breadcrumb -->
    <div v-if="product">
      <div id="breadcrumb">
        <div class="container">
          <h2 class="title">{{ product.name }}</h2>

          <ul class="breadcrumb">
            <li><router-link to="/">Trang Chá»§</router-link></li>
            <li><router-link to="/products">Sáº£n Pháº©m</router-link></li>
            <li>
              <span>{{ product.name }}</span>
            </li>
          </ul>
        </div>
      </div>

      <div class="container">
        <div class="product-detail">
          <div class="products-block layout-5">
            <div class="product-item">
              <div class="product-title">{{ product.name }}</div>

              <div class="row">
                <div class="product-left col-md-4 col-sm-4 col-xs-12">
                  <div class="product-image horizontal">
                    <div class="main-image">
                      <img
                        class="img-responsive"
                        :src="selectedImage"
                        :alt="product.name"
                      />
                    </div>
                    <div class="thumb-images thumb-swiper-wrapper">
                      <Swiper
                        :modules="swiperModules"
                        :slides-per-view="4"
                        :space-between="10"
                        :navigation="true"
                        class="thumb-swiper"
                        :breakpoints="{
                          0: { slidesPerView: 2 },
                          576: { slidesPerView: 3 },
                          768: { slidesPerView: 4 },
                        }"
                      >
                        <SwiperSlide
                          v-for="(image, index) in productGallery"
                          :key="index"
                        >
                          <div
                            class="thumb-item"
                            :class="{ active: selectedImage === image }"
                            @click="changeImage(image)"
                          >
                            <img
                              class="img-responsive"
                              :src="image"
                              :alt="product.name"
                            />
                          </div>
                        </SwiperSlide>
                      </Swiper>
                    </div>
                  </div>
                </div>

                <div class="product-right col-md-5 col-sm-4 col-xs-12">
                  <div class="product-info">
                    <div class="product-price">
                      <span class="sale-price"
                        >{{ Number(product.price).toLocaleString("vi-VN") }} Ä‘ /
                        {{ product.unit }}</span
                      >
                    </div>

                    <div class="product-stock">
                      <span class="availability">TÃ¬nh Tráº¡ng :</span
                      ><i class="fa fa-check-square-o" aria-hidden="true"></i>
                      {{ product.stock > 0 ? "CÃ²n HÃ ng" : "Háº¿t HÃ ng" }}
                    </div>

                    <div class="product-short-description">
                      {{ product.description }}
                    </div>

                    <div class="product-info-options border-bottom">
                      <div class="product-info-options-item"></div>

                      <div class="product-info-options-item"></div>
                    </div>

                    <div class="product-add-to-cart border-bottom">
                      <div class="product-quantity">
                        <span class="control-label">SL :</span>
                        <div class="qty">
                          <div class="input-group">
                            <input :value="quantity" data-min="1" readonly />
                            <span class="adjust-qty">
                              <span class="adjust-btn plus" @click="increaseQty"
                                >+</span
                              >
                              <span
                                class="adjust-btn minus"
                                @click="decreaseQty"
                                >-</span
                              >
                            </span>
                          </div>
                        </div>
                      </div>

                      <div class="product-buttons" style="margin-right: 20px">
                        <a
                          class="add-to-cart"
                          href="#"
                          @click.prevent="addCurrentProductToCart"
                        >
                          <i
                            class="fa fa-shopping-basket"
                            aria-hidden="true"
                          ></i>
                          <span>ThÃªm giá» hÃ ng</span>
                        </a>
                        <a
                          class="add-wishlist"
                          href="#"
                          @click.prevent="toggleWishlist"
                        >
                          <i
                            class="fa fa-heart"
                            :style="{ color: isLoved ? 'red' : '' }"
                            aria-hidden="true"
                          ></i>
                        </a>
                      </div>
                    </div>

                    <div class="product-share border-bottom">
                      <div class="item">
                        <a href="#" @click.prevent
                          ><i class="zmdi zmdi-share" aria-hidden="true"></i
                          ><span class="text">Chia sáº»</span></a
                        >
                      </div>
                      <div class="item">
                        <a href="#" @click.prevent
                          ><i class="zmdi zmdi-email" aria-hidden="true"></i
                          ><span class="text">Gá»­i cho báº¡n bÃ¨</span></a
                        >
                      </div>
                      <div class="item">
                        <a href="#" @click.prevent="printPage"
                          ><i class="zmdi zmdi-print" aria-hidden="true"></i
                          ><span class="text">In</span></a
                        >
                      </div>
                    </div>

                    <div class="product-review border-bottom">
                      <div class="item">
                        <div class="product-quantity">
                          <span class="control-label">ÄÃ¡nh GiÃ¡:</span>
                          <div class="product-rating">
                            <div
                              v-for="star in 5"
                              :key="star"
                              class="star"
                              :class="{
                                on:
                                  star <=
                                  Math.round(reviewStars.average_rating || 5),
                              }"
                            ></div>
                          </div>
                        </div>
                      </div>

                      <div class="item">
                        <a href="#" @click.prevent="activeTab = 'review'"
                          ><i class="zmdi zmdi-comments" aria-hidden="true"></i
                          ><span class="text"
                            >Äá»c ÄÃ¡nh GiÃ¡ ({{ reviews.length }})</span
                          ></a
                        >
                      </div>

                      <div class="item">
                        <a href="#" @click.prevent="activeTab = 'review'"
                          ><i class="zmdi zmdi-edit" aria-hidden="true"></i
                          ><span class="text">Viáº¿t ÄÃ¡nh GiÃ¡</span></a
                        >
                      </div>
                    </div>

                    <div class="product-extra">
                      <div class="item">
                        <!-- <span class="control-label">Review :</span
                          ><span class="control-label">E-02154</span> -->
                      </div>
                      <div class="item">
                        <span class="control-label">Danh Má»¥c :</span>
                        <a href="#">{{ product.category_name }}</a>
                      </div>
                      <div class="item">
                        <!-- <span class="control-label">Tags :</span>
                          <a href="#" title="Vegetables">Hot Trend,</a>
                          <a href="#" title="Fruits">Summer</a> -->
                      </div>
                    </div>
                  </div>
                </div>

                <div class="payment-intro col-md-3 col-sm-4 col-xs-12">
                  <div class="block-content">
                    <div class="item">
                      <img
                        class="img-responsive"
                        src="/img/home2-payment-1.png"
                        alt="Payment Intro"
                      />
                      <h3 class="title">Miá»…n phÃ­ váº­n chuyá»ƒn</h3>
                      <div class="content">
                        Sáº£n pháº©m cháº¥t lÆ°á»£ng cao vá»›i dá»‹ch vá»¥ giao hÃ ng nhanh
                        chÃ³ng vÃ  uy tÃ­n trÃªn toÃ n quá»‘c.
                      </div>
                    </div>
                    <div class="item">
                      <img
                        class="img-responsive"
                        src="/img/home2-payment-2.png"
                        alt="Payment Intro"
                      />
                      <h3 class="title">Thanh toÃ¡n báº£o máº­t</h3>
                      <div class="content">
                        Cam káº¿t báº£o máº­t thÃ´ng tin thanh toÃ¡n vÃ  Ä‘a dáº¡ng cÃ¡c
                        phÆ°Æ¡ng thá»©c tráº£ tiá»n an toÃ n.
                      </div>
                    </div>
                    <div class="item">
                      <img
                        class="img-responsive"
                        src="/img/home2-payment-3.png"
                        alt="Payment Intro"
                      />
                      <h3 class="title">HoÃ n tiá»n 100%</h3>
                      <div class="content">
                        Cam káº¿t hoÃ n tráº£ chi phÃ­ náº¿u sáº£n pháº©m khÃ´ng Ä‘Ãºng mÃ´ táº£
                        hoáº·c gáº·p lá»—i tá»« nhÃ  sáº£n xuáº¥t.
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="product-tab">
                <!-- Tab Navigation -->
                <div class="tab-nav">
                  <ul>
                    <li :class="{ active: activeTab === 'description' }">
                      <a href="#" @click.prevent="activeTab = 'description'">
                        <span>MÃ´ Táº£</span>
                      </a>
                    </li>

                    <li :class="{ active: activeTab === 'review' }">
                      <a href="#" @click.prevent="activeTab = 'review'">
                        <span>ÄÃ¡nh GiÃ¡</span>
                      </a>
                    </li>
                  </ul>
                </div>

                <!-- Tab Content -->
                <div class="tab-content">
                  <!-- Description -->
                  <div
                    v-if="activeTab === 'description'"
                    role="tabpanel"
                    class="tab-pane fade in active"
                    id="description"
                  >
                    <p>
                      {{ product.description }}
                    </p>
                  </div>

                  <!-- Review -->
                  <div
                    v-if="activeTab === 'review'"
                    role="tabpanel"
                    class="tab-pane fade in active"
                    id="review"
                  >
                    <div class="reviews">
                      <div v-if="reviews.length === 0" class="text-center py-3">
                        ChÆ°a cÃ³ Ä‘Ã¡nh giÃ¡ nÃ o cho sáº£n pháº©m nÃ y
                      </div>
                      <div
                        v-else
                        class="comments-list"
                        v-for="comment in reviews"
                        :key="comment.id"
                      >
                        <div class="item">
                          <div class="comment-left pull-left">
                            <div class="avatar">
                              <img
                                :src="comment.avatar || '/img/avatar.jpg'"
                                :alt="comment.author || 'avatar'"
                                width="90"
                                height="90"
                              />
                            </div>
                            <div class="product-rating">
                              <div
                                v-for="star in 5"
                                :key="star"
                                class="star"
                                :class="{
                                  on: star <= Number(comment.rating || 0),
                                }"
                              ></div>
                            </div>
                          </div>
                          <div class="comment-body">
                            <div class="comment-meta">
                              <span class="author">{{
                                comment.author || "NgÆ°á»i dÃ¹ng"
                              }}</span>
                              -
                              <span class="time">{{ comment.time }}</span>
                            </div>
                            <div class="comment-content">
                              {{ comment.content }}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div
                        v-if="!canReview"
                        class="review-note review-note-warning"
                      >
                        {{ canReviewMessage }}
                      </div>
                      <div v-else class="review-form">
                        <h4 class="title">Viáº¿t ÄÃ¡nh GiÃ¡</h4>

                        <form
                          @submit.prevent="submitReview"
                          action="#"
                          method="post"
                          class="form-validate"
                        >
                          <div class="form-group">
                            <div class="text">ÄÃ¡nh GiÃ¡</div>
                            <div class="product-rating">
                              <div
                                v-for="star in 5"
                                :key="star"
                                class="star"
                                :class="{ on: star <= reviewForm.rating }"
                                @click="setReviewRating(star)"
                                style="cursor: pointer"
                              ></div>
                            </div>
                          </div>
                          <div class="form-group">
                            <div class="text">
                              Ná»™i Dung<sup class="required">*</sup>
                            </div>
                            <textarea
                              v-model="reviewForm.comment"
                              id="comment"
                              name="comment"
                              cols="45"
                              rows="6"
                              aria-required="true"
                              :disabled="!canReview"
                            ></textarea>
                          </div>

                          <div class="form-group">
                            <button
                              class="btn btn-primary"
                              :disabled="!canReview"
                            >
                              Gá»­i ÄÃ¡nh GiÃ¡
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Related Products -->
        <div class="products-block related-products item-4">
          <div class="block-title">
            <h2 class="title"><span>Sáº£n Pháº©m</span> TÆ°Æ¡ng Tá»±</h2>
          </div>

          <div v-if="relatedProducts.length" class="block-content">
            <Swiper
              class="related-products-swiper"
              :modules="relatedSwiperModules"
              :slides-per-view="4"
              :space-between="30"
              :navigation="true"
              :loop="relatedProducts.length > 4"
              :breakpoints="{
                0: { slidesPerView: 1, spaceBetween: 12 },
                576: { slidesPerView: 2, spaceBetween: 16 },
                992: { slidesPerView: 3, spaceBetween: 20 },
                1200: { slidesPerView: 4, spaceBetween: 30 },
              }"
            >
              <SwiperSlide v-for="item in relatedProducts" :key="item._id">
                <div class="product-item">
                  <div class="product-image">
                    <router-link
                      :to="`/products/${item._id}`"
                      class="product-image-link"
                    >
                      <img :src="item.thumbnail" :alt="item.name" />
                    </router-link>
                  </div>

                  <div class="product-title">
                    <router-link :to="`/products/${item._id}`">
                      {{ item.name }}
                    </router-link>
                  </div>

                  <div class="product-rating">
                    <div
                      v-for="star in 5"
                      :key="star"
                      class="star"
                      :class="{ on: star <= item.rating || 5 }"
                    ></div>
                  </div>

                  <div class="product-price">
                    <span class="sale-price"
                      >{{ Number(item.price).toLocaleString("vi-VN") }} Ä‘</span
                    >
                  </div>

                  <div class="product-buttons">
                    <a
                      class="add-to-cart"
                      href="#"
                      @click.prevent="addToCart(item._id)"
                    >
                      <i class="fa fa-shopping-basket" aria-hidden="true"></i>
                    </a>

                    <a
                      class="add-wishlist"
                      href="#"
                      @click.prevent="toggleWishlistItem(item._id)"
                    >
                      <i
                        class="fa fa-heart"
                        aria-hidden="true"
                        :style="{
                          color: wishlistStore.isInWishlist(item._id)
                            ? 'red'
                            : '',
                        }"
                      ></i>
                    </a>

                    <router-link
                      class="quickview"
                      :to="`/products/${item._id}`"
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
    <div v-else id="content" class="site-content">
      <div id="breadcrumb">
        <div class="container">
          <h2 class="title"></h2>

          <ul class="breadcrumb">
            <li><router-link to="/">Trang Chá»§</router-link></li>
            <li><router-link to="/products">Sáº£n Pháº©m</router-link></li>
          </ul>
        </div>
      </div>
      <div class="container text-center">
        <h2>KhÃ´ng tÃ¬m tháº¥y sáº£n pháº©m</h2>
      </div>
    </div>
  </div>
</template>
<style>
.thumb-swiper-wrapper {
  margin-top: 15px;
}

.thumb-swiper {
  position: relative;
}

.thumb-swiper .swiper-slide {
  height: auto;
}

.thumb-item {
  cursor: pointer;
  padding: 4px;
  transition: all 0.2s ease;
  background: #fff;
}

.thumb-item.active {
  border-color: #7a9c59;
}

.thumb-item img {
  display: block;
  width: 100%;
  height: auto;
}

.thumb-swiper .swiper-button-prev,
.thumb-swiper .swiper-button-next {
  width: 28px;
  height: 28px;
  margin-top: -14px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid #78b144;
}
.thumb-swiper .swiper-button-prev .swiper-navigation-icon,
.thumb-swiper .swiper-button-next .swiper-navigation-icon {
  height: 70%;
  color: #78b144;
}

/* Related Product */

.related-products .block-content {
  position: relative;
}

.related-products-swiper {
  width: 100%;
  padding: 5px 2px;
}

.related-products-swiper .swiper-slide {
  height: auto;
  box-sizing: border-box;
}

.related-products-swiper .product-item {
  width: 100%;
  height: 100%;
  background: #fff;
  border: 1px solid #e5dfd3;
  padding: 20px 15px;
  text-align: center;
  overflow: hidden;
  box-sizing: border-box;
}

.related-products-swiper .product-image {
  width: 100%;
  height: 220px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 15px;
  overflow: hidden;
}

.related-products-swiper .product-image-link {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.related-products-swiper .product-image img {
  display: block;
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  object-fit: contain;
}

.related-products-swiper .swiper-button-prev .swiper-navigation-icon,
.related-products-swiper .swiper-button-next .swiper-navigation-icon {
  height: 70%;
  color: #78b144;
}
</style>
