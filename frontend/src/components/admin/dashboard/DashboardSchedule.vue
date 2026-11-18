<script setup>
import { ref } from "vue";
import {
  date,
  number,
  shortId,
  orderLabels,
} from "@/utils/admin-dashboard-display.util";
import { runLabels } from "@/utils/subscription.util";
import DashboardEmpty from "./DashboardEmpty.vue";
defineProps({ model: { type: Object, default: null }, permitted: Boolean });
const expanded = ref(false);
</script>
<template>
  <section class="fm-panel fm-schedule-panel">
    <header class="fm-section-head">
      <div>
        <span class="fm-panel-kicker">Lịch giao & đăng ký</span>
        <h2>Giao hàng định kỳ</h2>
      </div>
      <RouterLink
        v-if="permitted"
        class="fm-text-link"
        to="/admin/subscriptions"
        >Quản lý lịch
        <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i
      ></RouterLink>
    </header>
    <template v-if="model"
      ><div class="fm-schedule-metrics">
        <div>
          <span class="fm-mini-icon" aria-hidden="true"
            ><i class="fa-solid fa-repeat"></i></span
          ><strong>{{ number(model.active) }}</strong
          ><span>Đăng ký hoạt động</span>
        </div>
        <div>
          <span class="fm-mini-icon" aria-hidden="true"
            ><i class="fa-regular fa-calendar-check"></i></span
          ><strong>{{ number(model.today) }}</strong
          ><span>Kỳ mong muốn hôm nay</span>
        </div>
        <div>
          <span class="fm-mini-icon" aria-hidden="true"
            ><i class="fa-regular fa-calendar"></i></span
          ><strong>{{ number(model.next7days) }}</strong
          ><span>Kỳ trong 7 ngày tới</span>
        </div>
      </div>
      <div class="fm-subsection-head">
        <h3>Lịch sắp tới</h3>
        <span class="fm-scope">Ngày mong muốn · 7 ngày</span>
      </div>
      <ol v-if="model.upcoming.length" class="fm-timeline">
        <li
          v-for="run in expanded ? model.upcoming : model.upcoming.slice(0, 3)"
          :key="run._id"
        >
          <span class="fm-timeline-marker" aria-hidden="true"></span>
          <div class="fm-timeline-date">
            <strong>{{ date(run.scheduledDate, { year: undefined }) }}</strong>
          </div>
          <div class="fm-timeline-main">
            <div class="fm-timeline-top">
              <strong>{{ run.customer || "Chưa có tên khách hàng" }}</strong
              ><span
                class="fm-badge"
                :data-status="run.orderStatus || run.status"
                >{{
                  orderLabels[run.orderStatus] ||
                  runLabels[run.status] ||
                  run.status
                }}</span
              >
            </div>
            <RouterLink :to="'/admin/subscriptions/' + run.subscriptionId"
              >{{ run.code || shortId(run.subscriptionId) }} · Kỳ
              {{ run.occurrenceNumber }}</RouterLink
            ><RouterLink
              v-if="run.orderId"
              class="fm-order-ref"
              :to="'/admin/orders/' + run.orderId"
              >Đơn #{{ shortId(run.orderId) }}
              <i
                class="fa-solid fa-arrow-up-right-from-square"
                aria-hidden="true"
              ></i></RouterLink
            ><small v-else>Chưa phát sinh đơn hàng</small>
          </div>
        </li>
      </ol>
      <DashboardEmpty
        v-else
        compact
        title="Chưa có kỳ giao sắp tới"
        detail="Không có kỳ giao trong 7 ngày kể từ hôm nay."
        icon="fa-calendar-days"
      /><button
        v-if="model.upcoming.length > 3"
        type="button"
        class="fm-expand"
        :aria-expanded="expanded"
        @click="expanded = !expanded"
      >
        {{
          expanded ? "Thu gọn" : `Xem thêm ${model.upcoming.length - 3} kỳ giao`
        }}
      </button>
      <details class="fm-more fm-schedule-details">
        <summary>Chi tiết các kỳ trong khoảng đã chọn</summary>
        <dl class="fm-inline-metrics">
          <div>
            <dt>Chờ chuẩn bị</dt>
            <dd>{{ number(model.preparing) }}</dd>
          </div>
          <div>
            <dt>Đơn đã hoàn thành</dt>
            <dd>{{ number(model.completed) }}</dd>
          </div>
          <div>
            <dt>Tạo đơn thất bại</dt>
            <dd>{{ number(model.failed) }}</dd>
          </div>
          <div>
            <dt>Chờ xác nhận giá / thanh toán</dt>
            <dd>{{ number(model.awaitingCustomer) }}</dd>
          </div>
          <div>
            <dt>Đăng ký mới</dt>
            <dd>{{ number(model.created) }}</dd>
          </div>
        </dl>
        <p class="fm-note">
          Các kỳ được lọc theo ngày giao mong muốn; đăng ký mới lọc theo ngày
          tạo.
        </p>
      </details>
      <footer class="fm-panel-footer fm-note">
        Ngày mong muốn chưa phải cam kết giờ giao. Đăng ký và lượt giao được đếm
        riêng.
      </footer></template
    ><DashboardEmpty
      v-else
      title="Chưa tải được lịch giao"
      :detail="
        permitted
          ? 'Dùng Làm mới để tải lại khu vực này.'
          : 'Tài khoản cần quyền xem đơn hàng.'
      "
      icon="fa-calendar-days"
    />
  </section>
</template>
