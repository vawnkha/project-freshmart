import { defineStore } from "pinia";
import { computed, ref, reactive, watch, onScopeDispose } from "vue";
import wishlistService from "@/services/wishlist.service";
import { useAuthStore } from "./auth";
import { normalizeId } from "@/utils/id.util";

export const useWishlistStore = defineStore("wishlist", () => {
  const items = ref([]);
  const loading = ref(false);
  const auth = useAuthStore();
  const ownerVersion = ref(0);
  const mutation = reactive({ busy: false, uncertain: false, fresh: false, error: "", productId: "" });
  let readVersion = 0, reading = false, alive = true;
  const owner = () => normalizeId(auth.userId);
  const live = context => alive && context.owner === owner() && context.version === ownerVersion.value;
  const updateLoading = () => { loading.value = reading || mutation.busy; };
  function reset() {
    ++ownerVersion.value; ++readVersion; reading = false; items.value = [];
    Object.assign(mutation, { busy: false, uncertain: false, fresh: false, error: "", productId: "" });
    updateLoading();
  }
  watch(owner, reset, { flush: "sync" });
  onScopeDispose(() => { alive = false; ++ownerVersion.value; ++readVersion; });

  const wishlishCount = computed(() => items.value.length);

  function isInWishlist(productId) {
    return items.value.some(
      (item) => String(item._id || item.id) === String(productId),
    );
  }

  async function fetchWishlist(userId) {
    if (!alive) return;
    if (!userId) { reset(); return; }
    const context = { owner: normalizeId(userId), version: ownerVersion.value };
    if (!context.owner || context.owner !== owner()) return;
    context.read = ++readVersion;
    if (mutation.uncertain) { mutation.fresh = false; mutation.error = "Đang tải lại yêu thích để đối soát."; }
    reading = true; updateLoading();
    try {
      const data = await wishlistService.getByUser(userId);
      if (!live(context) || context.read !== readVersion) return;
      items.value = data.products || [];
      if (mutation.uncertain) { mutation.fresh = true; mutation.error = "Đã tải lại yêu thích. Kiểm tra dữ liệu trước khi tiếp tục."; }
    } catch (error) {
      if (!live(context) || context.read !== readVersion) return;
      if (mutation.uncertain) { mutation.fresh = false; mutation.error = "Chưa tải lại được yêu thích. Hãy đối soát trước khi thao tác tiếp."; }
      throw error;
    } finally {
      if (live(context) && context.read === readVersion) { reading = false; updateLoading(); }
    }
  }

  async function mutate(userId, productId, operation) {
    const context = { owner: normalizeId(userId), version: ownerVersion.value };
    if (!alive || !context.owner || context.owner !== owner() || mutation.busy || mutation.uncertain || reading) {
      throw Object.assign(new Error(mutation.uncertain ? "Cần đối soát yêu thích trước khi thao tác tiếp." : "Yêu thích đang cập nhật hoặc phiên tài khoản đã thay đổi."), { code: "CLIENT_MUTATION_BLOCKED", clientMutationBlocked: true });
    }
    ++readVersion;
    Object.assign(mutation, { busy: true, fresh: false, error: "", productId: normalizeId(productId) });
    updateLoading();
    try {
      const result = await operation();
      if (!live(context)) return;
      // A pre-toggle GET must not overwrite this confirmed response.
      ++readVersion; reading = false;
      items.value = result.data?.products || [];
      return result;
    } catch (cause) {
      if (!live(context)) return;
      const error = cause instanceof Error ? cause : new Error("Không thể cập nhật yêu thích.");
      if (!error.response || error.response.status === 408 || error.response.status >= 500) {
        mutation.uncertain = true; mutation.fresh = false;
        mutation.error = "Chưa xác định kết quả thao tác. Hãy tải lại yêu thích để đối soát.";
        try { await fetchWishlist(userId); } catch { /* keep unresolved state; never toggle again */ }
        if (!live(context)) return;
        error.clientMutationUncertain = true;
        error.clientMutationRecovered = mutation.fresh;
      }
      throw error;
    } finally {
      if (live(context)) { mutation.busy = false; updateLoading(); }
    }
  }

  async function toggleWishlist(userId, productId) {
    return mutate(userId, productId, () => wishlistService.toggleItem(userId, productId));
  }

  async function removeFromWishlist(userId, productId) {
    return mutate(userId, productId, () => wishlistService.removeItem(userId, productId));
  }

  async function clearWishlist(userId) {
    return mutate(userId, "", () => wishlistService.clear(userId));
  }

  async function refreshMutation() { if (mutation.uncertain && !loading.value && owner()) await fetchWishlist(owner()); }
  function acknowledgeMutation() {
    if (mutation.uncertain && mutation.fresh && !loading.value) Object.assign(mutation, { uncertain: false, fresh: false, error: "", productId: "" });
  }

  return {
    items,
    loading,
    wishlishCount,
    isInWishlist,
    fetchWishlist,
    removeFromWishlist,
    toggleWishlist,
    clearWishlist,
    ownerVersion,
    mutation,
    refreshMutation,
    acknowledgeMutation,
  };
});
