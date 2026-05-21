<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRouter } from "vue-router";
import purchaseOrderService from "@/services/purchase-order.service";
import supplierService from "@/services/supplier.service";
import AdminPagination from "@/components/common/AdminPagination.vue";

const router = useRouter();
const purchaseOrders = ref([]);
const suppliers = ref([]);
const loading = ref(false);
const actionLoadingId = ref("");
const currentPage = ref(1);
const pageSize = ref(12);

const filters = reactive({
  keyword: "",
  status: "",
  supplierId: "",
});

const filteredOrders = computed(() => {
  const q = filters.keyword.trim().toLowerCase();

  return purchaseOrders.value.filter((item) => {
    const supplierName = getSupplierName(item.supplierId);
    const matchKeyword =
      !q ||
      [
        item.purchaseCode,
        item.note,
        supplierName,
        ...(item.items || []).flatMap((sub) => [
          sub.itemCode,
          sub.itemName,
          sub.batchNumber,
        ]),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));

    const matchStatus = !filters.status || item.status === filters.status;
    const matchSupplier =
      !filters.supplierId || normalizeId(item.supplierId) === filters.supplierId;

    return matchKeyword && matchStatus && matchSupplier;
  });
});

const paginatedOrders = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return filteredOrders.value.slice(start, start + pageSize.value);
});

const totalAmount = computed(() =>
  filteredOrders.value.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0),
);
const draftCount = computed(
  () => filteredOrders.value.filter((item) => item.status === "draft").length,
);
const importedCount = computed(
  () => filteredOrders.value.filter((item) => item.status === "imported").length,
);
const cancelledCount = computed(
  () => filteredOrders.value.filter((item) => item.status === "cancelled").length,
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

function getSupplierName(id) {
  const supplier = suppliers.value.find((item) => getId(item) === normalizeId(id));
  return supplier?.name || normalizeId(id) || "---";
}

function formatPrice(value) {
  return Number(value || 0).toLocaleString("vi-VN") + " VND";
}

function formatDate(value) {
  if (!value) return "---";
  return new Date(value).toLocaleString("vi-VN");
}

function statusText(status) {
  if (status === "draft") return "Nhap nhap";
  if (status === "imported") return "Da nhap kho";
  if (status === "cancelled") return "Da huy";
  return status || "---";
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
      purchaseOrderService.getAll(),
      supplierService.getAll(),
    ]);

    purchaseOrders.value = normalizeList(orderRes);
    suppliers.value = normalizeList(supplierRes);
  } catch (error) {
    console.error(error);
    alert(error?.response?.data?.message || "Khong the tai phieu nhap");
  } finally {
    loading.value = false;
  }
}

async function confirmImport(item) {
  if (!window.confirm("Xac nhan nhap kho phieu nay?")) return;

  actionLoadingId.value = getId(item);
  try {
    await purchaseOrderService.confirmImport(getId(item));
    await fetchData();
    alert("Nhap kho thanh cong");
  } catch (error) {
    console.error(error);
    alert(error?.response?.data?.message || "Khong the nhap kho");
  } finally {
    actionLoadingId.value = "";
  }
}

async function cancelOrder(item) {
  if (!window.confirm("Huy phieu nhap nay?")) return;

  actionLoadingId.value = getId(item);
  try {
    await purchaseOrderService.cancel(getId(item));
    await fetchData();
    alert("Huy phieu nhap thanh cong");
  } catch (error) {
    console.error(error);
    alert(error?.response?.data?.message || "Khong the huy phieu nhap");
  } finally {
    actionLoadingId.value = "";
  }
}

watch(
  () => [filters.keyword, filters.status, filters.supplierId],
  () => {
    currentPage.value = 1;
  },
);

watch(filteredOrders, (list) => {
  const maxPage = Math.max(1, Math.ceil(list.length / pageSize.value));
  if (currentPage.value > maxPage) currentPage.value = maxPage;
});

onMounted(fetchData);
</script>

