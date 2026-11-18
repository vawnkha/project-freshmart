<script setup>
import { computed, onMounted, ref } from "vue";
import { useAdminDashboard } from "@/composables/useAdminDashboard";
import {
  date,
  stamp,
  sectionLabels,
} from "@/utils/admin-dashboard-display.util";
import DashboardMetrics from "@/components/admin/dashboard/DashboardMetrics.vue";
import DashboardTrend from "@/components/admin/dashboard/DashboardTrend.vue";
import DashboardAlerts from "@/components/admin/dashboard/DashboardAlerts.vue";
import DashboardOrders from "@/components/admin/dashboard/DashboardOrders.vue";
import DashboardSchedule from "@/components/admin/dashboard/DashboardSchedule.vue";
import DashboardInventory from "@/components/admin/dashboard/DashboardInventory.vue";
import DashboardCashflow from "@/components/admin/dashboard/DashboardCashflow.vue";
import DashboardSales from "@/components/admin/dashboard/DashboardSales.vue";
import DashboardCustomers from "@/components/admin/dashboard/DashboardCustomers.vue";
import DashboardEmpty from "@/components/admin/dashboard/DashboardEmpty.vue";
import "@/assets/css/admin/dashboard.css";

const { data, loading, error, load } = useAdminDashboard();
const preset = ref("month"),
  from = ref(""),
  to = ref(""),
  formError = ref(""),
  chartMode = ref("bar");
const presets = {
  today: "Hôm nay",
  "7days": "7 ngày",
  "30days": "30 ngày",
  month: "Tháng này",
  year: "Năm nay",
  custom: "Tùy chỉnh",
};
let applied = { preset: "month" };
function choose(value) {
  preset.value = value;
  formError.value = "";
  if (value !== "custom") {
    applied = { preset: value };
    load(applied);
  }
}
function apply() {
  const days = (new Date(to.value) - new Date(from.value)) / 86400000 + 1;
  if (
    !from.value ||
    !to.value ||
    !Number.isFinite(days) ||
    days < 1 ||
    days > 366
  ) {
    formError.value = "Chọn khoảng ngày hợp lệ, từ 1 đến 366 ngày.";
    return;
  }
  formError.value = "";
  applied = { preset: "custom", from: from.value, to: to.value };
  load(applied);
}
const hasQualityWarnings = computed(
  () =>
    data.value?.financial?.missingCompletionDates ||
    data.value?.financial?.missingReversalDates ||
    data.value?.financial?.invalidAmounts ||
    data.value?.cash?.incompletePayments,
);
const noAccess = computed(
  () => data.value && !Object.values(data.value.access).some(Boolean),
);
const inclusiveEnd = (value) => new Date(new Date(value).getTime() - 1);
onMounted(() => load(applied));
</script>

