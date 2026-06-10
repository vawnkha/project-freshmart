<script setup>
defineProps({
  posts: {
    type: Array,
    required: true,
  },
});
</script>

<template>
  <div class="section latest-news layout-2">
    <div class="block-title">
      <h2 class="title"><span>Blog</span></h2>
      <div class="sub-title">Tin tức và kiến thức mới nhất từ cửa hàng</div>
    </div>

    <div class="block-content">
      <div class="container">
        <div class="row">
          <div
            v-for="post in posts"
            :key="post.id || post.slug"
            class="col-lg-4 col-md-4 col-sm-4 col-xs-12"
          >
            <div class="blog-item">
              <div class="blog-image">
                <router-link :to="`/blog/${post.slug}`" class="zoom-effect">
                  <img v-if="post.image" :src="post.image" :alt="post.title" />
                  <div v-else class="home-blog-placeholder">Không có ảnh</div>
                </router-link>
              </div>

              <div class="blog-info">
                <div class="blog-title">
                  <router-link :to="`/blog/${post.slug}`">
                    {{ post.title }}
                  </router-link>
                </div>

                <div v-if="post.date" class="blog-time">
                  <span class="post-date">{{ post.date }}</span>
                </div>

                <div class="blog-desc">
                  {{ post.excerpt || "Bài viết chưa có mô tả ngắn." }}
                </div>
                <div class="readmore">
                  <router-link :to="`/blog/${post.slug}`">Xem thêm</router-link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home-blog-placeholder {
  align-items: center;
  background: #f5f5f5;
  color: #777;
  display: flex;
  min-height: 210px;
  justify-content: center;
  text-align: center;
}
</style>
