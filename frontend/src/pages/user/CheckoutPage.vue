<script setup>
import { computed, onMounted, reactive, ref, watch, nextTick } from "vue";
import { storeToRefs } from "pinia";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import { useRouter } from "vue-router";
import { useCartStore } from "@/stores/user/cart";
import { useAuthStore } from "@/stores/user/auth";
import addressService from "@/services/address.service";
import orderService from "@/services/orders.service";
import paymentService from "@/services/payments.service";
import shippingMethodService from "@/services/shipping-method.service";
import discountService from "@/services/discount.service";
import {
  objectIdSchema,
  optionalObjectIdSchema,
  optionalString,
  z,
} from "@/validators/common.validator";
import { mapBackendValidationErrors } from "@/utils/validation-error.util";

const router = useRouter();
const cartStore = useCartStore();
const authStore = useAuthStore();

const {
  items,
  cartCount,
  cartTotal,
  loading: cartLoading,
} = storeToRefs(cartStore);

const billingForm = reactive({
  fullName: "",
  phone: "",
  address: "",
  city: "",
});

const savedAddresses = ref([]);
const shippingMethods = ref([]);
const shippingLoading = ref(false);
const selectedAddressId = ref("");
const selectedShippingMethodId = ref("");
const paymentMethod = ref("paypal");
const submitting = ref(false);
const discountCode = ref("");
const discountLoading = ref(false);
const discountError = ref("");
const appliedDiscount = ref(null);
const paypalContainer = ref(null);
const internalOrderId = ref("");

const isAddressModalOpen = ref(false);
const newAddressForm = reactive({
  fullName: "",
  phone: "",
  address: "",
  city: "",
  isDefault: false,
});

const isSuccessModalOpen = ref(false);
const successMessage = ref("");

const checkoutSchema = toTypedSchema(
  z.object({
    addressId: objectIdSchema,
    paymentMethod: z.enum(["paypal", "cash"], {
      message: "Phuong thuc thanh toan khong hop le",
    }),
    shippingMethodId: optionalObjectIdSchema,
    discountCode: optionalString,
  }),
);

const {
  errors: checkoutErrors,
  setErrors: setCheckoutErrors,
  setValues: setCheckoutValues,
  validate: validateCheckoutVee,
} = useForm({
  validationSchema: checkoutSchema,
});

const selectedShippingMethod = computed(() => {
  return (
    shippingMethods.value.find(
      (method) => String(method._id || method.id) === String(selectedShippingMethodId.value),
    ) || null
  );
});

const shippingFee = computed(() =>
  items.value.length ? Number(selectedShippingMethod.value?.fee || 0) : 0,
);
const discountAmount = computed(() =>
  Math.min(
    Number(cartTotal.value || 0),
    Number(appliedDiscount.value?.discountAmount || 0),
  ),
);
const grandTotal = computed(
  () =>
    Math.max(
      0,
      Number(cartTotal.value || 0) +
        Number(shippingFee.value || 0) -
        Number(discountAmount.value || 0),
    ),
);

const selectedAddress = computed(() => {
  return (
    savedAddresses.value.find(
      (item) => String(item._id) === String(selectedAddressId.value),
    ) || null
  );
});

watch(selectedAddressId, () => fillAddressFromSaved());

function formatMoney(value) {
  return Number(value || 0).toLocaleString("vi-VN") + "đ";
}

function buildDiscountCartItems() {
  return items.value.map((item) => ({
    productId: item.product_id || item.productId || item.id,
    product_id: item.product_id || item.productId || item.id,
    categoryId: item.categoryId || item.category_id,
    category_id: item.category_id || item.categoryId,
    price: Number(item.price || 0),
    quantity: Number(item.quantity || 0),
    subtotal: Number(item.subtotal || item.line_total || item.price * item.quantity || 0),
  }));
}

async function refreshPaypalButtons() {
  if (paymentMethod.value !== "paypal" || !paypalContainer.value) return;
  paypalContainer.value.innerHTML = "";
  await nextTick();
  await renderPaypalButtons();
}

