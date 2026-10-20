<script setup>
import PageHeading from "@/components/user/common/PageHeading.vue";
import { notify } from "@/composables/useStorefrontNotice";
import AppState from "@/components/user/common/AppState.vue";
import ResponsiveImage from "@/components/user/common/ResponsiveImage.vue";
import { computed, onMounted, onBeforeUnmount, reactive, ref, watch, nextTick } from "vue";
import { storeToRefs } from "pinia";
import { useRouter } from "vue-router";
import { useCartStore } from "@/stores/user/cart";
import { useAuthStore } from "@/stores/user/auth";
import addressService from "@/services/address.service";
import orderService from "@/services/orders.service";
import paymentService from "@/services/payments.service";
import shippingMethodService from "@/services/shipping-method.service";
import discountService from "@/services/discount.service";
import { checkoutSchema } from "@/validators/checkout.validator";
import { buildCheckoutPayload } from "@/utils/checkout-payload.util";
import { PAYMENT_METHODS } from "@/constants/checkout";
import { useDialogFocus } from "@/composables/useDialogFocus";
import { userError, userFieldErrors, userMessage } from "@/utils/user-error.util";
import { loadPaypalSdk } from "@/services/paypal-sdk.service";
import { readPendingPaypal, savePendingPaypal } from "@/utils/paypal-pending.util";
import { normalizeId } from "@/utils/id.util";
import { catalogStock } from "@/utils/catalog-query.util";
import { cartLineProblem } from "@/utils/storefront-shell.util";

const pageError = ref("");
const checkoutLoading = ref(true);
const router = useRouter();
const cartStore = useCartStore();
const authStore = useAuthStore();

