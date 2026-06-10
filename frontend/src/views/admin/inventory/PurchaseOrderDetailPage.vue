<script setup>
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import purchaseOrderService from "@/services/purchase-order.service";
import supplierService from "@/services/supplier.service";

const route = useRoute();
const router = useRouter();
const purchaseOrder = ref(null);
const suppliers = ref([]);
const loading = ref(false);
const actionLoading = ref(false);
const importResult = ref(null);

const supplier = computed(() => {
  const id = normalizeId(purchaseOrder.value?.supplierId);
  return suppliers.value.find((item) => getId(item) === id) || null;
});

const importedRows = computed(() => {
  const rows = importResult.value?.imported || [];
  return Array.isArray(rows) ? rows : [];
});

const purchaseItems = computed(() => {
  const items = purchaseOrder.value?.items || [];
  return Array.isArray(items) ? items : [];
});

const firstInventoryItemId = computed(() => {
  const fromImportedRows = importedRows.value
    .map((row) => normalizeId(row.summary?.inventoryItemId || row.batch?.inventoryItemId))
    .find(Boolean);
  if (fromImportedRows) return fromImportedRows;

  return purchaseItems.value
    .map((item) => normalizeId(item.inventoryItemId))
    .find(Boolean) || "";
});

const canShowInventoryShortcuts = computed(
  () => purchaseOrder.value?.status === "imported" || importedRows.value.length > 0,
);

function normalizeList(res) {
  return Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
}

function getId(item) {
  return item?._id || item?.id || "";
}

function normalizeId(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value.$oid) return value.$oid;
  return String(value);
}

function formatPrice(value) {
  return Number(value || 0).toLocaleString("vi-VN") + " VND";
}

function formatDate(value) {
  if (!value) return "---";
  return new Date(value).toLocaleString("vi-VN");
}

function statusText(status) {
  if (status === "draft") return "Nháp";
  if (status === "imported") return "Đã nhập kho";
  if (status === "cancelled") return "Đã hủy";
  return status || "---";
}

function goToInventoryRoute(name) {
  const query = firstInventoryItemId.value
    ? { inventoryItemId: firstInventoryItemId.value }
    : {};
  router.push({ name, query });
}

function statusClass(status) {
  if (status === "imported") return "admin-badge--success";
  if (status === "cancelled") return "admin-badge--danger";
  if (status === "draft") return "admin-badge--warning";
  return "admin-badge--info";
}

async function fetchData() {
  loading.value = true;
  try {
    const [orderRes, supplierRes] = await Promise.all([
      purchaseOrderService.getById(route.params.id),
      supplierService.getAll(),
    ]);

    purchaseOrder.value = orderRes;
    suppliers.value = normalizeList(supplierRes);
  } catch (error) {
    console.error(error);
    alert(error?.response?.data?.message || "Không thể tải chi tiết phiếu nhập");
  } finally {
    loading.value = false;
  }
}

async function confirmImport() {
  if (!window.confirm("Xác nhận nhập kho phiếu này?")) return;

  actionLoading.value = true;
  try {
    const res = await purchaseOrderService.confirmImport(route.params.id);
    importResult.value = res?.data || null;
    purchaseOrder.value = importResult.value?.purchaseOrder || purchaseOrder.value;
    alert(res?.message || "Nhập kho thành công");
  } catch (error) {
    console.error(error);
    alert(error?.response?.data?.message || "Không thể nhập kho");
  } finally {
    actionLoading.value = false;
  }
}

async function cancelOrder() {
  if (!window.confirm("Hủy phiếu nhập này?")) return;

  actionLoading.value = true;
  try {
    const res = await purchaseOrderService.cancel(route.params.id);
    purchaseOrder.value = res?.data || purchaseOrder.value;
    alert(res?.message || "Hủy phiếu nhập thành công");
  } catch (error) {
    console.error(error);
    alert(error?.response?.data?.message || "Không thể hủy phiếu nhập");
  } finally {
    actionLoading.value = false;
  }
}

onMounted(fetchData);
</script>

