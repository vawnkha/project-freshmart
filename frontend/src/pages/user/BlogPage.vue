<script setup>
import { computed, onMounted, ref, watch } from "vue";
import BlogCard from "@/components/user/blog/BlogCard.vue";
import BlogSidebar from "@/components/user/blog/BlogSidebar.vue";
import newsService from "@/services/news.service";
import newsCategoryService from "@/services/news-category.service";

const posts = ref([]);
const categories = ref([]);
const loading = ref(false);
const errorMessage = ref("");
const keyword = ref("");
const categoryFilter = ref("");
const currentPage = ref(1);
const perPage = 8;

const categoryMap = computed(
  () => new Map(categories.value.map((item) => [normalizeId(item._id), item])),
);

const tags = computed(() => {
  const seen = new Set();
  return posts.value.reduce((result, post) => {
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

const normalizedPosts = computed(() => posts.value.map(normalizePost));

const filteredPosts = computed(() => {
  const q = keyword.value.trim().toLowerCase();

  return normalizedPosts.value.filter((post) => {
    const matchKeyword =
      !q ||
      [post.title, post.summary, post.category, ...(post.tags || [])]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    const matchCategory = !categoryFilter.value || post.categoryId === categoryFilter.value;
    return matchKeyword && matchCategory;
  });
});

const totalPages = computed(() =>
  Math.max(1, Math.ceil(filteredPosts.value.length / perPage)),
);

const paginatedPosts = computed(() => {
  const start = (currentPage.value - 1) * perPage;
  return filteredPosts.value.slice(start, start + perPage);
});

const recentPosts = computed(() => normalizedPosts.value.slice(0, 3));

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
    excerpt: item.summary || "",
    summary: item.summary || "",
    category: getCategoryName(item),
    categoryId: normalizeId(item.categoryId),
    tags: Array.isArray(item.tags) ? item.tags : [],
  };
}

function goToPage(page) {
  if (page < 1 || page > totalPages.value) return;
  currentPage.value = page;
}

async function fetchPosts() {
  loading.value = true;
  errorMessage.value = "";

  try {
    const [newsRes, categoryRes] = await Promise.all([
      newsService.getPublicNews(),
      newsCategoryService.getAll(),
    ]);
    posts.value = normalizeList(newsRes);
    categories.value = normalizeList(categoryRes);
  } catch (error) {
    console.error(error);
    errorMessage.value = "Không thể tải bài viết.";
    posts.value = [];
  } finally {
    loading.value = false;
  }
}

watch([keyword, categoryFilter], () => {
  currentPage.value = 1;
});

watch(filteredPosts, () => {
  if (currentPage.value > totalPages.value) currentPage.value = totalPages.value;
});

onMounted(fetchPosts);
</script>

<template>
  <div id="content" class="site-content">
    <div id="breadcrumb">
      <div class="container">
        <h2 class="title">Blog</h2>

        <ul class="breadcrumb">
          <li><router-link to="/">Trang chủ</router-link></li>
          <li><span>Blog</span></li>
        </ul>
      </div>
    </div>

    <div class="container">
      <div class="row">
        <div id="left-column" class="sidebar col-lg-3 col-md-3 col-sm-3 col-xs-12">
          <BlogSidebar :categories="categories" :recent-posts="recentPosts" :tags="tags" />
        </div>

        <div id="center-column" class="col-lg-9 col-md-9 col-sm-9 col-xs-12">
          <div class="blog-list layout-2">
            <div class="form-group">
              <input
                v-model="keyword"
                class="form-control"
                type="search"
                placeholder="Tìm bài viết..."
              />
            </div>

            <div class="form-group" v-if="categories.length">
              <select v-model="categoryFilter" class="form-control">
                <option value="">Tất cả danh mục</option>
                <option
                  v-for="category in categories"
                  :key="normalizeId(category._id)"
                  :value="normalizeId(category._id)"
                >
                  {{ category.name }}
                </option>
              </select>
            </div>

            <div v-if="loading" class="alert alert-info">Đang tải bài viết...</div>
            <div v-else-if="errorMessage" class="alert alert-danger">{{ errorMessage }}</div>
            <div v-else-if="!filteredPosts.length" class="alert alert-info">
              Chưa có bài viết nào.
            </div>

            <template v-else>
              <div class="posts-list">
                <BlogCard v-for="post in paginatedPosts" :key="post.id || post.slug" :post="post" />
              </div>

              <div v-if="totalPages > 1" class="pagination-bar">
                <div class="pagination">
                  <ul class="page-list">
                    <li>
                      <a
                        href="#"
                        class="prev"
                        @click.prevent="goToPage(currentPage - 1)"
                      >
                        Trước
                      </a>
                    </li>

                    <li v-for="page in totalPages" :key="page">
                      <a
                        href="#"
                        :class="{ current: page === currentPage }"
                        @click.prevent="goToPage(page)"
                      >
                        {{ page }}
                      </a>
                    </li>

                    <li>
                      <a
                        href="#"
                        class="next"
                        @click.prevent="goToPage(currentPage + 1)"
                      >
                        Sau
                      </a>
                    </li>
                  </ul>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
