<script setup>
import PageHeading from "@/components/user/common/PageHeading.vue";
import { notify as publishNotice, storefrontNotice } from "@/composables/useStorefrontNotice";
import AppState from "@/components/user/common/AppState.vue";
import { computed, reactive, ref, onMounted, onBeforeUnmount, watch, nextTick } from "vue";
import { useRouter, useRoute } from "vue-router";
import ProfileSidebar from "@/components/user/profile/ProfileSidebar.vue";
import ProfileOrdersTab from "@/components/user/profile/ProfileOrdersTab.vue";
import ProfileAddressesTab from "@/components/user/profile/ProfileAddressesTab.vue";
import ProfileAccountTab from "@/components/user/profile/ProfileAccountTab.vue";
import ProfilePasswordTab from "@/components/user/profile/ProfilePasswordTab.vue";
import ProfileOrderDetailTab from "@/components/user/profile/ProfileOrderDetailTab.vue";
import { useAuthStore } from "@/stores/user/auth";
import { useCartStore } from "@/stores/user/cart";
import { normalizeId } from "@/utils/id.util";
import { imageFileSchema } from "@/validators/common.validator";
import userService from "@/services/user.service";
import authService from "@/services/auth.service";
import ordersService from "@/services/orders.service";
import addressService from "@/services/address.service";
import { useDialogFocus } from "@/composables/useDialogFocus";
import { userError, userFieldErrors } from "@/utils/user-error.util";
import { accountSchema, addressSchema, changePasswordSchema } from "@/validators/storefront-form.validator";

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const cartStore = useCartStore();
const userId = computed(() => authStore.userId);
let accountNotice = null;
function notify(message, type) {
  publishNotice(message, type);
  accountNotice = storefrontNotice.value;
}
const loadingProfile = ref(false);
const loadingOrders = ref(false);
const loadingAddresses = ref(false);
const activeTab = ref(
  ["orders", "addresses", "account", "password"].includes(route.query.tab)
    ? route.query.tab
    : "dashboard",
);
const selectedOrder = ref(null);
const isAddressModalOpen = ref(false);
const editingAddressId = ref("");
const addressDialog = ref(null);
useDialogFocus(isAddressModalOpen, addressDialog, closeAddressModal);

const menuItems = [
  { key: "dashboard", label: "Bảng điều khiển", icon: "fa-solid fa-house" },
  { key: "orders", label: "Đơn hàng", icon: "fa-solid fa-file-lines" },
  { key: "addresses", label: "Địa chỉ", icon: "fa-solid fa-location-dot" },
  { key: "account", label: "Thông tin cá nhân", icon: "fa-solid fa-user" },
  { key: "password", label: "Đổi mật khẩu", icon: "fa-solid fa-key" },
];

const userProfile = reactive({
  name: "",
  phone: "",
  email: "",
  address: "",
  avatar: "",
});

const accountForm = reactive({
  name: "",
  phone: "",
  email: "",
  address: "",
});

const passwordForm = reactive({
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
});

const profileError = ref("");
const ordersError = ref("");
const addressesError = ref("");
const orders = ref([]);
const addresses = ref([]);

const newAddressForm = reactive({
  full_name: "",
  address: "",
  city: "",
  phone: "",
  isDefault: false,
});

const accountErrors = ref({});
const passwordErrors = ref({});
const addressErrors = ref({});
const submittedForms = reactive({ account: false, password: false, address: false });
const saving = reactive({ account: false, password: false, address: false });
function validateFields(schema, values, errors) {
  const parsed = schema.safeParse(values);
  errors.value = parsed.success ? {} : userFieldErrors(parsed.error);
  return parsed.success;
}
watch(accountForm, () => { if (submittedForms.account) validateFields(accountSchema, accountForm, accountErrors); });
watch(passwordForm, () => { if (submittedForms.password) validateFields(changePasswordSchema, passwordForm, passwordErrors); });
watch(newAddressForm, () => { if (submittedForms.address) validateFields(addressSchema, newAddressForm, addressErrors); });
watch(() => route.query.tab, (tab) => {
  activeTab.value = menuItems.some((item) => item.key === tab) ? tab : "dashboard";
  selectedOrder.value = null;
});

