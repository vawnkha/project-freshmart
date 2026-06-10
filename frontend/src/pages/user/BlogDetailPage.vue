<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import BlogSidebar from "@/components/user/blog/BlogSidebar.vue";
import BlogCard from "@/components/user/blog/BlogCard.vue";
import newsService from "@/services/news.service";
import newsCategoryService from "@/services/news-category.service";

const route = useRoute();

const article = ref(null);
const posts = ref([]);
const categories = ref([]);
const loading = ref(false);
const errorMessage = ref("");
const notFound = ref(false);

const slug = computed(() => route.params.slug || route.params.id || "");

const categoryMap = computed(
  () => new Map(categories.value.map((item) => [normalizeId(item._id), item])),
);

const normalizedPosts = computed(() => posts.value.map(normalizePost));

const currentPost = computed(() => (article.value ? normalizePost(article.value) : null));

const relatedPosts = computed(() => {
  if (!currentPost.value) return normalizedPosts.value.slice(0, 3);
  const sameCategory = normalizedPosts.value.filter(
    (post) =>
      post.slug !== currentPost.value.slug &&
      post.categoryId &&
      post.categoryId === currentPost.value.categoryId,
  );
  const fallback = normalizedPosts.value.filter((post) => post.slug !== currentPost.value.slug);
  return (sameCategory.length ? sameCategory : fallback).slice(0, 3);
});

const tags = computed(() => {
  const seen = new Set();
  return normalizedPosts.value.reduce((result, post) => {
    (post.tags || []).forEach((tag) => {
      const text = String(tag || "").trim();
      const key = text.toLowerCase();
      if (!text || seen.has(key)) return;
      seen.add(key);
      result.push(text);
    });
    return result;
  }, []);
});

const articleContent = computed(() => {
  if (!article.value) return "";
  return article.value.content || article.value.summary || "";
});

function normalizeList(res) {
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res)) return res;
  return [];
}

function normalizeId(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value.$oid) return value.$oid;
  return String(value);
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("vi-VN");
}

function getCategoryName(item) {
  if (item.category?.name) return item.category.name;
  if (item.categoryName) return item.categoryName;
  return categoryMap.value.get(normalizeId(item.categoryId))?.name || "";
}

function normalizePost(item) {
  return {
    id: normalizeId(item._id || item.id),
    slug: item.slug || normalizeId(item._id || item.id),
    title: item.title || "Bài viết chưa có tiêu đề",
    image: item.thumbnail || item.images?.[0] || "",
    date: formatDate(item.publishedAt || item.createdAt),
    summary: item.summary || "",
    excerpt: item.summary || "",
    category: getCategoryName(item),
    categoryId: normalizeId(item.categoryId),
    tags: Array.isArray(item.tags) ? item.tags : [],
  };
}

async function fetchArticle() {
  if (!slug.value) {
    notFound.value = true;
    return;
  }

  loading.value = true;
  errorMessage.value = "";
  notFound.value = false;
  article.value = null;

  try {
    const [articleRes, newsRes, categoryRes] = await Promise.all([
      newsService.getPublicNewsBySlug(slug.value),
      newsService.getPublicNews(),
      newsCategoryService.getAll(),
    ]);
    categories.value = normalizeList(categoryRes);
    posts.value = normalizeList(newsRes);
    article.value = articleRes?.data || articleRes;
  } catch (error) {
    console.error(error);
    if (error?.response?.status === 404) {
      notFound.value = true;
      errorMessage.value = "";
    } else {
      errorMessage.value = "Không thể tải bài viết.";
    }
  } finally {
    loading.value = false;
  }
}

watch(slug, fetchArticle);

onMounted(fetchArticle);
</script>

<template>
  <div id="content" class="site-content">
    <div id="breadcrumb">
      <div class="container">
        <h2 class="title">Blog</h2>

        <ul class="breadcrumb">
          <li><router-link to="/">Trang chủ</router-link></li>
          <li><router-link to="/blog">Blog</router-link></li>
          <li><span>{{ currentPost?.title || "Chi tiết bài viết" }}</span></li>
        </ul>
      </div>
    </div>

    <div class="container">
      <div class="row">
        <div id="left-column" class="sidebar col-lg-3 col-md-3 col-sm-3 col-xs-12">
          <BlogSidebar :categories="categories" :recent-posts="normalizedPosts.slice(0, 3)" :tags="tags" />
        </div>

        <div id="center-column" class="col-lg-9 col-md-9 col-sm-9 col-xs-12">
          <div class="blog-detail">
            <div v-if="loading" class="alert alert-info">Đang tải bài viết...</div>
            <div v-else-if="errorMessage" class="alert alert-danger">{{ errorMessage }}</div>
            <div v-else-if="notFound || !article" class="alert alert-info">
              Không tìm thấy bài viết.
            </div>

            <div v-else class="post-item">
              <div v-if="currentPost.image" class="post-image">
                <img class="img-responsive" :src="currentPost.image" :alt="currentPost.title" />
              </div>

              <h1 class="post-title">{{ currentPost.title }}</h1>

              <div class="post-meta border-bottom">
                <div class="post-info">
                  <span v-if="currentPost.date" class="date item">
                    <i class="zmdi zmdi-calendar-note"></i>{{ currentPost.date }}
                  </span>
                  <span v-if="currentPost.category" class="item">
                    <i class="zmdi zmdi-folder"></i>{{ currentPost.category }}
                  </span>
                </div>
              </div>

              <div v-if="currentPost.summary" class="post-description border-bottom">
                {{ currentPost.summary }}
              </div>

              <div class="post-content border-bottom" v-html="articleContent"></div>

              <div v-if="currentPost.tags.length" class="post-meta border-bottom">
                <div class="post-info">
                  <span v-for="tag in currentPost.tags" :key="tag" class="item">#{{ tag }}</span>
                </div>
              </div>

              <div v-if="relatedPosts.length" class="latest-news layout-2">
                <div class="block-title">
                  <h2 class="title"><span>Tin</span> liên quan</h2>
                </div>

                <div class="block-content">
                  <div class="row">
                    <div
                      v-for="post in relatedPosts"
                      :key="post.id || post.slug"
                      class="col-lg-4 col-md-4 col-sm-4 col-xs-12"
                    >
                      <BlogCard :post="post" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