const {
  items,
  cartCount,
  cartTotal,
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
const paymentMethod = ref(PAYMENT_METHODS.COD);
const submitting = ref(false);
const discountCode = ref("");
const discountLoading = ref(false);
const discountError = ref("");
const appliedDiscount = ref(null);
const voucherState = ref("idle");
let voucherVersion = 0;
let voucherRequest = null;
let voucherReceipt = null;
let writingVoucherCode = false;
const paypalContainer = ref(null);
const paypalError = ref("");
const paypalLoading = ref(false);
const pendingPaypal = ref(readPendingPaypal(sessionStorage, authStore.userId));
let paypalButtons;
let paypalRenderVersion = 0;
let disposed = false;
let checkoutLoadVersion = 0;
let cartMutationVersion = 0;
let validatedCart = null;
let cartSubmission = null;
const checkoutOwner = ref(null);
const cartReadError = ref("");

function cartContext() {
  return { owner: normalizeId(authStore.userId), epoch: cartStore.ownerVersion,
    load: checkoutLoadVersion, mutation: cartMutationVersion };
}
function currentCheckoutOwner(context) {
  return !disposed && authStore.isLoggedIn && !!context.owner &&
    context.owner === normalizeId(authStore.userId) && context.epoch === cartStore.ownerVersion &&
    context.load === checkoutLoadVersion;
}
function currentCartContext(context) {
  return currentCheckoutOwner(context) && context.mutation === cartMutationVersion;
}
function cartProblem(context = cartContext()) {
  if (!currentCartContext(context)) return "Phiên giỏ hàng đã thay đổi. Vui lòng kiểm tra lại.";
  if (checkoutLoading.value || !checkoutOwner.value || !currentCheckoutOwner(checkoutOwner.value))
    return "Đang xác minh giỏ hàng của tài khoản hiện tại.";
  if (cartStore.mutation.busy || cartStore.loading) return "Giỏ hàng đang cập nhật hoặc đối soát. Vui lòng chờ.";
  if (cartStore.mutation.uncertain) return "Chưa xác định kết quả cập nhật giỏ hàng. Hãy kiểm tra giỏ hàng và xác nhận đối soát trước khi thanh toán.";
  if (cartReadError.value) return cartReadError.value;
  if (!items.value.length) return "Giỏ hàng trống";
  for (const item of items.value) {
    const stock = catalogStock(item);
    if (stock === null) return `Chưa xác minh tồn kho của "${item.name || 'sản phẩm'}". Vui lòng kiểm tra giỏ hàng.`;
    if (!Number.isSafeInteger(Number(item.quantity)) || Number(item.quantity) < 1)
      return "Số lượng trong giỏ hàng không hợp lệ. Vui lòng kiểm tra giỏ hàng.";
    // The nullable gate must precede the legacy reader; linked UNKNOWN cannot use cached stock.
    const problem = stock < 1 ? "Sản phẩm không còn khả dụng." : cartLineProblem(item);
    if (problem || Number(item.quantity) > stock) return problem || `Sản phẩm "${item.name}" chỉ còn ${stock} sản phẩm khả dụng. Vui lòng cập nhật giỏ hàng.`;
  }
  return "";
}
const checkoutCartProblem = computed(() => cartProblem());
const checkoutVoucherProblem = computed(() => voucherProblem());
function canSubmitCart(context) {
  const problem = cartProblem(context) || voucherProblem();
  if (problem || validatedCart?.context !== context || validatedCart.items !== items.value) {
    notify(problem || "Giỏ hàng đã thay đổi. Vui lòng kiểm tra lại trước khi đặt hàng.", "error");
    return false;
  }
  return true;
}
function beginCartSubmission() {
  const attempt = { context: cartContext(), sent: false };
  cartSubmission = attempt;
  submitting.value = true;
  return attempt;
}
function finishCartSubmission(attempt) {
  if (cartSubmission !== attempt) return;
  cartSubmission = null;
  submitting.value = false;
}
watch(() => [cartStore.mutation.busy, cartStore.mutation.uncertain], () => {
  ++cartMutationVersion;
  validatedCart = null;
  if (hasVoucherIntent()) invalidateVoucher({ stale: true });
}, { flush: "sync" });
// Even a read that starts and finishes between validation and submission invalidates that proof.
watch(() => cartStore.loading, () => { validatedCart = null; }, { flush: "sync" });

function rememberPaypal(payment) {
  pendingPaypal.value = payment;
  savePendingPaypal(sessionStorage, authStore.userId, payment);
}

async function capturePendingPaypal(id = pendingPaypal.value?.id) {
  if (!id || submitting.value) return;
  const captureOwner = normalizeId(authStore.userId), captureEpoch = cartStore.ownerVersion;
  const ownsCapture = () => !disposed && captureOwner === normalizeId(authStore.userId) && captureEpoch === cartStore.ownerVersion;
  submitting.value = true;
  paypalError.value = "";
  try {
    rememberPaypal({ id, phase: "capture" });
    const result = await paymentService.capturePaypalOrder({ paypalOrderId: id });
    if (!ownsCapture()) return;
    if (!result?.data?._id) throw new Error("Chưa thể xác nhận đơn hàng sau thanh toán. Vui lòng thử lại.");
    rememberPaypal(null);
    // The payment API has confirmed the order. A later cart refresh failure
    // must not be presented as a failed payment or invite another charge.
    cartStore.items = [];
    cartStore.subtotal = 0;
    openSuccessModal("Thanh toán PayPal thành công");
  } catch (error) {
    if (!ownsCapture()) return;
    if (error?.response?.data?.code === "PAYPAL_NOT_APPROVED") rememberPaypal({ id, phase: "created" });
    if (["PAYPAL_PAYMENT_TERMINAL", "PAYPAL_INTENT_EXPIRED"].includes(error?.response?.data?.code)) {
      rememberPaypal(null);
      await loadCheckout();
      if (!ownsCapture()) return;
    }
    mapCheckoutErrors(error);
    paypalError.value = userError(error, "Chưa thể xác nhận kết quả PayPal. Vui lòng thử lại giao dịch này.");
  } finally { submitting.value = false; }
}

const addressErrors = reactive({});
const addressSubmitted = ref(false);
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
const addressDialog = ref(null);
const successDialog = ref(null);
useDialogFocus(isAddressModalOpen, addressDialog, closeAddressModal);
useDialogFocus(isSuccessModalOpen, successDialog, () => { isSuccessModalOpen.value = false; });

const checkoutErrors = reactive({});
const checkoutSubmitted = ref(false);
const checkoutTouched = reactive({ addressId: false, paymentMethod: false });

function checkoutValues() {
  return {
    addressId: selectedAddressId.value,
    paymentMethod: paymentMethod.value,
    shippingMethodId: selectedShippingMethodId.value || undefined,
    discountCode: appliedDiscount.value?.discount?.code || "",
  };
}

function validateCheckoutField(field) {
  const result = checkoutSchema.shape[field].safeParse(checkoutValues()[field]);
  checkoutErrors[field] = result.success
    ? ""
    : userMessage(result.error.issues[0]?.message, { field });
}

function onAddressChange() {
  checkoutTouched.addressId = true;
  fillAddressFromSaved();
  validateCheckoutField("addressId");
}

function onPaymentChange() {
  checkoutTouched.paymentMethod = true;
  validateCheckoutField("paymentMethod");
}

const selectedShippingMethod = computed(() => {
  return (
    shippingMethods.value.find(
      (method) =>
        String(method._id || method.id) ===
        String(selectedShippingMethodId.value),
    ) || null
  );
});

const shippingFee = computed(() =>
  items.value.length ? Number(selectedShippingMethod.value?.fee || 0) : 0,
);
const pricingSubtotal = computed(() => {
  const authoritative = appliedDiscount.value?.orderTotal;
  return typeof authoritative === "number" && Number.isFinite(authoritative) && authoritative >= 0 ? authoritative : Number(cartTotal.value || 0);
});
const discountAmount = computed(() =>
  Math.min(
    pricingSubtotal.value,
    Number(appliedDiscount.value?.discountAmount || 0),
  ),
);
const grandTotal = computed(() =>
  Math.max(
    0,
    pricingSubtotal.value +
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

watch(selectedAddressId, () => {
  fillAddressFromSaved();
  if (checkoutTouched.addressId || checkoutSubmitted.value) {
    validateCheckoutField("addressId");
  }
});

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
    subtotal: Number(
      item.subtotal || item.line_total || item.price * item.quantity || 0,
    ),
  }));
}

