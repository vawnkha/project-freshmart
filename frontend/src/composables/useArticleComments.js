import { computed, onBeforeUnmount, reactive, ref, watch } from "vue";
import { captureAuthRequestContext, useAuthStore } from "@/stores/user/auth";
import commentService from "@/services/article-comment.service";
import { commentContentError, commentPage } from "@/utils/article-comment.util";
import { userError } from "@/utils/user-error.util";

export function useArticleComments(articleId) {
  const auth = useAuthStore();
  const items = ref([]), total = ref(0), page = ref(1), hasMore = ref(false);
  const form = reactive({ content: "", editId: "", editContent: "" });
  const state = reactive({ loading: false, error: "", busy: false, sendError: "", success: "", fieldError: "", uncertain: false, fresh: false });
  const canWrite = computed(() => !!auth.userId && !!auth.accessToken && auth.isLoggedIn);
  const locked = computed(() => state.busy || state.uncertain);
  let epoch = 0, readVersion = 0, disposed = false, controller;

  async function load(more = false) {
    if (disposed || !articleId.value || (more && (state.loading || !hasMore.value))) return;
    controller?.abort();controller = new AbortController();
    const version = ++readVersion, generation = epoch, id = articleId.value, next = more ? page.value + 1 : 1;
    state.loading = true;state.error = "";
    const current = () => !disposed && epoch === generation && version === readVersion && articleId.value === id;
    try {
      const response = commentPage(await commentService.list(id, { page: next, limit: 10 }, controller.signal));
      if (!current()) return false;
      items.value = more ? [...new Map([...items.value, ...response.data].map(row => [row._id, row])).values()] : response.data;
      total.value = response.meta.total;page.value = response.meta.page;hasMore.value = response.meta.hasMore;
      if (state.uncertain) state.fresh = true;
      return true;
    } catch (error) {
      if (current()) {
        state.error = userError(error, "Không thể tải bình luận. Vui lòng thử lại.");
        if (error.response?.status === 404) { items.value = [];total.value = 0;hasMore.value = false;cancelEdit(); }
      }
      return false;
    } finally { if (current()) state.loading = false; }
  }

  function cancelEdit() { form.editId = "";form.editContent = "";state.fieldError = ""; }
  function edit(comment) {
    if (locked.value || String(comment.user_id) !== String(auth.userId)) return;
    form.editId = comment._id;form.editContent = comment.content;state.fieldError = "";
  }
  function acknowledge() {
    if (state.uncertain && state.fresh && !state.busy && !state.loading) {
      state.uncertain = false;state.fresh = false;state.sendError = "";
    }
  }

  async function mutate(kind, commentId) {
    if (disposed || !canWrite.value || locked.value) return false;
    const content = kind === "create" ? form.content : form.editContent;
    state.fieldError = kind === "remove" ? "" : commentContentError(content);
    if (state.fieldError) return false;
    state.busy = true;state.sendError = "";state.success = "";
    // An older list read cannot publish a comment removed/edited by this write.
    ++readVersion;controller?.abort();state.loading = false;
    const generation = epoch, id = articleId.value, context = captureAuthRequestContext();
    const current = () => !disposed && epoch === generation && id === articleId.value && !!context?.isCurrent();
    try {
      const response = kind === "create" ? await commentService.create(id, content.trim())
        : kind === "update" ? await commentService.update(commentId, content.trim()) : await commentService.remove(commentId);
      if (!current()) return false;
      if (!response?.data?._id) throw new TypeError("Invalid comment mutation response");
      if (kind === "create") {
        form.content = "";items.value = [response.data, ...items.value];total.value++;
      } else if (kind === "update") {
        items.value = items.value.map(row => row._id === commentId ? response.data : row);cancelEdit();
      } else {
        items.value = items.value.filter(row => row._id !== commentId);total.value = Math.max(0, total.value - 1);
        if (form.editId === commentId) cancelEdit();
      }
      state.success = kind === "create" ? "Đã gửi bình luận." : kind === "update" ? "Đã cập nhật bình luận." : "Đã xóa bình luận.";
      await load();
      return true;
    } catch (error) {
      if (!current()) return false;
      const status = error.response?.status;
      state.uncertain = !status || status >= 500;
      state.fresh = false;
      state.sendError = state.uncertain ? "Chưa xác định kết quả thao tác. Hãy tải lại bình luận để kiểm tra trước khi gửi tiếp." : userError(error, "Không thể cập nhật bình luận.");
      return false;
    } finally { if (current()) state.busy = false; }
  }

  watch([articleId, () => auth.userId, () => auth.accessToken, () => auth.isLoggedIn], () => {
    ++epoch;++readVersion;controller?.abort();items.value = [];total.value = 0;page.value = 1;hasMore.value = false;
    Object.assign(form, { content: "", editId: "", editContent: "" });
    Object.assign(state, { loading: false, error: "", busy: false, sendError: "", success: "", fieldError: "", uncertain: false, fresh: false });
    const current = epoch;
    queueMicrotask(() => { if (!disposed && current === epoch) load(); });
  }, { immediate: true, flush: "sync" });
  onBeforeUnmount(() => { disposed = true;++epoch;++readVersion;controller?.abort(); });
  return { auth, items, total, page, hasMore, form, state, canWrite, locked, load, edit, cancelEdit, acknowledge, submit: () => mutate("create"), save: () => mutate("update", form.editId), remove: id => mutate("remove", id) };
}
