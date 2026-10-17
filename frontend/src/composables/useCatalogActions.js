import { reactive, watch, onBeforeUnmount } from 'vue';
import { useAuthStore } from '@/stores/user/auth';
import { useCartStore } from '@/stores/user/cart';
import { useWishlistStore } from '@/stores/user/wishlist';
import { useRouter } from 'vue-router';
import { normalizeId } from '@/utils/id.util';
import { productPrice } from '@/utils/storefront.util';
import { catalogStock } from '@/utils/catalog-query.util';
import { userError } from '@/utils/user-error.util';
import { notify } from '@/composables/useStorefrontNotice';

// Catalog keeps feedback across pagination/filter remounts. Shared stores own
// serialization, owner fences and recovery; this coordinator never replays writes.
export function useCatalogActions() {
  const auth = useAuthStore(), cart = useCartStore(), wishlist = useWishlistStore(), router = useRouter();
  const state = reactive({ busy: '', productId: '', error: '', success: '', uncertain: '', fresh: false });
  let disposed = false, generation = 0;
  const id = product => normalizeId(product.product_id || product._id || product.id);
  const live = (owner, run) => !disposed && generation === run && owner === auth.userId;
  const locked = () => !!state.busy || !!state.uncertain || cart.loading || wishlist.loading || cart.mutation.uncertain || wishlist.mutation.uncertain;
  function quantity(product) { return cart.items.filter(item => normalizeId(item.product_id) === id(product)).reduce((sum, item) => sum + Number(item.quantity || 0), 0); }
  function canAdd(product) { return !!id(product) && productPrice(product) !== null && catalogStock(product) >= 1 && quantity(product) + 1 <= catalogStock(product) && !locked(); }
  function reset() { Object.assign(state, { busy: '', productId: '', error: '', success: '', uncertain: '', fresh: false }); }
  async function read(owner, run, kind) {
    if (!live(owner, run)) return;
    try {
      await (kind === 'cart' ? cart.fetchCart(owner) : wishlist.fetchWishlist(owner));
      if (live(owner, run)) state.fresh = (kind === 'cart' ? cart : wishlist).mutation.fresh;
    } catch (cause) {
      if (live(owner, run)) { state.fresh = false; state.error = 'Chưa tải lại được dữ liệu. Kiểm tra kết nối rồi tải lại trước khi thao tác tiếp.'; }
    }
  }
  async function perform(product, kind) {
    if (locked() || (kind === 'cart' && !canAdd(product)) || !id(product)) return;
    if (!auth.userId) { notify('Vui lòng đăng nhập để sử dụng chức năng này.'); router.push('/login'); return; }
    const owner = auth.userId, run = generation; reset(); state.busy = kind; state.productId = id(product);
    try {
      await (kind === 'cart' ? cart.addToCart(owner, id(product), 1) : wishlist.toggleWishlist(owner, id(product)));
      if (live(owner, run)) { state.success = kind === 'cart' ? 'Đã thêm sản phẩm vào giỏ hàng.' : 'Đã cập nhật danh sách yêu thích.'; notify(state.success, 'success'); }
    } catch (cause) {
      if (!live(owner, run)) return;
      console.warn('[Catalog] Mutation failed', { kind, status: cause.response?.status, code: cause.code });
      // A POST can have committed before a timeout, or its following GET failed.
      // Read once; never replay the additive POST/toggle as a recovery action.
      const uncertain = cause.clientMutationUncertain || (!cause.clientMutationBlocked && !cause.response) || cause.response?.status >= 500 || cause.config?.method?.toLowerCase() === 'get';
      state.error = uncertain ? 'Chưa xác định kết quả thao tác. Hãy kiểm tra dữ liệu mới nhất trước khi thao tác tiếp.' : userError(cause, 'Thao tác bị từ chối. Vui lòng kiểm tra thông tin sản phẩm.');
      if (uncertain) { state.uncertain = kind; if (cause.clientMutationUncertain) state.fresh = (kind === 'cart' ? cart : wishlist).mutation.fresh; else await read(owner, run, kind); }
      if (live(owner, run)) notify(state.error, 'error');
    } finally { if (live(owner, run)) state.busy = ''; }
  }
  async function refresh() {
    if (state.busy || !state.uncertain || !auth.userId) return;
    const kind = state.uncertain, owner = auth.userId, run = generation; state.busy = 'read';
    try { await read(owner, run, kind); } finally { if (live(owner, run)) state.busy = ''; }
  }
  watch(() => [auth.userId, cart.ownerVersion, wishlist.ownerVersion], () => { ++generation; reset(); }, { flush: 'sync' });
  watch(() => [cart.mutation.uncertain, cart.mutation.fresh, cart.mutation.error, wishlist.mutation.uncertain, wishlist.mutation.fresh, wishlist.mutation.error], () => {
    const kind = cart.mutation.uncertain ? 'cart' : wishlist.mutation.uncertain ? 'wishlist' : '';
    if (kind) { const shared = (kind === 'cart' ? cart : wishlist).mutation; state.uncertain = kind; state.fresh = shared.fresh; state.error = 'Chưa xác định kết quả thao tác. ' + shared.error; }
    else if (state.uncertain) reset();
  }, { immediate: true });
  onBeforeUnmount(() => { disposed = true; ++generation; });
  return { state, locked, quantity, canAdd, add: product => perform(product, 'cart'), toggle: product => perform(product, 'wishlist'), refresh,
    acknowledge() { const store = state.uncertain === 'cart' ? cart : wishlist; if (state.fresh && !state.busy && store.mutation.fresh && !store.loading) { store.acknowledgeMutation(); if (!store.mutation.uncertain) reset(); } }, isSaved: product => wishlist.isInWishlist(id(product)) };
}
