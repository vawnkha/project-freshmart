<script setup>
import { computed, onBeforeUnmount, ref, watch } from "vue";
import AdminPagination from "@/components/admin/common/AdminPagination.vue";
import commentService from "@/services/article-comment.service";
import newsService from "@/services/news.service";
import { captureAuthRequestContext, useAuthStore } from "@/stores/user/auth";
import { hasAllPermissions } from "@/utils/permission.util";
import { commentPage } from "@/utils/article-comment.util";
import { normalizeId } from "@/utils/id.util";
import { normalizeList } from "@/utils/storefront.util";
import { userError } from "@/utils/user-error.util";

const auth = useAuthStore();
const canManage = computed(() => auth.isLoggedIn && hasAllPermissions(auth, ["admin:access", "news:manage"]));
const items = ref([]), articles = ref([]), total = ref(0), page = ref(1), keyword = ref(""), articleId = ref("");
const loading = ref(false), busy = ref(false), error = ref(""), actionError = ref(""), success = ref(""), articleError = ref("");
let version = 0, generation = 0, disposed = false, controller, timer;
const pageSize = 20;
function date(value) { const parsed = new Date(value);return Number.isNaN(parsed.getTime()) ? "" : parsed.toLocaleString("vi-VN"); }

async function load() {
  clearTimeout(timer);
  if (disposed || !canManage.value) return;
  controller?.abort();controller = new AbortController();
  const currentVersion = ++version, context = captureAuthRequestContext();
  const current = () => !disposed && canManage.value && currentVersion === version && !!context?.isCurrent();
  loading.value = true;error.value = "";
  try {
    const result = commentPage(await commentService.listAdmin({ page: page.value, limit: pageSize, keyword: keyword.value.trim() || undefined, article_id: articleId.value || undefined }, controller.signal));
    if (!current()) return;
    if (page.value > result.meta.pages) { page.value = result.meta.pages;return load(); }
    items.value = result.data;total.value = result.meta.total;
  } catch (cause) { if (current()) { error.value = userError(cause, "Không thể tải bình luận.");items.value = []; } }
  finally { if (current()) loading.value = false; }
}

async function loadArticles() {
  const currentGeneration = generation, context = captureAuthRequestContext();
  articleError.value = "";
  try {
    const result = await newsService.getAll();
    if (!disposed && canManage.value && generation === currentGeneration && context?.isCurrent()) articles.value = normalizeList(result);
  } catch (cause) { if (!disposed && generation === currentGeneration && context?.isCurrent()) articleError.value = userError(cause, "Không thể tải lựa chọn bài viết."); }
}

async function remove(comment) {
  if (!canManage.value || busy.value || !window.confirm("Xóa bình luận này? Thao tác không thể hoàn tác.")) return;
  const currentGeneration = generation, context = captureAuthRequestContext();
  const current = () => !disposed && canManage.value && generation === currentGeneration && !!context?.isCurrent();
  busy.value = true;actionError.value = "";success.value = "";
  try {
    await commentService.remove(comment._id);
    if (!current()) return;
    success.value = "Đã xóa bình luận.";await load();
  } catch (cause) {
    if (current()) {
      actionError.value = !cause.response?.status || cause.response.status >= 500 ? "Chưa xác định kết quả xóa. Hãy làm mới danh sách để kiểm tra trước khi thao tác lại." : userError(cause, "Không thể xóa bình luận.");
    }
  } finally { if (current()) busy.value = false; }
}