function fillAddressFromSaved() {
  if (!selectedAddress.value) return;
  billingForm.fullName = selectedAddress.value.full_name || "";
  billingForm.phone = selectedAddress.value.phone || "";
  billingForm.address = selectedAddress.value.address_line || "";
  billingForm.city = selectedAddress.value.city || "";
}

async function fetchAddresses() {
  if (!authStore.userId) {
    savedAddresses.value = [];
    selectedAddressId.value = "";
    return;
  }

  try {
    const data = await addressService.getByUser(authStore.userId);
    savedAddresses.value = Array.isArray(data) ? data : [];

    const first =
      savedAddresses.value.find((x) => x.is_default) || savedAddresses.value[0];

    if (first) {
      selectedAddressId.value = first._id;
      fillAddressFromSaved();
    }
  } catch (error) {
    console.error(error);
    alert(error?.response?.data?.message || "Không thể tải địa chỉ");
  }
}

function normalizeList(res) {
  return Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
}

async function fetchShippingMethods() {
  shippingLoading.value = true;
  try {
    const res = await shippingMethodService.getAll();
    shippingMethods.value = normalizeList(res).filter(
      (method) => (method.status || "active") === "active",
    );

    if (!selectedShippingMethodId.value && shippingMethods.value.length) {
      selectedShippingMethodId.value = String(
        shippingMethods.value[0]._id || shippingMethods.value[0].id,
      );
    }
  } catch (error) {
    console.error(error);
    shippingMethods.value = [];
  } finally {
    shippingLoading.value = false;
  }
}

function buildCheckoutPayload(extra = {}) {
  const payload = {
    user_id: authStore.userId,
    address_id: selectedAddressId.value,
    ...extra,
  };

  if (selectedShippingMethodId.value) {
    payload.shippingMethodId = selectedShippingMethodId.value;
  }

  if (appliedDiscount.value?.discount?.code) {
    payload.discountCode = appliedDiscount.value.discount.code;
  }

  return payload;
}

function mapCheckoutErrors(error) {
  const mapped = mapBackendValidationErrors(error);
  setCheckoutErrors({
    addressId: mapped.address_id || mapped.addressId,
    paymentMethod: mapped.payment_method || mapped.paymentMethod,
    shippingMethodId: mapped.shippingMethodId,
    discountCode: mapped.discountCode,
  });
}

async function validateCheckout() {
  if (!authStore.userId) {
    alert("Bạn cần đăng nhập");
    return false;
  }
  if (!items.value.length) {
    alert("Giỏ hàng trống");
    return false;
  }
  setCheckoutValues({
    addressId: selectedAddressId.value,
    paymentMethod: paymentMethod.value,
    shippingMethodId: selectedShippingMethodId.value,
    discountCode: appliedDiscount.value?.discount?.code || discountCode.value,
  });
  const result = await validateCheckoutVee();
  if (!result.valid) return false;

  if (!selectedAddressId.value) {
    alert("Vui lòng chọn địa chỉ giao hàng");
    return false;
  }
  return true;
}

async function applyDiscount({ silent = false } = {}) {
  const code = discountCode.value.trim();
  discountError.value = "";

  if (!code) {
    appliedDiscount.value = null;
    if (!silent) discountError.value = "Vui lòng nhập mã giảm giá";
    await refreshPaypalButtons();
    return;
  }

  if (!items.value.length) {
    appliedDiscount.value = null;
    if (!silent) discountError.value = "Giỏ hàng trống";
    await refreshPaypalButtons();
    return;
  }

  discountLoading.value = true;
  try {
    const result = await discountService.validate({
      code,
      userId: authStore.userId,
      subtotal: Number(cartTotal.value || 0),
      cartItems: buildDiscountCartItems(),
    });

    if (!result?.valid) {
      appliedDiscount.value = null;
      discountError.value = result?.message || "Mã giảm giá không hợp lệ";
      await refreshPaypalButtons();
      return;
    }

    appliedDiscount.value = result;
    discountCode.value = result.discount?.code || code;
    discountError.value = "";
    await refreshPaypalButtons();
  } catch (error) {
    console.error(error);
    appliedDiscount.value = null;
    discountError.value =
      error?.response?.data?.message || "Không thể áp dụng mã giảm giá";
    await refreshPaypalButtons();
  } finally {
    discountLoading.value = false;
  }
}