// Voucher identity follows the existing Checkout owner/epoch. This semantic key
// covers the validate payload and stock eligibility, not a transient array object.
const voucherCartKey = computed(() => JSON.stringify({
  subtotal: Number(cartTotal.value || 0),
  lines: buildDiscountCartItems().map((item) => ({
    product: normalizeId(item.productId), category: normalizeId(item.categoryId),
    quantity: item.quantity, price: item.price, subtotal: item.subtotal,
  })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  stock: items.value.map((item) => ({
    product: normalizeId(item.product_id || item.productId || item.id),
    available: catalogStock(item), inStock: item.inStock, outOfStock: item.outOfStock,
  })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
}));

function hasVoucherIntent() {
  return !!(appliedDiscount.value || voucherRequest || voucherState.value === "stale");
}
function writeVoucherCode(value) {
  writingVoucherCode = true;
  try { discountCode.value = value; } finally { writingVoucherCode = false; }
}
function invalidateVoucher({ clearCode = false, stale = false } = {}) {
  ++voucherVersion;
  voucherRequest = null;
  voucherReceipt = null;
  validatedCart = null;
  appliedDiscount.value = null;
  discountLoading.value = false;
  voucherState.value = stale ? "stale" : "idle";
  discountError.value = stale
    ? "Giỏ hàng hoặc mã giảm giá đã thay đổi. Vui lòng áp dụng lại hoặc bỏ mã để tiếp tục."
    : "";
  checkoutErrors.discountCode = "";
  if (clearCode) writeVoucherCode("");
}
function ownsVoucherRequest(request) {
  return !disposed && voucherRequest === request && request.version === voucherVersion &&
    currentCheckoutOwner(request.context);
}
function currentVoucherContext(context, key) {
  return currentCartContext(context) && key === voucherCartKey.value && !cartProblem(context);
}
function voucherProblem() {
  if (discountLoading.value) return "Đang kiểm tra mã giảm giá. Vui lòng chờ trước khi thanh toán.";
  if (voucherState.value === "stale") return discountError.value;
  if (appliedDiscount.value && (!voucherReceipt ||
      voucherReceipt.result !== appliedDiscount.value || voucherReceipt.version !== voucherVersion ||
      !currentVoucherContext(voucherReceipt.context, voucherReceipt.key)))
    return "Mã giảm giá chưa được xác minh cho giỏ hàng hiện tại. Vui lòng áp dụng lại hoặc bỏ mã.";
  return "";
}
watch(appliedDiscount, (result) => {
  voucherReceipt = result ? { result, version: voucherVersion, context: cartContext(), key: voucherCartKey.value } : null;
  validatedCart = null;
}, { flush: "sync" });
watch(voucherCartKey, () => {
  if (hasVoucherIntent()) invalidateVoucher({ stale: true });
}, { flush: "sync" });
watch(() => authStore.isLoggedIn, () => invalidateVoucher({ clearCode: true }), { flush: "sync" });

async function refreshPaypalButtons() {
  if (paymentMethod.value !== "paypal") return;
  await renderPaypalButtons();
}

function fillAddressFromSaved() {
  billingForm.fullName = selectedAddress.value?.full_name || "";
  billingForm.phone = selectedAddress.value?.phone || "";
  billingForm.address = selectedAddress.value?.address_line || "";
  billingForm.city = selectedAddress.value?.city || "";
}

async function fetchAddresses(context = cartContext()) {
  if (!context.owner) {
    savedAddresses.value = [];
    selectedAddressId.value = "";
    return;
  }

  try {
    const data = await addressService.getByUser(context.owner);
    if (!currentCheckoutOwner(context)) return;
    savedAddresses.value = Array.isArray(data) ? data : [];

    const first =
      savedAddresses.value.find((x) => x.is_default) || savedAddresses.value[0];

    if (first) {
      selectedAddressId.value = String(first._id);
      fillAddressFromSaved();
    }
  } catch {
    throw new Error("Không thể tải địa chỉ giao hàng.");
  }
}

function normalizeList(res) {
  return Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
}

async function fetchShippingMethods(context = cartContext()) {
  shippingLoading.value = true;
  try {
    const res = await shippingMethodService.getAll();
    if (!currentCheckoutOwner(context)) return;
    shippingMethods.value = normalizeList(res).filter(
      (method) => (method.status || "active") === "active",
    );

    if (!selectedShippingMethodId.value && shippingMethods.value.length) {
      selectedShippingMethodId.value = String(
        shippingMethods.value[0]._id || shippingMethods.value[0].id,
      );
    }
  } catch {
    throw new Error("Không thể tải phương thức vận chuyển.");
  } finally {
    if (currentCheckoutOwner(context)) shippingLoading.value = false;
  }
}

function currentCheckoutPayload() {
  return buildCheckoutPayload({
    userId: authStore.userId,
    addressId: selectedAddressId.value,
    paymentMethod: paymentMethod.value,
    shippingMethodId: selectedShippingMethodId.value,
    discountCode: appliedDiscount.value?.discount?.code,
  });
}

function mapCheckoutErrors(error) {
  const mapped = userFieldErrors(error);
  checkoutSubmitted.value = true;
  checkoutErrors.addressId = mapped.address_id || mapped.addressId || "";
  checkoutErrors.paymentMethod =
    mapped.payment_method || mapped.paymentMethod || "";
  checkoutErrors.shippingMethodId = mapped.shippingMethodId || "";
  checkoutErrors.discountCode = mapped.discountCode || "";
}

async function validateCheckout(context = cartContext()) {
  validatedCart = null;
  if (pageError.value || checkoutLoading.value) return false;
  const problem = cartProblem(context) || voucherProblem();
  if (problem) {
    notify(problem, "error");
    return false;
  }
  const previousItems = items.value;
  try {
    await cartStore.fetchCart(context.owner);
  } catch {
    if (currentCartContext(context)) {
      cartReadError.value = "Không thể kiểm tra giỏ hàng. Vui lòng tải lại để xác minh.";
      notify(cartReadError.value, "error");
    }
    return false;
  }
  // A superseded/old-owner GET may resolve without committing. Never treat it as validation.
  if (cartProblem(context) || voucherProblem() || items.value === previousItems) {
    if (currentCartContext(context)) notify(cartProblem(context) || voucherProblem() || "Chưa xác minh được giỏ hàng hiện tại.", "error");
    return false;
  }
  checkoutSubmitted.value = true;
  const result = checkoutSchema.safeParse(checkoutValues());
  for (const field of Object.keys(checkoutSchema.shape))
    checkoutErrors[field] = "";
  if (result.success) {
    validatedCart = { context, items: items.value };
    return true;
  }
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (field && !checkoutErrors[field]) checkoutErrors[field] = userMessage(issue.message, { field });
  }
  return false;
}

async function applyDiscount({ silent = false } = {}) {
  if (disposed) return;
  const code = discountCode.value.trim();
  invalidateVoucher();

  if (!code) {
    appliedDiscount.value = null;
    if (!silent) discountError.value = "Vui lòng nhập mã giảm giá";
    if (currentCheckoutOwner(cartContext())) await refreshPaypalButtons();
    return;
  }

  const context = cartContext();
  const problem = cartProblem(context);
  if (problem) {
    voucherState.value = "stale";
    discountError.value = problem;
    return;
  }

  const request = { context, key: voucherCartKey.value, code, version: voucherVersion };
  voucherRequest = request;
  discountLoading.value = true;
  voucherState.value = "pending";
  try {
    const result = await discountService.validate({
      code,
      userId: context.owner,
      subtotal: Number(cartTotal.value || 0),
      cartItems: buildDiscountCartItems(),
    });

    if (!ownsVoucherRequest(request)) return;
    if (!currentVoucherContext(context, request.key)) {
      invalidateVoucher({ stale: true });
      return;
    }
    if (result?.valid === false) {
      appliedDiscount.value = null;
      voucherState.value = "invalid";
      discountError.value = userMessage(result?.message, { fallback: "Mã giảm giá không hợp lệ" });
      await refreshPaypalButtons();
      return;
    }

    // Validate the existing server envelope; never manufacture an amount or code.
    if (result?.valid !== true || typeof result.discount?.code !== "string" ||
        result.discount.code.trim().toUpperCase() !== code.toUpperCase() ||
        typeof result.discountAmount !== "number" || !Number.isFinite(result.discountAmount) ||
        result.discountAmount < 0)
      throw new Error("Chưa thể xác nhận dữ liệu mã giảm giá. Vui lòng thử lại.");
    writeVoucherCode(result.discount.code);
    appliedDiscount.value = result;
    voucherState.value = "applied";
    discountError.value = "";
    checkoutErrors.discountCode = "";
    await refreshPaypalButtons();
  } catch (error) {
    if (!ownsVoucherRequest(request)) return;
    if (!currentVoucherContext(context, request.key)) {
      invalidateVoucher({ stale: true });
      return;
    }
    console.error(error);
    appliedDiscount.value = null;
    voucherState.value = "error";
    discountError.value =
      userError(error, "Không thể áp dụng mã giảm giá");
    await refreshPaypalButtons();
  } finally {
    if (ownsVoucherRequest(request)) {
      voucherRequest = null;
      discountLoading.value = false;
    }
  }
}

async function removeDiscount() {
  if (disposed) return;
  invalidateVoucher({ clearCode: true });
  if (currentCheckoutOwner(cartContext())) await refreshPaypalButtons();
}

async function renderPaypalButtons() {
  await nextTick();
  if (!paypalContainer.value || pendingPaypal.value || disposed) return;
  const version = ++paypalRenderVersion;
  paypalLoading.value = true;
  paypalError.value = "";
  try {
    if (paypalButtons) { await paypalButtons.close(); paypalButtons = undefined; }
    const sdk = await loadPaypalSdk();
    if (version !== paypalRenderVersion || disposed || paymentMethod.value !== PAYMENT_METHODS.PAYPAL || !paypalContainer.value) return;
    paypalContainer.value.innerHTML = "";
    const buttons = sdk.Buttons({
      async createOrder() {
        if (submitting.value) throw new Error("Giao dịch đang được xử lý. Vui lòng chờ.");
        if (pendingPaypal.value?.phase === "created") return pendingPaypal.value.id;
        if (pendingPaypal.value) throw new Error("Vui lòng kiểm tra giao dịch PayPal trước đó.");
        const attempt = beginCartSubmission();
        try {
          const context = attempt.context;
          if (!(await validateCheckout(context)) || !canSubmitCart(context)) throw new Error("Thông tin thanh toán chưa hợp lệ. Vui lòng kiểm tra lại.");
          attempt.sent = true;
          const pp = await paymentService.createPaypalOrder({
            ...currentCheckoutPayload(),
          });
          if (!pp?.id) throw new Error("Không thể khởi tạo thanh toán PayPal.");
          rememberPaypal({ id: pp.id, phase: "created" });
          return pp.id;
        } catch (error) {
          mapCheckoutErrors(error);
          throw error;
        } finally {
          finishCartSubmission(attempt);
        }
      },

      async onApprove(data) {
        await capturePendingPaypal(data.orderID);
      },

      onCancel() {
        if (pendingPaypal.value?.phase === "created") rememberPaypal(null);
        notify("Bạn đã hủy thanh toán PayPal");
      },

      onError(err) {
        paypalError.value = userError(err, "Không thể hiển thị hoặc xử lý PayPal. Vui lòng thử lại.");
      },
    });
    paypalButtons = buttons;
    await buttons.render(paypalContainer.value);
  } catch (error) {
    if (version === paypalRenderVersion) paypalError.value = userError(error, "Không thể tải PayPal. Vui lòng thử lại.");
  } finally {
    if (version === paypalRenderVersion) paypalLoading.value = false;
  }
}

async function placeCODOrder() {
  if (submitting.value || pendingPaypal.value) return;
  const attempt = beginCartSubmission();
  try {
    const context = attempt.context;
    if (!(await validateCheckout(context)) || !canSubmitCart(context)) return;
    attempt.sent = true;
    const result = await orderService.create(currentCheckoutPayload());
    if (!result?.data?.order?._id) throw new Error("Chưa thể xác nhận đơn hàng. Vui lòng kiểm tra lại danh sách đơn hàng.");
    cartStore.items = [];
    cartStore.subtotal = 0;
    openSuccessModal("Đặt hàng COD thành công");
  } catch (error) {
    console.error(error);
    mapCheckoutErrors(error);
    notify(userError(error, "Đặt hàng thất bại"));
  } finally {
    finishCartSubmission(attempt);
  }
}

function addNewAddress() {
  addressSubmitted.value = false;
  for (const key of Object.keys(addressErrors)) delete addressErrors[key];
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
  if (submitting.value) return;
  if (!authStore.userId) {
    notify("Bạn cần đăng nhập");
    return;
  }

  addressSubmitted.value = true;
  for (const field of ["fullName", "phone", "address", "city"])
    addressErrors[field] = newAddressForm[field].trim()
      ? ""
      : "Vui lòng nhập thông tin này.";
  if (Object.values(addressErrors).some(Boolean)) return;

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

    const newId =
      res?.data?._id || res?.data?.insertedId || res?._id || res?.insertedId;
    if (newId) {
      selectedAddressId.value = String(newId);
      fillAddressFromSaved();
    }

    closeAddressModal();
    notify("Thêm địa chỉ thành công");
  } catch (error) {
    console.error(error);
    const fields = userFieldErrors(error);
    for (const [field, apiField] of Object.entries({ fullName: "full_name", phone: "phone", address: "address_line", city: "city" })) addressErrors[field] = fields[apiField] || "";
    notify(userError(error, "Không thể thêm địa chỉ"));
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
  if (checkoutTouched.paymentMethod || checkoutSubmitted.value) {
    validateCheckoutField("paymentMethod");
  }
  if (paypalContainer.value) {
    paypalContainer.value.innerHTML = "";
  }

  if (val === PAYMENT_METHODS.PAYPAL) {
    await nextTick();
    await renderPaypalButtons();
  }
});

