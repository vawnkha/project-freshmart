<script setup>
import { computed } from "vue";

const props = defineProps({
  post: {
    type: Object,
    required: true,
  },
});

const postLink = computed(() => `/blog/${props.post.slug}`);
</script>

<template>
  <div class="post-item">
    <div class="row">
      <div class="col-lg-4 col-md-4 col-sm-4 col-xs-12 post-left">
        <div class="post-image">
          <router-link :to="postLink">
            <img
              v-if="post.image"
              class="img-responsive"
              :src="post.image"
              :alt="post.title"
            />
            <div v-else class="blog-image-placeholder">Không có ảnh</div>
          </router-link>
        </div>
      </div>

      <div class="col-lg-8 col-md-8 col-sm-8 col-xs-12 post-right">
        <router-link :to="postLink" class="post-title">
          {{ post.title }}
        </router-link>

        <div class="post-info">
          <span v-if="post.category" class="item">
            <i class="zmdi zmdi-folder"></i>{{ post.category }}
          </span>
          <span v-if="post.date" class="date item">
            <i class="zmdi zmdi-calendar-note"></i>{{ post.date }}
          </span>
        </div>

        <div class="post-description">
          {{ post.excerpt || post.summary || "Bài viết chưa có mô tả ngắn." }}
          <span class="post-readmore">
            <router-link :to="postLink">Xem thêm</router-link>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.blog-image-placeholder {
  align-items: center;
  background: #f5f5f5;
  color: #777;
  display: flex;
  min-height: 150px;
  justify-content: center;
  text-align: center;
}
</style>
