<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import ordersService from "@/services/orders.service";
import AdminPagination from "@/components/admin/common/AdminPagination.vue";
import { useAuthStore } from "@/stores/user/auth";
import { hasPermission } from "@/utils/permission.util";

const router = useRouter();
const authStore = useAuthStore();
const orders = ref([]);
const activeShipping = ref(null);
const activeItems = ref(null);
const loading = ref(false);
const keyword = ref("");
const selectedStatus = ref("");
const selectedPayment = ref("");
const canUpdateOrders = computed(() => hasPermission(authStore, "order:update"));

const currentPage = ref(1);
const pageSize = ref(12);

async function fetchOrders() {
  loading.value = true;
  try {
    const res = await ordersService.getAll();
    orders.value = res?.data || res || [];
  } catch (error) {
    alert(error?.message || "Không thể tải danh sách đơn hàng");
  } finally {
    loading.value = false;
  }
}

function paymentBadgeClass(item) {
  if (item.payment_status === "completed") return "admin-badge--success";
  if (item.payment_status === "failed") return "admin-badge--danger";
  return "admin-badge--warning";
}

function orderBadgeClass(item) {
  if (item.status === "completed") return "admin-badge--success";
  if (item.status === "shipping") return "admin-badge--primary";
  if (item.status === "pending") return "admin-badge--warning";
  if (item.status === "canceled") return "admin-badge--danger";
  return "admin-badge--info";
}

function paymentText(item) {
  if (item.payment_status === "completed") return "Đã thanh toán";
  if (item.payment_status === "failed") return "Thanh toán lỗi";
  return "Chưa thanh toán";
}

function formatPrice(value) {
  return Number(value || 0).toLocaleString("vi-VN") + " VND";
}

function formatDate(value) {
  if (!value) return "---";
  return new Date(value).toLocaleString("vi-VN");
}

async function confirmOrder(item) {
  if (!canUpdateOrders.value) {
    alert("Ban khong co quyen cap nhat don hang");
    return;
  }

  try {
    let nextStatus = "";

    if (item.status === "pending") {
      nextStatus = "processing";
    } else if (item.status === "processing") {
      nextStatus = "shipping";
    } else {
      return;
    }

    await ordersService.updateStatus(item._id, {
      status: nextStatus,
    });

    await fetchOrders();
  } catch (error) {
    alert(error?.message || "Không thể cập nhật trạng thái đơn hàng");
  }
}

function closeShippingModal() {
  activeShipping.value = null;
}

function closeItemsModal() {
  activeItems.value = null;
}

const filteredOrders = computed(() => {
  const q = keyword.value.trim().toLowerCase();

  return orders.value.filter((item) => {
    const matchKeyword =
      !q ||
      String(item._id || "")
        .toLowerCase()
        .includes(q) ||
      String(item.user?.name || "")
        .toLowerCase()
        .includes(q) ||
      String(item.user?.email || "")
        .toLowerCase()
        .includes(q) ||
      String(item.shipping_address?.fullName || "")
        .toLowerCase()
        .includes(q) ||
      String(item.shipping_address?.phone || "")
        .toLowerCase()
        .includes(q);

    const matchStatus =
      !selectedStatus.value || item.status === selectedStatus.value;

    const matchPayment =
      !selectedPayment.value || item.payment_status === selectedPayment.value;

    return matchKeyword && matchStatus && matchPayment;
  });
});

const paginatedOrders = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  const end = start + pageSize.value;
  return filteredOrders.value.slice(start, end);
});

const totalOrders = computed(() => filteredOrders.value.length);
const pendingOrders = computed(
  () => filteredOrders.value.filter((item) => item.status === "pending").length,
);
const shippingOrders = computed(
  () =>
    filteredOrders.value.filter((item) => item.status === "shipping").length,
);
const completedOrders = computed(
  () =>
    filteredOrders.value.filter((item) => item.status === "completed").length,
);

watch([keyword, selectedStatus, selectedPayment], () => {
  currentPage.value = 1;
});

watch(filteredOrders, (list) => {
  const maxPage = Math.max(1, Math.ceil(list.length / pageSize.value));
  if (currentPage.value > maxPage) {
    currentPage.value = maxPage;
  }
});

onMounted(fetchOrders);
</script>