watch(selectedShippingMethodId, async () => {
  if (checkoutSubmitted.value) validateCheckoutField("shippingMethodId");
  await refreshPaypalButtons();
});

watch(discountCode, (value, previous) => {
  checkoutErrors.discountCode = "";
  if (writingVoucherCode || String(value || "").trim().toUpperCase() ===
      String(previous || "").trim().toUpperCase()) return;
  const stale = hasVoucherIntent() && !!String(value || "").trim();
  invalidateVoucher({ stale });
}, { flush: "sync" });

async function loadCheckout() {
  if (disposed) return;
  if (hasVoucherIntent()) invalidateVoucher({ stale: true });
  const context = { ...cartContext(), load: ++checkoutLoadVersion };
  checkoutOwner.value = null;
  validatedCart = null;
  cartReadError.value = "";
  pageError.value = "";
  checkoutLoading.value = true;
  try {
    if (!context.owner || !authStore.isLoggedIn) {
      pageError.value = "Phiên giỏ hàng đã thay đổi. Vui lòng đăng nhập lại để tiếp tục.";
      checkoutLoading.value = false;
      return;
    }
    await cartStore.fetchCart(context.owner);
    if (!currentCheckoutOwner(context)) return;
    await Promise.all([fetchAddresses(context), fetchShippingMethods(context)]);
    if (currentCheckoutOwner(context)) checkoutOwner.value = context;
  } catch {
    if (currentCheckoutOwner(context)) pageError.value = "Không thể tải thông tin thanh toán. Vui lòng thử lại.";
  } finally {
    if (currentCheckoutOwner(context)) checkoutLoading.value = false;
  }

  if (!currentCheckoutOwner(context)) return;
  if (paymentMethod.value === PAYMENT_METHODS.PAYPAL) {
    await nextTick();
    await renderPaypalButtons();
  }
}
watch(() => cartStore.ownerVersion, () => {
  invalidateVoucher({ clearCode: true });
  const version = ++checkoutLoadVersion;
  // Release only an old owner's pre-submit validation lease, never an already-sent payment/order.
  if (cartSubmission && !cartSubmission.sent) {
    cartSubmission = null;
    submitting.value = false;
  }
  checkoutOwner.value = null;
  validatedCart = null;
  checkoutLoading.value = true;
  savedAddresses.value = [];
  selectedAddressId.value = "";
  for (const field of Object.keys(billingForm)) billingForm[field] = "";
  // Store.reset increments ownerVersion before clearing data; reload after that sync reset finishes.
  nextTick(() => { if (!disposed && version === checkoutLoadVersion) loadCheckout(); });
}, { flush: "sync" });
onMounted(loadCheckout);
onBeforeUnmount(() => {
  disposed = true;
  invalidateVoucher({ clearCode: true });
  ++paypalRenderVersion;
  if (paypalButtons) Promise.resolve(paypalButtons.close()).catch((error) => console.error("Không thể đóng nút PayPal", error));
});
// Presentation only: never turn an unknown API price into a displayed zero.
function checkoutMoney(value) {
  if (value === null || value === undefined || String(value).trim() === "" || !Number.isFinite(Number(value)))
    return "Chưa xác định";
  return formatMoney(value);
}
</script>

