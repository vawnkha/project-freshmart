<script setup>
import { computed, onScopeDispose, ref, watch } from "vue";
import { useRoute } from "vue-router";
import AppState from "@/components/user/common/AppState.vue";
import ResponsiveImage from "@/components/user/common/ResponsiveImage.vue";
import BlogCard from "@/components/user/blog/BlogCard.vue";
import SageSkeleton from "@/components/user/sage/SageSkeleton.vue";
import { normalizeId } from "@/utils/id.util";
import { normalizeList } from "@/utils/storefront.util";
import { normalizeBlogPost, prepareArticleHtml, relatedBlogPosts } from "@/utils/blog.util";
import newsService from "@/services/news.service";
import newsCategoryService from "@/services/news-category.service";

const route = useRoute();
const article = ref(null);
const posts = ref([]);
const categories = ref([]);
const loading = ref(true);
const errorMessage = ref("");
const notFound = ref(false);
const relatedError = ref(false);
let requestVersion = 0;
const slug = computed(() => String(route.params.slug || route.params.id || ""));
const categoryMap = computed(() => new Map(categories.value.map((item) => [normalizeId(item._id), item])));
const normalizedPosts = computed(() => posts.value.map((post) => normalizeBlogPost(post, categoryMap.value)));
const currentPost = computed(() => article.value ? normalizeBlogPost(article.value, categoryMap.value) : null);
const relatedPosts = computed(() => relatedBlogPosts(normalizedPosts.value, currentPost.value));
const articleContent = computed(() => prepareArticleHtml(article.value?.content || article.value?.summary || ""));

async function fetchArticle() {
  const version = ++requestVersion;
  loading.value = true;
  errorMessage.value = "";
  notFound.value = false;
  relatedError.value = false;
  article.value = null;
  posts.value = [];
  if (!slug.value) {
    notFound.value = true;
    loading.value = false;
    return;
  }
  const [detailResult, newsResult, categoryResult] = await Promise.allSettled([
    newsService.getPublicNewsBySlug(slug.value), newsService.getPublicNews(), newsCategoryService.getAll(),
  ]);
  // A slow response for the preceding slug must not overwrite the current page.
  if (version !== requestVersion) return;
  if (categoryResult.status === "fulfilled") categories.value = normalizeList(categoryResult.value);
  else categories.value = [];
  if (newsResult.status === "fulfilled") posts.value = normalizeList(newsResult.value);
  else relatedError.value = true;
  if (detailResult.status === "fulfilled") {
    const document = detailResult.value?.data || detailResult.value;
    if (!document) notFound.value = true;
    else if (typeof document !== "object" || Array.isArray(document) || typeof document.title !== "string" || !document.title.trim()) errorMessage.value = "Không thể tải bài viết. Vui lòng thử lại.";
    else article.value = document;
  } else if (detailResult.reason?.response?.status === 404) notFound.value = true;
  else errorMessage.value = "Không thể tải bài viết. Vui lòng thử lại.";
  loading.value = false;
}
watch(slug, fetchArticle, { immediate: true });
onScopeDispose(() => { requestVersion++; });
</script>

<template>
  <div class="site-content knowledge-page knowledge-detail-page">
    <div class="container">
      <nav class="page-crumb knowledge-breadcrumb" aria-label="Đường dẫn">
        <router-link to="/">Trang chủ</router-link><span aria-hidden="true">/</span>
        <router-link to="/blog">Kiến thức & Tin tức</router-link><span aria-hidden="true">/</span>
        <span aria-current="page">{{ currentPost?.title || 'Bài viết' }}</span>
      </nav>
      <div v-if="loading || errorMessage || notFound || !article" class="knowledge-reading knowledge-detail-state">
        <h1>Kiến thức & Tin tức</h1>
        <SageSkeleton v-if="loading" media :lines="6" label="Đang tải bài viết" />
        <AppState v-else-if="errorMessage" kind="error" heading-tag="h2" :title="errorMessage" retry @retry="fetchArticle" />
        <AppState v-else heading-tag="h2" title="Không tìm thấy bài viết" description="Bài viết có thể đã được gỡ hoặc đường dẫn không còn tồn tại." to="/blog" action="Xem các bài viết" />
      </div>
      <template v-else>
        <article class="knowledge-reading">
          <header class="knowledge-article-heading">
            <div class="knowledge-meta">
              <router-link v-if="currentPost.category" :to="{path:'/blog', query:{category:currentPost.categoryId}}">{{ currentPost.category }}</router-link>
              <time v-if="currentPost.date" :datetime="currentPost.datetime">{{ currentPost.date }}</time>
            </div>
            <h1>{{ currentPost.title }}</h1>
            <p v-if="article.summary || article.excerpt || article.description" class="knowledge-lead">{{ currentPost.excerpt }}</p>
          </header>
          <div v-if="currentPost.image" class="knowledge-hero">
            <ResponsiveImage :src="currentPost.image" :alt="currentPost.title" eager />
          </div>
          <div v-if="articleContent" class="knowledge-body" v-html="articleContent"></div>
          <p v-else class="knowledge-content-empty" role="status">Nội dung bài viết đang được cập nhật.</p>
          <ul v-if="currentPost.tags.length" class="knowledge-tags" aria-label="Từ khóa bài viết">
            <li v-for="tag in currentPost.tags" :key="tag"><router-link :to="{path:'/blog', query:{q:tag}}">#{{ tag }}</router-link></li>
          </ul>
          <router-link to="/blog" class="text-link knowledge-back"><i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Tất cả bài viết</router-link>
        </article>
        <section v-if="relatedPosts.length" class="knowledge-related" aria-labelledby="knowledge-related-title">
          <div class="knowledge-list-heading"><h2 id="knowledge-related-title">Tin liên quan</h2><router-link to="/blog" class="text-link">Xem tất cả <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></router-link></div>
          <div class="knowledge-related-grid" :class="`knowledge-related-count-${relatedPosts.length}`">
            <BlogCard v-for="post in relatedPosts" :key="post.id || post.slug" :post="post" variant="compact" />
          </div>
        </section>
        <p v-else-if="relatedError" class="knowledge-related-error" role="status">Chưa tải được các bài viết liên quan. <button type="button" class="text-link" @click="fetchArticle">Thử lại</button></p>
      </template>
    </div>
  </div>
</template>