function formatDate(dateValue) {
  if (!dateValue) return "";
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return dateValue;
  return d.toLocaleDateString("vi-VN");
}

function getImageUrl(path) {
  if (!path) return "/img/avatar.jpg";
  if (path.startsWith("http")) return path;
  if (path.startsWith("/uploads")) return path;
  return path;
}

function normalizeOrder(raw, previous) {
  const shipping = raw.shipping_address || {};

  const items = Array.isArray(raw.items)
    ? raw.items.map((item, index) => ({
        id: item.product_id || item._id || item.id || index,
        name: item.name || "Sản phẩm",
        thumbnail: item.thumbnail || "",
        price: Number(item.price || 0),
        quantity: Number(item.quantity || 1),
        subtotal: item.subtotal ?? item.totalPrice ?? null,
        batchAllocations: item.batchAllocations || [],
      }))
    : [];

  const paymentMethod =
    raw.payment_method === "cash" ? "cod" : raw.payment_method || previous?.paymentMethod || "unknown";

  return {
    id: normalizeId(raw._id || raw.id),
    _id: normalizeId(raw._id || raw.id),
    userId: normalizeId(raw.user_id) || previous?.userId || normalizeId(userId.value),
    paymentStatus: raw.payment_status ?? previous?.paymentStatus ?? null,
    subtotal: raw.subtotal_price ?? previous?.subtotal ?? null,
    shippingFee: raw.shipping_fee ?? previous?.shippingFee ?? null,
    discount: raw.discount_amount ?? previous?.discount ?? null,
    orderDate: formatDate(raw.created_at || raw.orderDate),
    status: raw.status_text || raw.status || "Chờ xác nhận",
    rawStatus: raw.status || "",
    paymentMethod,
    total: raw.total_price ?? raw.total ?? previous?.total ?? null,
    items,
    shipping:
      !raw.shipping_address && previous?.shipping
        ? previous.shipping
        : {
            fullName:
              shipping.fullName || shipping.full_name || shipping.name || "",
            address:
              shipping.address ||
              shipping.address_line ||
              shipping.street ||
              "",
            city: shipping.city || shipping.province || "",
            phone: shipping.phone || shipping.phoneNumber || "",
          },
    timeline: Array.isArray(raw.timeline) ? raw.timeline : [],
  };
}

function normalizeAddress(raw) {
  return {
    id: raw._id || raw.id,
    userId: normalizeId(raw.user_id) || normalizeId(userId.value),
    full_name: raw.full_name || raw.full_name || raw.name || "",
    address: raw.address_line || raw.street || "",
    city: raw.city || raw.province || "",
    phone: raw.phone || raw.phoneNumber || "",
    isDefault: !!(raw.isDefault || raw.is_default),
  };
}

async function fetchUserProfile() {
  return readAccount('profile', loadingProfile, profileError,
    context => userService.getUserById(context.owner), user => {
      if (normalizeId(user?._id || user?.id) !== normalizeId(userId.value)) throw new Error('Profile owner mismatch');
      Object.assign(userProfile, { name:user.name || '', phone:user.phone || '', email:user.email || '', address:user.address || '', avatar:getImageUrl(user.avatar_url || user.avatar || '') });
      Object.assign(accountForm, { name:userProfile.name, phone:userProfile.phone, email:userProfile.email, address:userProfile.address });
    }, 'Không thể tải thông tin tài khoản. Vui lòng thử lại.');
}