<template>
  <div id="content" class="site-content sage-checkout">
    <PageHeading
      title="Thanh toán"
      description="Kiểm tra thông tin nhận hàng và đơn hàng trước khi xác nhận."
      parent="Giỏ hàng"
      parent-to="/cart"
    />

    <div class="container">
      <div class="page-checkout" data-validation-scope>
        <div v-if="pendingPaypal" class="paypal-recovery" role="status">
          <h2>Tiếp tục giao dịch PayPal</h2>
          <p>Giao dịch trước chưa được xác nhận hoàn tất. Kiểm tra lại giao dịch này trước khi tạo thanh toán khác.</p>
          <p v-if="paypalError" class="form-error" role="alert">{{ paypalError }}</p>
          <button type="button" class="btn btn-primary" :disabled="submitting" @click="capturePendingPaypal()">
            {{ submitting ? 'Đang kiểm tra...' : 'Kiểm tra và hoàn tất giao dịch' }}
          </button>
          <button type="button" v-if="pendingPaypal.phase === 'created'" class="text-button" @click="rememberPaypal(null); refreshPaypalButtons()">Đóng giao dịch chưa thanh toán</button>
        </div>
        <AppState
          v-if="pageError"
          kind="error"
          :title="pageError"
          retry
          @retry="loadCheckout"
        />
        <AppState
          v-if="checkoutLoading && !pageError"
          kind="loading"
          title="Đang tải dữ liệu giỏ hàng..."
        />

        <AppState
          v-else-if="!items.length && !pageError && !isSuccessModalOpen"
          title="Không thể thanh toán"
          description="Giỏ hàng của bạn đang trống."
          to="/products"
          action="Đi tới trang sản phẩm"
        />

        <div v-else-if="!pageError" class="checkout-layout">
          <div class="checkout-information">
            <div class="checkout-left">
              <div class="block block-address">
                <h2 class="block-title">Địa chỉ giao hàng</h2>

                <div v-if="savedAddresses.length" class="form-group">
                  <label for="checkoutpage-field-1">Chọn địa chỉ đã lưu</label>
                  <select
                    id="checkoutpage-field-1"
                    :aria-invalid="!!(checkoutErrors.addressId && (checkoutTouched.addressId || checkoutSubmitted))"
                    aria-describedby="checkout-address-selection-error"
                    v-model="selectedAddressId"
                    class="form-control"
                    :class="{
                      'is-invalid':
                        checkoutErrors.addressId &&
                        (checkoutTouched.addressId || checkoutSubmitted),
                    }"
                    @change="onAddressChange"
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
                <p v-else class="checkout-note">Chưa có địa chỉ nhận hàng. Hãy thêm địa chỉ để tiếp tục.</p>
                <div id="checkout-address-selection-error" class="form-error form-error--field" aria-live="polite">
                  {{ (checkoutErrors.addressId && (checkoutTouched.addressId || checkoutSubmitted)) ? checkoutErrors.addressId : "" }}
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
                <h2 class="block-title">Thông tin nhận hàng</h2>
                <p id="checkout-recipient-hint" class="checkout-note">
                  Thông tin được lấy từ địa chỉ đã chọn. Để thay đổi, hãy thêm
                  địa chỉ mới.
                </p>

                <div class="form-group">
                  <label for="checkoutpage-field-2">Họ và tên</label>
                  <input
                    id="checkoutpage-field-2"
                    v-model="billingForm.fullName"
                    type="text"
                    class="form-control"
                    placeholder="Nhập họ và tên"
                    readonly
                  />
                </div>

                <div class="form-group">
                  <label for="checkoutpage-field-3">Số điện thoại</label>
                  <input
                    id="checkoutpage-field-3"
                    v-model="billingForm.phone"
                    type="text"
                    class="form-control"
                    placeholder="Nhập số điện thoại"
                    readonly
                  />
                </div>

                <div class="form-group">
                  <label for="checkoutpage-field-4">Địa chỉ</label>
                  <textarea
                    id="checkoutpage-field-4"
                    v-model="billingForm.address"
                    type="text"
                    class="form-control"
                    placeholder="Địa chỉ từ thông tin đã lưu"
                    aria-describedby="checkout-recipient-hint"
                    rows="3"
                    readonly
                  ></textarea>
                </div>

                <div class="form-group">
                  <label for="checkoutpage-field-5">Tỉnh / Thành phố</label>
                  <input
                    id="checkoutpage-field-5"
                    v-model="billingForm.city"
                    type="text"
                    class="form-control"
                    placeholder="Nhập tỉnh / thành phố"
                    readonly
                  />
                </div>
              </div>

              <fieldset class="block block-shipping-method">
                <legend class="block-title">Phương thức vận chuyển</legend>

                <div v-if="shippingLoading" class="shipping-method-empty">
                  Đang tải phương thức vận chuyển...
                </div>

                <div
                  v-else-if="shippingMethods.length"
                  class="shipping-methods"
                >
                  <label
                    v-for="method in shippingMethods"
                    :key="method._id || method.id"
                    class="shipping-option"
                  >
                    <input
                      v-model="selectedShippingMethodId"
                      :aria-invalid="!!(checkoutErrors.shippingMethodId && checkoutSubmitted)"
                      aria-describedby="checkout-shipping-error"
                      type="radio"
                      name="checkout-shipping"
                      :value="String(method._id || method.id)"
                    />
                    <span class="shipping-option__content">
                      <span class="shipping-option__name">{{
                        method.name
                      }}</span>
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
                  Chưa có phương thức vận chuyển. Đơn hàng vẫn có thể tiếp tục
                  với phí vận chuyển 0đ.
                </div>
                <div id="checkout-shipping-error" class="form-error form-error--field" aria-live="polite">
                  {{ (checkoutErrors.shippingMethodId && checkoutSubmitted) ? checkoutErrors.shippingMethodId : "" }}
                </div>
              </fieldset>

