<script setup>
import { computed, onMounted, ref, watch } from "vue";
import AdminPagination from "@/components/common/AdminPagination.vue";
import newsService from "@/services/news.service";
import newsCategoryService from "@/services/news-category.service";

const articles = ref([]);
const categories = ref([]);
const loading = ref(false);
const keyword = ref("");
const statusFilter = ref("");
const categoryFilter = ref("");
const currentPage = ref(1);
const pageSize = ref(12);

const categoryMap = computed(
  () => new Map(categories.value.map((item) => [normalizeId(item._id), item])),
);

const filteredArticles = computed(() => {
  const q = keyword.value.trim().toLowerCase();

  return articles.value.filter((item) => {
    const categoryId = normalizeId(item.categoryId);
    const matchKeyword =
      !q ||
      [item.title, item.slug, item.summary, ...(item.tags || [])]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    const matchStatus = !statusFilter.value || item.status === statusFilter.value;
    const matchCategory = !categoryFilter.value || categoryId === categoryFilter.value;
    return matchKeyword && matchStatus && matchCategory;
  });
});

const paginatedArticles = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return filteredArticles.value.slice(start, start + pageSize.value);
});

const publishedCount = computed(
  () => articles.value.filter((item) => item.status === "published").length,
);

const draftCount = computed(
  () => articles.value.filter((item) => item.status === "draft").length,
);

function normalizeList(res) {
  return Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
}

function normalizeId(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value.$oid) return value.$oid;
  return String(value);
}

function getId(item) {
  return item?._id || item?.id || "";
}

function categoryName(categoryId) {
  return categoryMap.value.get(normalizeId(categoryId))?.name || "---";
}

function formatDate(value) {
  if (!value) return "---";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "---";
  return date.toLocaleDateString("vi-VN");
}

function statusText(status) {
  if (status === "published") return "Đã xuất bản";
  if (status === "draft") return "Bản nháp";
  if (status === "archived") return "Đã lưu trữ";
  return status || "---";
}

function statusClass(status) {
  if (status === "published") return "admin-badge--success";
  if (status === "draft") return "admin-badge--warning";
  if (status === "archived") return "admin-badge--danger";
  return "admin-badge--info";
}

async function fetchData() {
  loading.value = true;
  try {
    const [newsRes, categoryRes] = await Promise.all([
      newsService.getAll(),
      newsCategoryService.getAll(),
    ]);
    articles.value = normalizeList(newsRes);
    categories.value = normalizeList(categoryRes);
  } catch (error) {
    console.error(error);
    alert(error?.response?.data?.message || "Không thể tải bài viết");
  } finally {
    loading.value = false;
  }
}

async function removeArticle(item) {
  if (item.status === "archived") return;

  if (!window.confirm("Bạn có chắc muốn xóa bài viết này?")) return;

  try {
    await newsService.remove(getId(item));
    await fetchData();
    alert("Đã xóa bài viết");
  } catch (error) {
    console.error(error);
    alert(error?.response?.data?.message || "Không thể xóa bài viết");
  }
}

watch([keyword, statusFilter, categoryFilter], () => {
  currentPage.value = 1;
});

watch(filteredArticles, (list) => {
  const maxPage = Math.max(1, Math.ceil(list.length / pageSize.value));
  if (currentPage.value > maxPage) currentPage.value = maxPage;
});

onMounted(fetchData);
</script>

