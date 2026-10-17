import { reactive, watch, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/user/auth';
import { useCartStore } from '@/stores/user/cart';
import { useWishlistStore } from '@/stores/user/wishlist';
import { detailId, detailStock, quantityMessage } from '@/utils/product-detail.util';
import { productPrice } from '@/utils/storefront.util';
import { notify } from '@/composables/useStorefrontNotice';
import { userError } from '@/utils/user-error.util';

// Main quantity and related cards share feedback. The stores coordinate pending
// writes and uncertainty across consumers; quantity and API contracts stay intact.
export function useProductPurchase() {
  const auth = useAuthStore(), cart = useCartStore(), wishlist = useWishlistStore(), router = useRouter();
  const state = reactive({ busy: '', productId: '', success: '', error: '', uncertain: '', fresh: false });
  let generation = 0, disposed = false;
  const id = product => detailId(product?._id || product?.id);
  const live = (owner, run) => !disposed && run === generation && owner === auth.userId;
  function reset() { Object.assign(state, { busy: '', productId: '', success: '', error: '', uncertain: '', fresh: false }); }
  function quantity(product) { return cart.items.filter(row => detailId(row.product_id) === id(product)).reduce((sum, row) => sum + Number(row.quantity || 0), 0); }
  function maximum(product) { const stock = detailStock(product); return stock === null ? null : Math.max(0, Math.floor(stock) - quantity(product)); }
  function locked() { return !!state.busy || !!state.uncertain || cart.loading || wishlist.loading || cart.mutation.uncertain || wishlist.mutation.uncertain; }
  function canAdd(product, amount = 1) { return !!id(product) && productPrice(product) !== null && !quantityMessage(amount, maximum(product)) && !locked(); }
  async function read(owner, run, kind) {
    if (!live(owner, run)) return;
    try {
      await (kind === 'cart' ? cart.fetchCart(owner) : wishlist.fetchWishlist(owner));
      if (live(owner, run)) state.fresh = (kind === 'cart' ? cart : wishlist).mutation.fresh;
    } catch {
      if (live(owner, run)) { state.fresh = false; state.error = 'Chưa tải lại được dữ liệu. Kiểm tra kết nối rồi tải lại trước khi thao tác tiếp.'; }
    }
  }
  async function perform(product, kind, amount = 1) {
    if (locked() || !id(product) || (kind === 'cart' && !canAdd(product, amount))) return;
    if (!auth.userId) { notify('Vui lòng đăng nhập để sử dụng chức năng này.'); router.push('/login'); return; }
    const owner = auth.userId, run = generation; reset(); state.busy = kind; state.productId = id(product);
    try {
      await (kind === 'cart' ? cart.addToCart(owner, id(product), Number(amount)) : wishlist.toggleWishlist(owner, id(product)));
      if (live(owner, run)) { state.success = kind === 'cart' ? 'Đã thêm sản phẩm vào giỏ hàng.' : 'Đã cập nhật danh sách yêu thích.'; notify(state.success, 'success'); }
    } catch (cause) {
      if (!live(owner, run)) return;
      console.warn('[PDP] Mutation failed', { kind, status: cause.response?.status, code: cause.code });
      const uncertain = cause.clientMutationUncertain || (!cause.clientMutationBlocked && !cause.response) || cause.response?.status >= 500 || cause.config?.method?.toLowerCase() === 'get';
      state.error = uncertain ? 'Chưa xác định kết quả thao tác. Hãy kiểm tra dữ liệu mới nhất trước khi thao tác tiếp.' : userError(cause, 'Chưa thể thêm sản phẩm. Số lượng khả dụng có thể đã thay đổi.');
      if (uncertain) { state.uncertain = kind; if (cause.clientMutationUncertain) state.fresh = (kind === 'cart' ? cart : wishlist).mutation.fresh; else await read(owner, run, kind); }
      if (live(owner, run)) notify(state.error, 'error');
    } finally { if (live(owner, run)) state.busy = ''; }
  }
  async function refresh() {
    if (state.busy || !state.uncertain || !auth.userId) return;
    const owner = auth.userId, run = generation, kind = state.uncertain; state.busy = 'read';
    try { await read(owner, run, kind); } finally { if (live(owner, run)) state.busy = ''; }
  }
  watch(() => [auth.userId, cart.ownerVersion, wishlist.ownerVersion], () => { ++generation; reset(); }, { flush: 'sync' });
  watch(() => [cart.mutation.uncertain, cart.mutation.fresh, cart.mutation.error, wishlist.mutation.uncertain, wishlist.mutation.fresh, wishlist.mutation.error], () => {
    const kind = cart.mutation.uncertain ? 'cart' : wishlist.mutation.uncertain ? 'wishlist' : '';
    if (kind) { const shared = (kind === 'cart' ? cart : wishlist).mutation; state.uncertain = kind; state.fresh = shared.fresh; state.error = 'Chưa xác định kết quả thao tác. ' + shared.error; }
    else if (state.uncertain) reset();
  }, { immediate: true });
  onBeforeUnmount(() => { disposed = true; ++generation; });
  return { state, quantity, maximum, locked, canAdd, add: (product, amount = 1) => perform(product, 'cart', amount),
    toggle: product => perform(product, 'wishlist'), isSaved: product => wishlist.isInWishlist(id(product)), refresh,
    acknowledge() { const store = state.uncertain === 'cart' ? cart : wishlist; if (state.fresh && !state.busy && store.mutation.fresh && !store.loading) { store.acknowledgeMutation(); if (!store.mutation.uncertain) reset(); } } };
}
