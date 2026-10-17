<script setup>
import { computed } from 'vue';
import newsService from '@/services/news.service';
import newsCategoryService from '@/services/news-category.service';
import { useHomeResource } from '@/composables/useHomeResource';
import { homePosts } from '@/utils/home-content.util';
import { normalizeId } from '@/utils/id.util';
import BlogCard from '@/components/user/blog/BlogCard.vue';
import SectionHeading from '@/components/user/common/SectionHeading.vue';
import SageSkeleton from '@/components/user/sage/SageSkeleton.vue';
import SageEmptyState from '@/components/user/sage/SageEmptyState.vue';
import SageErrorState from '@/components/user/sage/SageErrorState.vue';
import SageButton from '@/components/user/sage/SageButton.vue';
const articles = useHomeResource(() => newsService.getPublicNews(), 'Không thể tải bài viết. Vui lòng thử lại.');
const topics = useHomeResource(() => newsCategoryService.getAll(), 'Chưa tải được chủ đề bài viết.');
const { loading, error, load } = articles;
const posts = computed(() => homePosts(articles.data.value, new Map(topics.data.value.map(category => [normalizeId(category._id || category.id), category]))));
</script>
<template>
  <section class="home-sage-section home-knowledge" :aria-busy="loading" aria-label="Kiến thức và tin tức">
    <div class="container">
      <SectionHeading eyebrow="Kiến thức & tin tức" title="Dành thời gian tìm hiểu." to="/blog" link-text="Tất cả bài viết" />
      <div v-if="loading" class="home-sage-news-grid"><SageSkeleton v-for="n in 3" :key="n" media :lines="3" label="Đang tải bài viết" /></div>
      <SageErrorState v-else-if="error" heading-tag="h3" :title="error" @retry="load" />
      <SageEmptyState v-else-if="!posts.length" heading-tag="h3" title="Chưa có bài viết" description="Kiến thức và tin tức sẽ được cập nhật tại đây." />
      <template v-else>
        <div v-if="topics.error.value" class="home-sage-topic-error" role="status"><span>{{ topics.error.value }}</span><SageButton variant="ghost" :loading="topics.loading.value" @click="topics.load">Tải lại chủ đề</SageButton></div>
        <div class="home-sage-news-grid">
          <div v-for="(post, index) in posts.slice(0, 3)" :key="post.slug" class="reveal" :style="{ '--i': index }"><BlogCard :post="post" variant="approved-home" /></div>
        </div>
      </template>
    </div>
  </section>
</template>