async function removeDiscount() {
  appliedDiscount.value = null;
  discountError.value = "";
  discountCode.value = "";
  await refreshPaypalButtons();
}

async function renderPaypalButtons() {
  await nextTick();

  if (!paypalContainer.value || !window.paypal) return;

  paypalContainer.value.innerHTML = "";

  const buttons = window.paypal.Buttons({
    async createOrder() {
      if (!(await validateCheckout())) {
        throw new Error("Checkout không hợp lệ");
      }

      try {
        const pp = await paymentService.createPaypalOrder({
          ...buildCheckoutPayload(),
        });

        return pp.id;
      } catch (error) {
        mapCheckoutErrors(error);
        throw error;
      }
    },

    async onApprove(data) {
      try {
        await paymentService.capturePaypalOrder({
          paypalOrderId: data.orderID,
          ...buildCheckoutPayload(),
        });

        await cartStore.fetchCart(authStore.userId);
        openSuccessModal("Thanh toán PayPal thành công");
      } catch (error) {
        console.error("CAPTURE ERROR:", error?.response?.data || error);
        mapCheckoutErrors(error);
        alert(error?.response?.data?.message || "Thanh toán PayPal thất bại");
      }
    },

    onCancel() {
      alert("Bạn đã hủy thanh toán PayPal");
    },

    onError(err) {
      console.error("PayPal Buttons Error:", err);
      alert("Không thể hiển thị hoặc xử lý PayPal");
    },
  });

  await buttons.render(paypalContainer.value);
}

async function placeCODOrder() {
  if (!(await validateCheckout())) return;

  try {
    submitting.value = true;

    await orderService.create({
      ...buildCheckoutPayload({
        payment_method: "cash",
      }),
    });

    await cartStore.fetchCart(authStore.userId);
    openSuccessModal("Đặt hàng COD thành công");
  } catch (error) {
    console.error(error);
    mapCheckoutErrors(error);
    alert(error?.response?.data?.message || "Đặt hàng thất bại");
  } finally {
    submitting.value = false;
  }
}

function addNewAddress() {
  newAddressForm.fullName = "";
  newAddressForm.phone = "";
  newAddressForm.address = "";
  newAddressForm.city = "";
  newAddressForm.isDefault = false;
  isAddressModalOpen.value = true;
}

function closeAddressModal() {
  isAddressModalOpen.value = false;
}

async function saveNewAddress() {
  if (!authStore.userId) {
    alert("Bạn cần đăng nhập");
    return;
  }

  if (
    !newAddressForm.fullName.trim() ||
    !newAddressForm.phone.trim() ||
    !newAddressForm.address.trim() ||
    !newAddressForm.city.trim()
  ) {
    alert("Vui lòng nhập đầy đủ thông tin địa chỉ");
    return;
  }

  try {
    submitting.value = true;

    const payload = {
      user_id: authStore.userId,
      full_name: newAddressForm.fullName,
      phone: newAddressForm.phone,
      address_line: newAddressForm.address,
      city: newAddressForm.city,
      is_default: newAddressForm.isDefault,
    };

    const res = await addressService.create(payload);

    await fetchAddresses();

    const newId = res?.data?._id || res?._id;
    if (newId) {
      selectedAddressId.value = String(newId);
      fillAddressFromSaved();
    }

    closeAddressModal();
    alert("Thêm địa chỉ thành công");
  } catch (error) {
    console.error(error);
    alert(error?.response?.data?.message || "Không thể thêm địa chỉ");
  } finally {
    submitting.value = false;
  }
}