<section class="block discount-box" aria-labelledby="checkout-discount-title">
                  <h2 id="checkout-discount-title" class="block-title">Mã giảm giá</h2>
                  <label for="checkout-discount" class="discount-box__label">Mã giảm giá</label>
                  <div class="discount-box__input-row">
                    <input
                      id="checkout-discount"
                      :aria-invalid="!!(checkoutErrors.discountCode && checkoutSubmitted)"
                      aria-describedby="checkout-discount-error"
                      v-model="discountCode"
                      type="text"
                      class="form-control"
                      placeholder="Nhập mã giảm giá"
                      :disabled="discountLoading || !!appliedDiscount"
                      @keyup.enter="applyDiscount()"
                    />
                    <button
                  type="button"
                      v-if="!appliedDiscount"
                      class="btn btn-primary"
                      :disabled="discountLoading || !discountCode.trim()"
                      :aria-busy="discountLoading"
                      @click="applyDiscount()"
                    >
                      {{ discountLoading ? "Đang kiểm tra..." : "Áp dụng" }}
                    </button>
                    <button
                  type="button"
                      v-else
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
                    <strong>-{{ checkoutMoney(discountAmount) }}</strong>
                    <p v-if="appliedDiscount.batchOffer">Lô {{ appliedDiscount.batchOffer.batchNumber }} · HSD {{ new Date(appliedDiscount.batchOffer.expiryDate).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) }}. Giảm {{ appliedDiscount.discount.value }}% trên {{ appliedDiscount.discount.eligibleQuantity }} sản phẩm thuộc lô này; phần hàng khác giữ giá thường.</p>
                  </div>

                  <div
                    id="checkout-discount-error"
                    class="form-error form-error--field"
                    aria-live="polite"
                  >
                    {{ discountError || (checkoutSubmitted ? checkoutErrors.discountCode : '') }}
                  </div>
                </section>

              <fieldset class="block block-payment">
                <legend class="block-title">Phương thức thanh toán</legend>

                <div class="payment-methods">
                  <label class="payment-option">
                    <input
                      v-model="paymentMethod"
                      :aria-invalid="!!(checkoutErrors.paymentMethod && (checkoutTouched.paymentMethod || checkoutSubmitted))"
                      aria-describedby="checkout-payment-error"
                      type="radio"
                      name="checkout-payment"
                      :value="PAYMENT_METHODS.PAYPAL"
                      @change="onPaymentChange"
                    />
                    <span><strong>PayPal / Thẻ qua PayPal</strong><small>Tiếp tục qua cổng thanh toán PayPal.</small></span>
                  </label>

                  <label class="payment-option">
                    <input
                      v-model="paymentMethod"
                      :aria-invalid="!!(checkoutErrors.paymentMethod && (checkoutTouched.paymentMethod || checkoutSubmitted))"
                      aria-describedby="checkout-payment-error"
                      type="radio"
                      name="checkout-payment"
                      :value="PAYMENT_METHODS.COD"
                      @change="onPaymentChange"
                    />
                    <span><strong>Thanh toán khi nhận hàng (COD)</strong><small>Thanh toán khi nhận đơn hàng.</small></span>
                  </label>
                </div>
                <div id="checkout-payment-error" class="form-error form-error--field" aria-live="polite">
                  {{ (checkoutErrors.paymentMethod && (checkoutTouched.paymentMethod || checkoutSubmitted)) ? checkoutErrors.paymentMethod : "" }}
                </div>
              </fieldset>
            </div>
          </div>

          <div class="checkout-aside">
            <div class="checkout-right">
              <section class="block block-summary" aria-labelledby="checkout-summary-title">
                <h2 id="checkout-summary-title" class="block-title">Đơn hàng của bạn</h2>

                <div class="summary-items">
                  <div
                    v-for="item in items"
                    :key="item.product_id || item.id"
                    class="summary-item"
                  >
                    <div class="summary-item-left">
                      <ResponsiveImage
                        :src="item.thumbnail"
                        :alt="item.name"
                        class="summary-thumb"
                      />
                    </div>

                    <div class="summary-item-right">
                      <div class="summary-name">{{ item.name }}</div>
                      <div class="summary-meta">
                        Số lượng: {{ item.quantity }} × {{ checkoutMoney(item.price) }}
                      </div>
                      <div v-if="item.line_total != null || item.subtotal != null" class="summary-line-amount">
                        <span>Thành tiền</span> <strong>{{ checkoutMoney(item.line_total ?? item.subtotal) }}</strong>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="summary-row">
                  <span>Tổng sản phẩm</span>
                  <strong>{{ cartCount }}</strong>
                </div>

                <div class="summary-row">
                  <span>Tạm tính</span>
                  <strong>{{ checkoutMoney(pricingSubtotal) }}</strong>
                </div>

                <div class="summary-row">
                  <span>
                    Phí vận chuyển
                    <small v-if="selectedShippingMethod">
                      ({{ selectedShippingMethod.name }})
                    </small>
                  </span>
                  <strong>{{ checkoutMoney(shippingFee) }}</strong>
                </div>

                <div class="summary-row discount-row">
                  <span>Giảm giá</span>
                  <strong>-{{ checkoutMoney(discountAmount) }}</strong>
                </div>

                <div class="summary-row total">
                  <span>Tổng cộng<small v-if="discountLoading || voucherState === 'stale'">Tạm tính · mã giảm giá chưa được xác nhận</small></span>
                  <strong>{{ checkoutMoney(grandTotal) }}</strong>
                </div>

                <div
                  v-if="(checkoutCartProblem || checkoutVoucherProblem) && !pendingPaypal"
                  id="checkout-cart-guard"
                  class="form-error"
                  role="status"
                >
                  <p>{{ checkoutCartProblem || checkoutVoucherProblem }}</p>
                  <router-link v-if="checkoutCartProblem" to="/cart">Kiểm tra giỏ hàng</router-link>
                  <button type="button" v-if="cartReadError && !cartStore.loading" class="text-button" @click="loadCheckout">Tải lại giỏ hàng</button>
                </div>

                <div
                  v-show="paymentMethod === PAYMENT_METHODS.PAYPAL"
                  class="paypal-actions"
                >
                  <div ref="paypalContainer"></div>
                  <p v-if="paypalLoading" role="status">Đang tải PayPal...</p>
                  <div v-if="paypalError && !pendingPaypal" role="alert">
                    <p class="form-error">{{ paypalError }}</p>
                    <button type="button" class="text-button" @click="renderPaypalButtons">Thử lại PayPal</button>
                  </div>
                </div>

                <div
                  v-show="paymentMethod === PAYMENT_METHODS.COD"
                  class="cod-actions"
                >
                  <button
                  type="button"
                    class="btn btn-primary btn-block"
                    @click="placeCODOrder"
                    data-validation-submit
                    :aria-busy="submitting"
                    :disabled="submitting || !!pendingPaypal || !!checkoutCartProblem || !!checkoutVoucherProblem"
                    :aria-describedby="(checkoutCartProblem || checkoutVoucherProblem) && !pendingPaypal ? 'checkout-cart-guard' : undefined"
                  >
                    {{ submitting ? "Đang đặt hàng..." : "ĐẶT HÀNG" }}
                  </button>
                </div>
                <p class="checkout-note checkout-summary-note">Kiểm tra địa chỉ, sản phẩm và tổng tiền trước khi đặt hàng.</p>
              </section>
            </div>
          </div>
        </div>
        <router-link class="checkout-back" to="/cart">← Quay lại giỏ hàng</router-link>

        <div v-if="isAddressModalOpen" class="address-modal-overlay">
          <div
            ref="addressDialog"
            tabindex="-1"
            class="address-modal" data-validation-scope
            role="dialog"
            aria-modal="true"
            aria-label="Thêm địa chỉ mới"
            @keydown.esc="closeAddressModal"
          >
            <div class="address-modal-header">
              <h2>Thêm địa chỉ mới</h2>
              <button
                  type="button"
                class="close-btn"
                aria-label="Đóng hộp thoại"
                @click="closeAddressModal"
              >
                ×
              </button>
            </div>

            <div class="address-modal-body">
              <div class="form-group">
                <label for="checkoutpage-field-6">Họ và tên</label>
                <input
                  id="checkoutpage-field-6" required autocomplete="name"
                  v-model="newAddressForm.fullName"
                  :class="{ 'is-invalid': addressErrors.fullName }"
                  :aria-invalid="!!addressErrors.fullName"
                  :aria-describedby="addressErrors.fullName ? 'checkout-address-error-fullName' : undefined"
                  @input="
                    addressSubmitted &&
                    (addressErrors.fullName = newAddressForm.fullName.trim()
                      ? ''
                      : 'Vui lòng nhập thông tin này.')
                  "
                  type="text"
                  class="form-control"
                />
                <div id="checkout-address-error-fullName" class="form-error form-error--field" aria-live="polite">
                  {{ addressErrors.fullName }}
                </div>
              </div>

              <div class="form-group">
                <label for="checkoutpage-field-7">Số điện thoại</label>
                <input
                  id="checkoutpage-field-7" required autocomplete="tel" inputmode="tel"
                  v-model="newAddressForm.phone"
                  :class="{ 'is-invalid': addressErrors.phone }"
                  :aria-invalid="!!addressErrors.phone"
                  :aria-describedby="addressErrors.phone ? 'checkout-address-error-phone' : undefined"
                  @input="
                    addressSubmitted &&
                    (addressErrors.phone = newAddressForm.phone.trim()
                      ? ''
                      : 'Vui lòng nhập thông tin này.')
                  "
                  type="text"
                  class="form-control"
                />
                <div id="checkout-address-error-phone" class="form-error form-error--field" aria-live="polite">
                  {{ addressErrors.phone }}
                </div>
              </div>

              <div class="form-group">
                <label for="checkoutpage-field-8">Địa chỉ</label>
                <input
                  id="checkoutpage-field-8" required autocomplete="street-address"
                  v-model="newAddressForm.address"
                  :class="{ 'is-invalid': addressErrors.address }"
                  :aria-invalid="!!addressErrors.address"
                  :aria-describedby="addressErrors.address ? 'checkout-address-error-address' : undefined"
                  @input="
                    addressSubmitted &&
                    (addressErrors.address = newAddressForm.address.trim()
                      ? ''
                      : 'Vui lòng nhập thông tin này.')
                  "
                  type="text"
                  class="form-control"
                />
                <div id="checkout-address-error-address" class="form-error form-error--field" aria-live="polite">
                  {{ addressErrors.address }}
                </div>
              </div>

              <div class="form-group">
                <label for="checkoutpage-field-9">Tỉnh / Thành phố</label>
                <input
                  id="checkoutpage-field-9" required autocomplete="address-level1"
                  v-model="newAddressForm.city"
                  :class="{ 'is-invalid': addressErrors.city }"
                  :aria-invalid="!!addressErrors.city"
                  :aria-describedby="addressErrors.city ? 'checkout-address-error-city' : undefined"
                  @input="
                    addressSubmitted &&
                    (addressErrors.city = newAddressForm.city.trim()
                      ? ''
                      : 'Vui lòng nhập thông tin này.')
                  "
                  type="text"
                  class="form-control"
                />
                <div id="checkout-address-error-city" class="form-error form-error--field" aria-live="polite">
                  {{ addressErrors.city }}
                </div>
              </div>

              <div class="form-group checkbox-line">
                <label>
                  <input v-model="newAddressForm.isDefault" type="checkbox" />
                  Đặt làm địa chỉ mặc định
                </label>
              </div>
            </div>

            <div class="address-modal-footer">
              <button type="button" class="btn btn-default" @click="closeAddressModal">
                Hủy
              </button>
              <button type="button" class="btn btn-primary" :disabled="submitting" @click="saveNewAddress" data-validation-submit>
                {{ submitting ? "Đang lưu..." : "Lưu địa chỉ" }}
              </button>
            </div>
          </div>
        </div>

        <div v-if="isSuccessModalOpen" class="success-modal-overlay">
          <div
            ref="successDialog"
            tabindex="-1"
            class="success-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Đặt hàng thành công"
          >
            <div class="success-modal-icon">✓</div>
            <h2 class="success-modal-title">Thành công</h2>
            <p class="success-modal-text">{{ successMessage }}</p>

            <div class="success-modal-actions">
              <router-link class="btn btn-primary" to="/profile?tab=orders"
                >Xem đơn hàng</router-link
              >
              <button
                  type="button"
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
