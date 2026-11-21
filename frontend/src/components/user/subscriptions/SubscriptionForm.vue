<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, useId, watch } from 'vue';
import { captureAuthRequestContext, useAuthStore } from '@/stores/user/auth';
import subscriptions from '@/services/subscriptions.service';
import addressService from '@/services/address.service';
import shippingService from '@/services/shipping-method.service';
import discountService from '@/services/discount.service';
import { normalizeList } from '@/utils/storefront.util';
import { userError } from '@/utils/user-error.util';
import { subscriptionPayload, subscriptionFormProblem, subscriptionItemsProblem, subscriptionMoney as money, subscriptionDate as date } from '@/utils/subscription.util';
import CheckoutVoucherDialog from '@/components/user/checkout/CheckoutVoucherDialog.vue';
import SageInput from '@/components/user/sage/SageInput.vue';
import SageSelect from '@/components/user/sage/SageSelect.vue';
import SageTextarea from '@/components/user/sage/SageTextarea.vue';
import SageButton from '@/components/user/sage/SageButton.vue';
const props = defineProps({ initial: Object, productId: String, quantity: { type: Number, default: 1 } });
const emit = defineEmits(['saved']);
const auth = useAuthStore();
const form = reactive({ items: [], frequency: 'every_14_days', startDate: '', endMode: 'count', endDate: '', maxOccurrences: 6,
  addressId: '', shippingMethodId: '', paymentMethod: 'cod', notes: '', discountCode: '', maximumTotal: '', consent: false });
const addresses = ref([]), shipping = ref([]), catalog = ref([]), preview = ref(null), policy = ref(null);
const error = ref(''), loading = ref(true), busy = ref(false);
const invalidOwner = ref(false);
const keyword = ref(''), matches = ref([]), searchError = ref(''), searching = ref(false);
const pickerOpen = ref(false), activeIndex = ref(-1);
const resultId = useId();
const voucherId = useId();
const voucherCodeLimit = 50;
const voucherPicker = reactive({ open: false, loading: false, offers: [], error: '' });
const voucherApplyError = ref('');
let voucherRequest = null;
let searchVersion = 0, searchTimer;
let version = 0, disposed = false;
const chosenAddress = computed(() => addresses.value.find(row => row._id === form.addressId));
const lockedFrequency = computed(() => !!props.initial?.runs?.some(run => run.status !== 'scheduled' || run.startedAt));
const chosenShipping = computed(() => shipping.value.find(row => row._id === form.shippingMethodId));
const available = computed(() => (keyword.value.trim() ? matches.value : catalog.value)
  .filter(row => !form.items.some(item => item.productId === row._id)));