function openSuccessModal(message) {
  successMessage.value = message;
  isSuccessModalOpen.value = true;
}

async function closeSuccessModalAndRedirect() {
  isSuccessModalOpen.value = false;
  await router.push("/");
}

watch(paymentMethod, async (val) => {
  if (paypalContainer.value) {
    paypalContainer.value.innerHTML = "";
  }

  if (val === "paypal") {
    internalOrderId.value = "";
    await nextTick();
    await renderPaypalButtons();
  }
});

watch(selectedShippingMethodId, async () => {
  await refreshPaypalButtons();
});

watch(discountCode, (value) => {
  if (!appliedDiscount.value) return;
  if (String(value || "").trim().toUpperCase() !== appliedDiscount.value.discount?.code) {
    appliedDiscount.value = null;
    discountError.value = "";
  }
});

watch(cartTotal, async () => {
  if (appliedDiscount.value?.discount?.code) {
    await applyDiscount({ silent: true });
  }
});

onMounted(async () => {
  await cartStore.fetchCart(authStore.userId);
  await Promise.all([fetchAddresses(), fetchShippingMethods()]);

  if (paymentMethod.value === "paypal") {
    await nextTick();
    await renderPaypalButtons();
  }
});
</script>

<template>
  <div id="content" class="site-content">
    <div id="breadcrumb">
      <div class="container">
        <h2 class="title">Thanh Toán</h2>

        <ul class="breadcrumb">
          <li><router-link to="/">Trang Chủ</router-link></li>
          <li><router-link to="/cart">Giỏ Hàng</router-link></li>
          <li><span>Thanh Toán</span></li>
        </ul>
      </div>
    </div>

    <div class="container">
      <div class="page-checkout">
        <div
          v-if="cartLoading"
          class="text-center"
          style="padding: 40px 0; font-size: 16px"
        >
          Đang tải dữ liệu giỏ hàng...
        </div>

        <div
          v-else-if="!items.length"
          class="text-center"
          style="padding: 60px 0"
        >
          <h3>Không thể thanh toán</h3>
          <p>Giỏ hàng của bạn đang trống.</p>

          <router-link to="/products" class="btn btn-primary">
            Đi tới trang sản phẩm
          </router-link>
        </div>

        <div v-else class="row">
          <div class="col-md-7">
            <div class="checkout-left">
              <div class="block block-address">
                <h3 class="block-title">Địa chỉ giao hàng</h3>

                <div v-if="savedAddresses.length" class="form-group">
                  <label>Chọn địa chỉ đã lưu</label>
                  <select
                    v-model="selectedAddressId"
                    class="form-control"
                    :class="{ 'is-invalid': checkoutErrors.addressId }"
                    @change="fillAddressFromSaved"
                  >
                    <option
                      v-for="address in savedAddresses"
                      :key="address._id"
                      :value="address._id"
                    >
                      {{ address.full_name }} - {{ address.city }},
                      {{ address.address_line }}
                    </option>
                  </select>
                </div>
                <div v-if="checkoutErrors.addressId" class="form-error">
                  {{ checkoutErrors.addressId }}
                </div>

                <button
                  type="button"
                  class="btn btn-default"
                  @click="addNewAddress"
                >
                  + Thêm địa chỉ mới
                </button>
              </div>

              <div class="block block-billing">
                <h3 class="block-title">Thông tin nhận hàng</h3>

                <div class="form-group">
                  <label>Họ và tên</label>
                  <input
                    v-model="billingForm.fullName"
                    type="text"
                    class="form-control"
                    placeholder="Nhập họ và tên"
                  />
                </div>

                <div class="form-group">
                  <label>Số điện thoại</label>
                  <input
                    v-model="billingForm.phone"
                    type="text"
                    class="form-control"
                    placeholder="Nhập số điện thoại"
                  />
                </div>

                <div class="form-group">
                  <label>Địa chỉ</label>
                  <input
                    v-model="billingForm.address"
                    type="text"
                    class="form-control"
                    placeholder="Số nhà, tên đường..."
                  />
                </div>

                <div class="form-group">
                  <label>Tỉnh / Thành phố</label>
                  <input
                    v-model="billingForm.city"
                    type="text"
                    class="form-control"
                    placeholder="Nhập tỉnh / thành phố"
                  />
                </div>
              </div>

              <div class="block block-shipping-method">
                <h3 class="block-title">Phương thức vận chuyển</h3>

                <div v-if="shippingLoading" class="shipping-method-empty">
                  Đang tải phương thức vận chuyển...
                </div>

                <div v-else-if="shippingMethods.length" class="shipping-methods">
                  <label
                    v-for="method in shippingMethods"
                    :key="method._id || method.id"
                    class="shipping-option"
                  >
                    <input
                      v-model="selectedShippingMethodId"
                      type="radio"
                      :value="String(method._id || method.id)"
                    />
                    <span class="shipping-option__content">
                      <span class="shipping-option__name">{{ method.name }}</span>
                      <span class="shipping-option__meta">
                        {{ Number(method.fee || 0).toLocaleString("vi-VN") }}đ
                        <template v-if="method.estimatedDays">
                          - {{ method.estimatedDays }} ngày
                        </template>
                      </span>
                    </span>
                  </label>
                </div>

                <div v-else class="shipping-method-empty">
                  Chưa có phương thức vận chuyển. Đơn hàng vẫn có thể tiếp tục với phí vận chuyển 0đ.
                </div>
              </div>

              <div class="block block-payment">
                <h3 class="block-title">Phương thức thanh toán</h3>

                <div class="payment-methods">
                  <label class="payment-option">
                    <input
                      v-model="paymentMethod"
                      type="radio"
                      value="paypal"
                    />
                    <span>PayPal / Thẻ qua PayPal</span>
                  </label>

                  <label class="payment-option">
                    <input v-model="paymentMethod" type="radio" value="cash" />
                    <span>Thanh toán khi nhận hàng (COD)</span>
                  </label>
                </div>
                <div v-if="checkoutErrors.paymentMethod" class="form-error">
                  {{ checkoutErrors.paymentMethod }}
                </div>
              </div>
            </div>
          </div>

          <div class="col-md-5">
            <div class="checkout-right">
              <div class="block block-summary">
                <h3 class="block-title">Đơn hàng của bạn</h3>

                <div class="summary-items">
                  <div
                    v-for="item in items"
                    :key="item.product_id || item.id"
                    class="summary-item"
                  >
                    <div class="summary-item-left">
                      <img
                        :src="item.thumbnail"
                        :alt="item.name"
                        class="summary-thumb"
                      />
                    </div>

                    <div class="summary-item-right">
                      <div class="summary-name">{{ item.name }}</div>
                      <div class="summary-meta">
                        SL: {{ item.quantity }} x
                        {{ Number(item.price || 0).toLocaleString("vi-VN") }}đ
                      </div>
                    </div>
                  </div>
                </div>

                <div class="summary-row">
                  <span>Tổng sản phẩm</span>
                  <strong>{{ cartCount }}</strong>
                </div>

                <div class="discount-box">
                  <label class="discount-box__label">Mã giảm giá</label>
                  <div class="discount-box__input-row">
                    <input
                      v-model="discountCode"
                      type="text"
                      class="form-control"
                      placeholder="Nhập mã giảm giá"
                      :disabled="discountLoading || !!appliedDiscount"
                      @keyup.enter="applyDiscount()"
                    />
                    <button
                      v-if="!appliedDiscount"
                      type="button"
                      class="btn btn-primary"
                      :disabled="discountLoading || !discountCode.trim()"
                      @click="applyDiscount()"
                    >
                      {{ discountLoading ? "Đang kiểm tra..." : "Áp dụng" }}
                    </button>
                    <button
                      v-else
                      type="button"
                      class="btn btn-default"
                      @click="removeDiscount"
                    >
                      Bỏ mã
                    </button>
                  </div>

                  <div v-if="appliedDiscount" class="discount-chip">
                    <span>
                      {{ appliedDiscount.discount?.code }}
                      <small v-if="appliedDiscount.discount?.name">
                        - {{ appliedDiscount.discount.name }}
                      </small>
                    </span>
                    <strong>-{{ formatMoney(discountAmount) }}</strong>
                  </div>

                  <div v-if="discountError" class="discount-box__error">
                    {{ discountError }}
                  </div>
                </div>

                <div class="summary-row">
                  <span>Tạm tính</span>
                  <strong>{{ formatMoney(cartTotal) }}</strong>
                </div>

                <div class="summary-row">
                  <span>
                    Phí vận chuyển
                    <small v-if="selectedShippingMethod">
                      ({{ selectedShippingMethod.name }})
                    </small>
                  </span>
                  <strong>{{ formatMoney(shippingFee) }}</strong>
                </div>

                <div class="summary-row discount-row">
                  <span>Giảm giá</span>
                  <strong>-{{ formatMoney(discountAmount) }}</strong>
                </div>

                <div class="summary-row total">
                  <span>Tổng cộng</span>
                  <strong>{{ formatMoney(grandTotal) }}</strong>
                </div>

                <div v-show="paymentMethod === 'paypal'" class="paypal-actions">
                  <div ref="paypalContainer"></div>
                </div>

                <div v-show="paymentMethod === 'cash'" class="cod-actions">
                  <button
                    class="btn btn-primary btn-block"
                    @click="placeCODOrder"
                    :disabled="submitting"
                  >
                    {{ submitting ? "Đang đặt hàng..." : "ĐẶT HÀNG" }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="isAddressModalOpen" class="address-modal-overlay">
          <div class="address-modal">
            <div class="address-modal-header">
              <h3>Thêm địa chỉ mới</h3>
              <button class="close-btn" @click="closeAddressModal">×</button>
            </div>

            <div class="address-modal-body">
              <div class="form-group">
                <label>Họ và tên</label>
                <input
                  v-model="newAddressForm.fullName"
                  type="text"
                  class="form-control"
                />
              </div>

              <div class="form-group">
                <label>Số điện thoại</label>
                <input
                  v-model="newAddressForm.phone"
                  type="text"
                  class="form-control"
                />
              </div>

              <div class="form-group">
                <label>Địa chỉ</label>
                <input
                  v-model="newAddressForm.address"
                  type="text"
                  class="form-control"
                />
              </div>

              <div class="form-group">
                <label>Tỉnh / Thành phố</label>
                <input
                  v-model="newAddressForm.city"
                  type="text"
                  class="form-control"
                />
              </div>

              <div class="form-group checkbox-line">
                <label>
                  <input v-model="newAddressForm.isDefault" type="checkbox" />
                  Đặt làm địa chỉ mặc định
                </label>
              </div>
            </div>

            <div class="address-modal-footer">
              <button class="btn btn-default" @click="closeAddressModal">
                Hủy
              </button>
              <button class="btn btn-primary" @click="saveNewAddress">
                {{ submitting ? "Đang lưu..." : "Lưu địa chỉ" }}
              </button>
            </div>
          </div>
        </div>

        <div v-if="isSuccessModalOpen" class="success-modal-overlay">
          <div class="success-modal">
            <div class="success-modal-icon">✓</div>
            <h3 class="success-modal-title">Thành công</h3>
            <p class="success-modal-text">{{ successMessage }}</p>

            <div class="success-modal-actions">
              <button
                class="btn btn-primary"
                @click="closeSuccessModalAndRedirect"
              >
                Về trang chủ
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-checkout {
  padding: 40px 0 60px;
}

.block {
  background: #fff;
  border: 1px solid #e5e5e5;
  padding: 20px;
  margin-bottom: 20px;
  border-radius: 6px;
}

.block-title {
  margin: 0 0 16px;
  font-size: 20px;
  font-weight: 700;
}

.form-group {
  margin-bottom: 15px;
}

.payment-methods {
  display: grid;
  gap: 10px;
}

.shipping-methods {
  display: grid;
  gap: 10px;
}

.shipping-option {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px;
  border: 1px solid #e5e5e5;
  border-radius: 6px;
  cursor: pointer;
}

.shipping-option__content {
  display: grid;
  gap: 4px;
}

.shipping-option__name {
  font-weight: 700;
  color: #333;
}

.shipping-option__meta,
.shipping-method-empty {
  color: #666;
  font-size: 14px;
}

.payment-option {
  display: flex;
  align-items: center;
  gap: 8px;
}

.summary-items {
  margin-bottom: 15px;
}

.summary-item {
  display: flex;
  gap: 12px;
  margin-bottom: 14px;
  padding-bottom: 14px;
  border-bottom: 1px dashed #ddd;
}

.summary-thumb {
  width: 72px;
  height: 72px;
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid #eee;
}

.summary-name {
  font-weight: 600;
  margin-bottom: 6px;
}

.summary-meta {
  color: #666;
  font-size: 14px;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
}

.discount-box {
  border: 1px solid #e8edf5;
  border-radius: 8px;
  margin: 14px 0 16px;
  padding: 12px;
  background: #fbfcff;
}

.discount-box__label {
  display: block;
  font-weight: 700;
  margin-bottom: 8px;
}

.discount-box__input-row {
  display: flex;
  gap: 8px;
}

.discount-box__input-row .form-control {
  min-width: 0;
}

.discount-box__input-row .btn {
  flex: 0 0 auto;
  white-space: nowrap;
}

.discount-chip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 10px;
  padding: 9px 10px;
  border-radius: 6px;
  background: #eaf8ef;
  color: #1f7a3f;
}

