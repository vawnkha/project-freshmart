<script setup>
import { computed } from 'vue';
import { runLabels, subscriptionDate as date, subscriptionMoney as money, subscriptionPaymentLabel } from '@/utils/subscription.util';
const props = defineProps({ subscription: { type: Object, required: true }, admin: Boolean });
defineEmits(['confirm', 'pay']);
const orders = computed(() => new Map((props.subscription.orders || []).map(order => [order._id, order])));
</script>
<template><section class="subscription-history" aria-labelledby="subscription-schedule-heading"><h2 id="subscription-schedule-heading">Lịch giao và đơn hàng</h2>
  <ol class="subscription-schedule"><li v-for="run in subscription.runs" :key="run._id" class="subscription-run" :data-run-status="run.status"><div class="subscription-run-heading"><strong>Kỳ {{ run.occurrenceNumber }}</strong> <span class="subscription-status" :data-status="run.status">{{ runLabels[run.status] }}</span></div><span>Ngày đăng ký tạo đơn: {{ date(run.wishDate) }}</span><span>Bắt đầu tạo đơn từ: {{ date(run.processAt) }}</span>
    <p v-if="run.lastError" class="subscription-error">{{ run.lastError }}</p><p v-if="run.reason">{{ run.reason }}</p>
    <p v-if="run.status==='scheduled' && run.startedAt">Kỳ đã bắt đầu trước khi tạm dừng; giữ nguyên dữ liệu và giới hạn giá đã chốt.</p>
    <template v-if="run.orderId"><RouterLink :to="admin ? '/admin/orders/'+run.orderId : {path:'/profile',query:{tab:'orders',orderId:run.orderId}}">Xem đơn #{{ String(run.orderId).slice(-8).toUpperCase() }}</RouterLink><p v-if="orders.get(run.orderId)">{{ money(orders.get(run.orderId).total_price) }} · {{ orders.get(run.orderId).status_text }} · {{ subscriptionPaymentLabel(orders.get(run.orderId).payment_status) }}<br />Tạo ngày {{ date(orders.get(run.orderId).created_at) }}</p></template>
    <div v-if="!admin && subscription.status==='active'" class="subscription-actions"><button v-if="['pending_confirmation','pending_payment'].includes(run.status)" type="button" class="sage-button sage-button--secondary" @click="$emit('confirm',run)">Xem và xác nhận giá kỳ {{ run.occurrenceNumber }}</button><button v-if="run.status==='pending_payment' && run.inputSnapshot?.paymentMethod==='paypal'" type="button" class="sage-button" @click="$emit('pay',run)">Thanh toán kỳ {{ run.occurrenceNumber }}</button></div>
    <slot name="actions" :run="run" />
    <button v-if="!admin && run.orderId && ['awaiting_capture','capture_unknown'].includes(orders.get(run.orderId)?.payment_status)" type="button" class="sage-button sage-button--secondary" @click="$emit('pay',run)">Kiểm tra thanh toán kỳ {{ run.occurrenceNumber }}</button>
    <p v-if="run.paymentOutcome==='failed'" class="subscription-error">Thanh toán chưa thành công; đơn đã được hủy và hoàn kho theo quy trình hiện tại. Kỳ này không tự tạo đơn thay thế.</p>
    <details v-if="admin && run.audit?.length"><summary>Lịch sử xử lý · {{ run.attempts }} lần thử</summary><ul><li v-for="(event,index) in run.audit" :key="index">{{ date(event.at) }} · {{ event.type }}<span v-if="event.reason"> · {{ event.reason }}</span></li></ul></details>
  </li></ol>
</section></template>
