<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { useAuthStore } from "@/stores/user/auth";
import { useCartStore } from "@/stores/user/cart";
import { z } from "@/validators/common.validator";

const authStore = useAuthStore();
const cartStore = useCartStore();

const { items, cartTotal, loading } = storeToRefs(cartStore);
const pageLoading = ref(false);
const actionLoadingMap = ref({});
const quantityErrorMap = ref({});

const cartQuantitySchema = z.preprocess(
  (value) => Number(value),
  z
    .number({ message: "So luong phai la so" })
    .int("So luong phai la so nguyen")
    .positive("So luong phai lon hon 0"),
);

const grandTotal = computed(() => Number(cartTotal.value || 0));

function isBusy(productId) {
  return !!actionLoadingMap.value[productId];
}

function setBusy(productId, value) {
  actionLoadingMap.value = {
    ...actionLoadingMap.value,
    [productId]: value,
  };
}

function setQuantityError(productId, message = "") {
  quantityErrorMap.value = {
    ...quantityErrorMap.value,
    [productId]: message,
  };
}

function validateCartQuantity(productId, value) {
  const result = cartQuantitySchema.safeParse(value);
  if (!result.success) {
    setQuantityError(productId, result.error.issues?.[0]?.message || "So luong khong hop le");
    return null;
  }
  setQuantityError(productId, "");
  return result.data;
}

async function fetchCartData() {
  if (!authStore.userId) return;
  pageLoading.value = true;
  try {
    await cartStore.fetchCart(authStore.userId);
  } catch (error) {
    alert(error.message);
  } finally {
    pageLoading.value = false;
  }
}

onMounted(fetchCartData);

watch(
  () => authStore.userId,
  async (newUserId) => {
    if (newUserId) {
      await fetchCartData();
    }
  },
);

async function increaseItemQty(item) {
  if (!authStore.userId || isBusy(item.product_id)) return;

  const nextQty = Number(item.quantity || 0) + 1;
  if (validateCartQuantity(item.product_id, nextQty) === null) return;
  const maxStock = Number(item.stock || 0);

  if (nextQty > maxStock) {
    alert("Số lượng vượt quá tồn kho");
    return;
  }
  setBusy(item.product_id, true);
  try {
    await cartStore.updateQuantity(authStore.userId, item.product_id, nextQty);
  } catch (error) {
    alert(error.message);
  } finally {
    setBusy(item.product_id, false);
  }
}

async function decreaseItemQty(item) {
  if (!authStore.userId || isBusy(item.product_id)) return;

  const nextQty = Number(item.quantity || 0) - 1;
  if (nextQty < 1) return;
  if (validateCartQuantity(item.product_id, nextQty) === null) return;

  setBusy(item.product_id, true);
  try {
    await cartStore.updateQuantity(authStore.userId, item.product_id, nextQty);
  } catch (error) {
    alert(error.message);
  } finally {
    setBusy(item.product_id, false);
  }
}

async function handleQuantityInput(item, event) {
  if (!authStore.userId || isBusy(item.product_id)) return;

  const rawValue = Number(event.target.value);
  const maxStock = Number(item.stock || 0);

  let nextQty = validateCartQuantity(item.product_id, rawValue);
  if (nextQty === null) return;
  if (maxStock > 0 && nextQty > maxStock) nextQty = maxStock;

  if (nextQty === Number(item.quantity)) return;

  setBusy(item.product_id, true);
  try {
    await cartStore.updateQuantity(authStore.userId, item.product_id, nextQty);
  } catch (error) {
    alert(error.message);
  } finally {
    setBusy(item.product_id, false);
  }
}

async function handleRemoveItem(productId) {
  if (!authStore.userId || !productId || isBusy(productId)) return;

  setBusy(productId, true);
  try {
    await cartStore.removeFromCart(authStore.userId, productId);
  } catch (error) {
    alert(error.message);
  } finally {
    setBusy(productId, false);
  }
}

async function handleClearCart() {
  if (!authStore.userId || !items.value.length) return;

  const confirmed = window.confirm("Bạn muốn xóa toàn bộ giỏ hàng?");
  if (!confirmed) return;

  try {
    await cartStore.clearCart(authStore.userId);
  } catch (error) {
    alert(error.message);
  }
}
</script>

