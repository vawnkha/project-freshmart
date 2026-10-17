<script setup>
import { computed, onMounted, ref } from "vue";
import { useAdminStore } from "@/stores/admin/admin";
import { buildDashboardLists, getOrderRevenue } from "@/utils/dashboard.util";

const adminStore = useAdminStore();

const newestUsers = ref([]);
const newestOrders = ref([]);
const bestSelling = ref([]);
const categories = ref([]);
const orders = ref([]);

const selectedYear = ref(new Date().getFullYear());
const selectedMonth = ref("");

const stats = computed(() => adminStore.dashboard);

function formatCurrency(value) {
  if (value === null) return "---";
  return Number(value || 0).toLocaleString("vi-VN") + " VNĐ";
}

function formatDate(value) {
  if (!value) return "---";
  return new Date(value).toLocaleString("vi-VN");
}

function getOrderDate(order) {
  return order?.created_at ? new Date(order.created_at) : null;
}

async function fetchExtra() {
  orders.value = adminStore.resources.orders || [];
  const lists = buildDashboardLists(adminStore.resources);
  newestUsers.value = lists.newestUsers;
  newestOrders.value = lists.newestOrders;
  bestSelling.value = lists.bestSelling;
  categories.value = lists.categories;
}

const availableYears = computed(() => {
  const yearSet = new Set();

  orders.value.forEach((order) => {
    const d = getOrderDate(order);
    if (d && !Number.isNaN(d.getTime())) {
      yearSet.add(d.getFullYear());
    }
  });

  const result = Array.from(yearSet).sort((a, b) => b - a);

  if (!result.length) {
    result.push(new Date().getFullYear());
  }

  return result;
});

const revenueFilteredOrders = computed(() => {
  return orders.value.filter((order) => {
    const d = getOrderDate(order);
    if (!d || Number.isNaN(d.getTime())) return false;

    const matchYear = d.getFullYear() === Number(selectedYear.value);
    const matchMonth =
      selectedMonth.value === "" ||
      d.getMonth() + 1 === Number(selectedMonth.value);

    return matchYear && matchMonth;
  });
});

const periodRevenue = computed(() => {
  return revenueFilteredOrders.value.reduce(
    (sum, order) => sum + getOrderRevenue(order),
    0,
  );
});

const periodOrders = computed(() => revenueFilteredOrders.value.length);

const paidOrders = computed(() => {
  return revenueFilteredOrders.value.filter(
    (order) =>
      getOrderRevenue(order) > 0,
  ).length;
});

const averageOrderValue = computed(() => {
  if (!paidOrders.value) return 0;
  return periodRevenue.value / paidOrders.value;
});

const chartData = computed(() => {
  const year = Number(selectedYear.value);

  if (!selectedMonth.value) {
    const monthly = Array.from({ length: 12 }, (_, index) => ({
      label: `T${index + 1}`,
      shortLabel: `${index + 1}`,
      value: 0,
    }));

    orders.value.forEach((order) => {
      const d = getOrderDate(order);
      if (!d || Number.isNaN(d.getTime())) return;
      if (d.getFullYear() !== year) return;

      const monthIndex = d.getMonth();
      monthly[monthIndex].value += getOrderRevenue(order);
    });

    const maxValue = Math.max(...monthly.map((item) => item.value), 0);

    return monthly.map((item) => ({
      ...item,
      height:
        maxValue > 0
          ? Math.max((item.value / maxValue) * 100, item.value > 0 ? 10 : 4)
          : 4,
    }));
  }

  const month = Number(selectedMonth.value);
  const daysInMonth = new Date(year, month, 0).getDate();

  const daily = Array.from({ length: daysInMonth }, (_, index) => ({
    label: `Ngày ${index + 1}`,
    shortLabel: `${index + 1}`,
    value: 0,
  }));

  orders.value.forEach((order) => {
    const d = getOrderDate(order);
    if (!d || Number.isNaN(d.getTime())) return;
    if (d.getFullYear() !== year) return;
    if (d.getMonth() + 1 !== month) return;

    const dayIndex = d.getDate() - 1;
    daily[dayIndex].value += getOrderRevenue(order);
  });

  const maxValue = Math.max(...daily.map((item) => item.value), 0);

  return daily.map((item) => ({
    ...item,
    height:
      maxValue > 0
        ? Math.max((item.value / maxValue) * 100, item.value > 0 ? 10 : 4)
        : 4,
  }));
});