const activeResult = computed(() => available.value[activeIndex.value]);
const pickerDisabled = computed(() => busy.value || invalidOwner.value || form.items.length >= 30);
const voucherCode = computed(() => String(form.discountCode || '').trim());
const voucherApplied = computed(() => !!(preview.value && voucherCode.value));
const voucherPickerDisabled = computed(() => busy.value || invalidOwner.value || !!subscriptionItemsProblem(form.items));
const voucherItemsKey = computed(() => JSON.stringify(subscriptionPayload(form).items));
const addressOptions = computed(() => [{ value: '', label: 'Chọn địa chỉ nhận hàng' }, ...addresses.value.map(row => ({ value: row._id, label: `${row.full_name || row.fullName || ''} · ${row.address_line || row.address || ''}` }))]);
const shippingOptions = computed(() => [{ value: '', label: 'Chọn phương thức vận chuyển' }, ...shipping.value.map(row => ({ value: row._id, label: `${row.name} · ${money(row.fee)}` }))]);
function snapshotProduct(row) { return { productId: row._id, name: row.name, image: row.thumbnail || '', unit: row.unit || '', packageSize: row.packageSize || '', price: row.sellingPrice ?? row.price, quantity: 1 }; }
function invalidate() { preview.value = null; form.consent = false; version++; }
watch(() => JSON.stringify(subscriptionPayload(form)), invalidate);
function live(context, request) { return !disposed && context?.isCurrent() && request === version; }
async function load() {
  const request = ++version, context = captureAuthRequestContext(); loading.value = true; error.value = '';
  try {
    const [a, s, p, c] = await Promise.all([addressService.getByUser(auth.userId), shippingService.getAll(), subscriptions.policy(), subscriptions.catalog()]);
    if (!live(context, request)) return;
    addresses.value = normalizeList(a); shipping.value = normalizeList(s).filter(row => row.status === 'active'); policy.value = p; catalog.value = c.items;
    form.startDate = p.today;
    if (props.initial) {
      const sub = props.initial;
      Object.assign(form, { frequency: sub.frequency, startDate: sub.startDate, endMode: sub.endDate ? 'date' : 'count', endDate: sub.endDate || '', maxOccurrences: sub.maxOccurrences || 6,
        addressId: sub.addressId, shippingMethodId: sub.shippingMethodId, paymentMethod: sub.paymentMethod, notes: sub.notes, discountCode: sub.discountCode, maximumTotal: sub.maximumTotal,
        items: sub.items.map(item => ({ ...item.productSnapshot, productId: item.productId, quantity: item.quantity })) });
    } else {
      form.addressId = addresses.value.find(row => row.is_default || row.isDefault)?._id || addresses.value[0]?._id || '';
      form.shippingMethodId = shipping.value[0]?._id || '';
      if (props.productId) {
        let product = c.items.find(row => row._id === props.productId);
        if (!product) {
          const productService = (await import('@/services/product.service')).default;
          const response = await productService.getById(props.productId);
          if (disposed || !context.isCurrent()) return;
          product = response.data || response;
          const productPolicy = await subscriptions.policy(props.productId);
          if (!productPolicy.eligible) throw new Error('Sản phẩm không đủ điều kiện đăng ký định kỳ.');
        }
        if (product) form.items = [{ ...snapshotProduct(product), quantity: Math.min(10000, Math.max(1, props.quantity || 1)) }];
      }
    }
  } catch (cause) { if (!disposed && context?.isCurrent()) error.value = userError(cause, cause.message || 'Không thể tải biểu mẫu.'); }
  finally { if (!disposed && context?.isCurrent()) loading.value = false; }
}
function closePicker() {
  pickerOpen.value = false;
  activeIndex.value = -1;
}

function resetPicker() {
  clearTimeout(searchTimer);
  searchVersion++;
  keyword.value = '';
  matches.value = [];
  searchError.value = '';
  searching.value = false;
  closePicker();
}

function searchProducts(value) {
  resetPicker();
  keyword.value = value;
  pickerOpen.value = true;
  const query = value.trim();
  if (!query) return;
  const request = searchVersion, context = captureAuthRequestContext();
  const isCurrent = () => !disposed && request === searchVersion && context?.isCurrent();
  searching.value = true;
  searchTimer = setTimeout(async () => {
    try {
      const result = await subscriptions.catalog(query);
      if (isCurrent()) matches.value = result.items;
    } catch (cause) {
      if (isCurrent()) searchError.value = userError(cause, 'Không thể tìm sản phẩm. Hãy thử lại.');
    } finally {
      if (isCurrent()) searching.value = false;
    }
  }, 240);
}

function addProduct(product) {
  if (pickerDisabled.value || !available.value.includes(product)) return;
  form.items.push(snapshotProduct(product));
  resetPicker();
}

async function handlePickerKey(event) {
  if (event.isComposing || pickerDisabled.value) return;
  if (event.key === 'Escape' && pickerOpen.value) {
    event.preventDefault();
    event.stopPropagation();
    closePicker();
  } else if (event.key === 'Enter') {
    event.preventDefault();
    if (pickerOpen.value && activeResult.value) addProduct(activeResult.value);
    else if (searchError.value) searchProducts(keyword.value);
    else pickerOpen.value = true;
  } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    pickerOpen.value = true;
    const last = available.value.length - 1;
    if (last < 0) return;
    const step = event.key === 'ArrowDown' ? 1 : -1;
    activeIndex.value = activeIndex.value === -1 && step === -1
      ? last : Math.max(0, Math.min(last, activeIndex.value + step));
    await nextTick();
    document.getElementById(resultId + '-' + activeResult.value?._id)?.scrollIntoView?.({ block: 'nearest' });
  }
}
function closeVoucherPicker() {
  voucherRequest = null;
  Object.assign(voucherPicker, { open: false, loading: false, offers: [], error: '' });
}