async function fetchOrders() {
  return readAccount('orders', loadingOrders, ordersError,
    context => ordersService.getByUser(context.owner), raw => {
      if (!Array.isArray(raw) || raw.some(item => item.user_id && normalizeId(item.user_id) !== normalizeId(userId.value))) throw new Error('Order owner mismatch');
      orders.value = raw.map(item => normalizeOrder(item));
      if (selectedOrder.value) selectedOrder.value = orders.value.find(item => item.id === selectedOrder.value.id) || null;
    }, 'Không thể tải đơn hàng. Vui lòng thử lại.', () => { orders.value=[]; selectedOrder.value=null; });
}

async function fetchAddresses() {
  return readAccount('addresses', loadingAddresses, addressesError,
    context => addressService.getByUser(context.owner), res => {
      const list=Array.isArray(res)?res:Array.isArray(res?.data)?res.data:Array.isArray(res?.addresses)?res.addresses:[];
      if (list.some(item => item.user_id && normalizeId(item.user_id) !== normalizeId(userId.value))) throw new Error('Address owner mismatch');
      addresses.value=list.map(normalizeAddress);
    }, 'Không thể tải địa chỉ. Vui lòng thử lại.', () => { addresses.value=[]; });
}

async function updateAvatar(file) {
  if (avatarSaving.value || !accountReady()) return;
  const checked=imageFileSchema.safeParse(file);
  if (!file || !checked.success) { notify(checked.error?.issues[0]?.message || 'Vui lòng chọn ảnh hợp lệ'); return; }
  await mutateAccount('avatar', avatarSaving, null, context => userService.updateAvatar(context.owner,file), async (res, context) => {
    if (res.avatar_url) userProfile.avatar=getImageUrl(res.avatar_url); else await fetchUserProfile();
    if (isCurrent(context)) notify(res.message || 'Cập nhật ảnh đại diện thành công');
  }, error => notify(userError(error,'Cập nhật ảnh đại diện thất bại')));
}

async function updateAccount() {
  if (saving.account || loadingProfile.value || profileError.value || !accountReady()) return;
  submittedForms.account=true;
  if (!validateFields(accountSchema, accountForm, accountErrors)) return;
  const values={name:accountForm.name.trim(),phone:accountForm.phone.trim(),address:accountForm.address.trim()};
  await mutateAccount('account', saving, 'account', context => userService.updateUser(context.owner, values), res => {
    Object.assign(userProfile, values);
    if (normalizeId(authStore.user?._id) === normalizeId(userId.value)) authStore.user={...authStore.user,...values};
    notify(res.message || 'Cập nhật thông tin thành công');
  }, error => { accountErrors.value=userFieldErrors(error); notify(userError(error,'Cập nhật thông tin thất bại')); });
}

async function changePassword() {
  if (saving.password || !accountReady()) return;
  submittedForms.password=true;
  if (!validateFields(changePasswordSchema,passwordForm,passwordErrors)) return;
  const current=passwordForm.currentPassword, next=passwordForm.newPassword;
  await mutateAccount('password',saving,'password',() => authService.changePassword(current,next), res => {
    Object.assign(passwordForm,{currentPassword:'',newPassword:'',confirmPassword:''});
    submittedForms.password=false; passwordErrors.value={};
    notify(res.message || 'Đổi mật khẩu thành công');
  }, error => {
    const fields=userFieldErrors(error);
    passwordErrors.value={...fields,currentPassword:fields.oldPassword || fields.currentPassword};
    if (error?.response?.data?.code === 'INVALID_CURRENT_PASSWORD') passwordErrors.value.currentPassword=error.response.data.message;
    notify(userError(error,'Đổi mật khẩu thất bại'));
  });
}

function viewOrderDetail(order) {
  if (!accountReady()) return;
  const owned=orders.value.find(item=>item.id===(order.id || order._id));
  if (!owned || owned.userId!==normalizeId(userId.value)) return;
  selectedOrder.value=owned;
}

async function backToOrders() {
  selectedOrder.value = null;
  await fetchOrders();
}

