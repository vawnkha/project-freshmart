import { defineStore } from "pinia";
import { computed, ref, reactive, watch, onScopeDispose } from "vue";
import cartService from "@/services/cart.service";
import { useAuthStore } from "./auth";
import { normalizeId } from "@/utils/id.util";

export const useCartStore = defineStore("cart", () => {
  const items = ref([]);
  const subtotal = ref(0);
  const loading = ref(false);
  const auth = useAuthStore();
  const ownerVersion = ref(0);
  const mutation = reactive({ busy: false, uncertain: false, fresh: false, error: "", productId: "", kind: "" });
  let readVersion = 0, reading = false, alive = true;
  const owner = () => normalizeId(auth.userId);
  const live = context => alive && context.owner === owner() && context.version === ownerVersion.value;
  const updateLoading = () => { loading.value = reading || mutation.busy; };
  function reset() {
    ++ownerVersion.value; ++readVersion; reading = false;
    items.value = []; subtotal.value = 0;
    Object.assign(mutation, { busy: false, uncertain: false, fresh: false, error: "", productId: "", kind: "" });
    updateLoading();
  }
  watch(owner, reset, { flush: "sync" });
  onScopeDispose(() => { alive = false; ++ownerVersion.value; ++readVersion; });

  const cartCount = computed(() =>
    items.value.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
  );

  const cartTotal = computed(() => subtotal.value);

  async function fetchCart(userId) {
    if (!alive) return;
    if (!userId) { reset(); return; }
    const context = { owner: normalizeId(userId), version: ownerVersion.value };
    if (!context.owner || context.owner !== owner()) return;
    context.read = ++readVersion;
    if (mutation.uncertain) { mutation.fresh = false; mutation.error = "Đang tải lại giỏ hàng để đối soát."; }
    reading = true; updateLoading();
    try {
      const data = await cartService.getCart(userId);
      if (!live(context) || context.read !== readVersion) return;
      items.value = data.items || [];
      subtotal.value = data.subtotal || 0;
      if (mutation.uncertain) { mutation.fresh = true; mutation.error = "Đã tải lại giỏ hàng. Kiểm tra dữ liệu trước khi tiếp tục."; }
    } catch (error) {
      if (!live(context) || context.read !== readVersion) return;
      if (mutation.uncertain) { mutation.fresh = false; mutation.error = "Chưa tải lại được giỏ hàng. Hãy đối soát trước khi thao tác tiếp."; }
      throw error;
    } finally {
      if (live(context) && context.read === readVersion) { reading = false; updateLoading(); }
    }
  }

  async function mutate(userId, productId, operation, kind) {
    const context = { owner: normalizeId(userId), version: ownerVersion.value };
    if (!alive || !context.owner || context.owner !== owner() || mutation.busy || mutation.uncertain || reading) {
      throw Object.assign(new Error(mutation.uncertain ? "Cần đối soát giỏ hàng trước khi thao tác tiếp." : "Giỏ hàng đang cập nhật hoặc phiên tài khoản đã thay đổi."), { code: "CLIENT_MUTATION_BLOCKED", clientMutationBlocked: true });
    }
    ++readVersion;
    Object.assign(mutation, { busy: true, fresh: false, error: "", productId: normalizeId(productId), kind });
    updateLoading();
    let confirmed = false;
    try {
      await operation();
      if (!live(context)) return;
      confirmed = true;
      await fetchCart(userId);
    } catch (cause) {
      if (!live(context)) return;
      const error = cause instanceof Error ? cause : new Error("Không thể cập nhật giỏ hàng.");
      const uncertain = confirmed || !error.response || error.response.status === 408 || error.response.status >= 500;
      if (uncertain) {
        mutation.uncertain = true; mutation.fresh = false;
        mutation.error = "Chưa xác định kết quả thao tác. Hãy tải lại giỏ hàng để đối soát.";
        // Read, never replay the additive POST or another mutation.
        try { await fetchCart(userId); } catch { /* fetch keeps the recovery error and lock */ }
        if (!live(context)) return;
        error.clientMutationUncertain = true;
        error.clientMutationRecovered = mutation.fresh;
      }
      throw error;
    } finally {
      if (live(context)) { mutation.busy = false; updateLoading(); }
    }
  }

  async function addToCart(userId, productId, quantity = 1) {
    await mutate(userId, productId, () => cartService.addItem(userId, productId, quantity), "add");
  }

  async function updateQuantity(userId, productId, quantity) {
    await mutate(userId, productId, () => cartService.updateItem(userId, productId, quantity), "quantity");
  }

  async function removeFromCart(userId, productId) {
    await mutate(userId, productId, () => cartService.removeItem(userId, productId), "remove");
  }

  async function clearCart(userId) {
    await mutate(userId, "", () => cartService.clearCart(userId), "clear");
  }

  async function refreshMutation() { if (mutation.uncertain && !loading.value && owner()) await fetchCart(owner()); }
  function acknowledgeMutation() {
    if (mutation.uncertain && mutation.fresh && !loading.value) Object.assign(mutation, { uncertain: false, fresh: false, error: "", productId: "", kind: "" });
  }

  return {
    items,
    subtotal,
    loading,
    cartCount,
    cartTotal,
    fetchCart,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    ownerVersion,
    mutation,
    refreshMutation,
    acknowledgeMutation,
  };
});