<template>
  <div class="admin-page">
    <div class="admin-page-title admin-page-title--stack">
      <h1>Phiếu nhập kho</h1>
      <p>Quản lý phiếu nhập, xác nhận nhập kho và theo dõi tổng tiền nhập.</p>
    </div>

    <div class="admin-stat-row admin-stat-row--orders">
      <div class="admin-stat-card">
        <div class="admin-stat-card__label">Tổng phiếu</div>
        <div class="admin-stat-card__value">{{ filteredOrders.length }}</div>
      </div>
      <div class="admin-stat-card">
        <div class="admin-stat-card__label">Nháp</div>
        <div class="admin-stat-card__value">{{ draftCount }}</div>
      </div>
      <div class="admin-stat-card">
        <div class="admin-stat-card__label">Đã nhập</div>
        <div class="admin-stat-card__value">{{ importedCount }}</div>
      </div>
      <div class="admin-stat-card">
        <div class="admin-stat-card__label">Tổng tiền</div>
        <div class="admin-stat-card__value">{{ formatPrice(totalAmount) }}</div>
      </div>
    </div>

    <section class="admin-panel">
      <div class="admin-panel__header admin-panel__header--flex">
        <div>
          <div class="admin-panel__header-title">Danh sách phiếu nhập</div>
          <div class="admin-panel__header-subtitle">
            Dữ liệu được tải toàn bộ từ backend và lọc/phân trang ở frontend.
          </div>
        </div>
        <div class="purchase-order-actions">
          <button class="admin-btn admin-btn--secondary" @click="fetchData">
            Làm mới
          </button>
          <button
            class="admin-btn admin-btn--primary"
            @click="router.push({ name: 'admin-purchase-order-create' })"
          >
            <i class="fa-solid fa-plus me-1"></i>
            Tạo phiếu nhập
          </button>
        </div>
      </div>

      <div class="admin-panel__body">
        <div class="row admin-toolbar">
          <div class="col-md-5 col-lg-5">
            <input
              v-model="filters.keyword"
              type="text"
              class="admin-toolbar__input"
              placeholder="Tìm mã phiếu, hàng, lô, nhà cung cấp"
            />
          </div>
          <div class="col-md-3 col-lg-3">
            <select v-model="filters.status" class="admin-toolbar__select">
              <option value="">Tất cả trạng thái</option>
              <option value="draft">Nháp</option>
              <option value="imported">Đã nhập kho</option>
              <option value="cancelled">Đã hủy</option>
            </select>
          </div>
          <div class="col-md-4 col-lg-4">
            <select v-model="filters.supplierId" class="admin-toolbar__select">
              <option value="">Tất cả nhà cung cấp</option>
              <option v-for="supplier in suppliers" :key="getId(supplier)" :value="getId(supplier)">
                {{ supplier.name }}
              </option>
            </select>
          </div>
        </div>

        <div v-if="loading" class="admin-empty-state">Đang tải phiếu nhập...</div>
        <div v-else-if="!filteredOrders.length" class="admin-empty-state">
          Chưa có phiếu nhập phù hợp
        </div>

        <div v-else class="table-responsive">
          <table class="admin-table admin-table--orders">
            <thead>
              <tr>
                <th>Mã phiếu</th>
                <th>Nhà cung cấp</th>
                <th>Số dòng</th>
                <th>Tổng tiền</th>
                <th>Trạng thái</th>
                <th>Ngày tạo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in paginatedOrders" :key="getId(item)">
                <td>
                  <strong>{{ item.purchaseCode || getId(item) }}</strong>
                  <div class="purchase-order-sub">{{ item.note || "---" }}</div>
                </td>
                <td>{{ getSupplierName(item.supplierId) }}</td>
                <td>{{ item.items?.length || 0 }}</td>
                <td class="admin-price-cell">{{ formatPrice(item.totalAmount) }}</td>
                <td>
                  <span class="admin-badge" :class="statusClass(item.status)">
                    {{ statusText(item.status) }}
                  </span>
                </td>
                <td>{{ formatDate(item.createdAt) }}</td>
                <td>
                  <div class="admin-action-stack admin-action-stack--row">
                    <button
                      class="admin-btn admin-btn--primary"
                      @click="
                        router.push({
                          name: 'admin-purchase-order-detail',
                          params: { id: getId(item) },
                        })
                      "
                    >
                      Chi tiết
                    </button>
                    <button
                      v-if="item.status === 'draft'"
                      class="admin-btn admin-btn--success"
                      :disabled="actionLoadingId === getId(item)"
                      @click="confirmImport(item)"
                    >
                      Nhập kho
                    </button>
                    <button
                      v-if="item.status === 'draft'"
                      class="admin-btn admin-btn--danger"
                      :disabled="actionLoadingId === getId(item)"
                      @click="cancelOrder(item)"
                    >
                      Hủy
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
  </div>
</template>

<style scoped>
.purchase-order-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.purchase-order-sub {
  color: #7b8794;
  font-size: 12px;
  margin-top: 4px;
  max-width: 260px;
}
</style>