function openTab(tabKey) {
  activeTab.value = tabKey;
  router.replace({ query: { ...route.query, tab: tabKey } });
  if (tabKey !== "orders") {
    selectedOrder.value = null;
  }
}

function openAddressModal(address = null) {
  if (!accountReady() || saving.address || addressActionPending.value) return;
  if (address?.userId && normalizeId(address.userId)!==normalizeId(userId.value)) return;
  editingAddressId.value=address?.id || '';submittedForms.address=false;addressErrors.value={};
  Object.assign(newAddressForm,{full_name:address?.full_name || '',address:address?.address || '',city:address?.city || '',phone:address?.phone || '',isDefault:address?.isDefault || false});
  isAddressModalOpen.value=true;
}

function closeAddressModal() {
  isAddressModalOpen.value = false;
}

async function saveNewAddress() {
  if (saving.address || addressActionPending.value || !accountReady()) return;
  submittedForms.address=true;
  if (!validateFields(addressSchema,newAddressForm,addressErrors)) return;
  const editing=editingAddressId.value;
  const values={full_name:newAddressForm.full_name,address_line:newAddressForm.address,city:newAddressForm.city,phone:newAddressForm.phone,is_default:newAddressForm.isDefault};
  await mutateAccount('address-write',saving,'address', context => editing?addressService.update(editing,values):addressService.create({user_id:context.owner,...values}), async (res,context) => {
    isAddressModalOpen.value=false; await fetchAddresses();
    if (isCurrent(context)) notify(editing?'Đã cập nhật địa chỉ':'Đã thêm địa chỉ mới');
  }, error => { const fields=userFieldErrors(error);addressErrors.value={...fields,address:fields.address_line || fields.address};notify(userError(error,'Lưu địa chỉ thất bại')); });
}

async function removeAddress(id) {
  if (saving.address || addressActionPending.value || !accountReady() || !addresses.value.some(item=>item.id===id)) return;
  if (!window.confirm('Bạn có chắc muốn xóa địa chỉ này?\n\nDữ liệu sau khi xóa sẽ không thể khôi phục.')) return;
  await mutateAccount('address-write',addressActionPending,null,() => addressService.delete(id),async (res,context)=>{await fetchAddresses();if(isCurrent(context))notify('Đã xóa địa chỉ');},error=>notify(userError(error,'Xóa địa chỉ thất bại')));
}

async function setDefaultAddress(id) {
  if (saving.address || addressActionPending.value || !accountReady() || !addresses.value.some(item=>item.id===id)) return;
  await mutateAccount('address-write',addressActionPending,null,() => addressService.update(id,{is_default:true}),async(res,context)=>{await fetchAddresses();if(isCurrent(context))notify('Đã cập nhật địa chỉ mặc định');},error=>notify(userError(error,'Cập nhật địa chỉ mặc định thất bại')));
}

async function cancelOrder(orderId) {
  const previous=orders.value.find(item=>item.id===orderId);
  if (!accountReady() || orderActionPending.value || !previous || previous.userId!==normalizeId(userId.value) || previous.rawStatus!=='pending') return;
  await mutateAccount('order-write',orderActionPending,null,() => ordersService.cancel(orderId), updated => {
    if (updated?.user_id && normalizeId(updated.user_id)!==normalizeId(userId.value)) throw new Error('Order owner mismatch');
    const normalized=normalizeOrder(updated,previous),index=orders.value.findIndex(item=>item.id===orderId);
    if(index!==-1) orders.value[index]=normalized;
    if(selectedOrder.value?.id===orderId) selectedOrder.value=normalized;
    notify('Hủy đơn hàng thành công');
  },error=>notify(userError(error,'Không thể cập nhật đơn hàng')));
}