<template>
  <div class="fm-dashboard" :aria-busy="loading">
    <header class="fm-heading">
      <div>
        <span class="fm-eyebrow">Fresh Mart / Quản trị</span>
        <h1>Tổng quan kinh doanh</h1>
      </div>
      <div class="fm-heading-actions">
        <span class="fm-updated"
          ><span class="fm-live-dot" aria-hidden="true"></span
          >{{
            loading
              ? "Đang cập nhật…"
              : data
                ? "Cập nhật " + stamp(data.generatedAt)
                : "Dữ liệu theo giờ Việt Nam"
          }}</span
        ><button
          type="button"
          class="fm-refresh"
          :disabled="loading"
          @click="load(applied)"
        >
          <i class="fa-solid fa-arrows-rotate" aria-hidden="true"></i> Làm mới
        </button>
      </div>
    </header>
    <div class="fm-toolbar">
      <div
        class="fm-presets"
        role="group"
        aria-label="Khoảng thời gian thống kê"
      >
        <button
          v-for="(label, key) in presets"
          :key="key"
          type="button"
          :aria-pressed="preset === key"
          @click="choose(key)"
        >
          {{ label }}
        </button>
      </div>
      <span class="fm-timezone"
        ><i class="fa-regular fa-clock" aria-hidden="true"></i> Giờ Việt Nam ·
        UTC+7</span
      >
      <form
        v-if="preset === 'custom'"
        class="fm-custom"
        @submit.prevent="apply"
      >
        <label
          >Từ ngày<input
            v-model="from"
            type="date"
            required
            :aria-invalid="!!formError"
            :aria-describedby="
              formError ? 'dashboard-date-error' : undefined
            " /></label
        ><label
          >Đến ngày<input
            v-model="to"
            type="date"
            required
            :min="from"
            :aria-invalid="!!formError"
            :aria-describedby="
              formError ? 'dashboard-date-error' : undefined
            " /></label
        ><button class="fm-primary" :disabled="loading">Áp dụng</button
        ><span
          id="dashboard-date-error"
          class="fm-date-error"
          :role="formError ? 'alert' : undefined"
          >{{ formError }}</span
        >
      </form>
    </div>
    <div v-if="error" role="alert" class="fm-error">
      <i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>
      <div>
        <strong>Không thể cập nhật dashboard</strong>
        <p>{{ error }}</p>
      </div>
      <button type="button" @click="load(applied)">Thử lại</button>
    </div>
    <template v-if="loading"
      ><p role="status" class="fm-loading-label">Đang tổng hợp dữ liệu…</p>
      <div class="fm-kpis fm-loading-kpis" aria-hidden="true">
        <div v-for="n in 4" :key="n" class="fm-kpi fm-skeleton-card">
          <span class="fm-skeleton fm-skeleton-icon"></span
          ><span class="fm-skeleton fm-skeleton-value"></span
          ><span class="fm-skeleton fm-skeleton-text"></span>
        </div>
      </div>
      <div class="fm-dashboard-grid fm-loading-panels" aria-hidden="true">
        <div
          v-for="n in 4"
          :key="n"
          class="fm-panel fm-skeleton-panel"
          :class="n === 1 ? 'fm-span-8' : n === 2 ? 'fm-span-4' : 'fm-span-6'"
        >
          <span class="fm-skeleton fm-skeleton-text"></span
          ><span class="fm-skeleton fm-skeleton-chart"></span>
        </div></div
    ></template>
    <template v-else-if="data">
      <div class="fm-period-line">
        <p class="fm-timestamp">
          Kỳ {{ date(data.period.start) }} –
          {{ date(inclusiveEnd(data.period.end)) }}
          <span
            >· So với {{ date(data.period.previousStart) }} –
            {{ date(inclusiveEnd(data.period.previousEnd)) }}</span
          >
        </p>
        <span class="fm-note">Kỳ trước cùng số ngày</span>
      </div>
      <div v-if="data.errors.length" role="alert" class="fm-error">
        <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
        <p>
          Chưa tải được
          {{ data.errors.map((key) => sectionLabels[key] || key).join(", ") }}.
          Các khu vực còn lại vẫn hiển thị dữ liệu đã xác định.
        </p>
        <button type="button" @click="load(applied)">Thử lại</button>
      </div>
      <p v-if="noAccess" class="fm-notice">
        Tài khoản chưa có quyền xem số liệu nghiệp vụ. Liên hệ quản trị viên để
        được cấp quyền phù hợp.
      </p>
      <p v-if="hasQualityWarnings" class="fm-notice" role="status">
        Có bản ghi thiếu thời gian hoặc số tiền hợp lệ. Số liệu chỉ phản ánh
        phát sinh có đủ chứng cứ; xem phần quy tắc tính bên dưới.
      </p>
      <DashboardMetrics
        :financial="data.financial"
        :orders="data.orders"
        :permitted="data.access.orders"
      />
      <div class="fm-dashboard-grid">
        <section class="fm-panel fm-financial-panel fm-span-8">
          <header class="fm-section-head">
            <div>
              <span class="fm-panel-kicker">Phân tích kinh doanh</span>
              <h2>Xu hướng tài chính</h2>
            </div>
            <div class="fm-chart-switch" role="group" aria-label="Kiểu biểu đồ">
              <button
                type="button"
                :aria-pressed="chartMode === 'line'"
                @click="chartMode = 'line'"
              >
                <i class="fa-solid fa-chart-line" aria-hidden="true"></i>
                Đường</button
              ><button
                type="button"
                :aria-pressed="chartMode === 'bar'"
                @click="chartMode = 'bar'"
              >
                <i class="fa-solid fa-chart-column" aria-hidden="true"></i> Cột
              </button>
            </div>
          </header>
          <DashboardTrend
            v-if="data.financial"
            :rows="data.financial.series"
            :mode="chartMode"
          /><DashboardEmpty
            v-else
            title="Chưa có dữ liệu tài chính"
            :detail="
              data.access.orders
                ? 'Khu vực tài chính chưa tải được. Dùng Làm mới để thử lại.'
                : 'Tài khoản cần quyền xem đơn hàng.'
            "
          />
        </section>
        <DashboardAlerts class="fm-span-4" :data="data" />
        <DashboardOrders
          class="fm-span-6"
          :model="data.orders"
          :permitted="data.access.orders"
        />
        <DashboardSchedule
          class="fm-span-6"
          :model="data.subscriptions"
          :permitted="data.access.orders"
        />
        <DashboardInventory
          class="fm-span-6"
          :model="data.inventory"
          :permitted="data.access.inventory"
        />
        <DashboardCashflow
          class="fm-span-6"
          :cash="data.cash"
          :purchases="data.purchases"
          :orders="data.orders"
          :access="data.access"
        />
        <DashboardSales
          class="fm-span-6"
          :model="data.sales"
          :permitted="data.access.orders"
        />
        <DashboardCustomers
          class="fm-span-6"
          :customers="data.customers"
          :sales="data.sales"
        />
      </div>
      <details class="fm-limitations" :open="!!hasQualityWarnings">
        <summary>
          <span
            ><i class="fa-solid fa-circle-info" aria-hidden="true"></i> Quy tắc
            tính & giới hạn dữ liệu</span
          ><span class="fm-note">Xem giải thích các chỉ số</span>
        </summary>
        <div class="fm-limitations-content">
          <p v-if="data.financial?.missingCompletionDates" class="fm-notice">
            {{ data.financial.missingCompletionDates }} đơn thiếu mốc hoàn
            thành; không dùng ngày tạo thay cho ngày doanh thu.
          </p>
          <p v-if="data.cash?.incompletePayments" class="fm-notice">
            {{ data.cash.incompletePayments }} thanh toán thiếu ngày thu/hoàn,
            số tiền hợp lệ hoặc loại tiền VND.
          </p>
          <p v-if="data.financial?.missingReversalDates" class="fm-notice">
            {{ data.financial.missingReversalDates }} đơn từng hoàn thành thiếu
            mốc hủy/hoàn để đảo ghi nhận.
          </p>
          <p v-if="data.financial?.invalidAmounts" class="fm-notice">
            {{ data.financial.invalidAmounts }} đơn thiếu tổng tiền hợp lệ;
            không cộng vào doanh thu.
          </p>
          <ul>
            <li v-for="note in data.limitations" :key="note">{{ note }}</li>
          </ul>
        </div>
      </details>
    </template>
  </div>
</template>
