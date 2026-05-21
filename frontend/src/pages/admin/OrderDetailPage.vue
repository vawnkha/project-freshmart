<script setup>
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import ordersService from "@/services/orders.service";
import { useAuthStore } from "@/stores/user/auth";
import { hasPermission } from "@/utils/permission.util";

const route = useRoute();
const authStore = useAuthStore();
const order = ref(null);
const sendingInvoice = ref(false);
const invoiceRef = ref(null);
const canUpdateOrders = computed(() => hasPermission(authStore, "order:update"));

async function fetchOrder() {
  order.value = await ordersService.getById(route.params.id);
}

function formatPrice(value) {
  return Number(value || 0).toLocaleString("vi-VN") + " VND";
}

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleString("vi-VN");
}

async function handleSendInvoice() {
  if (!canUpdateOrders.value) {
    alert("Ban khong co quyen cap nhat don hang");
    return;
  }

  try {
    sendingInvoice.value = true;

    const res = await ordersService.sendInvoice(order.value._id);

    alert(res.message || "Đã gửi hóa đơn");

    order.value.invoice_sent = true;
    order.value.invoice_sent_at = new Date().toISOString();
  } catch (err) {
    alert(err?.response?.data?.message || "Lỗi gửi hóa đơn");
  } finally {
    sendingInvoice.value = false;
  }
}

function handlePrintInvoice() {
  window.print();
}

onMounted(fetchOrder);
</script>

<template>
  <div v-if="order" class="admin-page">
    <div class="admin-page-title">Hóa đơn</div>

    <section ref="invoiceRef" class="admin-panel admin-invoice-panel">
      <div class="admin-panel__header">Hóa đơn</div>

      <div class="admin-panel__body">
        <div class="invoice-hero">
          <div class="invoice-hero__left">
            <div class="invoice-hero__icon">
              <i class="fa-solid fa-globe"></i>
            </div>
            <div>
              <div class="invoice-hero__title">Hóa đơn</div>
              <div class="invoice-hero__date">
                Ngày tạo: {{ formatDate(order.created_at) }}
              </div>
            </div>
          </div>

          <div class="invoice-hero__status">
            <span class="admin-badge admin-badge--info">
              {{ order.status_text || order.status }}
            </span>
          </div>
        </div>

        <div class="invoice-info-grid">
          <div class="invoice-card">
            <div class="invoice-card__title">Thông tin nhận hàng</div>
            <div class="invoice-card__line">
              <span>Người nhận</span>
              <strong>{{ order.shipping_address?.fullName || "---" }}</strong>
            </div>
            <div class="invoice-card__line">
              <span>Địa chỉ</span>
              <strong>{{ order.shipping_address?.address || "---" }}</strong>
            </div>
            <div class="invoice-card__line">
              <span>Thành phố</span>
              <strong>{{ order.shipping_address?.city || "---" }}</strong>
            </div>
            <div class="invoice-card__line">
              <span>Số điện thoại</span>
              <strong>{{ order.shipping_address?.phone || "---" }}</strong>
            </div>
          </div>

          <div class="invoice-card">
            <div class="invoice-card__title">Thông tin đơn hàng</div>
            <div class="invoice-card__line">
              <span>Order ID</span>
              <strong>{{ order._id }}</strong>
            </div>
            <div class="invoice-card__line">
              <span>Email</span>
              <strong>{{ order.user?.email || "---" }}</strong>
            </div>
            <div class="invoice-card__line">
              <span>Tài khoản</span>
              <strong>{{ order.user?.name || "---" }}</strong>
            </div>
            <div class="invoice-card__line">
              <span>Thanh toán</span>
              <strong>{{
                (order.payment_method || "cod").toUpperCase()
              }}</strong>
            </div>
          </div>
        </div>

        <div class="table-responsive">
          <table class="admin-table admin-table--invoice">
            <thead>
              <tr>
                <th>Ảnh</th>
                <th>Sản phẩm</th>
                <th>Giá</th>
                <th>Số lượng</th>
                <th>Thành tiền</th>
              </tr>
            </thead>

            <tbody>
              <tr v-for="item in order.items || []" :key="item.product_id">
                <td class="invoice-thumb-cell">
                  <img
                    :src="item.thumbnail || '/img/no-image.png'"
                    class="admin-thumb invoice-thumb"
                    alt="product"
                  />
                </td>
                <td>
                  <div class="invoice-product-name">{{ item.name }}</div>
                </td>
                <td>{{ formatPrice(item.price) }}</td>
                <td>{{ item.quantity }}</td>
                <td>
                  <strong>{{ formatPrice(item.subtotal) }}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="invoice-bottom">
          <div class="invoice-payment-box">
            <div class="invoice-section-title">Phương thức thanh toán</div>

            <div
              class="invoice-payment-tag"
              :class="
                order.payment_method === 'paypal'
                  ? 'invoice-payment-tag--paypal'
                  : 'invoice-payment-tag--cod'
              "
            >
              {{ order.payment_method === "paypal" ? "PayPal" : "COD" }}
            </div>

            <div class="invoice-note">
              Nếu là PayPal, thanh toán đã được xử lý trực tuyến. Nếu là COD,
              khách hàng sẽ thanh toán khi nhận hàng.
            </div>

            <div class="invoice-actions">
              <button class="invoice-link-btn" @click="handlePrintInvoice">
                <i class="fa-solid fa-print"></i>
                <span>In hóa đơn</span>
              </button>

              <button
                v-if="!order?.invoice_sent"
                class="admin-btn admin-btn--success"
                :disabled="sendingInvoice || !canUpdateOrders"
                :title="
                  !canUpdateOrders
                    ? 'Ban khong co quyen cap nhat don hang'
                    : ''
                "
                @click="handleSendInvoice"
              >
                <i class="fa-solid fa-paper-plane"></i>
                <span>{{
                  sendingInvoice ? "Đang gửi..." : "Gửi hóa đơn"
                }}</span>
              </button>
              <div
                v-if="order?.invoice_sent"
                style="color: #28a745; font-weight: 600"
              >
                ✔ Hóa đơn đã được gửi
              </div>
            </div>
          </div>

          <div class="invoice-total-box">
            <table class="admin-table admin-table--total">
              <tbody>
                <tr>
                  <th>Tiền hàng</th>
                  <td>
                    {{ formatPrice(order.total_price) }}
                  </td>
                </tr>
                <tr>
                  <th>Phí vận chuyển</th>
                  <td>{{ formatPrice(order.shipping_fee || 0) }}</td>
                </tr>
                <tr>
                  <th>Tổng tiền</th>
                  <td class="invoice-total-final">
                    {{ formatPrice(order.total_price || 0) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
<style>
@media print {
  body * {
    visibility: hidden;
  }

  .admin-invoice-panel,
  .admin-invoice-panel * {
    visibility: visible;
  }

  .admin-invoice-panel {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    box-shadow: none !important;
    border: 0 !important;
  }

  .invoice-actions,
  .admin-topbar,
  .admin-sidebar,
  .admin-page-title {
    display: none !important;
  }

  .admin-panel__header {
    border-bottom: 1px solid #ddd !important;
  }

  .admin-table th,
  .admin-table td {
    border-color: #ddd !important;
  }
}
</style>
