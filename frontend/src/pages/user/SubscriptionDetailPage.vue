<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { captureAuthRequestContext, useAuthStore } from '@/stores/user/auth';
import subscriptions from '@/services/subscriptions.service';
import { userError } from '@/utils/user-error.util';
import { subscriptionLabels, frequencyLabel, subscriptionDate as date, subscriptionMoney as money } from '@/utils/subscription.util';
import PageHeading from '@/components/user/common/PageHeading.vue';
import SageButton from '@/components/user/sage/SageButton.vue';
import SageInput from '@/components/user/sage/SageInput.vue';
import SageDialog from '@/components/user/sage/SageDialog.vue';
import SubscriptionForm from '@/components/user/subscriptions/SubscriptionForm.vue';
import SubscriptionSchedule from '@/components/user/subscriptions/SubscriptionSchedule.vue';
import SubscriptionPaypal from '@/components/user/subscriptions/SubscriptionPaypal.vue';
const route = useRoute(), auth = useAuthStore();
const sub = ref(null), loading = ref(true), error = ref(''), busy = ref(false), action = ref(''), editing = ref(false), selectedRun = ref(null), payingRun = ref(null);
const cap = ref(0), quote = ref(null), consent = ref(false);
const rejectingPrice = ref(false);
const oldTotal = computed(() => quote.value?.previousTotal ?? selectedRun.value?.approvedTotal ?? selectedRun.value?.priceConsent?.confirmedTotal);
const newTotal = computed(() => quote.value?.estimatedTotal ?? selectedRun.value?.estimatedTotal);
const priceDifference = computed(() => Number(newTotal.value) - Number(oldTotal.value));
let version = 0, timer;
const manageable = computed(() => ['active', 'paused'].includes(sub.value?.status));
const actionText = { pause: 'Tạm dừng đăng ký', resume: 'Tiếp tục đăng ký', cancel: 'Hủy đăng ký' };
async function load(quiet = false) {
  const request = ++version, context = captureAuthRequestContext(); if (!quiet) loading.value = true; error.value = '';
  try { const result = await subscriptions.detail(route.params.id); if (request === version && context?.isCurrent()) sub.value = result; }
  catch (cause) { if (request === version && context?.isCurrent()) { error.value = userError(cause, 'Không thể tải đăng ký.'); if (!quiet) sub.value = null; } }
  finally { if (request === version) loading.value = false; }
}
async function perform() {
  if (busy.value || !action.value) return;
  const context = captureAuthRequestContext(); busy.value = true; error.value = '';
  try { const result = await subscriptions.lifecycle(sub.value._id, action.value); if (context?.isCurrent()) { sub.value = result; action.value = ''; } }
  catch (cause) { if (context?.isCurrent()) error.value = userError(cause, 'Không thể thay đổi đăng ký.'); }
  finally { busy.value = false; }
}
function chooseRun(run) { selectedRun.value = run; cap.value = run.approvedMaximum || run.priceConsent?.maximumTotal || sub.value.maximumTotal; quote.value = null; consent.value = false; rejectingPrice.value = false; error.value = ''; }
async function quoteRun() {
  if (busy.value) return; busy.value = true; error.value = ''; const context = captureAuthRequestContext();
  try { const result = await subscriptions.runQuote(selectedRun.value._id, Number(cap.value)); if (context?.isCurrent()) { quote.value = result; consent.value = false; } }
  catch (cause) { if (context?.isCurrent()) error.value = userError(cause, 'Không thể kiểm tra giá.'); }
  finally { busy.value = false; }
}
async function confirmRun() {
  if (busy.value || !consent.value || !quote.value) return; busy.value = true; error.value = ''; const context = captureAuthRequestContext();
  try { await subscriptions.confirmRun(selectedRun.value._id, { quoteToken: quote.value.quoteToken, maximumTotal: Number(cap.value), consent: true }); if (context?.isCurrent()) { selectedRun.value = null; await load(true); } }
  catch (cause) { if (context?.isCurrent()) error.value = userError(cause, 'Không thể xác nhận kỳ giao.'); }
  finally { busy.value = false; }
}
watch(cap, () => { quote.value = null; consent.value = false; });
async function rejectRun() {
  if (busy.value || !selectedRun.value) return;
  const context = captureAuthRequestContext(); busy.value = true; error.value = '';
  try { await subscriptions.rejectRun(selectedRun.value._id); if (context?.isCurrent()) { selectedRun.value = null; rejectingPrice.value = false; await load(true); } }
  catch (cause) { if (context?.isCurrent()) error.value = userError(cause, 'Không thể từ chối kỳ giao.'); }
  finally { busy.value = false; }
}
watch(() => route.params.id, () => { sub.value = null; selectedRun.value = null; payingRun.value = null; action.value = ''; editing.value = false; load(); });
watch(() => auth.userId, () => { version++; sub.value = null; selectedRun.value = null; payingRun.value = null; editing.value = false; action.value = ''; });
onMounted(() => { load(); timer = setInterval(() => { if (!busy.value && !editing.value && !action.value && !selectedRun.value && !payingRun.value) load(true); }, 30000); });
onBeforeUnmount(() => { version++; clearInterval(timer); });
</script>
<template><div class="site-content subscription-page"><PageHeading title="Chi tiết đơn hàng định kỳ" parent="Đơn hàng định kỳ" parent-to="/account/subscriptions" /><div class="container subscription-workspace">
  <p v-if="loading" role="status">Đang tải đăng ký…</p><div v-if="error" class="subscription-error" role="alert"><p>{{ error }}</p><SageButton v-if="!sub" variant="secondary" @click="load()">Thử lại</SageButton></div>
  <template v-if="sub && !loading"><section class="subscription-card">
    <div class="subscription-card-heading"><h2>{{ sub.code }}</h2><span class="subscription-status" :data-status="sub.status">{{ subscriptionLabels[sub.status] }}</span></div>
    <p>{{ frequencyLabel(sub.frequency) }} · Bắt đầu {{ date(sub.startDate) }} · {{ sub.endDate ? 'Kết thúc '+date(sub.endDate) : sub.totalOccurrences+' kỳ' }}</p>
    <dl class="subscription-facts subscription-detail-facts"><div><dt>Kỳ tiếp theo</dt><dd>{{ date(sub.nextScheduledDate) }}</dd></div><div><dt>Đơn đã tạo</dt><dd>{{ sub.completedOccurrences }}</dd></div><div><dt>Giá tham khảo ban đầu / kỳ</dt><dd>{{ money(sub.confirmedTotal) }}</dd></div><div><dt>Giới hạn mỗi kỳ</dt><dd>{{ money(sub.maximumTotal) }}</dd></div></dl>
    <div class="subscription-detail-sections"><section><h3>Sản phẩm mỗi kỳ</h3><ul class="subscription-items"><li v-for="item in sub.items" :key="item.productId"><RouterLink :to="'/products/'+item.productId">{{ item.productSnapshot.name }}</RouterLink><strong>{{ item.quantity }} {{ item.productSnapshot.unit }} · {{ item.productSnapshot.packageSize }}</strong></li></ul></section>
      <section><h3>Nhận hàng và thanh toán</h3><p>{{ sub.shippingAddress.full_name }} · {{ sub.shippingAddress.phone }}<br />{{ sub.shippingAddress.address_line }}, {{ sub.shippingAddress.city }}</p><p>{{ sub.shippingMethod?.name }} · {{ sub.paymentMethod.toUpperCase() }}</p><p>Tăng trên {{ sub.priceIncreasePercent }}% cần xác nhận.</p><p v-if="sub.notes">Ghi chú: {{ sub.notes }}</p></section></div>
    <div v-if="manageable" class="subscription-actions"><SageButton variant="secondary" @click="action=sub.status==='active'?'pause':'resume'">{{ sub.status==='active'?'Tạm dừng':'Tiếp tục' }}</SageButton><SageButton variant="secondary" @click="editing=true">Chỉnh sửa kỳ tương lai</SageButton><SageButton variant="ghost" @click="action='cancel'">Hủy đăng ký</SageButton></div></section>
    <SubscriptionSchedule :subscription="sub" @confirm="chooseRun" @pay="payingRun=$event" />
    <section class="subscription-card"><h2>Thông báo</h2><p v-if="!sub.notifications.length">Chưa có thông báo.</p><ul class="subscription-notifications"><li v-for="notice in sub.notifications" :key="notice._id"><strong>{{ notice.title }}</strong><p>{{ notice.content }} · {{ date(notice.created_at) }}</p></li></ul></section>
    <p class="subscription-note">Đăng ký không giữ kho. Ngày nhận mong muốn không phải cam kết ngày giao thực tế. Thay đổi đăng ký không thay đổi đơn đã tạo.</p>
  </template>
  <SageDialog class="subscription-dialog" :model-value="!!action" :title="actionText[action]||'Xác nhận'" @update:model-value="!$event&&!busy&&(action='')"><p v-if="action==='resume'">Giữ lịch gốc, bỏ qua các kỳ đã trôi qua và không tạo đơn bù.</p><p v-else>Các kỳ chưa tạo đơn sẽ dừng. Đơn đã tạo và lịch sử được giữ nguyên; muốn hủy đơn, hãy dùng chức năng hủy đơn hiện tại.</p><p v-if="error" role="alert">{{ error }}</p><template #footer><SageButton variant="secondary" :disabled="busy" @click="action=''">Đóng</SageButton><SageButton :loading="busy" @click="perform">Xác nhận {{ action==='cancel'?'hủy':action==='pause'?'tạm dừng':'tiếp tục' }}</SageButton></template></SageDialog>
  <SageDialog v-model="editing" title="Chỉnh sửa các kỳ chưa xử lý" class="subscription-dialog subscription-edit-dialog"><SubscriptionForm v-if="editing&&sub" :initial="sub" @saved="sub=$event;editing=false" /></SageDialog>
  <SageDialog class="subscription-dialog" :model-value="!!selectedRun" :title="'Xác nhận giá kỳ '+(selectedRun?.occurrenceNumber||'')" @update:model-value="!$event&&!busy&&(selectedRun=null)">
    <template v-if="!rejectingPrice"><SageInput v-model="cap" type="number" min="1" max="1000000000" label="Giới hạn tổng tiền kỳ này (đ)" /><SageButton variant="secondary" :loading="busy" @click="quoteRun">Kiểm tra giá hiện tại</SageButton>
      <dl v-if="oldTotal!==undefined && newTotal!==undefined" class="subscription-price-comparison"><div><dt>Giá đã xác nhận</dt><dd>{{ money(oldTotal) }}</dd></div><div><dt>Giá mới</dt><dd>{{ money(newTotal) }}</dd></div><div><dt>Chênh lệch</dt><dd>{{ priceDifference>0?'+':'' }}{{ money(priceDifference) }}<span v-if="oldTotal>0"> ({{ (priceDifference*100/oldTotal).toLocaleString('vi-VN',{maximumFractionDigits:2}) }}%)</span></dd></div></dl>
      <p v-if="quote">Giá và giới hạn mới chỉ áp dụng cho kỳ này.</p><label v-if="quote" class="subscription-consent"><input v-model="consent" type="checkbox" />Tôi đồng ý giá hiện tại và giới hạn trên cho kỳ này.</label>
    </template><p v-else>Bỏ qua kỳ này vì không đồng ý giá. Những kỳ tương lai giữ nguyên lịch và giới hạn đã đăng ký; không phát sinh đơn cho kỳ bị từ chối.</p><p v-if="error" role="alert">{{ error }}</p>
    <template #footer><template v-if="!rejectingPrice"><SageButton variant="secondary" :disabled="busy" @click="rejectingPrice=true">Từ chối giá</SageButton><SageButton :disabled="!quote||!consent||Number(cap)<quote.estimatedTotal" :loading="busy" @click="confirmRun">Xác nhận giá và xử lý kỳ này</SageButton></template><template v-else><SageButton variant="secondary" :disabled="busy" @click="rejectingPrice=false">Quay lại</SageButton><SageButton :loading="busy" @click="rejectRun">Xác nhận bỏ qua kỳ này</SageButton></template></template>
  </SageDialog>
  <SageDialog class="subscription-dialog" :model-value="!!payingRun" :title="'Thanh toán kỳ '+(payingRun?.occurrenceNumber||'')" @update:model-value="!$event&&(payingRun=null)"><SubscriptionPaypal v-if="payingRun" :key="payingRun._id" :run-id="payingRun._id" :paypal-order-id="payingRun.paymentRequestId" @paid="payingRun=null;load(true)" @settled="payingRun=null;load(true)" /></SageDialog>
</div></div></template>
