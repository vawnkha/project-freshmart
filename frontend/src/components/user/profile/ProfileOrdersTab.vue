<script setup>
import AppState from "@/components/user/common/AppState.vue";
import {
  formatMoney,
  orderStatusLabel,
  orderStatusClass,
} from "@/utils/storefront.util";
defineProps({
  orders: { type: Array, required: true },
  loading: Boolean,
  error: String,
});
defineEmits(["view-order-detail", "retry"]);
const money = value => value === null || value === undefined || !Number.isFinite(Number(value)) ? 'Chưa xác định' : formatMoney(value);
</script>
<template>
  <div class="profile-content-box">
    <h2 class="profile-section-title">Đơn hàng của bạn</h2>
    <AppState
      v-if="loading"
      kind="loading"
      title="Đang tải đơn hàng..."
    /><AppState
      v-else-if="error"
      kind="error"
      :title="error"
      retry
      @retry="$emit('retry')"
    /><AppState
      v-else-if="!orders.length"
      title="Bạn chưa có đơn hàng"
      description="Các đơn hàng của bạn sẽ hiển thị tại đây."
      to="/products"
    />
    <div v-else class="order-list">
      <article v-for="order in orders" :key="order.id" class="order-card">
        <div>
          <h3>Đơn hàng #{{ order.id }}</h3>
          <p>{{ order.orderDate || 'Chưa có ngày đặt' }}</p>
        </div>
        <span class="status-badge" :class="orderStatusClass(order)">{{
          orderStatusLabel(order)
        }}</span
        ><strong>{{ money(order.total) }}</strong
        ><button class="btn" @click="$emit('view-order-detail', order)">
          Xem chi tiết
          <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
        </button>
      </article>
    </div>
  </div>
</template>
