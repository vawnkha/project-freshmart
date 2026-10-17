<script setup>
import { ref, watch } from "vue";
import ResponsiveImage from "@/components/user/common/ResponsiveImage.vue";
import { normalizeId } from "@/utils/id.util";
const props = defineProps({
  categories: { type: Array, default: () => [] },
  recentPosts: { type: Array, default: () => [] },
  selected: { type: String, default: "" },
  keyword: { type: String, default: "" },
  loading: Boolean,
  categoryError: Boolean,
  showCategories: { type: Boolean, default: true },
  textOnly: Boolean,
});
const emit = defineEmits(["category", "keyword", "retry"]);
const search = ref(props.keyword);
watch(() => props.keyword, (keyword) => { search.value = keyword; });
</script>

<template>
  <aside class="knowledge-sidebar" :class="{ 'knowledge-sidebar--text': textOnly }" aria-label="Tìm kiếm và khám phá bài viết">
    <section class="knowledge-sidebar-section">
      <h2>Tìm kiếm bài viết</h2>
      <form class="knowledge-search" role="search" @submit.prevent="emit('keyword', search.trim())">
        <label class="sr-only" for="knowledge-search">Tìm kiếm bài viết</label>
        <input id="knowledge-search" v-model="search" type="search" placeholder="Tìm kiếm bài viết..." enterkeyhint="search" />
        <button type="submit" aria-label="Tìm bài viết"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i></button>
      </form>
    </section>
    <section v-if="showCategories || categoryError" class="knowledge-sidebar-section">
      <h2>Chủ đề bài viết</h2>
      <div class="knowledge-categories">
        <button type="button" :aria-pressed="!selected" @click="emit('category', '')">Tất cả bài viết <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button>
        <button v-for="category in categories" :key="normalizeId(category._id)" type="button" :aria-pressed="selected === normalizeId(category._id)" @click="emit('category', normalizeId(category._id))">{{ category.name }} <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button>
      </div>
      <p v-if="categoryError" role="status">Chưa tải được chủ đề. <button type="button" class="text-link" @click="emit('retry')">Thử lại</button></p>
      <p v-else-if="!categories.length && !loading">Chủ đề đang được cập nhật.</p>
    </section>
    <section v-if="recentPosts.length" class="knowledge-sidebar-section">
      <h2>Bài viết gần đây</h2>
      <ul class="knowledge-recent-list">
        <li v-for="post in recentPosts" :key="post.id || post.slug">
          <router-link :to="'/blog/' + post.slug" class="knowledge-recent-item">
            <div v-if="post.image && !textOnly" class="knowledge-recent-image"><ResponsiveImage :src="post.image" :alt="post.title" /></div>
            <div><span class="knowledge-recent-title">{{ post.title }}</span><time v-if="post.date" :datetime="post.datetime">{{ post.date }}</time></div>
          </router-link>
        </li>
      </ul>
    </section>
  </aside>
</template>