.discount-chip span {
  min-width: 0;
  overflow-wrap: anywhere;
}

.discount-chip small {
  color: #3d8f58;
}

.discount-box__error {
  color: #b42318;
  font-size: 13px;
  margin-top: 8px;
}

.summary-row.discount-row strong {
  color: #1f9d55;
}

.summary-row.total {
  font-size: 18px;
  font-weight: 700;
  border-top: 1px solid #eee;
  padding-top: 12px;
}

.paypal-actions,
.cod-actions {
  margin-top: 18px;
}

.btn-block {
  width: 100%;
  margin-bottom: 10px;
}

.address-modal-overlay,
.success-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgb(0 0 0 / 45%);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.address-modal {
  width: 100%;
  max-width: 520px;
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
}

.address-modal-header,
.address-modal-footer {
  padding: 16px 20px;
  border-bottom: 1px solid #eee;
}

.address-modal-footer {
  border-top: 1px solid #eee;
  border-bottom: 0;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.address-modal-body {
  padding: 20px;
}

.close-btn {
  border: 0;
  background: transparent;
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
  float: right;
}

.checkbox-line label {
  display: flex;
  align-items: center;
  gap: 8px;
}

.success-modal {
  width: 100%;
  max-width: 420px;
  background: #fff;
  border-radius: 12px;
  padding: 28px 24px;
  text-align: center;
  box-shadow: 0 10px 30px rgb(0 0 0 / 15%);
}

.success-modal-icon {
  width: 70px;
  height: 70px;
  margin: 0 auto 16px;
  border-radius: 50%;
  background: #e8f8ee;
  color: #1f9d55;
  font-size: 34px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.success-modal-title {
  margin: 0 0 10px;
  font-size: 24px;
  font-weight: 700;
  color: #222;
}

.success-modal-text {
  margin: 0 0 20px;
  font-size: 15px;
  color: #666;
}

.success-modal-actions {
  display: flex;
  justify-content: center;
}
</style>