<template>
  <div class="admin-page">
    <div class="admin-page-title admin-page-title--stack">
      <h1>Bài viết</h1>
      <p>Quản lý nội dung tin tức/blog hiển thị trên website.</p>
    </div>

    <div class="admin-stat-row admin-stat-row--orders">
      <div class="admin-stat-card">
        <div class="admin-stat-card__label">Tổng bài viết</div>
        <div class="admin-stat-card__value">{{ articles.length }}</div>
      </div>
      <div class="admin-stat-card">
        <div class="admin-stat-card__label">Đã xuất bản</div>
        <div class="admin-stat-card__value">{{ publishedCount }}</div>
      </div>
      <div class="admin-stat-card">
        <div class="admin-stat-card__label">Bản nháp</div>
        <div class="admin-stat-card__value">{{ draftCount }}</div>
      </div>
    </div>

    <section class="admin-panel">
      <div class="admin-panel__header admin-panel__header--flex">
        <div>
          <div class="admin-panel__header-title">Danh sách bài viết</div>
          <div class="admin-panel__header-subtitle">
            Dữ liệu lấy từ /api/news, filter và phân trang xử lý ở frontend.
          </div>
        </div>

        <RouterLink class="admin-btn admin-btn--primary" :to="{ name: 'admin-news-create' }">
          <i class="fa-solid fa-plus me-1"></i>
          Thêm bài viết
        </RouterLink>
      </div>

      <div class="admin-panel__body">
        <div class="row admin-toolbar">
          <div class="col-md-5">
            <input
              v-model="keyword"
              type="text"
              class="admin-toolbar__input"
              placeholder="Tìm theo tiêu đề, slug, tag..."
            />
          </div>
          <div class="col-md-4">
            <select v-model="categoryFilter" class="admin-toolbar__select">
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
          <div class="col-md-3">
            <select v-model="statusFilter" class="admin-toolbar__select">
              <option value="">Tất cả trạng thái</option>
              <option value="draft">Bản nháp</option>
              <option value="published">Đã xuất bản</option>
              <option value="archived">Đã lưu trữ</option>
            </select>
          </div>
        </div>

        <div v-if="loading" class="admin-empty-state">Đang tải bài viết...</div>
        <div v-else-if="!filteredArticles.length" class="admin-empty-state">
          Chưa có bài viết phù hợp.
        </div>
        <div v-else class="table-responsive">
          <table class="admin-table admin-table--orders">
            <thead>
              <tr>
                <th>Bài viết</th>
                <th>Danh mục</th>
                <th>Ngày xuất bản</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in paginatedArticles" :key="getId(item)">
                <td>
                  <div class="news-row">
                    <img
                      v-if="item.thumbnail"
                      class="news-row__thumb"
                      :src="item.thumbnail"
                      :alt="item.title"
                    />
                    <div class="news-row__body">
                      <strong>{{ item.title }}</strong>
                      <div class="inventory-sub">{{ item.slug }}</div>
                      <div v-if="item.tags?.length" class="news-tags">
                        <span v-for="tag in item.tags" :key="tag" class="news-tag">{{ tag }}</span>
                      </div>
                    </div>
                  </div>
                </td>
                <td>{{ categoryName(item.categoryId) }}</td>
                <td>{{ formatDate(item.publishedAt) }}</td>
                <td>
                  <span class="admin-badge" :class="statusClass(item.status)">
                    {{ statusText(item.status) }}
                  </span>
                </td>
                <td>
                  <div class="admin-table__actions">
                    <RouterLink
                      class="admin-btn admin-btn--secondary"
                      :to="{ name: 'admin-news-edit', params: { id: getId(item) } }"
                    >
                      Sửa
                    </RouterLink>
                    <button
                      v-if="item.status !== 'archived'"
                      type="button"
                      class="admin-btn admin-btn--danger"
                      @click.stop="removeArticle(item)"
                    >
                      Xóa
                    </button>
                    <span v-else class="admin-badge admin-badge--danger">Đã xóa</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          <AdminPagination
            v-model="currentPage"
            :total-items="filteredArticles.length"
            :page-size="pageSize"
          />
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.news-row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 260px;
}

.news-row__thumb {
  width: 72px;
  height: 52px;
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
  background: #f8fafc;
}

.news-row__body {
  min-width: 0;
}

.news-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}

.news-tag {
  border-radius: 999px;
  background: #eef2ff;
  color: #3730a3;
  font-size: 12px;
  padding: 2px 8px;
}
</style>