const chartPeak = computed(() => {
  if (!chartData.value.length) return null;

  return chartData.value.reduce((max, item) => {
    if (!max || item.value > max.value) return item;
    return max;
  }, null);
});

const chartAverage = computed(() => {
  if (!chartData.value.length) return 0;
  const total = chartData.value.reduce((sum, item) => sum + item.value, 0);
  return total / chartData.value.length;
});

const chartTitle = computed(() => {
  if (!selectedMonth.value) {
    return `Biểu đồ doanh thu năm ${selectedYear.value}`;
  }
  return `Biểu đồ doanh thu tháng ${selectedMonth.value}/${selectedYear.value}`;
});

onMounted(async () => {
  await adminStore.fetchDashboard();
  await fetchExtra();

  if (!availableYears.value.includes(Number(selectedYear.value))) {
    selectedYear.value = availableYears.value[0];
  }
});
</script>

<template>
  <div class="admin-page dashboard-page">
    <div class="admin-page-title admin-page-title--stack">
      <h1>Tổng quan hệ thống</h1>
      <p>Thống kê nhanh hoạt động bán hàng, doanh thu và dữ liệu mới nhất</p>
      <p v-if="adminStore.limitedAccess">Bạn chưa có quyền xem một số số liệu.</p>
      <p v-if="adminStore.loadErrors.length" role="alert">Một số số liệu chưa tải được. Vui lòng tải lại trang.</p>
    </div>

    <div class="admin-stat-row dashboard-stat-row">
      <div class="admin-stat-card dashboard-stat-card">
        <div class="admin-stat-card__label">
          <i class="fa-solid fa-user me-1"></i> Tổng số người dùng
        </div>
        <div class="admin-stat-card__value">{{ stats.totalUsers }}</div>
      </div>

      <div class="admin-stat-card dashboard-stat-card">
        <div class="admin-stat-card__label">
          <i class="fa-solid fa-chart-column me-1"></i> Tổng số lượng sản phẩm
        </div>
        <div class="admin-stat-card__value">{{ stats.totalProducts }}</div>
      </div>

      <div class="admin-stat-card dashboard-stat-card">
        <div class="admin-stat-card__label">
          <i class="fa-solid fa-cart-shopping me-1"></i> Tổng số lượng đơn hàng
        </div>
        <div class="admin-stat-card__value dashboard-stat-card__value--accent">
          {{ stats.totalOrders }}
        </div>
      </div>

      <div class="admin-stat-card dashboard-stat-card">
        <div class="admin-stat-card__label">
          <i class="fa-solid fa-money-bill me-1"></i> Tổng tiền đã thanh toán
        </div>
        <div class="admin-stat-card__value">
          {{ formatCurrency(stats.revenue) }}
        </div>
      </div>
    </div>

    <div class="dashboard-grid-top">
      <section class="admin-panel admin-panel--dashboard admin-panel--chart">
        <div class="admin-panel__header admin-panel__header--flex">
          <div>
            <div class="admin-panel__header-title">Doanh thu</div>
            <div class="admin-panel__header-subtitle">
              {{ chartTitle }}
            </div>
          </div>

          <div class="dashboard-filter-bar">
            <select v-model="selectedYear" class="dashboard-filter-select">
              <option v-for="year in availableYears" :key="year" :value="year">
                Năm {{ year }}
              </option>
            </select>

            <select v-model="selectedMonth" class="dashboard-filter-select">
              <option value="">Tất cả tháng</option>
              <option v-for="month in 12" :key="month" :value="month">
                Tháng {{ month }}
              </option>
            </select>
          </div>
        </div>

        <div class="admin-panel__body">
          <div class="dashboard-revenue-summary">
            <div class="dashboard-revenue-card">
              <span>Doanh thu kỳ chọn</span>
              <strong>{{ formatCurrency(periodRevenue) }}</strong>
            </div>

            <div class="dashboard-revenue-card">
              <span>Đơn hàng trong kỳ</span>
              <strong>{{ periodOrders }}</strong>
            </div>

            <div class="dashboard-revenue-card">
              <span>Đã ghi nhận doanh thu</span>
              <strong>{{ paidOrders }}</strong>
            </div>

            <div class="dashboard-revenue-card">
              <span>Giá trị trung bình / đơn</span>
              <strong>{{ formatCurrency(averageOrderValue) }}</strong>
            </div>
          </div>

          <div class="dashboard-chart-card">
            <div class="dashboard-chart-info">
              <div class="dashboard-chart-info__item">
                <span>Cao nhất</span>
                <strong>
                  {{
                    chartPeak
                      ? `${chartPeak.label} · ${formatCurrency(chartPeak.value)}`
                      : "---"
                  }}
                </strong>
              </div>

              <div class="dashboard-chart-info__item">
                <span>Trung bình</span>
                <strong>{{ formatCurrency(chartAverage) }}</strong>
              </div>

              <div class="dashboard-chart-info__item">
                <span>Tổng kỳ</span>
                <strong>{{ formatCurrency(periodRevenue) }}</strong>
              </div>
            </div>

            <div class="dashboard-chart-wrap">
              <div class="dashboard-chart">
                <div
                  v-for="(item, index) in chartData"
                  :key="`${item.label}-${index}`"
                  class="dashboard-chart__item"
                >
                  <div class="dashboard-chart__tooltip">
                    <strong>{{ item.label }}</strong>
                    <span>{{ formatCurrency(item.value) }}</span>
                  </div>

                  <div class="dashboard-chart__bar-wrap">
                    <div
                      class="dashboard-chart__bar"
                      :style="{ height: `${item.height}%` }"
                    ></div>
                  </div>

                  <div class="dashboard-chart__label">
                    {{ item.shortLabel }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div class="dashboard-side-panels">
        <section class="admin-panel admin-panel--dashboard">
          <div class="admin-panel__header">Top danh mục</div>
          <div class="admin-panel__body">
            <table class="admin-table admin-table--dashboard">
              <thead>
                <tr>
                  <th>Top</th>
                  <th>Danh mục</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(item, index) in categories"
                  :key="item._id || item.id"
                >
                  <td>#{{ index + 1 }}</td>
                  <td>{{ item.name }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="admin-panel admin-panel--dashboard">
          <div class="admin-panel__header">Sản phẩm bán chạy nhất</div>
          <div class="admin-panel__body">
            <table class="admin-table admin-table--dashboard">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Ảnh</th>
                  <th>Tên sản phẩm</th>
                  <th>Giá</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(item, index) in bestSelling"
                  :key="item._id || item.id"
                >
                  <td>{{ index + 1 }}</td>
                  <td>
                    <img
                      :src="item.thumbnail"
                      class="admin-thumb dashboard-thumb"
                    />
                  </td>
                  <td>{{ item.name }}</td>
                  <td>{{ formatCurrency(item.price) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>

    <div class="dashboard-grid-bottom">
      <section class="admin-panel admin-panel--dashboard">
        <div class="admin-panel__header">Người dùng mới</div>
        <div class="admin-panel__body">
          <table class="admin-table admin-table--dashboard">
            <thead>
              <tr>
                <th>#</th>
                <th>Khách hàng</th>
                <th>Số điện thoại</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, index) in newestUsers" :key="item._id || index">
                <td>{{ index + 1 }}</td>
                <td>{{ item.name }}</td>
                <td>{{ item.phone || "-" }}</td>
                <td>
                  <span
                    class="admin-badge"
                    :class="
                      item.status === 'active'
                        ? 'admin-badge--success'
                        : 'admin-badge--danger'
                    "
                  >
                    {{ item.status || "Đã kích hoạt" }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="admin-panel admin-panel--dashboard">
        <div class="admin-panel__header">Đơn hàng mới</div>
        <div class="admin-panel__body">
          <table class="admin-table admin-table--dashboard">
            <thead>
              <tr>
                <th>#</th>
                <th>Khách hàng</th>
                <th>Tổng tiền</th>
                <th>Trạng thái</th>
                <th>Ngày đặt</th>
                <th>Chi tiết</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(item, index) in newestOrders"
                :key="item._id || index"
              >
                <td>{{ index + 1 }}</td>
                <td>
                  {{
                    item.customer_name || item.shipping_address?.fullName || "-"
                  }}
                </td>
                <td>{{ formatCurrency(item.total_price) }}</td>
                <td>
                  <span
                    class="admin-badge"
                    :class="
                      item.status === 'completed'
                        ? 'admin-badge--success'
                        : item.status === 'shipping'
                          ? 'admin-badge--primary'
                          : item.status === 'canceled'
                            ? 'admin-badge--danger'
                            : 'admin-badge--warning'
                    "
                  >
                    {{ item.status_text || item.status }}
                  </span>
                </td>
                <td>{{ formatDate(item.created_at) }}</td>
                <td>
                  <RouterLink
                    :to="{
                      name: 'admin-order-detail',
                      params: { id: item._id },
                    }"
                    class="admin-btn admin-btn--primary text-decoration-none"
                  >
                    Xem
                  </RouterLink>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </div>
</template>
