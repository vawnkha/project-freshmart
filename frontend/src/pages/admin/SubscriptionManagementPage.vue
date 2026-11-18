<script setup>
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { captureAuthRequestContext, useAuthStore } from '@/stores/user/auth';
import { hasPermission } from '@/utils/permission.util';
import subscriptions from '@/services/subscriptions.service';
import { userError } from '@/utils/user-error.util';
import { subscriptionLabels, runLabels, frequencyLabel, subscriptionDate as date, subscriptionMoney as money } from '@/utils/subscription.util';
import SubscriptionSchedule from '@/components/user/subscriptions/SubscriptionSchedule.vue';
import AdminPagination from '@/components/admin/common/AdminPagination.vue';
import { useDialogFocus } from '@/composables/useDialogFocus';
const route = useRoute(), auth = useAuthStore();
const summary = ref(null), rows = ref([]), detail = ref(null), total = ref(0), page = ref(1), mode = ref('subscriptions'), loading = ref(true), busy = ref(false), error = ref(''), message = ref('');
const filter = reactive({ keyword: '', status: '', from: '', to: '', sort: 'newest', runStatus: '' });
const operation = ref(null), reason = ref(''), dialog = ref(null);
const modalOpen = computed(() => !!operation.value), canManage = computed(() => hasPermission(auth, 'order:update'));
let version = 0;
useDialogFocus(modalOpen, dialog, () => { if (!busy.value) operation.value = null; });
const counters = { total: 'Tổng đăng ký', active: 'Đang hoạt động', paused: 'Tạm dừng', upcoming: 'Kỳ sắp đến (7 ngày)', failed: 'Kỳ thất bại', orders: 'Đơn đã tạo' };
async function load() {
  const request = ++version, context = captureAuthRequestContext(); loading.value = true; error.value = ''; rows.value = []; detail.value = null;
  try {
    const params = { page: page.value, limit: 10 };
    const resultPromise = route.params.id ? subscriptions.adminDetail(route.params.id) : mode.value === 'runs' ? subscriptions.adminRuns({ ...params, ...(filter.runStatus ? { runStatus: filter.runStatus } : {}) })
      : subscriptions.adminList({ ...params, ...Object.fromEntries(Object.entries(filter).filter(([key,value])=>key!=='runStatus'&&value)) });
    const [data, stats] = await Promise.all([resultPromise, subscriptions.adminSummary()]);
    if (request !== version || !context?.isCurrent()) return;
    summary.value = stats;
    if (route.params.id) detail.value = data;
    else { rows.value = data.items; total.value = data.total; }
  } catch (cause) { if (request === version && context?.isCurrent()) error.value = userError(cause, 'Không thể tải quản lý đăng ký.'); }
  finally { if (request === version) loading.value = false; }
}
function search() { if (page.value !== 1) page.value = 1; else load(); }
function choose(run, action) { operation.value = { run, action }; reason.value = ''; message.value = ''; error.value = ''; }
async function act() {
  if (!operation.value || busy.value || !reason.value.trim()) return;
  const context = captureAuthRequestContext(); busy.value = true; error.value = '';
  try {
    await subscriptions.adminRunAction(operation.value.run._id, operation.value.action, reason.value.trim());
    if (context?.isCurrent()) { operation.value = null; message.value = 'Đã lưu yêu cầu xử lý kỳ giao.'; await load(); }
  } catch (cause) { if (context?.isCurrent()) error.value = userError(cause, 'Không thể xử lý kỳ giao.'); }
  finally { busy.value = false; }
}
function actionable(run) { return canManage.value && detail.value?.status === 'active' && !run.orderId && ['failed', 'pending_payment', 'pending_confirmation'].includes(run.status); }
watch(page, load);
watch(mode, search);
watch(() => route.params.id, search);
watch(() => auth.userId, () => { version++; detail.value = null; rows.value = []; summary.value = null; operation.value = null; });
load();
onBeforeUnmount(() => { version++; });
</script>
<template><div class="admin-page subscription-admin"><RouterLink v-if="route.params.id" to="/admin/subscriptions">← Danh sách đăng ký</RouterLink><h1 class="admin-page-title">Quản lý đơn hàng định kỳ</h1>
  <div v-if="summary" class="subscription-admin-stats"><div v-for="(label,key) in counters" :key="key" class="admin-panel"><div class="admin-panel__body"><span>{{ label }}</span><strong>{{ summary[key] }}</strong></div></div></div>
  <p v-if="error && !operation" role="alert" class="admin-form__error">{{ error }}</p><p v-if="message" role="status">{{ message }}</p>
  <section v-if="!route.params.id" class="admin-panel"><div class="admin-panel__body"><div class="subscription-actions"><button type="button" class="admin-btn" :class="mode==='subscriptions'?'admin-btn--primary':'admin-btn--secondary'" @click="mode='subscriptions'">Đăng ký</button><button type="button" class="admin-btn" :class="mode==='runs'?'admin-btn--primary':'admin-btn--secondary'" @click="mode='runs'">Các kỳ giao</button></div>
    <form class="subscription-admin-filters" @submit.prevent="search">
      <template v-if="mode === 'subscriptions'">
        <label class="admin-form__field">
          Tìm mã, sản phẩm, khách hàng
          <input v-model="filter.keyword" class="admin-toolbar__input" maxlength="100" />
        </label>
        <label class="admin-form__field">
          Trạng thái
          <select v-model="filter.status" class="admin-toolbar__select">
            <option value="">Tất cả</option>
            <option v-for="(label, key) in subscriptionLabels" :key="key" :value="key">{{ label }}</option>
          </select>
        </label>
        <label class="admin-form__field">
          Tạo từ ngày
          <input v-model="filter.from" class="admin-toolbar__input" type="date" />
        </label>
        <label class="admin-form__field">
          Đến ngày
          <input v-model="filter.to" class="admin-toolbar__input" type="date" />
        </label>
        <label class="admin-form__field">
          Sắp xếp
          <select v-model="filter.sort" class="admin-toolbar__select">
            <option value="newest">Mới nhất</option>
            <option value="oldest">Cũ nhất</option>
            <option value="next">Kỳ tiếp theo</option>
          </select>
        </label>
      </template>
      <label v-else class="admin-form__field">
        Trạng thái kỳ
        <select v-model="filter.runStatus" class="admin-toolbar__select">
          <option value="">Tất cả</option>
          <option v-for="(label, key) in runLabels" :key="key" :value="key">{{ label }}</option>
        </select>
      </label>
      <button type="submit" class="admin-btn admin-btn--primary" :disabled="loading">Áp dụng bộ lọc</button>
    </form>
    <p v-if="loading" role="status" class="admin-empty-state">Đang tải đăng ký…</p><p v-else-if="!rows.length" class="admin-empty-state">Không có dữ liệu phù hợp.</p>
    <div v-else class="subscription-admin-rows"><div class="subscription-admin-table-heading" aria-hidden="true"><template v-if="mode==='subscriptions'"><span>Đăng ký / khách hàng</span><span>Sản phẩm mỗi kỳ</span><span>Lịch giao</span><span>Trạng thái</span></template><template v-else><span>Kỳ giao</span><span>Ngày mong muốn</span><span>Trạng thái</span><span>Kết quả xử lý</span></template></div><article v-for="row in rows" :key="row._id" class="subscription-admin-row"><template v-if="mode==='subscriptions'"><div><RouterLink :to="'/admin/subscriptions/'+row._id">{{ row.code }}</RouterLink><p>{{ row.customer?.name || row.userId }}<br />{{ row.customer?.email }}</p></div><ul><li v-for="item in row.items" :key="item.productId">{{ item.productSnapshot.name }} · {{ item.quantity }} {{ item.productSnapshot.unit }}</li></ul><div><span>{{ frequencyLabel(row.frequency) }}</span><p>Kỳ tiếp: {{ date(row.nextScheduledDate) }}</p></div><span class="subscription-status" :data-status="row.status">{{ subscriptionLabels[row.status] }}</span></template><template v-else><RouterLink :to="'/admin/subscriptions/'+row.subscriptionId">Kỳ {{ row.occurrenceNumber }} · {{ String(row.subscriptionId).slice(-8).toUpperCase() }}</RouterLink><span>{{ date(row.wishDate) }}</span><span class="subscription-status" :data-status="row.status">{{ runLabels[row.status] }}</span><span>{{ row.lastError || row.reason || '—' }}</span></template></article></div>
    <AdminPagination v-model="page" :total-items="total" :page-size="10" /><button v-if="error" class="admin-btn admin-btn--secondary" @click="load">Thử lại</button>
  </div></section>
  <p v-else-if="loading" role="status">Đang tải chi tiết đăng ký…</p>
  <template v-else-if="detail"><section class="admin-panel"><div class="admin-panel__body"><h2>{{ detail.code }}</h2><p><span class="subscription-status" :data-status="detail.status">{{ subscriptionLabels[detail.status] }}</span> · {{ frequencyLabel(detail.frequency) }} · {{ detail.totalOccurrences }} kỳ</p><p>Khách hàng: {{ detail.customer?.name }} · {{ detail.customer?.email }} · {{ detail.userId }}</p><p>Ngày bắt đầu {{ date(detail.startDate) }} · Kết thúc {{ detail.endDate ? date(detail.endDate) : 'theo số kỳ' }} · Kỳ tiếp theo {{ date(detail.nextScheduledDate) }}</p><ul><li v-for="item in detail.items" :key="item.productId"><RouterLink :to="'/products/'+item.productId">{{ item.productSnapshot.name }}</RouterLink> · {{ item.quantity }} {{ item.productSnapshot.unit }} · {{ item.productSnapshot.packageSize }}</li></ul><p>{{ detail.shippingAddress.full_name }} · {{ detail.shippingAddress.phone }}<br />{{ detail.shippingAddress.address_line }}, {{ detail.shippingAddress.city }}</p><p>{{ detail.shippingMethod?.name }} · {{ detail.paymentMethod.toUpperCase() }} · Giá tham khảo ban đầu {{ money(detail.confirmedTotal) }} · Giới hạn {{ money(detail.maximumTotal) }}</p><p>Ghi chú: {{ detail.notes || 'Không có' }}</p><p>Giới hạn tăng giá {{ detail.priceIncreasePercent }}%; chỉ khách hàng được xác nhận mức giá mới.</p></div></section>
    <section class="admin-panel"><div class="admin-panel__body"><SubscriptionSchedule :subscription="detail" admin><template #actions="{run}"><div v-if="actionable(run)" class="subscription-actions"><button v-if="run.status==='failed'" class="admin-btn admin-btn--secondary" @click="choose(run,'retry')">Thử lại kỳ {{ run.occurrenceNumber }}</button><button class="admin-btn admin-btn--secondary" @click="choose(run,'confirm')">Yêu cầu xác nhận giá</button><button class="admin-btn admin-btn--danger" @click="choose(run,'skip')">Bỏ qua kỳ {{ run.occurrenceNumber }}</button></div></template></SubscriptionSchedule></div></section>
    <section class="admin-panel"><div class="admin-panel__body"><h2>Lịch sử đăng ký</h2><ul><li v-for="(event,index) in detail.audit" :key="index">{{ date(event.at) }} · {{ event.type }}</li></ul></div></section>
  </template>
  <Teleport to="body">
    <div v-if="operation" class="admin-modal-mask subscription-admin-dialog" @click.self="!busy && (operation = null)">
      <section ref="dialog" class="admin-modal admin-modal--compact" role="dialog" aria-modal="true" aria-labelledby="subscription-admin-dialog-title" tabindex="-1">
        <header class="admin-modal__header">
          <h2 id="subscription-admin-dialog-title" class="admin-modal__title">
            {{ { retry: 'Thử lại', skip: 'Bỏ qua', confirm: 'Yêu cầu xác nhận' }[operation.action] }} kỳ {{ operation.run.occurrenceNumber }}
          </h2>
        </header>
        <form class="admin-form" :aria-busy="busy" @submit.prevent="act">
          <div class="admin-modal__body admin-form--stacked">
            <p>Giới hạn giá của khách hàng áp dụng khi xử lý kỳ giao.</p>
            <label class="admin-form__field">
              Lý do xử lý
              <textarea v-model="reason" class="admin-form__textarea" required maxlength="500" rows="3" />
            </label>
            <p v-if="error" class="admin-form__error" role="alert">{{ error }}</p>
          </div>
          <footer class="admin-modal__footer admin-action-row">
            <button type="button" class="admin-btn admin-btn--secondary" :disabled="busy" @click="operation = null">Đóng</button>
            <button type="submit" class="admin-btn admin-btn--primary" :disabled="busy || !reason.trim()">{{ busy ? 'Đang xử lý…' : 'Xác nhận thao tác' }}</button>
          </footer>
        </form>
      </section>
    </div>
  </Teleport>
</div></template>