<template>
  <div id="content" class="site-content">
    <!-- Breadcrumb -->
    <div id="breadcrumb">
      <div class="container">
        <h2 class="title">Giỏ Hàng</h2>

        <ul class="breadcrumb">
          <li><router-link to="/">Trang Chủ</router-link></li>
          <li><span>Giỏ Hàng</span></li>
        </ul>
      </div>
    </div>

    <div class="container">
      <div
        v-if="pageLoading"
        class="cart-empty text-center"
        style="padding: 60px 0"
      >
        <h3>Đang tải giỏ hàng...</h3>
      </div>
      <div
        v-else-if="!items.length"
        class="cart-empty text-center"
        style="padding: 60px 0"
      >
        <h3>Giỏ hàng của bạn đang trống</h3>
        <p>Bạn chưa thêm sản phẩm nào vào giỏ hàng.</p>
        <div class="checkout-btn">
          <router-link to="/products" class="btn btn-primary pull-center">
            <span>Tiếp tục mua sắm</span>
            <i class="fa fa-angle-right ml-xs"></i>
          </router-link>
        </div>
      </div>

      <div v-else class="page-cart">
        <div class="cart-actions">
          <router-link to="/products" class="btn btn-primary">
            <i class="fa fa-angle-left ml-xs"></i>
            <span>Tiếp tục mua sắm</span>
          </router-link>

          <button
            class="btn btn-danger btn-circle"
            @click="handleClearCart"
            :disabled="loading"
          >
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>

        <div class="table-responsive">
          <table class="cart-summary table table-bordered">
            <thead>
              <tr>
                <th class="width-20">&nbsp;</th>
                <th class="width-80 text-center">Ảnh</th>
                <th>Tên</th>
                <th style="width: 150px" class="text-center">Đơn Giá</th>
                <th class="width-100 text-center">SL</th>
                <th style="width: 150px" class="text-center">Thành Tiền</th>
              </tr>
            </thead>

            <tbody>
              <tr v-for="item in items" :key="item.product_id">
                <td class="product-remove">
                  <a
                    title="Remove this item"
                    class="remove"
                    href="#"
                    @click.prevent="handleRemoveItem(item.product_id)"
                  >
                    <i class="fa fa-times"></i>
                  </a>
                </td>
                <td>
                  <router-link :to="`/products/${item.product_id}`">
                    <img
                      width="80"
                      :alt="item.name"
                      class="img-responsive"
                      :src="item.thumbnail"
                    />
                  </router-link>
                </td>
                <td>
                  <router-link
                    :to="`/products/${item.product_id}`"
                    class="product-name"
                  >
                    {{ item.name }}
                  </router-link>
                </td>
                <td class="text-center">
                  {{ Number(item.price).toLocaleString("vi-VN") }} đ/{{
                    item.unit
                  }}
                </td>
                <td>
                  <div class="product-quantity">
                    <div class="qty">
                      <div class="input-group">
                        <input
                          type="number"
                          min="1"
                          :max="item.stock"
                          :value="item.quantity"
                          :disabled="isBusy(item.product_id)"
                          @input="handleQuantityInput(item, $event)"
                        />
                        <span class="adjust-qty">
                          <span
                            class="adjust-btn plus"
                            :class="{ disabled: isBusy(item.product_id) }"
                            @click="increaseItemQty(item)"
                            >+</span
                          >
                          <span
                            class="adjust-btn minus"
                            :class="{ disabled: isBusy(item.product_id) }"
                            @click="decreaseItemQty(item)"
                            >-</span
                          >
                        </span>
                      </div>
                      <div v-if="quantityErrorMap[item.product_id]" class="form-error">
                        {{ quantityErrorMap[item.product_id] }}
                      </div>
                    </div>
                  </div>
                </td>
                <td class="text-center">
                  {{
                    Number(item.price * item.quantity).toLocaleString("vi-VN")
                  }}
                  đ
                </td>
              </tr>
            </tbody>

            <tfoot>
              <tr class="cart-total">
                <td rowspan="3" colspan="3"></td>
                <td colspan="2" class="text-right">Tạm tính</td>
                <td colspan="1" class="text-center">
                  {{ Number(cartTotal).toLocaleString("vi-VN") }} đ
                </td>
              </tr>
              <tr class="cart-total">
                <td colspan="2" class="text-right">Phí vận chuyển</td>
                <td colspan="1" class="text-center">
                  Chọn ở bước thanh toán
                </td>
              </tr>
              <tr class="cart-total">
                <td colspan="2" class="total text-right">Tổng cộng</td>
                <td colspan="1" class="total text-center">
                  {{ Number(grandTotal).toLocaleString("vi-VN") }} đ
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div class="checkout-btn">
          <router-link to="/checkout" class="btn btn-primary pull-right">
            <span>Tiến Hành Thanh Toán</span>
            <i class="fa fa-angle-right ml-xs"></i>
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>
<style>
.cart-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 20px 0;
  flex-wrap: wrap;
  gap: 12px;
}
.cart-actions .btn-danger {
  color: black;
  background-color: #fff;
  border: 1px solid #ddd;
}
.cart-actions .btn-danger:hover {
  color: #fff;
  background-color: darkred;
}

.cart-actions .btn-circle {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
}
</style>