async function completeOrder(orderId) {
  const previous=orders.value.find(item=>item.id===orderId);
  if (!accountReady() || orderActionPending.value || !previous || previous.userId!==normalizeId(userId.value) || previous.rawStatus!=='shipping') return;
  await mutateAccount('order-write',orderActionPending,null,() => ordersService.complete(orderId), updated => {
    if (updated?.user_id && normalizeId(updated.user_id)!==normalizeId(userId.value)) throw new Error('Order owner mismatch');
    const normalized=normalizeOrder(updated,previous),index=orders.value.findIndex(item=>item.id===orderId);
    if(index!==-1) orders.value[index]=normalized;
    if(selectedOrder.value?.id===orderId) selectedOrder.value=normalized;
    notify('Xác nhận nhận hàng thành công');
  },error=>notify(userError(error,'Không thể cập nhật đơn hàng')));
}

const avatarSaving = ref(false);
const addressActionPending = ref(false);
const orderActionPending = ref(false);
const accountTokens = new Map();
let accountDisposed = false;
let loadGeneration = 0;

function accountReady() {
  return !accountDisposed && authStore.isLoggedIn && !!normalizeId(userId.value);
}
function beginRequest(key) {
  if (!accountReady()) return null;
  // Reuse the existing owner/session epoch; this is only a component request slot.
  const token = { key, owner: normalizeId(userId.value), epoch: cartStore.ownerVersion };
  accountTokens.set(key, token);
  return token;
}
function isCurrent(token) {
  return !!token && accountReady() && token.owner === normalizeId(userId.value) &&
    token.epoch === cartStore.ownerVersion && accountTokens.get(token.key) === token;
}
async function readAccount(key, loading, error, operation, commit, message, clear = () => {}) {
  const token = beginRequest(key);
  if (!token) return;
  loading.value = true;
  error.value = '';
  try {
    const result = await operation(token);
    if (isCurrent(token)) commit(result);
  } catch {
    if (isCurrent(token)) { clear(); error.value = message; }
  } finally {
    if (isCurrent(token)) loading.value = false;
  }
}
async function mutateAccount(key, flag, field, operation, commit, fail) {
  const token = beginRequest(key);
  if (!token) return;
  const set = value => { if (field) flag[field] = value; else flag.value = value; };
  set(true);
  try {
    const result = await operation(token);
    if (!isCurrent(token)) return;
    // A confirmed write supersedes reads that started before its confirmation.
    const resource = key === 'order-write' ? 'orders' : key === 'address-write' ? 'addresses' :
      key === 'account' || key === 'avatar' ? 'profile' : null;
    if (resource) {
      accountTokens.delete(resource);
      if (resource === 'orders') loadingOrders.value = false;
      else if (resource === 'addresses') loadingAddresses.value = false;
      else loadingProfile.value = false;
    }
    await commit(result, token);
  } catch (error) {
    if (isCurrent(token)) fail(error);
  } finally {
    if (isCurrent(token)) set(false);
  }
}
function clearAccount(){
  // Only clear feedback owned by this page; a different consumer may have
  // replaced it with a newer notice in the meantime.
  if (accountNotice && storefrontNotice.value === accountNotice) storefrontNotice.value = null;
  accountNotice = null;
  accountTokens.clear();selectedOrder.value=null;orders.value=[];addresses.value=[];
  for(const key of Object.keys(userProfile))userProfile[key]='';
  for(const key of Object.keys(accountForm))accountForm[key]='';
  for(const key of Object.keys(passwordForm))passwordForm[key]='';
  Object.assign(newAddressForm,{full_name:'',address:'',city:'',phone:'',isDefault:false});
  isAddressModalOpen.value=false;editingAddressId.value='';
  accountErrors.value={};passwordErrors.value={};addressErrors.value={};
  profileError.value='';ordersError.value='';addressesError.value='';
  loadingProfile.value=false;loadingOrders.value=false;loadingAddresses.value=false;
  avatarSaving.value=false;addressActionPending.value=false;orderActionPending.value=false;
  for(const key of Object.keys(saving)){saving[key]=false;submittedForms[key]=false;}
}
async function loadAccount(){if(accountReady())await Promise.all([fetchUserProfile(),fetchOrders(),fetchAddresses()]);}
watch(()=>[cartStore.ownerVersion,authStore.isLoggedIn],()=>{
  const generation=++loadGeneration;clearAccount();
  nextTick(()=>{if(!accountDisposed && generation===loadGeneration)loadAccount();});
},{flush:'sync'});
onMounted(loadAccount);
onBeforeUnmount(()=>{accountDisposed=true;++loadGeneration;clearAccount();});
</script>

