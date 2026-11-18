<script setup>
import { onBeforeUnmount, ref, watch } from 'vue';
import { useAuthStore, captureAuthRequestContext } from '@/stores/user/auth';
import subscriptions from '@/services/subscriptions.service';
import { userError } from '@/utils/user-error.util';
import { subscriptionLabels, frequencyLabel, subscriptionDate as date, subscriptionMoney as money } from '@/utils/subscription.util';
import PageHeading from '@/components/user/common/PageHeading.vue';
import SageSelect from '@/components/user/sage/SageSelect.vue';
import SageButton from '@/components/user/sage/SageButton.vue';
const auth = useAuthStore();
const rows = ref([]), total = ref(0), page = ref(1), status = ref(''), loading = ref(true), error = ref('');
let version = 0;
async function load() {
  const request = ++version, context = captureAuthRequestContext(); loading.value = true; error.value = '';
  try {
    const result = await subscriptions.list({ page: page.value, limit: 10, ...(status.value ? { status: status.value } : {}) });
    if (request === version && context?.isCurrent()) { rows.value = result.items; total.value = result.total; }
  } catch (cause) { if (request === version && context?.isCurrent()) error.value = userError(cause, 'Không thể tải đăng ký định kỳ.'); }
  finally { if (request === version) loading.value = false; }
}
watch(status, () => { if (page.value !== 1) page.value = 1; else load(); });
watch(() => auth.userId, () => { rows.value = []; total.value = 0; version++; if (auth.userId) load(); });
watch(page, load);
load();
onBeforeUnmount(() => { version++; });
</script>
<template><div class="site-content subscription-page"><PageHeading title="Đơn hàng định kỳ" description="Theo dõi lịch nhận chế phẩm, các kỳ cần thanh toán và những đơn hàng đã tạo." parent="Tài khoản" parent-to="/profile" />
  <div class="container subscription-workspace">
    <div class="subscription-toolbar">
      <div class="subscription-toolbar-filter"><SageSelect v-model="status" label="Trạng thái đăng ký" :options="[{value:'',label:'Tất cả'},...Object.entries(subscriptionLabels).map(([value,label])=>({value,label}))]" /></div>
      <div class="subscription-toolbar-actions"><RouterLink to="/account/subscriptions/new" class="sage-button"><span aria-hidden="true">＋</span>Đăng ký mới</RouterLink><SageButton variant="secondary" :loading="loading" @click="load">Làm mới</SageButton></div>
    </div>
    <p class="subscription-result-count" role="status" aria-live="polite">{{ loading ? 'Đang tải đăng ký…' : total+' đăng ký' }}</p>
    <div v-if="error" role="alert" class="subscription-error"><p>{{ error }}</p><SageButton variant="secondary" @click="load">Thử lại</SageButton></div>
    <p v-else-if="!loading&&!rows.length" class="subscription-note">Chưa có đăng ký phù hợp. Chọn “Đăng ký mới” để lên lịch nhận sản phẩm.</p>
    <div v-else class="subscription-cards" :aria-busy="loading"><article v-for="sub in rows" :key="sub._id" class="subscription-card subscription-list-card">
      <div class="subscription-card-heading"><RouterLink :to="'/account/subscriptions/'+sub._id" :title="sub.code">{{ sub.code }}</RouterLink><span class="subscription-status" :data-status="sub.status">{{ subscriptionLabels[sub.status] }}</span></div>
      <ul class="subscription-items"><li v-for="item in sub.items" :key="item.productId"><span>{{ item.productSnapshot.name }}</span><strong>{{ item.quantity }} {{ item.productSnapshot.unit }}/kỳ</strong></li></ul>
      <div class="subscription-card-summary"><dl class="subscription-facts"><div><dt>Chu kỳ giao</dt><dd>{{ frequencyLabel(sub.frequency) }}</dd></div><div><dt>Kỳ tiếp theo</dt><dd>{{ date(sub.nextScheduledDate) }}</dd></div><div><dt>Giá tham khảo ban đầu / kỳ</dt><dd>{{ money(sub.confirmedTotal) }}</dd></div><div><dt>Ngày đăng ký</dt><dd>{{ date(sub.createdAt) }}</dd></div></dl>
        <RouterLink class="subscription-detail-link" :to="'/account/subscriptions/'+sub._id">Xem lịch và quản lý →</RouterLink></div>
    </article></div>
    <nav v-if="total>10" class="subscription-pagination" aria-label="Phân trang đăng ký"><SageButton variant="secondary" :disabled="page<=1||loading" @click="page--">Trang trước</SageButton><span>Trang {{ page }}/{{ Math.ceil(total/10) }}</span><SageButton variant="secondary" :disabled="page*10>=total||loading" @click="page++">Trang sau</SageButton></nav>
  </div></div></template>