<template>
  <div class="admin-page">
    <div class="admin-page-title admin-page-title--stack">
      <h1>Chi tiết phiếu nhập</h1>
      <p>Xem snapshot hàng nhập, confirm import và kiểm tra lô/tồn/giao dịch.</p>
    </div>

    <div v-if="loading" class="admin-empty-state">Đang tải phiếu nhập...</div>

    <template v-else-if="purchaseOrder">
      <section class="admin-panel">
        <div class="admin-panel__header admin-panel__header--flex">
          <div>
            <div class="admin-panel__header-title">
              {{ purchaseOrder.purchaseCode || purchaseOrder._id }}
            </div>
            <div class="admin-panel__header-subtitle">
              Tạo ngày {{ formatDate(purchaseOrder.createdAt) }}
            </div>
          </div>
          <div class="purchase-order-detail-actions">
            <button
              class="admin-btn admin-btn--secondary"
              @click="router.push({ name: 'admin-purchase-orders' })"
            >
              Quay lại
            </button>
            <button
              v-if="purchaseOrder.status === 'draft'"
              class="admin-btn admin-btn--success"
              :disabled="actionLoading"
              @click="confirmImport"
            >
              {{ actionLoading ? "Đang nhập..." : "Xác nhận nhập kho" }}
            </button>
            <button
              v-if="purchaseOrder.status === 'draft'"
              class="admin-btn admin-btn--danger"
              :disabled="actionLoading"
              @click="cancelOrder"
            >
              Hủy phiếu
            </button>
            <button
              v-if="canShowInventoryShortcuts"
              class="admin-btn admin-btn--primary"
              @click="goToInventoryRoute('admin-inventory-batches')"
            >
              Xem lô hàng
            </button>
            <button
              v-if="canShowInventoryShortcuts"
              class="admin-btn admin-btn--secondary"
              @click="goToInventoryRoute('admin-inventory-summaries')"
            >
              Xem tồn kho
            </button>
            <button
              v-if="canShowInventoryShortcuts"
              class="admin-btn admin-btn--secondary"
              @click="goToInventoryRoute('admin-inventory-transactions')"
            >
              Xem giao dịch kho
            </button>
          </div>
        </div>

        <div class="admin-panel__body">
          <div class="purchase-order-detail-grid">
            <div class="purchase-order-detail-card">
              <span>Trạng thái</span>
              <strong>
                <span
                  class="admin-badge"
                  :class="statusClass(purchaseOrder.status)"
                >
                  {{ statusText(purchaseOrder.status) }}
                </span>
              </strong>
            </div>
            <div class="purchase-order-detail-card">
              <span>Nhà cung cấp</span>
              <strong>{{ supplier?.name || normalizeId(purchaseOrder.supplierId) || "---" }}</strong>
            </div>
            <div class="purchase-order-detail-card">
              <span>Tổng dòng</span>
              <strong>{{ purchaseItems.length }}</strong>
            </div>
            <div class="purchase-order-detail-card">
              <span>Tổng tiền</span>
              <strong>{{ formatPrice(purchaseOrder.totalAmount) }}</strong>
            </div>
            <div class="purchase-order-detail-card">
              <span>Ngày nhập</span>
              <strong>{{ formatDate(purchaseOrder.importedAt) }}</strong>
            </div>
            <div class="purchase-order-detail-card purchase-order-detail-card--full">
              <span>Ghi chú</span>
              <strong>{{ purchaseOrder.note || "---" }}</strong>
            </div>
          </div>

          <div class="table-responsive mt-3">
            <table class="admin-table admin-table--orders">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Hàng kho</th>
                  <th>Đơn vị</th>
                  <th>Quy cách</th>
                  <th>Số lượng</th>
                  <th>Giá nhập</th>
                  <th>Thành tiền</th>
                  <th>Số lô</th>
                  <th>Hạn dùng</th>
                  <th>Vị trí</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(item, index) in purchaseItems" :key="item._id || index">
                  <td>{{ index + 1 }}</td>
                  <td>
                    <strong>{{ item.itemCode }}</strong>
                    <div class="purchase-order-sub">{{ item.itemName }}</div>
                  </td>
                  <td>{{ item.unit || "---" }}</td>
                  <td>{{ item.packageSize || "---" }}</td>
                  <td>{{ item.quantity }}</td>
                  <td>{{ formatPrice(item.importPrice) }}</td>
                  <td>{{ formatPrice(item.totalPrice) }}</td>
                  <td>{{ item.batchNumber || "---" }}</td>
                  <td>{{ formatDate(item.expiryDate) }}</td>
                  <td>{{ item.warehouseLocation || "---" }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section v-if="importedRows.length" class="admin-panel mt-3">
        <div class="admin-panel__header">
          Kết quả sau confirm import: batch / summary / transaction
        </div>
        <div class="admin-panel__body">
          <div class="table-responsive">
            <table class="admin-table admin-table--orders">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Batch</th>
                  <th>Summary</th>
                  <th>Transaction</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, index) in importedRows" :key="index">
                  <td>{{ index + 1 }}</td>
                  <td>
                    <strong>{{ row.batch?.batchNumber }}</strong>
                    <div class="purchase-order-sub">
                      ID: {{ normalizeId(row.batch?._id) }}
                    </div>
                    <div>SL: {{ row.batch?.quantity }}</div>
                    <div>Hạn: {{ formatDate(row.batch?.expiryDate) }}</div>
                  </td>
                  <td>
                    <strong>{{ row.summary?.itemCode }}</strong>
                    <div>{{ row.summary?.itemName }}</div>
                    <div>Tồn: {{ row.summary?.availableQuantity ?? row.summary?.quantity }}</div>
                    <div>ID: {{ normalizeId(row.summary?._id) }}</div>
                  </td>
                  <td>
                    <strong>{{ row.transaction?.type }}</strong>
                    <div>ID: {{ normalizeId(row.transaction?._id) }}</div>
                    <div>
                      {{ row.transaction?.beforeQuantity }} ->
                      {{ row.transaction?.afterQuantity }}
                    </div>
                    <div>SL: {{ row.transaction?.quantity }}</div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.purchase-order-detail-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.purchase-order-detail-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.purchase-order-detail-card {
  background: #f8fafc;
  border: 1px solid #e8edf3;
  border-radius: 6px;
  display: grid;
  gap: 6px;
  padding: 12px;
}

.purchase-order-detail-card--full {
  grid-column: 1 / -1;
}

.purchase-order-detail-card span {
  color: #7b8794;
  font-size: 12px;
  font-weight: 700;
}

.purchase-order-detail-card strong {
  color: #23364d;
}

.purchase-order-sub {
  color: #7b8794;
  font-size: 12px;
  margin-top: 4px;
}

@media (max-width: 900px) {
  .purchase-order-detail-grid {
    grid-template-columns: 1fr;
  }
}
</style>
