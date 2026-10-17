import { normalizeId } from './id.util.js';
import { availableStock, normalizeList, productPrice } from './storefront.util.js';
import { userError } from './user-error.util.js';

// Presentation-only navigation; desktop and mobile use the same inventory.
export const CLIENT_NAVIGATION = Object.freeze([
  { to: '/', label: 'Trang chủ' }, { to: '/products', label: 'Sản phẩm' },
  { to: '/blog', label: 'Kiến thức & tin tức' }, { to: '/about', label: 'Giới thiệu' },
  { to: '/contact', label: 'Liên hệ' },
]);
export function isClientRouteActive(path, target) {
  return target === '/' ? path === '/' : path === target || path.startsWith(target + '/');
}
export function canOpenSearch(event) {
  return event.key === '/' && !event.defaultPrevented && !event.repeat && !event.ctrlKey && !event.altKey && !event.metaKey &&
    !event.target?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],dialog[open]');
}
export function publicSearchProducts(response) {
  return normalizeList(response).filter(p => normalizeId(p._id || p.id) &&
    (!p.status || ['active', 'in_stock', 'out_stock', 'out_of_stock'].includes(p.status)));
}

// The service has no AbortSignal parameter. Versioning discards both stale
// successes and errors, including responses received after close/unmount.
export function createStorefrontSearch({ search, publish, log = console.warn, delay = 160, clock = globalThis }) {
  let version = 0, timer, disposed = false, keyword = '';
  function invalidate() { ++version; clock.clearTimeout(timer); timer = undefined; }
  async function run(text, request) {
    publish({ keyword: text, products: [], status: 'loading', error: '' });
    try {
      const products = publicSearchProducts(await search({ q: text }));
      if (!disposed && request === version) publish({ keyword: text, products, status: 'ready', error: '' });
    } catch (error) {
      if (!disposed && request === version) {
        log('Storefront search failed', error);
        publish({ keyword: text, products: [], status: 'error', error: userError(error, 'Không thể tìm sản phẩm. Vui lòng thử lại.') });
      }
    }
  }
  return {
    update(value) {
      if (disposed) return;
      invalidate(); keyword = String(value || '').trim();
      publish({ keyword, products: [], status: keyword ? 'waiting' : 'idle', error: '' });
      if (keyword) { const request = version; timer = clock.setTimeout(() => run(keyword, request), delay); }
    },
    retry() { if (!disposed && keyword) { invalidate(); return run(keyword, version); } },
    dispose() { disposed = true; invalidate(); },
  };
}

export function cartLineProblem(item) {
  if (!normalizeId(item.product_id)) return 'Thông tin sản phẩm không hợp lệ. Vui lòng mở giỏ hàng để kiểm tra.';
  if (productPrice(item) === null) return 'Sản phẩm chưa có giá bán.';
  if (availableStock(item) < 1 || item.outOfStock === true) return 'Sản phẩm hiện không còn hàng để bán.';
  if (!Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 1) return 'Số lượng không hợp lệ.';
  if (Number(item.quantity) > availableStock(item)) return 'Số lượng trong giỏ vượt tồn kho khả dụng. Vui lòng giảm số lượng.';
  return '';
}

// One mutation at a time, including its store-owned refresh. No optimistic
// totals, automatic mutation retry, or local inventory calculation.
export function createMiniCartController({ cart, userId, publish, log = console.warn }) {
  let busy = false, disposed = false, generation = 0;
  let state = { busy: false, error: '', notice: '', loaded: false };
  function update(next) { state = { ...state, ...next }; if (!disposed) publish(state); }
  async function perform(action, message) {
    if (disposed || busy || cart.loading || !userId()) return false;
    const owner = userId(), ownerVersion = cart.ownerVersion, run = ++generation;
    const live = () => !disposed && owner === userId() && ownerVersion === cart.ownerVersion && run === generation;
    busy = true; update({ busy: true, error: '', notice: '' });
    try {
      await action(owner);
      if (live()) update({ loaded: true, notice: message });
      return live();
    } catch (error) {
      if (live()) {
        log('Storefront mini-cart failed', { code: error.code, status: error.response?.status });
        update({ error: userError(error, 'Không thể cập nhật giỏ hàng. Hãy tải lại để kiểm tra trạng thái mới nhất.'), loaded: false });
      }
      return false;
    } finally { if (run === generation) { busy = false; if (live()) update({ busy: false }); } }
  }
  return {
    refresh() { return perform(async id => {
      await cart.fetchCart(id);
      // An explicit read reconciles absolute PUT/DELETE state. An additive POST
      // remains protected until the shopper acknowledges the displayed cart.
      if (cart.mutation?.uncertain && cart.mutation.fresh && cart.mutation.kind !== 'add') cart.acknowledgeMutation();
    }, ''); },
    quantity(item, value) {
      if (busy || cart.loading || disposed) return Promise.resolve(false);
      const amount = Number(value);
      if (!normalizeId(item.product_id) || productPrice(item) === null || item.outOfStock === true || !Number.isInteger(amount) || amount < 1 || amount > availableStock(item)) {
        update({ error: 'Số lượng phải là số nguyên từ 1 đến tồn kho khả dụng.', notice: '' }); return Promise.resolve(false);
      }
      if (amount === Number(item.quantity)) return Promise.resolve(true);
      return perform(id => cart.updateQuantity(id, normalizeId(item.product_id), amount), 'Đã cập nhật số lượng.');
    },
    remove(item) {
      if (!normalizeId(item.product_id)) { update({ error: 'Thông tin sản phẩm không hợp lệ.' }); return Promise.resolve(false); }
      return perform(id => cart.removeFromCart(id, normalizeId(item.product_id)), 'Đã xóa sản phẩm khỏi giỏ hàng.');
    },
    invalidate() { ++generation; busy = false; update({ busy: false, error: '', notice: '', loaded: false }); },
    dispose() { disposed = true; ++generation; },
  };
}

export function breadcrumbParent(to, routeQuery = {}) {
  if (!to) return undefined;
  if (to !== '/products' && to?.path !== '/products') return to;
  const target = typeof to === 'string' ? { path: to } : { ...to };
  const query = Object.fromEntries(['q', 'category_id', 'sort', 'page'].filter(key => routeQuery[key] != null).map(key => [key, routeQuery[key]]));
  return { ...target, query: { ...query, ...target.query } };
}
