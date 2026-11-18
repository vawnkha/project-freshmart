<script setup>
import {
  money,
  number,
  paymentLabels,
} from "@/utils/admin-dashboard-display.util";
import DashboardHint from "./DashboardHint.vue";
import DashboardEmpty from "./DashboardEmpty.vue";
defineProps({
  cash: { type: Object, default: null },
  purchases: { type: Object, default: null },
  orders: { type: Object, default: null },
  access: { type: Object, default: () => ({}) },
});
</script>
<template>
  <section class="fm-panel fm-cash-panel">
    <header class="fm-section-head">
      <div>
        <span class="fm-panel-kicker">Phát sinh trong kỳ</span>
        <h2>Dòng tiền & nhập hàng</h2>
      </div>
      <span class="fm-scope">Trong kỳ</span>
    </header>
    <template v-if="cash"
      ><div class="fm-cash-pair">
        <div>
          <span class="fm-cash-icon fm-positive" aria-hidden="true"
            ><i class="fa-solid fa-arrow-down"></i></span
          ><span>Tiền đã thu</span><strong>{{ money(cash.received) }}</strong>
        </div>
        <div>
          <span class="fm-cash-icon fm-negative" aria-hidden="true"
            ><i class="fa-solid fa-arrow-up"></i></span
          ><span>Đã hoàn khách</span><strong>{{ money(cash.refunded) }}</strong>
        </div>
      </div>
      <div class="fm-net-cash">
        <span
          >Thu trừ hoàn khách
          <DashboardHint
            label="Thu trừ hoàn khách"
            text="Tiền thu theo paid_at trừ tiền hoàn theo refunded_at. Chưa trừ phí thanh toán, tiền trả nhà cung cấp hoặc chi phí khác; không đồng nghĩa lợi nhuận hay dòng tiền ròng toàn doanh nghiệp." /></span
        ><strong>{{ money(cash.net) }}</strong
        ><small>Theo giao dịch đã ghi nhận</small>
      </div></template
    ><DashboardEmpty
      v-else
      compact
      title="Chưa có dữ liệu dòng tiền"
      :detail="
        access.orders
          ? 'Dòng tiền chưa tải được.'
          : 'Tài khoản cần quyền xem đơn hàng.'
      "
      icon="fa-wallet"
    />
    <div class="fm-subsection-head">
      <h3>Hàng hóa nhập kho</h3>
      <RouterLink
        v-if="access.purchases"
        class="fm-text-link"
        to="/admin/purchase-orders"
        >Phiếu nhập <i class="fa-solid fa-arrow-right" aria-hidden="true"></i
      ></RouterLink>
    </div>
    <div class="fm-purchase-summary">
      <span class="fm-purchase-icon" aria-hidden="true"
        ><i class="fa-solid fa-truck-ramp-box"></i
      ></span>
      <div>
        <span>Giá trị đã nhập kho</span
        ><strong>{{ money(purchases?.value) }}</strong>
      </div>
      <div class="fm-receipt-count">
        <strong>{{ number(purchases?.count) }}</strong
        ><span>phiếu đã nhập</span>
      </div>
    </div>
    <p class="fm-inline-note">
      <i class="fa-solid fa-circle-info" aria-hidden="true"></i> Giá trị nhập
      kho không phải tiền đã chi hay giá vốn hàng bán.
    </p>
    <details v-if="purchases?.series.length" class="fm-more">
      <summary>Nhập kho theo thời gian</summary>
      <ul class="fm-compact-list">
        <li v-for="point in purchases.series" :key="point._id">
          <span>{{ point._id }}</span
          ><strong>{{ money(point.value) }}</strong>
        </li>
      </ul>
    </details>
    <details class="fm-more">
      <summary>
        Chi phí & công nợ
        <span class="fm-summary-note">Chưa có sổ ghi nhận</span>
      </summary>
      <dl class="fm-inline-metrics">
        <div>
          <dt>Chi phí vận hành</dt>
          <dd>Chưa có dữ liệu</dd>
        </div>
        <div>
          <dt>Tiền trả nhà cung cấp</dt>
          <dd>Chưa có sổ thanh toán</dd>
        </div>
        <div>
          <dt>Công nợ phải thu / phải trả</dt>
          <dd>Chưa được hỗ trợ</dd>
        </div>
      </dl>
    </details>
    <div
      v-if="orders?.reconciliationStatuses.length"
      class="fm-reconcile-links"
    >
      <RouterLink
        v-for="item in orders.reconciliationStatuses"
        :key="item._id"
        :to="{ path: '/admin/orders', query: { payment: item._id } }"
        ><i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>
        {{ paymentLabels[item._id] || item._id }} ·
        {{ number(item.count) }}</RouterLink
      >
    </div>
    <p v-if="orders?.unlinkedIntents" class="fm-notice">
      {{ number(orders.unlinkedIntents) }} yêu cầu PayPal đang đối soát chưa có
      bản ghi thanh toán; chưa có trang xử lý riêng.
    </p>
  </section>
</template>