function ownsVoucherRequest(request) {
  return !disposed && voucherRequest === request && request.isCurrent();
}

async function openVoucherPicker() {
  if (voucherPickerDisabled.value || voucherPicker.loading) return;
  const request = captureAuthRequestContext();
  if (!request) return;
  voucherRequest = request;
  Object.assign(voucherPicker, { open: true, loading: true, offers: [], error: '' });
  try {
    const { data } = await discountService.getAvailable(subscriptionPayload(form).items);
    if (!Array.isArray(data)) throw new Error('Dữ liệu mã giảm giá không hợp lệ.');
    if (ownsVoucherRequest(request)) {
      voucherPicker.offers = data.filter(offer => typeof offer?.code === 'string' && offer.code.trim() && offer.code.length <= voucherCodeLimit);
    }
  } catch (cause) {
    if (ownsVoucherRequest(request)) voucherPicker.error = userError(cause, 'Chưa thể tải mã giảm giá. Vui lòng thử lại.');
  } finally {
    if (ownsVoucherRequest(request)) voucherPicker.loading = false;
  }
}

function selectVoucher(code) {
  if (voucherPickerDisabled.value || !voucherRequest || !ownsVoucherRequest(voucherRequest) ||
      !voucherPicker.offers.some(offer => offer.code === code)) return;
  closeVoucherPicker();
  form.discountCode = code;
  void showPreview({ applyingVoucher: true });
}

function applyVoucher() {
  if (voucherCode.value && !voucherApplied.value) void showPreview({ applyingVoucher: true });
}

function removeVoucher() {
  form.discountCode = '';
  error.value = '';
}

watch(() => form.discountCode, () => { voucherApplyError.value = ''; }, { flush: 'sync' });
watch(voucherItemsKey, () => {
  closeVoucherPicker();
  voucherApplyError.value = '';
}, { flush: 'sync' });
watch(() => auth.accessToken, closeVoucherPicker, { flush: 'sync' });

