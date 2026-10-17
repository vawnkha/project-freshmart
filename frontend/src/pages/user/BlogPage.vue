<script setup>
import { computed, onMounted, onScopeDispose, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import PageHeading from "@/components/user/common/PageHeading.vue";
import AppState from "@/components/user/common/AppState.vue";
import SageSkeleton from "@/components/user/sage/SageSkeleton.vue";
import BlogCard from "@/components/user/blog/BlogCard.vue";
import BlogSidebar from "@/components/user/blog/BlogSidebar.vue";
import { normalizeId } from "@/utils/id.util";
import { normalizeList } from "@/utils/storefront.util";
import { filterBlogPosts, normalizeBlogPost } from "@/utils/blog.util";
import newsService from "@/services/news.service";
import newsCategoryService from "@/services/news-category.service";

const route = useRoute();
const router = useRouter();
const posts = ref([]);
const categories = ref([]);
const loading = ref(true);
const errorMessage = ref("");
const categoryError = ref(false);
const keyword = computed(() => String(route.query.q || ""));
const categoryFilter = computed(() => String(route.query.category || ""));
const currentPage = ref(1);
const perPage = 8;
let requestVersion = 0;
const categoryMap = computed(() => new Map(categories.value.map((item) => [normalizeId(item._id), item])));
const normalizedPosts = computed(() => posts.value.map((post) => normalizeBlogPost(post, categoryMap.value)));
const filteredPosts = computed(() => filterBlogPosts(normalizedPosts.value, keyword.value, categoryFilter.value));
const totalPages = computed(() => Math.max(1, Math.ceil(filteredPosts.value.length / perPage)));
const paginatedPosts = computed(() => filteredPosts.value.slice((currentPage.value - 1) * perPage, currentPage.value * perPage));
const recentPosts = computed(() => normalizedPosts.value.slice(0, 3));

function updateFilter(name, value) {
  const query = { ...route.query };
  if (value) query[name] = value;
  else delete query[name];
  router.push({ path: "/blog", query });
}
function resetFilters() {
  router.push({ path: "/blog" });
}
function goToPage(page) {
  if (page >= 1 && page <= totalPages.value) currentPage.value = page;
}
async function fetchPosts() {
  const version = ++requestVersion;
  loading.value = true;
  errorMessage.value = "";
  categoryError.value = false;
  // A category failure must not hide successfully loaded public articles.
  const [newsResult, categoryResult] = await Promise.allSettled([
    newsService.getPublicNews(), newsCategoryService.getAll(),
  ]);
  if (version !== requestVersion) return;
  // The public endpoint returns the complete array, not a server page. Do not
  // silently turn an unexpected response into an empty or partial catalog.
  if (newsResult.status === "fulfilled" &&
    (Array.isArray(newsResult.value) || Array.isArray(newsResult.value?.data))) posts.value = normalizeList(newsResult.value);
  else {
    posts.value = [];
    errorMessage.value = "Không thể tải bài viết. Vui lòng thử lại.";
  }
  if (categoryResult.status === "fulfilled") categories.value = normalizeList(categoryResult.value);
  else {
    categories.value = [];
    categoryError.value = true;
  }
  loading.value = false;
}
watch([keyword, categoryFilter], () => { currentPage.value = 1; });
watch(totalPages, (pages) => { currentPage.value = Math.min(currentPage.value, pages); });
onMounted(fetchPosts);
onScopeDispose(() => { requestVersion++; });
</script>

<template>
  <div class="site-content knowledge-page knowledge-list-page">
    <PageHeading title="Kiến thức & Tin tức" description="Bài viết, kiến thức và thông tin dành cho người nuôi tôm." />
    <div class="container knowledge-layout">
      <section class="knowledge-results" aria-label="Danh sách bài viết" :aria-busy="loading">
        <nav class="knowledge-topic-nav" aria-label="Chủ đề bài viết">
          <button type="button" :aria-pressed="!categoryFilter" @click="updateFilter('category', '')">Tất cả</button>
          <button v-for="topic in categories" :key="normalizeId(topic._id)" type="button" :aria-pressed="categoryFilter === normalizeId(topic._id)" @click="updateFilter('category', normalizeId(topic._id))">{{ topic.name }}</button>
        </nav>
        <div class="knowledge-list-heading">
          <h2>{{ categoryMap.get(categoryFilter)?.name || 'Bài viết mới nhất' }}</h2>
          <span v-if="!loading && !errorMessage" role="status">{{ filteredPosts.length }} bài viết</span>
        </div>
        <div v-if="keyword || categoryFilter" class="knowledge-active-filter">
          <span v-if="keyword">Tìm kiếm: “{{ keyword }}”</span>
          <button type="button" class="text-link" @click="resetFilters">Xóa bộ lọc</button>
        </div>
        <div v-if="loading" class="knowledge-grid knowledge-loading" aria-label="Đang tải bài viết">
          <SageSkeleton v-for="i in 4" :key="i" media :lines="3" label="Đang tải bài viết" />
        </div>
        <AppState v-else-if="errorMessage" kind="error" :title="errorMessage" retry @retry="fetchPosts" />
        <AppState v-else-if="!filteredPosts.length" :title="posts.length ? 'Chưa có bài viết phù hợp' : 'Chưa có bài viết'" :description="posts.length ? 'Thử tìm kiếm từ khóa khác hoặc chọn lại chủ đề.' : 'Các bài viết mới sẽ được cập nhật tại đây.'" />
        <template v-else>
          <div class="knowledge-grid knowledge-grid--editorial">
            <BlogCard v-for="post in paginatedPosts" :key="post.id || post.slug" :post="post" variant="editorial" />
          </div>
          <nav v-if="totalPages > 1" class="knowledge-pagination" aria-label="Phân trang bài viết">
            <button type="button" :disabled="currentPage === 1" @click="goToPage(currentPage - 1)">Trước</button>
            <button v-for="page in totalPages" :key="page" type="button" :aria-label="`Trang ${page}`" :aria-current="page === currentPage ? 'page' : undefined" @click="goToPage(page)">{{ page }}</button>
            <button type="button" :disabled="currentPage === totalPages" @click="goToPage(currentPage + 1)">Sau</button>
          </nav>
        </template>
      </section>
      <BlogSidebar :categories="categories" :recent-posts="recentPosts" :selected="categoryFilter" :keyword="keyword" :loading="loading" :category-error="categoryError" :show-categories="false" text-only @category="updateFilter('category', $event)" @keyword="updateFilter('q', $event)" @retry="fetchPosts" />
    </div>
  </div>
</template>