<template>
  <div id="content" class="site-content sage-account">
    <PageHeading title="Tài khoản của tôi" />

    <div class="container">
      <AppState
        v-if="profileError && activeTab === 'dashboard'"
        kind="error"
        :title="profileError"
        retry
        @retry="fetchUserProfile"
      />
      <div class="user-profile-page">
        <div class="approved-account-layout">
          <div
            class="approved-account-navigation"
          >
            <ProfileSidebar
              :menu-items="menuItems"
              :active-tab="activeTab"
              @change-tab="openTab"
            />
          </div>

          <div
            class="approved-account-content"
          >
            <div v-if="activeTab === 'dashboard'" class="profile-content-box">
              <AppState
                v-if="loadingProfile"
                kind="loading"
                title="Đang tải tài khoản..."
              />
              <h2 class="profile-section-title">Xin chào{{ userProfile.name ? ", " + userProfile.name : "" }}.</h2>
              <p>
                Tài khoản <strong>{{ userProfile.name }}</strong
                >.
              </p>
              <p>
                Từ trang tài khoản, bạn có thể xem đơn hàng gần đây, quản lý địa
                chỉ giao hàng, và cập nhật thông tin tài khoản hoặc mật khẩu.
              </p>
              <div class="approved-account-shortcuts">
                <router-link :to="{ path: '/profile', query: { ...route.query, tab: 'orders' } }"><strong>Đơn hàng</strong><span>{{ loadingOrders ? 'Đang tải...' : ordersError ? 'Kiểm tra đơn hàng' : orders.length + ' đơn hàng' }}</span></router-link>
                <router-link :to="{ path: '/profile', query: { ...route.query, tab: 'addresses' } }"><strong>Địa chỉ</strong><span>{{ loadingAddresses ? 'Đang tải...' : addressesError ? 'Kiểm tra địa chỉ' : addresses.length + ' địa chỉ' }}</span></router-link>
                <router-link to="/wishlist"><strong>Yêu thích</strong><span>Xem sản phẩm đã lưu</span></router-link>
              </div>
            </div>

            <ProfileOrdersTab
              v-else-if="activeTab === 'orders' && !selectedOrder"
              :orders="orders"
              :loading="loadingOrders"
              :error="ordersError"
              @retry="fetchOrders"
              @view-order-detail="viewOrderDetail"
            />

            <ProfileOrderDetailTab
              v-else-if="activeTab === 'orders' && selectedOrder"
              :order="selectedOrder"
              :saving="orderActionPending"
              @back-to-orders="backToOrders"
              @cancel-order="cancelOrder"
              @complete-order="completeOrder"
            />

            <AppState
              v-else-if="activeTab === 'addresses' && loadingAddresses"
              kind="loading"
              title="Đang tải địa chỉ..."
            />
            <AppState
              v-else-if="activeTab === 'addresses' && addressesError"
              kind="error"
              :title="addressesError"
              retry
              @retry="fetchAddresses"
            />
            <ProfileAddressesTab
              v-else-if="activeTab === 'addresses'"
              :addresses="addresses"
              :saving="saving.address || addressActionPending"
              @open-address-modal="openAddressModal"
              @remove-address="removeAddress"
              @set-default-address="setDefaultAddress"
            />

            <AppState v-else-if="activeTab === 'account' && loadingProfile" kind="loading" title="Đang tải thông tin cá nhân..." />
            <AppState v-else-if="activeTab === 'account' && profileError" kind="error" :title="profileError" retry @retry="fetchUserProfile" />
            <ProfileAccountTab
              :avatar-saving="avatarSaving"
              v-else-if="activeTab === 'account'"
              :user-profile="userProfile"
              :account-form="accountForm"
              :errors="accountErrors"
              :saving="saving.account"
              @update-account="updateAccount"
              @update-avatar="updateAvatar"
            />

            <ProfilePasswordTab
              v-else-if="activeTab === 'password'"
              :password-form="passwordForm"
              :errors="passwordErrors"
              :saving="saving.password"
              @change-password="changePassword"
            />
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="isAddressModalOpen"
      class="address-modal-overlay"
      @click="closeAddressModal"
    >
      <div
        ref="addressDialog"
        tabindex="-1"
        class="address-modal" data-validation-scope
        role="dialog"
        aria-modal="true"
        :aria-label="editingAddressId ? 'Sửa địa chỉ' : 'Thêm địa chỉ mới'"
        @keydown.esc="closeAddressModal"
        @click.stop
      >
        <div class="address-modal-header">
          <h3>{{ editingAddressId ? 'Sửa địa chỉ' : 'Thêm địa chỉ mới' }}</h3>
          <button
            class="address-modal-close"
            aria-label="Đóng hộp thoại"
            @click="closeAddressModal"
          >
            ×
          </button>
        </div>

        <div class="address-modal-body" :inert="saving.address">
          <div class="form-group">
            <label for="userprofilepage-field-1">Tên người dùng</label>
            <input
              id="userprofilepage-field-1"
              v-model="newAddressForm.full_name"
              type="text"
              class="form-control"
              :aria-invalid="!!addressErrors.full_name"
              :aria-describedby="addressErrors.full_name ? 'userprofilepage-field-1-error' : undefined"
            />
            <p id="userprofilepage-field-1-error" class="form-error form-error--field" role="alert">
              {{ addressErrors.full_name }}
            </p>
          </div>

          <div class="form-group">
            <label for="userprofilepage-field-2">Địa chỉ</label>
            <input
              id="userprofilepage-field-2"
              v-model="newAddressForm.address"
              type="text"
              class="form-control"
              :aria-invalid="!!addressErrors.address"
              :aria-describedby="addressErrors.address ? 'userprofilepage-field-2-error' : undefined"
            />
            <p id="userprofilepage-field-2-error" class="form-error form-error--field" role="alert">
              {{ addressErrors.address }}
            </p>
          </div>

          <div class="form-group">
            <label for="userprofilepage-field-3">Thành phố</label>
            <input
              id="userprofilepage-field-3"
              v-model="newAddressForm.city"
              type="text"
              class="form-control"
              :aria-invalid="!!addressErrors.city"
              :aria-describedby="addressErrors.city ? 'userprofilepage-field-3-error' : undefined"
            />
            <p id="userprofilepage-field-3-error" class="form-error form-error--field" role="alert">
              {{ addressErrors.city }}
            </p>
          </div>

          <div class="form-group">
            <label for="userprofilepage-field-4">Số điện thoại</label>
            <input
              id="userprofilepage-field-4"
              v-model="newAddressForm.phone"
              type="tel" autocomplete="tel"
              class="form-control"
              :aria-invalid="!!addressErrors.phone"
              :aria-describedby="addressErrors.phone ? 'userprofilepage-field-4-error' : undefined"
            />
            <p id="userprofilepage-field-4-error" class="form-error form-error--field" role="alert">
              {{ addressErrors.phone }}
            </p>
          </div>

          <div class="form-group">
            <label class="address-default-check">
              <input v-model="newAddressForm.isDefault" type="checkbox" />
              Đặt làm địa chỉ mặc định
            </label>
          </div>
        </div>

        <div class="address-modal-footer">
          <button class="btn btn-primary" :disabled="saving.address" :aria-busy="saving.address" @click="saveNewAddress" data-validation-submit>
            Lưu địa chỉ
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