watch([keyword, articleId], () => {
  page.value = 1;++version;controller?.abort();loading.value = false;
  clearTimeout(timer);timer = setTimeout(load, 300);
});
watch([() => auth.userId, () => auth.accessToken, canManage], () => {
  ++generation;++version;controller?.abort();clearTimeout(timer);
  items.value = [];articles.value = [];total.value = 0;page.value = 1;busy.value = false;loading.value = false;
  error.value = canManage.value ? "" : "Bạn không có quyền quản lý bình luận.";actionError.value = "";success.value = "";
  const current = generation;
  queueMicrotask(() => { if (!disposed && generation === current && canManage.value) { load();loadArticles(); } });
}, { immediate: true, flush: "sync" });
onBeforeUnmount(() => { disposed = true;++version;++generation;controller?.abort();clearTimeout(timer); });
</script>
<template>
  <div class="admin-comment-page">
    <div class="admin-page-title admin-page-title--stack"><h1>Bình luận bài viết</h1><p>Quản lý trao đổi của người dùng trong mục tin tức.</p></div>
    <section class="admin-panel">
      <div class="admin-panel__header admin-panel__header--flex"><div><strong>{{ total }} bình luận</strong></div><button type="button" class="admin-btn admin-btn--secondary" :disabled="loading || busy || !canManage" @click="load">Làm mới</button></div>
      <div class="admin-panel__body">
        <div class="admin-comment-filters">
          <label>Tìm kiếm<input v-model="keyword" type="search" maxlength="100" class="admin-toolbar__input" placeholder="Nội dung, người đăng hoặc bài viết" :disabled="!canManage" /></label>
          <label>Bài viết<select v-model="articleId" class="admin-toolbar__select" :disabled="!canManage"><option value="">Tất cả bài viết</option><option v-for="article in articles" :key="normalizeId(article._id)" :value="normalizeId(article._id)">{{ article.title }}</option></select></label>
        </div>
        <p v-if="articleError" role="alert">{{ articleError }} <button type="button" class="admin-btn admin-btn--secondary" @click="loadArticles">Tải lại bài viết</button></p>
        <p v-if="success" role="status">{{ success }}</p><p v-if="actionError" role="alert">{{ actionError }}</p>
        <p v-if="error" role="alert">{{ error }} <button v-if="canManage" type="button" class="admin-btn admin-btn--secondary" @click="load">Thử lại</button></p>
        <p v-if="loading" role="status" class="admin-empty-state">Đang tải bình luận…</p>
        <p v-else-if="!error && !items.length" class="admin-empty-state">Không có bình luận phù hợp.</p>
        <div v-else-if="!error" class="admin-comment-table-wrap" :aria-busy="loading" role="region" aria-label="Danh sách bình luận" tabindex="0">
          <table class="admin-table"><thead><tr><th>Người đăng</th><th>Bài viết</th><th>Nội dung</th><th>Thời gian</th><th>Thao tác</th></tr></thead><tbody>
            <tr v-for="comment in items" :key="comment._id">
              <td>{{ comment.author?.name || 'Người dùng' }}</td>
              <td><RouterLink v-if="comment.article" :to="{ name: 'admin-news-edit', params: { id: comment.article._id } }">{{ comment.article.title }}</RouterLink><span v-else>Bài viết không còn tồn tại</span></td>
              <td class="admin-comment-content">{{ comment.content }}</td><td><time :datetime="comment.created_at">{{ date(comment.created_at) }}</time></td>
              <td><button type="button" class="admin-btn admin-btn--danger" :disabled="busy || loading || !canManage" @click="remove(comment)">{{ busy ? 'Đang xử lý…' : 'Xóa' }}</button></td>
            </tr>
          </tbody></table>
        </div>
        <AdminPagination v-if="!error && !loading" v-model="page" :total-items="total" :page-size="pageSize" @change="load" />
      </div>
    </section>
  </div>
</template>
<style scoped>
.admin-comment-filters { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 16px; margin-bottom: 20px; }
.admin-comment-filters label { display: grid; gap: 8px; min-width: 0; }
.admin-comment-filters input, .admin-comment-filters select { min-width: 0; font-weight: 400; }
.admin-comment-table-wrap { max-width: 100%; overflow-x: auto; }
.admin-table { min-width: 760px; }
.admin-comment-content { white-space: pre-wrap; overflow-wrap: anywhere; min-width: 220px; max-width: 480px; }
.admin-table td { vertical-align: top; }
.admin-comment-page :deep(.admin-pagination__controls) { flex-wrap: wrap; }
@media (max-width: 640px) { .admin-comment-filters { grid-template-columns: minmax(0,1fr); } }
@media (max-width: 768px) {
  :global(.admin-shell:has(.admin-comment-page)) { flex-direction: column; }
  :global(.admin-shell:has(.admin-comment-page) > .admin-sidebar) { position: static; width: 100%; height: auto; max-height: 240px; }
  :global(.admin-content:has(.admin-comment-page)) { width: 100%; margin-left: 0; }
}
</style>
