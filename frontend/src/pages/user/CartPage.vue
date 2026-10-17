<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { useAuthStore } from "@/stores/user/auth";
import { useCartStore } from "@/stores/user/cart";
import { formatMoney, productPrice } from "@/utils/storefront.util";
import { catalogStock } from "@/utils/catalog-query.util";
import { cartLineProblem } from "@/utils/storefront-shell.util";
import { normalizeId } from "@/utils/id.util";
import { notify } from "@/composables/useStorefrontNotice";
import { userError } from "@/utils/user-error.util";
import PageHeading from "@/components/user/common/PageHeading.vue";
import AppState from "@/components/user/common/AppState.vue";
import ResponsiveImage from "@/components/user/common/ResponsiveImage.vue";
import SageButton from "@/components/user/sage/SageButton.vue";
import SageSkeleton from "@/components/user/sage/SageSkeleton.vue";
const auth = useAuthStore();
const cart = useCartStore();
const { items, cartTotal } = storeToRefs(cart);
const loading = ref(true);
const error = ref("");
const busy = ref({});
const quantityErrors = ref({});
const confirmClear = ref(false);
const clearing = ref(false), actionError = ref(''), root = ref(null), clearTrigger = ref(null);
let generation = 0, readRequest = 0, disposed = false;
const context = () => ({ owner: auth.userId, version: cart.ownerVersion, generation });
const live = ctx => !disposed && ctx.owner === auth.userId && ctx.version === cart.ownerVersion && ctx.generation === generation;
const pending = computed(() => loading.value || cart.loading || clearing.value || Object.values(busy.value).some(Boolean));
const mutationsDisabled = computed(() => pending.value || !!error.value || cart.mutation.uncertain || !auth.userId);
function problem(item) {
  if (catalogStock(item) === null) return 'Chưa xác định tồn kho. Tải lại giỏ hàng để kiểm tra.';
  return cartLineProblem(item);
}
function stockLabel(item) {
  const stock = catalogStock(item);
  return stock === null ? 'Chưa xác định tồn kho' : stock < 1 || item.outOfStock ? 'Hết hàng' : 'Còn ' + stock + ' sản phẩm';
}
function lineTotal(item) {
  const raw = item.line_total ?? item.subtotal;
  if (raw != null) return Number.isFinite(Number(raw)) && Number(raw) >= 0 ? formatMoney(raw) : 'Chưa có tổng tiền';
  // Preserve legacy price × quantity presentation when the detailed field is absent.
  const price = productPrice(item), qty = Number(item.quantity);
  return price !== null && Number.isSafeInteger(qty) && qty > 0 ? formatMoney(price * qty) : 'Chưa có tổng tiền';
}
const insufficient = computed(() =>
  items.value.some(
    (item) =>
      problem(item) ||
      quantityErrors.value[item.product_id] ||
      busy.value[item.product_id],
  ),
);
const checkoutBlocked = computed(() => mutationsDisabled.value || !items.value.length || insufficient.value);
async function loadCart() {
  if (!auth.userId || disposed) return;
  const ctx = context(), request = ++readRequest;
  loading.value = true;
  error.value = "";
  try {
    await cart.fetchCart(ctx.owner);
    if (live(ctx) && request === readRequest) quantityErrors.value = {};
  } catch {
    if (live(ctx) && request === readRequest) error.value = "Không thể tải giỏ hàng. Vui lòng thử lại.";
  } finally {
    if (live(ctx) && request === readRequest) loading.value = false;
  }
}
function acceptConfirmedQuantity(item, value) {
  // A validation render can restore the store's input value before blur.
  // Editing back to that confirmed value needs no PUT, even without a change event.
  if (!mutationsDisabled.value && Number(value) === Number(item.quantity)) quantityErrors.value[item.product_id] = '';
}
async function updateQuantity(item, value) {
  const qty = Number(value);
  const id = item.product_id;
  if (mutationsDisabled.value) return;
  const stock = catalogStock(item);
  if (stock === null || productPrice(item) === null || item.outOfStock || !normalizeId(id)) {
    quantityErrors.value[id] = problem(item); return;
  }
  if (!Number.isSafeInteger(qty) || qty < 1 || qty > stock) {
    quantityErrors.value[id] =
      "Số lượng phải từ 1 đến " + stock + " sản phẩm.";
    return;
  }
  if (qty === Number(item.quantity)) { quantityErrors.value[id] = ''; return; }
  const ctx = context(); actionError.value = '';
  quantityErrors.value[id] = "";
  busy.value[id] = true;
  try {
    await cart.updateQuantity(ctx.owner, id, qty);
  } catch (error) {
    if (live(ctx) && !cart.mutation.uncertain) quantityErrors.value[id] = userError(error, "Không thể cập nhật số lượng. Vui lòng thử lại.");
  } finally {
    if (live(ctx)) busy.value[id] = false;
  }
}
async function restoreRemovedFocus(previous, ctx) {
  await nextTick();
  if (live(ctx) && previous && !previous.isConnected && document.activeElement === document.body && !document.querySelector('dialog[open]'))
    root.value?.querySelector('.cart-remove:not(:disabled), .cart-empty a, .cart-actions a')?.focus({ preventScroll: true });
}
async function remove(id) {
  if (mutationsDisabled.value || !normalizeId(id)) return;
  const ctx = context(), previous = document.activeElement; actionError.value = '';
  busy.value[id] = true;
  try {
    await cart.removeFromCart(ctx.owner, id);
  } catch {
    if (live(ctx) && !cart.mutation.uncertain) { actionError.value = 'Không thể xóa sản phẩm. Vui lòng thử lại.'; notify(actionError.value, 'error'); }
  } finally {
    if (live(ctx)) { busy.value[id] = false; void restoreRemovedFocus(previous, ctx); }
  }
}
async function clear() {
  if (mutationsDisabled.value || !confirmClear.value) return;
  const ctx = context(), previous = document.activeElement; clearing.value = true; actionError.value = '';
  try {
    await cart.clearCart(ctx.owner);
    if (live(ctx)) confirmClear.value = false;
  } catch {
    if (live(ctx) && !cart.mutation.uncertain) { actionError.value = 'Không thể xóa giỏ hàng. Vui lòng thử lại.'; notify(actionError.value, 'error'); }
  } finally {
    if (live(ctx)) { clearing.value = false; void restoreRemovedFocus(previous, ctx); }
  }
}
async function cancelClear() { confirmClear.value = false; await nextTick(); if (!disposed && !document.querySelector('dialog[open]')) clearTrigger.value?.focus({ preventScroll: true }); }
watch(() => cart.ownerVersion, () => {
  ++generation; ++readRequest; busy.value = {}; quantityErrors.value = {}; confirmClear.value = false;
  clearing.value = false; error.value = ''; actionError.value = ''; loading.value = !!auth.userId;
  // The store increments its epoch before finishing reset; read after that reset.
  if (auth.userId) { const ctx = context(); void nextTick(() => { if (live(ctx)) return loadCart(); }); }
}, { immediate: true, flush: 'sync' });
onBeforeUnmount(() => { disposed = true; ++generation; ++readRequest; });
</script>
<template>
  <div ref="root" class="site-content sage-cart">
    <PageHeading title="Giỏ hàng của bạn" description="Kiểm tra sản phẩm trước khi tiếp tục thanh toán." />
    <div class="container">
      <AppState v-if="!auth.userId" heading-tag="h2" title="Đăng nhập để xem giỏ hàng" description="Giỏ hàng được lưu theo tài khoản khách hàng." to="/login" action="Đăng nhập" />
      <template v-else>
        <template v-if="pending && !items.length">
          <AppState kind="loading" heading-tag="h2" title="Đang tải giỏ hàng..." />
          <div class="cart-loading" aria-hidden="true"><div><SageSkeleton v-for="n in 2" :key="n" class="cart-loading-row" /></div><SageSkeleton class="cart-loading-summary" /></div>
        </template>
        <AppState v-if="error" kind="error" heading-tag="h2" :title="error" retry @retry="loadCart" />
        <section v-if="cart.mutation.uncertain" class="cart-recovery" role="alert" aria-labelledby="cart-recovery-title">
          <h2 id="cart-recovery-title">Cần đối soát giỏ hàng</h2>
          <p>{{ cart.mutation.error }}</p>
          <p>Chưa xác định kết quả thao tác. Kiểm tra dữ liệu mới nhất trước khi tiếp tục; thao tác cũ không được gửi lại tự động.</p>
          <div class="cart-recovery-actions">
            <SageButton variant="secondary" :disabled="pending" :loading="loading" @click="loadCart">Tải lại giỏ hàng</SageButton>
            <SageButton v-if="cart.mutation.fresh" variant="secondary" :disabled="pending" @click="cart.acknowledgeMutation()">Đã kiểm tra, tiếp tục</SageButton>
          </div>
        </section>
        <p v-if="pending && items.length" class="cart-status" role="status">Đang cập nhật giỏ hàng. Vui lòng chờ xác nhận.</p>
        <p v-if="actionError" class="cart-action-error" role="alert">{{ actionError }}</p>
        <AppState v-if="!pending && !error && !items.length && !cart.mutation.uncertain" class="cart-empty" heading-tag="h2"
          title="Giỏ hàng của bạn đang trống" description="Khám phá sản phẩm và lựa chọn giải pháp cho ao nuôi." to="/products" />
        <div v-if="items.length" class="cart-layout">
          <div class="cart-content">
            <div class="cart-lines" :aria-busy="pending">
              <article v-for="item in items" :key="item.product_id" class="cart-line">
                <RouterLink v-if="normalizeId(item.product_id)" :to="'/products/' + normalizeId(item.product_id)" class="cart-line-image">
                  <ResponsiveImage :src="item.thumbnail || item.image" :alt="item.name || item.productName || 'Sản phẩm'" />
                </RouterLink>
                <div v-else class="cart-line-image"><ResponsiveImage :src="item.thumbnail || item.image" :alt="item.name || 'Sản phẩm'" /></div>
                <div class="cart-line-body">
                  <h2 class="cart-line-title"><RouterLink v-if="normalizeId(item.product_id)" :to="'/products/' + normalizeId(item.product_id)">{{ item.name || item.productName || 'Sản phẩm' }}</RouterLink><span v-else>{{ item.name || 'Sản phẩm không còn khả dụng' }}</span></h2>
                  <p v-if="item.packageSize" class="cart-line-package">{{ item.packageSize }}</p>
                  <p class="cart-unit-price">{{ productPrice(item) === null ? 'Chưa có giá' : formatMoney(productPrice(item)) }}<span v-if="item.unit"> / {{ item.unit }}</span></p>
                  <p class="stock-label" :class="catalogStock(item) === null ? 'unknown-stock' : catalogStock(item) > 0 && !item.outOfStock ? 'in-stock' : 'out-stock'">{{ stockLabel(item) }}</p>
                  <div class="quantity-control" role="group" :aria-label="'Số lượng ' + item.name">
                    <button type="button" :aria-label="'Giảm số lượng ' + item.name" :disabled="mutationsDisabled || item.quantity <= 1 || catalogStock(item) === null || catalogStock(item) < 1 || productPrice(item) === null || item.outOfStock"
                      @click="updateQuantity(item, Number(item.quantity) - 1)">−</button>
                    <input type="number" inputmode="numeric" step="1" min="1" :max="catalogStock(item) ?? undefined" :value="item.quantity" :aria-label="'Số lượng ' + item.name"
                      :aria-invalid="!!quantityErrors[item.product_id]" :aria-describedby="'cart-quantity-error-' + item.product_id"
                      :disabled="mutationsDisabled || catalogStock(item) === null || catalogStock(item) < 1 || productPrice(item) === null || item.outOfStock" @input="acceptConfirmedQuantity(item, $event.target.value)" @change="updateQuantity(item, $event.target.value)" />
                    <button type="button" :aria-label="'Tăng số lượng ' + item.name" :disabled="mutationsDisabled || !!problem(item) || Number(item.quantity) >= catalogStock(item)"
                      @click="updateQuantity(item, Number(item.quantity) + 1)">+</button>
                  </div>
                  <p :id="'cart-quantity-error-' + item.product_id" class="form-error form-error--field" aria-live="polite">{{ quantityErrors[item.product_id] || problem(item) }}</p>
                  <button type="button" class="cart-remove text-link" :aria-label="'Xóa ' + item.name" :aria-busy="busy[item.product_id] || undefined" :disabled="mutationsDisabled || !normalizeId(item.product_id)" @click="remove(item.product_id)">Xóa</button>
                </div>
                <div class="cart-line-end"><strong>{{ lineTotal(item) }}</strong></div>
              </article>
            </div>
            <div class="cart-actions">
              <RouterLink to="/products" class="text-link">Tiếp tục mua sắm <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></RouterLink>
              <button ref="clearTrigger" type="button" class="text-button cart-clear-toggle" :disabled="mutationsDisabled" :aria-expanded="confirmClear" aria-controls="cart-clear-confirmation" @click="confirmClear = !confirmClear">Xóa giỏ hàng</button>
            </div>
            <section v-if="confirmClear" id="cart-clear-confirmation" class="cart-clear-confirmation" role="group" aria-labelledby="cart-clear-question">
              <h2 id="cart-clear-question">Xóa toàn bộ sản phẩm trong giỏ?</h2>
              <div><SageButton variant="secondary" :disabled="pending" @click="cancelClear">Giữ lại</SageButton><SageButton variant="danger" :disabled="mutationsDisabled" :loading="clearing" @click="clear">Xóa toàn bộ</SageButton></div>
            </section>
          </div>
          <aside class="cart-summary-card" aria-labelledby="cart-summary-title">
            <h2 id="cart-summary-title">Tóm tắt giỏ hàng</h2>
            <div class="summary-row"><span>Số lượng</span><span>{{ cart.cartCount }} sản phẩm</span></div>
            <div class="summary-row"><span>Tạm tính</span><strong>{{ formatMoney(cartTotal) }}</strong></div>
            <div class="summary-row"><span>Vận chuyển</span><span>Tính ở bước tiếp theo</span></div>
            <div class="summary-row total"><span>Tổng tiền hàng</span><strong>{{ formatMoney(cartTotal) }}</strong></div>
            <p v-if="checkoutBlocked" class="cart-checkout-problem">Kiểm tra số lượng, đối soát khi cần và chờ giỏ hàng cập nhật trước khi thanh toán.</p>
            <RouterLink v-if="!checkoutBlocked" to="/checkout" class="sage-button cart-checkout">Tiến hành thanh toán <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></RouterLink>
            <SageButton v-else class="cart-checkout" disabled>Kiểm tra lại giỏ hàng</SageButton>
            <p class="cart-summary-note">Phí vận chuyển và mã giảm giá được cập nhật khi thanh toán.</p>
          </aside>
        </div>
      </template>
    </div>
  </div>
</template>