<template>
  <div class="admin-page">
    <div class="admin-page-title admin-page-title--stack">
      <h1>Quản lý đơn hàng</h1>
      <p>Danh sách tất cả đơn hàng</p>
    </div>

    <div class="admin-stat-row admin-stat-row--orders">
      <div class="admin-stat-card">
        <div class="admin-stat-card__label">Tổng đơn hàng</div>
        <div class="admin-stat-card__value">{{ totalOrders }}</div>
      </div>

      <div class="admin-stat-card">
        <div class="admin-stat-card__label">Chờ xác nhận</div>
        <div class="admin-stat-card__value">{{ pendingOrders }}</div>
      </div>

      <div class="admin-stat-card">
        <div class="admin-stat-card__label">Đang giao</div>
        <div class="admin-stat-card__value">{{ shippingOrders }}</div>
      </div>

      <div class="admin-stat-card">
        <div class="admin-stat-card__label">Hoàn thành</div>
        <div class="admin-stat-card__value">{{ completedOrders }}</div>
      </div>
    </div>

    <section class="admin-panel admin-panel--orders">
      <div class="admin-panel__header admin-panel__header--flex">
        <div>
          <div class="admin-panel__header-title">Danh sách đơn hàng</div>
          <div class="admin-panel__header-subtitle">
            Trang quản lý đơn hàng cho phép admin xác nhận, xem và theo dõi đơn
            hàng.
          </div>
        </div>

        <button class="admin-btn admin-btn--secondary" @click="fetchOrders">
          Làm mới
        </button>
      </div>

      <div class="admin-panel__body">
        <div class="row admin-toolbar">
          <div class="col-md-6 col-lg-6">
            <input
              v-model="keyword"
              type="text"
              class="admin-toolbar__input"
              placeholder="Tìm kiếm"
            />
          </div>

          <div class="col-md-3 col-lg-3">
            <select v-model="selectedStatus" class="admin-toolbar__select">
              <option value="">Tất cả trạng thái</option>
              <option value="pending">Chờ xác nhận</option>
              <option value="processing">Đang xử lý</option>
              <option value="shipping">Đang giao</option>
              <option value="completed">Hoàn thành</option>
              <option value="canceled">Đã hủy</option>
            </select>
          </div>

          <div class="col-md-3 col-lg-3">
            <select v-model="selectedPayment" class="admin-toolbar__select">
              <option value="">Tất cả thanh toán</option>
              <option value="pending">Chưa thanh toán</option>
              <option value="completed">Đã thanh toán</option>
              <option value="failed">Thất bại</option>
            </select>
          </div>
        </div>

        <div v-if="loading" class="admin-empty-state">
          Đang tải dữ liệu đơn hàng...
        </div>

        <div v-else-if="!filteredOrders.length" class="admin-empty-state">
          Không có đơn hàng phù hợp
        </div>

        <div v-else class="table-responsive">
          <table class="admin-table admin-table--orders">
            <thead>
              <tr>
                <th>ID</th>
                <th>Thông tin người đặt</th>
                <th>Tổng tiền</th>
                <th>Trạng thái đơn hàng</th>
                <th>Trạng thái thanh toán</th>
                <th>Chi tiết đơn hàng</th>
                <th>Thông tin địa chỉ</th>
                <th></th>
              </tr>
            </thead>

            <tbody>
              <tr v-for="item in paginatedOrders" :key="item._id">
                <td>
                  <div class="admin-order-id">
                    <strong>{{ item._id }}</strong>
                    <small>{{ formatDate(item.created_at) }}</small>
                  </div>
                </td>

                <td class="text-center">
                  <div class="admin-customer-info">
                    <strong>
                      {{
                        item.user?.name ||
                        item.shipping_address?.fullName ||
                        item.customer_name ||
                        "-"
                      }}
                    </strong>
                  </div>
                </td>

                <td class="admin-price-cell">
                  {{ formatPrice(item.total_price) }}
                </td>

                <td class="text-center">
                  <span class="admin-badge" :class="orderBadgeClass(item)">
                    {{ item.status_text }}
                  </span>
                </td>

                <td class="text-center">
                  <div class="admin-payment-info">
                    <span class="admin-badge" :class="paymentBadgeClass(item)">
                      {{ paymentText(item) }}
                    </span>
                    <small>{{
                      (item.payment_method || "cod").toUpperCase()
                    }}</small>
                  </div>
                </td>

                <td class="text-center">
                  <button
                    class="admin-btn admin-btn--info"
                    @click="activeItems = item"
                  >
                    Xem
                  </button>
                </td>

                <td class="text-center">
                  <button
                    class="admin-btn admin-btn--primary"
                    @click="activeShipping = item"
                  >
                    Xem
                  </button>
                </td>

                <td>
                  <div class="admin-action-stack">
                    <button
                      v-if="
                        item.status === 'pending' ||
                        item.status === 'processing'
                      "
                      class="admin-btn admin-btn--success"
                      :disabled="!canUpdateOrders"
                      :title="
                        !canUpdateOrders
                          ? 'Ban khong co quyen cap nhat don hang'
                          : ''
                      "
                      @click="confirmOrder(item)"
                    >
                      {{
                        item.status === "pending" ? "Xác nhận đơn" : "Giao hàng"
                      }}
                    </button>

                    <button
                      class="admin-btn admin-btn--primary"
                      @click="
                        router.push({
                          name: 'admin-order-detail',
                          params: { id: item._id },
                        })
                      "
                    >
                      Xem chi tiết
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          <AdminPagination
            v-model="currentPage"
            :total-items="filteredOrders.length"
            :page-size="pageSize"
          />
        </div>
      </div>
    </section>

    <div
      v-if="activeShipping"
      class="admin-modal-mask"
      @click.self="closeShippingModal"
    >
      <div class="admin-modal admin-modal--order">
        <div class="admin-modal__header">
          <div class="admin-modal__title">Thông tin giao hàng</div>
          <button
            class="admin-btn admin-btn--secondary"
            @click="closeShippingModal"
          >
            ×
          </button>
        </div>

        <div class="admin-modal__body">
          <div class="admin-detail-grid">
            <div class="admin-detail-card">
              <span>Người nhận</span>
              <strong>{{
                activeShipping.shipping_address?.fullName || "---"
              }}</strong>
            </div>

            <div class="admin-detail-card">
              <span>Số điện thoại</span>
              <strong>{{
                activeShipping.shipping_address?.phone || "---"
              }}</strong>
            </div>

            <div class="admin-detail-card admin-detail-card--full">
              <span>Địa chỉ</span>
              <strong>{{
                activeShipping.shipping_address?.address || "---"
              }}</strong>
            </div>

            <div class="admin-detail-card">
              <span>Thành phố</span>
              <strong>{{
                activeShipping.shipping_address?.city || "---"
              }}</strong>
            </div>

            <div class="admin-detail-card">
              <span>Trạng thái</span>
              <strong>{{ activeShipping.status_text || "---" }}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="activeItems"
      class="admin-modal-mask"
      @click.self="closeItemsModal"
    >
      <div class="admin-modal admin-modal--order admin-modal--wide">
        <div class="admin-modal__header">
          <div class="admin-modal__title">Chi tiết hóa đơn</div>
          <button
            class="admin-btn admin-btn--secondary"
            @click="closeItemsModal"
          >
            ×
          </button>
        </div>

        <div class="admin-modal__body">
          <div class="admin-order-summary">
            <div class="admin-order-summary__item">
              <span>Tổng sản phẩm</span>
              <strong>{{ activeItems.items?.length || 0 }}</strong>
            </div>
            <div class="admin-order-summary__item">
              <span>Tổng tiền</span>
              <strong>{{ formatPrice(activeItems.total_price) }}</strong>
            </div>
          </div>

          <div class="table-responsive">
            <table class="admin-table admin-table--orders">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Tên sản phẩm</th>
                  <th>Số lượng</th>
                  <th>Đơn giá</th>
                  <th>Thành tiền</th>
                </tr>
              </thead>

              <tbody>
                <tr
                  v-for="(sub, index) in activeItems.items || []"
                  :key="index"
                >
                  <td>{{ index + 1 }}</td>
                  <td>{{ sub.name }}</td>
                  <td>{{ sub.quantity }}</td>
                  <td>{{ formatPrice(sub.price) }}</td>
                  <td>{{ formatPrice(sub.subtotal) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
