<script setup>
defineProps({
  categories: {
    type: Array,
    default: () => [],
  },
  recentPosts: {
    type: Array,
    default: () => [],
  },
  tags: {
    type: Array,
    default: () => [],
  },
});
</script>

<template>
  <div class="block product-categories">
    <h3 class="block-title">Danh mục</h3>

    <div class="block-content">
      <template v-if="categories.length">
        <div class="item" v-for="category in categories" :key="category._id || category.slug">
          <a class="category-title" href="#" @click.prevent>{{ category.name }}</a>
        </div>
      </template>
      <div v-else class="item">Chưa có danh mục.</div>
    </div>
  </div>

  <div class="block posts recent-posts">
    <h3 class="block-title">Bài viết gần đây</h3>

    <div class="block-content">
      <template v-if="recentPosts.length">
        <div class="post-item" v-for="post in recentPosts" :key="post.id || post.slug">
          <router-link :to="`/blog/${post.slug}`" class="post-title">
            {{ post.title }}
          </router-link>
          <div class="post-info">
            <span v-if="post.date" class="date item">
              <i class="zmdi zmdi-calendar-note"></i>{{ post.date }}
            </span>
          </div>
          <div v-if="post.summary || post.excerpt" class="post-description">
            {{ post.summary || post.excerpt }}
          </div>
          <div class="post-readmore">
            <router-link :to="`/blog/${post.slug}`">Xem thêm</router-link>
          </div>
        </div>
      </template>
      <div v-else>Chưa có bài viết.</div>
    </div>
  </div>

  <div class="block tags blog-tags" v-if="tags.length">
    <h3 class="block-title">Từ khóa</h3>

    <div class="block-content">
      <ul>
        <li v-for="tag in tags" :key="tag">
          <a href="#" @click.prevent :title="tag">{{ tag }}</a>
        </li>
      </ul>
    </div>
  </div>
</template>
