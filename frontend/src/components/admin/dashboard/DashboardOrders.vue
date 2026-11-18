<script setup>
import { ref } from "vue";
import {
  money,
  number,
  shortId,
  orderLabels,
  shareWidth,
} from "@/utils/admin-dashboard-display.util";
import DashboardEmpty from "./DashboardEmpty.vue";
defineProps({ model: { type: Object, default: null }, permitted: Boolean });
const expanded = ref(false);
</script>
<template>
  <section class="fm-panel fm-orders-panel">
    <header class="fm-section-head">
      <div>
        <span class="fm-panel-kicker">Trong kỳ chọn</span>
        <h2>
          Đơn hàng
          <span v-if="model" class="fm-heading-count">{{
            number(model.total)
          }}</span>
        </h2>
      </div>
      <RouterLink v-if="permitted" class="fm-text-link" to="/admin/orders"
        >Quản lý đơn
        <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i
      ></RouterLink>
    </header>
    <template v-if="model"
      ><div
        class="fm-statuses"
        role="list"
        aria-label="Phân bố trạng thái đơn tạo trong kỳ"
      >
        <div
          v-for="item in model.statuses"
          :key="item.status"
          class="fm-status-row"
          :data-status="item.status"
          role="listitem"
        >
          <RouterLink
            :to="{ path: '/admin/orders', query: { status: item.status } }"
            >{{ item.label }}</RouterLink
          >
          <div class="fm-track" aria-hidden="true">
            <span
              :style="{ width: shareWidth(item.count, model.total) + '%' }"
            ></span>
          </div>
          <strong>{{ number(item.count) }}</strong>
        </div>
      </div>
      <div class="fm-subsection-head">
        <h3>Đơn cần xử lý gần nhất</h3>
        <span class="fm-scope"
          >Hiện tại · {{ number(model.attentionCount) }}</span
        >
      </div>
      <ul v-if="model.attention.length" class="fm-order-list">
        <li
          v-for="order in expanded
            ? model.attention
            : model.attention.slice(0, 3)"
          :key="order._id"
        >
          <RouterLink :to="'/admin/orders/' + order._id" class="fm-order-link"
            ><span class="fm-order-icon" aria-hidden="true"
              ><i class="fa-solid fa-receipt"></i></span
            ><span class="fm-order-copy"
              ><b>#{{ shortId(order._id) }}</b
              ><small>{{
                order.customer || "Chưa có tên khách hàng"
              }}</small></span
            ><span class="fm-order-amount"
              ><strong>{{ money(order.total_price) }}</strong
              ><span class="fm-badge" :data-status="order.status">{{
                orderLabels[order.status] || order.status
              }}</span></span
            ><i
              class="fa-solid fa-chevron-right fm-chevron"
              aria-hidden="true"
            ></i
          ></RouterLink>
        </li>
      </ul>
      <DashboardEmpty
        v-else
        compact
        title="Không có đơn đang chờ xử lý"
        detail="Các đơn cần thao tác sẽ xuất hiện ở đây."
        icon="fa-clipboard-check"
      /><button
        v-if="model.attention.length > 3"
        type="button"
        class="fm-expand"
        :aria-expanded="expanded"
        @click="expanded = !expanded"
      >
        {{
          expanded ? "Thu gọn" : `Xem thêm ${model.attention.length - 3} đơn`
        }}
      </button></template
    ><DashboardEmpty
      v-else
      title="Chưa có số liệu đơn hàng"
      :detail="
        permitted
          ? 'Không thể tải khu vực này. Dùng Làm mới để thử lại.'
          : 'Tài khoản cần quyền xem đơn hàng.'
      "
      icon="fa-bag-shopping"
    />
  </section>
</template>