async function showPreview({ applyingVoucher = false } = {}) {
  if (busy.value || invalidOwner.value) return;
  const context = captureAuthRequestContext();
  const feedback = applyingVoucher ? voucherApplyError : error;
  error.value = ''; voucherApplyError.value = ''; preview.value = null; form.consent = false;
  // The first estimate supplies a suggested cap. The second signed quote binds
  // the actual, visible cap. Backend remains the only schedule/pricing source.
  const missingCap = !Number(form.maximumTotal);
  const payload = subscriptionPayload(form); if (missingCap) payload.maximumTotal = 1000000000;
  const problem = subscriptionFormProblem({ ...form, maximumTotal: payload.maximumTotal });
  if (problem) { feedback.value = problem; return; }
  busy.value = true;
  try {
    let result = await subscriptions.preview(payload, !!props.initial, props.initial?._id);
    if (disposed || !context?.isCurrent()) return;
    if (missingCap) {
      form.maximumTotal = result.estimatedTotal;
      await Promise.resolve();
      result = await subscriptions.preview(subscriptionPayload(form), !!props.initial, props.initial?._id);
    }
    if (!disposed && context?.isCurrent()) preview.value = result;
  } catch (cause) { if (!disposed && context?.isCurrent()) feedback.value = userError(cause, 'Không thể xem lịch và giá.'); }
  finally { if (!disposed) busy.value = false; }
}
async function submit() {
  if (busy.value || invalidOwner.value || !preview.value || !form.consent) return;
  const context = captureAuthRequestContext(); busy.value = true; error.value = '';
  try {
    const payload = { ...subscriptionPayload(form), quoteToken: preview.value.quoteToken };
    const result = props.initial ? await subscriptions.edit(props.initial._id, payload) : await subscriptions.create(payload);
    if (!disposed && context?.isCurrent()) emit('saved', result);
  } catch (cause) {
    if (!disposed && context?.isCurrent()) { error.value = userError(cause, 'Chưa xác định kết quả đăng ký. Hãy kiểm tra danh sách trước khi gửi lại.'); preview.value = null; form.consent = false; }
  } finally { if (!disposed) busy.value = false; }
}
watch(() => auth.userId, () => {
  invalidate(); invalidOwner.value = true; addresses.value = [];
  form.addressId = ''; form.notes = ''; form.discountCode = ''; form.items = [];
  resetPicker(); closeVoucherPicker();
  error.value = 'Phiên tài khoản đã thay đổi. Vui lòng tải lại trang.';
}, { flush: 'sync' });
onMounted(load);
onBeforeUnmount(() => { disposed = true; version++; clearTimeout(searchTimer); });
</script>
<template>
  <p v-if="loading" role="status">Đang tải thông tin đăng ký…</p>
  <div v-else-if="!policy?.enabled" class="subscription-note"><p>Cửa hàng chưa mở đăng ký giao hàng định kỳ.</p><SageButton variant="secondary" @click="load">Tải lại</SageButton></div>
  <form v-else class="subscription-form" @submit.prevent="submit">
    <p v-if="error" role="alert" class="subscription-error">{{ error }}</p>
    <fieldset :disabled="busy||invalidOwner"><legend>Sản phẩm mỗi kỳ</legend>
      <div class="subscription-picker">
        <SageInput
          :model-value="keyword" label="Tìm và thêm sản phẩm" placeholder="Nhập tên rồi chọn sản phẩm"
          maxlength="100" autocomplete="off" role="combobox" aria-autocomplete="list"
          :disabled="pickerDisabled"
          :hint="form.items.length >= 30 ? 'Đã thêm tối đa 30 sản phẩm.' : undefined"
          :aria-expanded="pickerOpen && !pickerDisabled"
          :aria-controls="pickerOpen && !pickerDisabled ? resultId : undefined"
          :aria-activedescendant="pickerOpen && activeResult ? resultId + '-' + activeResult._id : undefined"
          @update:model-value="searchProducts"
          @focus="pickerOpen = true" @click="pickerOpen = true" @blur="closePicker" @keydown="handlePickerKey"
        />
        <div v-if="pickerOpen && !pickerDisabled" class="subscription-picker-results">
          <ul :id="resultId" role="listbox" aria-label="Sản phẩm có thể thêm" :aria-busy="searching">
            <li
              v-for="(product, index) in available" :id="resultId + '-' + product._id" :key="product._id"
              role="option" :aria-selected="activeIndex === index"
              @mousedown.prevent @click="addProduct(product)"
            >{{ product.name }}</li>
          </ul>
          <p v-if="searching" role="status">Đang tìm sản phẩm…</p>
          <p v-else-if="searchError" role="alert">{{ searchError }}</p>
          <p v-else-if="!available.length" role="status">Không có sản phẩm phù hợp.</p>
        </div>
      </div>
      <p v-if="!form.items.length" class="subscription-note">Chọn ít nhất một sản phẩm để bắt đầu.</p>
      <article v-for="(item,index) in form.items" :key="item.productId" class="subscription-product" :class="{'subscription-product--no-image':!item.image}">
        <img v-if="item.image" :src="item.image" alt="" width="64" height="64" />
        <div class="subscription-product-copy"><RouterLink :to="'/products/'+item.productId">{{ item.name }}</RouterLink><p>{{ item.packageSize }} · {{ item.unit }}<span v-if="item.price"> · {{ money(item.price) }}</span></p></div>
        <div class="subscription-quantity"><SageInput v-model="item.quantity" label="Số lượng mỗi kỳ" :aria-label="'Số lượng mỗi kỳ: '+item.name" type="number" min="1" max="10000" step="1" required /></div>
        <SageButton variant="ghost" :aria-label="'Bỏ '+item.name" @click="form.items.splice(index,1)">Bỏ</SageButton>
      </article>
    </fieldset>
    <fieldset :disabled="busy||invalidOwner"><legend>Chu kỳ và thời gian</legend><div class="subscription-grid">
      <SageSelect v-model="form.frequency" label="Chu kỳ giao" :disabled="lockedFrequency" :hint="initial ? (lockedFrequency ? 'Lịch sử đã bắt đầu xử lý: giữ chu kỳ gốc; tạo đăng ký mới để đổi chu kỳ.' : 'Có thể đổi chu kỳ trước khi bất kỳ kỳ giao nào bắt đầu xử lý.') : undefined" :options="[{value:'every_14_days',label:'Mỗi 14 ngày'},{value:'monthly',label:'Hằng tháng'}]" />
      <SageInput v-model="form.startDate" type="date" label="Ngày tạo đơn" :min="initial ? undefined : policy.today" :disabled="!!initial" required />
      <SageSelect v-model="form.endMode" label="Kết thúc đăng ký" :options="[{value:'count',label:'Theo số kỳ giao'},{value:'date',label:'Theo ngày kết thúc'}]" />
      <SageInput v-if="form.endMode==='count'" v-model="form.maxOccurrences" type="number" min="1" max="120" step="1" label="Số kỳ giao" required />
      <SageInput v-else v-model="form.endDate" type="date" :min="form.startDate" label="Ngày kết thúc vụ nuôi" required />
    </div><p class="subscription-note">Lịch theo giờ Việt Nam. Chu kỳ tháng giữ ngày gốc; tháng thiếu ngày sẽ dùng ngày cuối tháng. Tối đa {{ policy.maxOccurrences }} kỳ.</p></fieldset>
    <fieldset :disabled="busy||invalidOwner"><legend>Địa chỉ nhận hàng</legend><div class="subscription-grid">
      <SageSelect v-model="form.addressId" label="Địa chỉ nhận hàng" :options="addressOptions" required />
      <SageSelect v-model="form.shippingMethodId" label="Phương thức vận chuyển" :options="shippingOptions" required />
    </div><p v-if="chosenAddress" class="subscription-note">{{ chosenAddress.full_name || chosenAddress.fullName }} · {{ chosenAddress.phone }} · {{ chosenAddress.address_line || chosenAddress.address }}, {{ chosenAddress.city }}</p>
      <RouterLink to="/profile?tab=addresses">{{ addresses.length ? 'Quản lý địa chỉ' : 'Thêm địa chỉ nhận hàng trước khi đăng ký' }}</RouterLink>
      <SageTextarea v-model="form.notes" label="Ghi chú giao hàng" rows="2" maxlength="500" />
    </fieldset>
    <fieldset :disabled="busy||invalidOwner"><legend>Thanh toán từng kỳ</legend><div class="subscription-grid">
      <SageSelect v-model="form.paymentMethod" label="Thanh toán từng kỳ" :options="[{value:'cod',label:'COD — thanh toán khi nhận hàng'},{value:'paypal',label:'PayPal — tự thanh toán từng kỳ'}]" />
      <SageInput v-model="form.maximumTotal" label="Giới hạn tổng tiền mỗi kỳ (đ)" type="number" min="1" max="1000000000" step="1" hint="Bao gồm phí vận chuyển. Để trống khi xem lịch lần đầu để nhận giá gợi ý." />
    </div></fieldset>
    <section class="subscription-voucher" :aria-labelledby="voucherId + '-title'">
      <div class="subscription-voucher-heading">
        <h2 :id="voucherId + '-title'">Mã giảm giá (nếu có)</h2>
        <SageButton variant="secondary" aria-haspopup="dialog" :disabled="voucherPickerDisabled" @click="openVoucherPicker">Chọn mã giảm giá</SageButton>
      </div>
      <label :for="voucherId">Nhập mã giảm giá</label>
      <div class="subscription-voucher-entry">
        <input :id="voucherId" v-model="form.discountCode" class="sage-control" type="text"
          placeholder="Nhập mã giảm giá" autocomplete="off" :maxlength="voucherCodeLimit"
          :disabled="busy || invalidOwner || voucherApplied"
          :aria-describedby="voucherId + '-hint' + (voucherApplyError ? ' ' + voucherId + '-error' : '')"
          @keydown.enter.prevent="applyVoucher" />
        <SageButton v-if="!voucherApplied" :disabled="!voucherCode || busy || invalidOwner" @click="applyVoucher">Áp dụng</SageButton>
        <SageButton v-if="voucherCode" variant="secondary" :disabled="busy || invalidOwner" @click="removeVoucher">Bỏ mã</SageButton>
      </div>
      <p :id="voucherId + '-hint'" class="subscription-note">Mã được kiểm tra lại ở từng kỳ theo hiệu lực và lô hàng.</p>
      <p v-if="voucherApplyError" :id="voucherId + '-error'" class="subscription-error" role="alert">{{ voucherApplyError }}</p>
      <p v-if="voucherApplied" class="subscription-voucher-summary" role="status">
        <strong>{{ voucherCode }}</strong><span>Dự kiến giảm {{ money(preview.discountAmount) }} mỗi kỳ</span>
      </p>
      <CheckoutVoucherDialog recurring :open="voucherPicker.open" :loading="voucherPicker.loading"
        :offers="voucherPicker.offers" :error="voucherPicker.error" :applied-code="voucherApplied ? voucherCode.toUpperCase() : undefined"
        @close="closeVoucherPicker" @retry="openVoucherPicker" @select="selectVoucher" />
    </section>
    <div class="subscription-policy"><p>{{ policy.pricePolicy }}</p><p>Hệ thống yêu cầu xác nhận lại nếu tổng vượt giới hạn bạn nhập hoặc tăng quá {{ policy.priceIncreasePercent }}% so với giá đã xác nhận. Tạo đơn trước ngày mong muốn {{ policy.leadDays }} ngày.</p><p>{{ policy.deliveryPolicy }}<span v-if="chosenShipping?.estimatedDays"> Vận chuyển dự kiến: {{ chosenShipping.estimatedDays }} ngày.</span></p><p>Đăng ký không giữ kho. Tạm dừng/tiếp tục giữ lịch gốc và bỏ qua kỳ đã trôi qua. Hủy đăng ký không tự hủy đơn đã tạo.</p><p v-if="form.paymentMethod==='paypal'">Mỗi kỳ cần bạn chủ động phê duyệt PayPal. Không tự động thu tiền; không dùng lại giao dịch cũ.</p></div>
    <SageButton variant="secondary" :loading="busy" :disabled="invalidOwner" @click="showPreview()">Xem lịch và giá dự kiến</SageButton>
    <section v-if="preview" class="subscription-preview" aria-label="Lịch giao dự kiến"><h2>Lịch giao dự kiến · {{ initial ? preview.futureOccurrences : preview.totalOccurrences }} kỳ{{ initial ? ' chưa xử lý' : '' }}</h2><p v-if="initial && preview.lockedOccurrenceCount">{{ preview.lockedOccurrenceCount }} kỳ đã bắt đầu xử lý được giữ nguyên. Các kỳ đã trôi qua không được tự tạo đơn bù.</p>
      <p><strong>{{ money(preview.estimatedTotal) }}/kỳ</strong> · Phí vận chuyển {{ money(preview.shippingFee) }} · Giảm giá {{ money(preview.discountAmount) }}</p><p>Tổng tham khảo {{ money(preview.estimatedAllOccurrences) }}; đây chưa phải khoản thanh toán đã xác nhận.</p>
      <ol class="subscription-schedule"><li v-for="row in preview.schedule" :key="row.occurrenceNumber"><strong>Kỳ {{ row.occurrenceNumber }}</strong><span>Mong muốn nhận: {{ date(row.wishDate) }}</span><span>Xử lý từ: {{ date(row.processAt) }}</span><span>{{ form.items.reduce((sum,item)=>sum+Number(item.quantity),0) }} sản phẩm · {{ money(preview.estimatedTotal) }} dự kiến</span></li></ol>
      <label class="subscription-consent"><input v-model="form.consent" type="checkbox" required /> <span>Tôi đồng ý tự động tạo đơn COD theo lịch và giới hạn trên, hoặc tự thanh toán PayPal từng kỳ; tôi đã hiểu chính sách giá, tạm dừng và hủy.</span></label>
      <SageButton type="submit" :disabled="!form.consent" :loading="busy">{{ initial ? 'Lưu thay đổi cho các kỳ chưa xử lý' : 'Xác nhận đăng ký định kỳ' }}</SageButton>
    </section>
    <p v-if="error" role="alert" class="subscription-error">{{ error }}</p>
  </form>
</template>
