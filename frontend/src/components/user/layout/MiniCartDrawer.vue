<script setup>
import { computed, ref, watch, onBeforeUnmount } from 'vue';
import { useAuthStore } from '@/stores/user/auth';
import { useCartStore } from '@/stores/user/cart';
import { cartLineProblem, createMiniCartController } from '@/utils/storefront-shell.util';
import { formatMoney, productPrice } from '@/utils/storefront.util';
import { catalogStock } from '@/utils/catalog-query.util';
import { normalizeId } from '@/utils/id.util';
import SageDrawer from '@/components/user/sage/SageDrawer.vue';
import SageButton from '@/components/user/sage/SageButton.vue';
import SageLoading from '@/components/user/sage/SageLoading.vue';
import SageEmptyState from '@/components/user/sage/SageEmptyState.vue';
import SageErrorState from '@/components/user/sage/SageErrorState.vue';
import ResponsiveImage from '@/components/user/common/ResponsiveImage.vue';
defineProps({ modelValue: Boolean, id: String });
const emit = defineEmits(['update:modelValue', 'closed', 'navigate']);
const auth = useAuthStore(), cart = useCartStore();
const state = ref({ busy: false, error: '', notice: '', loaded: false });
let disposed = false;
const controller = createMiniCartController({ cart, userId: () => auth.isLoggedIn ? auth.userId : '', publish: value => { state.value = value; } });
const busy = computed(() => state.value.busy || cart.loading);
const mutationsDisabled = computed(() => !auth.isLoggedIn || !normalizeId(auth.userId) || busy.value || !state.value.loaded || !!state.value.error || cart.mutation.uncertain);
const unknownStockMessage = 'Chưa xác minh được tồn kho của sản phẩm. Vui lòng tải lại giỏ hàng để kiểm tra.';
const hasUnknownStock = computed(() => cart.items.some(item => catalogStock(item) === null));
function lineProblem(item) {
  const stock = catalogStock(item);
  if (stock === null) return unknownStockMessage;
  if (stock < 1) return 'Sản phẩm hiện không còn hàng để bán.';
  if (!Number.isSafeInteger(Number(item.quantity)) || Number(item.quantity) < 1) return 'Số lượng không hợp lệ.';
  return cartLineProblem(item);
}
const blocked = computed(() => mutationsDisabled.value || !cart.items.length || cart.items.some(lineProblem));
function canQuantity(item, value) {
  // Read the current canonical row, not a stale render/owner's captured item.
  if (disposed || mutationsDisabled.value || !cart.items.includes(item) || !normalizeId(item.product_id)) return false;
  const stock = catalogStock(item), amount = Number(value), current = Number(item.quantity);
  return stock !== null && stock > 0 && productPrice(item) !== null && item.outOfStock !== true &&
    Number.isSafeInteger(current) && current > 0 && Number.isSafeInteger(amount) && amount >= 1 && amount <= stock;
}
function quantity(item, value) { if (!canQuantity(item, value)) return false; return controller.quantity(item, value); }
function checkout(event, navigate) {
  if (disposed || blocked.value) { event.preventDefault(); return false; }
  emit('navigate');
  return navigate(event);
}
// If App/Header is already reading the cart, wait for that read to finish;
// then get a fresh snapshot rather than racing a second shell-owned read.
let requested = false;
watch(() => cart.ownerVersion, () => { requested = false; controller.invalidate(); }, { flush: 'sync' });
watch(() => [auth.userId, cart.loading], () => {
  if (!requested && auth.isLoggedIn && auth.userId && !cart.loading) { requested = true; controller.refresh(); }
}, { immediate: true });
onBeforeUnmount(() => { disposed = true; controller.dispose(); });
function total(item) { const value = item.line_total ?? item.subtotal; return value != null && Number.isFinite(Number(value)) && Number(value) >= 0 ? formatMoney(value) : 'Chưa có tổng tiền'; }
</script>
<template>
  <SageDrawer :id="id" :model-value="modelValue" title="Giỏ hàng của bạn" class="shell-mini-cart" @update:model-value="emit('update:modelValue', $event)" @closed="emit('closed')">
    <SageEmptyState v-if="!auth.isLoggedIn || !auth.userId" title="Đăng nhập để xem giỏ hàng" heading-tag="h3" description="Giỏ hàng được lưu theo tài khoản khách hàng."><router-link class="sage-button" to="/login" @click="emit('navigate')">Đăng nhập</router-link></SageEmptyState>
    <template v-else>
      <SageLoading v-if="busy" label="Đang cập nhật giỏ hàng…" />
      <SageErrorState v-if="state.error || cart.mutation.uncertain || hasUnknownStock" title="Cần kiểm tra lại giỏ hàng" heading-tag="h3" :description="cart.mutation.uncertain ? cart.mutation.error : state.error || unknownStockMessage" :loading="busy" retry-label="Tải lại giỏ hàng" @retry="controller.refresh" />
      <SageButton v-if="cart.mutation.uncertain && cart.mutation.fresh" :disabled="busy" @click="cart.acknowledgeMutation()">Đã kiểm tra, tiếp tục</SageButton>
      <p v-if="state.notice" role="status" class="shell-cart-notice">{{ state.notice }}</p>
      <SageEmptyState v-if="!busy && state.loaded && !state.error && !cart.items.length" title="Giỏ hàng đang trống" heading-tag="h3" description="Khám phá sản phẩm phù hợp với nhu cầu ao nuôi."><router-link to="/products" class="sage-button" @click="emit('navigate')">Khám phá sản phẩm</router-link></SageEmptyState>
      <ul v-if="cart.items.length" class="shell-cart-lines" :aria-busy="busy">
        <li v-for="item in cart.items" :key="item.product_id" class="shell-cart-line">
          <ResponsiveImage :src="item.thumbnail || item.image" :alt="item.name || 'Sản phẩm'" />
          <div class="shell-cart-info">
            <router-link v-if="normalizeId(item.product_id)" :to="'/products/' + normalizeId(item.product_id)" class="shell-cart-name" @click="emit('navigate')">{{ item.name || 'Sản phẩm' }}</router-link><span v-else class="shell-cart-name">{{ item.name || 'Sản phẩm không còn khả dụng' }}</span>
            <p class="shell-cart-unit">{{ productPrice(item) === null ? 'Chưa có giá' : formatMoney(productPrice(item)) }}<span v-if="item.unit"> / {{ item.unit }}</span></p>
            <p v-if="lineProblem(item)" class="shell-cart-problem">{{ lineProblem(item) }}</p>
            <div class="shell-cart-controls">
              <div class="shell-quantity" role="group" :aria-label="'Số lượng ' + item.name">
                <SageButton variant="ghost" :disabled="!canQuantity(item, Number(item.quantity) - 1)" :aria-label="'Giảm số lượng ' + item.name" @click="quantity(item, Number(item.quantity) - 1)">−</SageButton>
                <output :aria-label="'Số lượng hiện tại ' + item.name">{{ item.quantity }}</output>
                <SageButton variant="ghost" :disabled="!canQuantity(item, Number(item.quantity) + 1)" :aria-label="'Tăng số lượng ' + item.name" @click="quantity(item, Number(item.quantity) + 1)">+</SageButton>
              </div>
              <SageButton variant="ghost" :disabled="mutationsDisabled || !normalizeId(item.product_id)" :aria-label="'Xóa ' + item.name + ' khỏi giỏ hàng'" @click="controller.remove(item)"><i class="fa-regular fa-trash-can" aria-hidden="true"></i></SageButton>
            </div>
            <SageButton v-if="catalogStock(item) !== null && Number(item.quantity) > catalogStock(item) && catalogStock(item) > 0 && productPrice(item) !== null && !item.outOfStock" variant="secondary" :disabled="!canQuantity(item, catalogStock(item))" @click="quantity(item, catalogStock(item))">Giảm về {{ catalogStock(item) }}</SageButton>
            <strong class="shell-cart-line-total">{{ total(item) }}</strong>
          </div>
        </li>
      </ul>
    </template>
    <template v-if="auth.isLoggedIn && auth.userId && cart.items.length" #footer>
      <div class="shell-cart-subtotal"><span>Tạm tính</span><strong>{{ formatMoney(cart.subtotal) }}</strong></div>
      <p class="shell-cart-footnote">Phí vận chuyển và ưu đãi được xác nhận tại bước thanh toán.</p>
      <div class="shell-cart-cta"><router-link class="sage-button sage-button--secondary" to="/cart" @click="emit('navigate')">Xem giỏ hàng</router-link><SageButton v-if="blocked" disabled>Thanh toán</SageButton><router-link v-else v-slot="{ href, navigate, isActive, isExactActive }" to="/checkout" custom><a class="sage-button" :class="{ 'router-link-active': isActive, 'router-link-exact-active': isExactActive }" :href="href" :aria-current="isExactActive ? 'page' : undefined" @click="checkout($event, navigate)">Thanh toán</a></router-link></div>
      <p v-if="blocked && !busy" class="shell-cart-footnote">Tải lại hoặc cập nhật sản phẩm chưa hợp lệ trước khi thanh toán.</p>
    </template>
  </SageDrawer>
</template>
