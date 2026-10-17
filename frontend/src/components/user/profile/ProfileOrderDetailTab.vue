<script setup>
import ResponsiveImage from "@/components/user/common/ResponsiveImage.vue";
import { orderStatusLabel, orderStatusClass } from "@/utils/storefront.util";
defineProps({ order: { type: Object, required: true }, saving: Boolean });
defineEmits(["back-to-orders", "cancel-order", "complete-order"]);
const money=value=>value===null || value===undefined || String(value).trim()==='' || !Number.isFinite(Number(value)) ? 'Chưa xác định' : Number(value).toLocaleString('vi-VN')+'đ';
const paymentLabel=status=>({pending:'Chờ thanh toán',completed:'Đã thanh toán',paid:'Đã thanh toán',failed:'Thanh toán chưa hoàn tất',refunded:'Đã hoàn tiền',capture_unknown:'Chưa xác định kết quả thanh toán',created:'Đang khởi tạo thanh toán',canceled:'Đã hủy thanh toán'})[status] || 'Chưa xác định';
</script>
<template>
  <section class="profile-content-box approved-order-detail" :aria-busy="saving">
    <div class="order-detail-header">
      <h2 class="profile-section-title">Đơn hàng #{{ order.id }}</h2>
      <button class="btn" @click="$emit('back-to-orders')">Quay lại</button>
    </div>
    <span class="status-badge" :class="orderStatusClass(order)">{{ orderStatusLabel(order) }}</span>
    <dl class="approved-order-meta">
      <div><dt>Ngày đặt</dt><dd>{{ order.orderDate || 'Chưa xác định' }}</dd></div>
      <div><dt>Thanh toán</dt><dd>{{ order.paymentMethod === 'paypal' ? 'PayPal' : order.paymentMethod === 'cod' ? 'Thanh toán khi nhận hàng' : 'Chưa xác định' }}<br />{{ paymentLabel(order.paymentStatus) }}</dd></div>
      <div><dt>Tổng tiền</dt><dd class="approved-account-money">{{ money(order.total) }}</dd></div>
    </dl>
    <section class="approved-recipient" aria-labelledby="order-recipient-title">
      <h3 id="order-recipient-title">Địa chỉ tại thời điểm đặt hàng</h3>
      <p>{{ order.shipping?.fullName || 'Chưa có tên người nhận' }} · {{ order.shipping?.phone || 'Chưa có số điện thoại' }}</p>
      <p>{{ order.shipping?.address || 'Chưa có địa chỉ' }}<template v-if="order.shipping?.city">, {{ order.shipping.city }}</template></p>
    </section>
    <h3 class="order-detail-subtitle">Sản phẩm trong đơn</h3>
    <p v-if="!order.items?.length">Chưa có thông tin sản phẩm.</p>
    <div v-else class="approved-order-lines">
      <article v-for="item in order.items" :key="item.id" class="approved-order-line">
        <ResponsiveImage :src="item.thumbnail" :alt="item.name" class="order-product-image" />
        <div><h4>{{ item.name }}</h4><p>{{ item.quantity }} × {{ money(item.price) }}</p></div>
        <strong class="approved-account-money">{{ money(item.subtotal) }}</strong>
      </article>
    </div>
    <dl class="approved-order-totals">
      <div v-if="order.subtotal !== null && order.subtotal !== undefined"><dt>Tạm tính</dt><dd>{{ money(order.subtotal) }}</dd></div>
      <div v-if="order.shippingFee !== null && order.shippingFee !== undefined"><dt>Phí giao hàng</dt><dd>{{ money(order.shippingFee) }}</dd></div>
      <div v-if="order.discount !== null && order.discount !== undefined"><dt>Giảm giá</dt><dd>{{ money(order.discount) }}</dd></div>
      <div><dt>Tổng cộng</dt><dd><strong>{{ money(order.total) }}</strong></dd></div>
    </dl>
    <ol v-if="order.timeline?.length" class="approved-order-timeline">
      <li v-for="(event, index) in order.timeline" :key="index"><strong>{{ event.status_text || event.status || event.title }}</strong><p>{{ event.note }}</p><time v-if="event.created_at">{{ event.created_at }}</time></li>
    </ol>
    <div class="approved-account-actions">
      <button v-if="order.rawStatus === 'pending'" class="btn" :disabled="saving" @click="$emit('cancel-order', order.id)">Hủy đơn hàng</button>
      <button v-if="order.rawStatus === 'shipping'" class="btn btn-primary" :disabled="saving" @click="$emit('complete-order', order.id)">Đã nhận hàng</button>
    </div>
    <p v-if="saving" role="status">Đang cập nhật đơn hàng...</p>
  </section>
</template>
