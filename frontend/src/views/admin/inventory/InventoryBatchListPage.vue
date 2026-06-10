<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRoute } from "vue-router";
import inventoryBatchService from "@/services/inventory-batch.service";
import inventoryItemService from "@/services/inventory-item.service";
import AdminPagination from "@/components/common/AdminPagination.vue";

const route = useRoute();
const batches = ref([]);
const inventoryItems = ref([]);
const loading = ref(false);
const itemLoading = ref(false);
const actionLoadingId = ref("");
const currentPage = ref(1);
const pageSize = ref(12);

const filters = reactive({
  keyword: "",
  status: "",
  inventoryItemId: "",
});

const filteredBatches = computed(() => {
  const q = filters.keyword.trim().toLowerCase();

  return batches.value.filter((item) => {
    const matchKeyword =
      !q ||
      [
        item.batchNumber,
        item.itemCode,
        item.itemName,
        item.warehouseLocation,
        item.note,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));

    const matchStatus = !filters.status || item.status === filters.status;
    const matchItem =
      !filters.inventoryItemId ||
      normalizeId(item.inventoryItemId) === filters.inventoryItemId;

    return matchKeyword && matchStatus && matchItem;
  });
});

const paginatedBatches = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return filteredBatches.value.slice(start, start + pageSize.value);
});

const totalQuantity = computed(() =>
  filteredBatches.value.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
);

const availableCount = computed(
  () => filteredBatches.value.filter((item) => item.status === "available").length,
);

const lockedCount = computed(
  () => filteredBatches.value.filter((item) => item.status === "locked").length,
);

const soldOutCount = computed(
  () => filteredBatches.value.filter((item) => item.status === "sold_out").length,
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

function formatDate(value) {
  if (!value) return "---";
  return new Date(value).toLocaleString("vi-VN");
}

function formatPrice(value) {
  return Number(value || 0).toLocaleString("vi-VN") + " VND";
}

function statusText(status) {
  if (status === "available") return "Có sẵn";
  if (status === "locked") return "Đang khóa";
  if (status === "sold_out") return "Hết hàng";
  return status || "---";
}

function itemOptionLabel(item) {
  return [item.itemCode, item.itemName].filter(Boolean).join(" - ") || getId(item);
}

function selectedInventoryItemLabel() {
  const item = inventoryItems.value.find(
    (entry) => getId(entry) === filters.inventoryItemId,
  );
  return item ? itemOptionLabel(item) : filters.inventoryItemId;
}

function statusClass(status) {
  if (status === "available") return "admin-badge--success";
  if (status === "locked") return "admin-badge--warning";
  if (status === "sold_out") return "admin-badge--danger";
  return "admin-badge--info";
}

function syncQueryFilter() {
  const itemId = route.query.inventoryItemId;
  filters.inventoryItemId = typeof itemId === "string" ? itemId : "";
}

async function fetchBatches() {
  loading.value = true;
  try {
    const res = await inventoryBatchService.getAll();
    batches.value = normalizeList(res);
  } catch (error) {
    console.error(error);
    alert(error?.response?.data?.message || "Không thể tải lô hàng");
  } finally {
    loading.value = false;
  }
}

async function fetchInventoryItems() {
  itemLoading.value = true;
  try {
    const res = await inventoryItemService.getAll();
    inventoryItems.value = normalizeList(res);
  } catch (error) {
    console.error(error);
    inventoryItems.value = [];
  } finally {
    itemLoading.value = false;
  }
}

async function lockBatch(item) {
  if (!window.confirm("Khóa lô hàng này?")) return;

  actionLoadingId.value = getId(item);
  try {
    await inventoryBatchService.lock(getId(item));
    await fetchBatches();
    alert("Khóa lô hàng thành công");
  } catch (error) {
    console.error(error);
    alert(error?.response?.data?.message || "Không thể khóa lô hàng");
  } finally {
    actionLoadingId.value = "";
  }
}

async function unlockBatch(item) {
  if (!window.confirm("Mở khóa lô hàng này?")) return;

  actionLoadingId.value = getId(item);
  try {
    await inventoryBatchService.unlock(getId(item));
    await fetchBatches();
    alert("Mở khóa lô hàng thành công");
  } catch (error) {
    console.error(error);
    alert(error?.response?.data?.message || "Không thể mở khóa lô hàng");
  } finally {
    actionLoadingId.value = "";
  }
}

watch(
  () => route.query.inventoryItemId,
  () => {
    syncQueryFilter();
    currentPage.value = 1;
  },
  { immediate: true },
);

watch(
  () => [filters.keyword, filters.status, filters.inventoryItemId],
  () => {
    currentPage.value = 1;
  },
);

watch(filteredBatches, (list) => {
  const maxPage = Math.max(1, Math.ceil(list.length / pageSize.value));
  if (currentPage.value > maxPage) currentPage.value = maxPage;
});

onMounted(() => {
  fetchBatches();
  fetchInventoryItems();
});
</script>

<template>
  <div class="admin-page">
    <div class="admin-page-title admin-page-title--stack">
      <h1>Lô hàng</h1>
      <p>Theo dõi batch theo FEFO, hạn dùng và trạng thái khóa/mở khóa.</p>
    </div>

    <div class="admin-stat-row admin-stat-row--orders">
      <div class="admin-stat-card">
        <div class="admin-stat-card__label">Tổng lô</div>
        <div class="admin-stat-card__value">{{ filteredBatches.length }}</div>
      </div>
      <div class="admin-stat-card">
        <div class="admin-stat-card__label">Có sẵn</div>
        <div class="admin-stat-card__value">{{ availableCount }}</div>
      </div>
      <div class="admin-stat-card">
        <div class="admin-stat-card__label">Đang khóa</div>
        <div class="admin-stat-card__value">{{ lockedCount }}</div>
      </div>
      <div class="admin-stat-card">
        <div class="admin-stat-card__label">Tổng SL</div>
        <div class="admin-stat-card__value">{{ totalQuantity }}</div>
      </div>
    </div>

    <section class="admin-panel">
      <div class="admin-panel__header admin-panel__header--flex">
        <div>
          <div class="admin-panel__header-title">Danh sách lô hàng</div>
          <div class="admin-panel__header-subtitle">
            Load toàn bộ dữ liệu và lọc/phân trang tại frontend.
          </div>
        </div>
        <button class="admin-btn admin-btn--secondary" @click="fetchBatches">
          Làm mới
        </button>
      </div>

      <div class="admin-panel__body">
        <div class="row admin-toolbar">
          <div class="col-md-5">
            <input
              v-model="filters.keyword"
              type="text"
              class="admin-toolbar__input"
              placeholder="Tìm mã lô, mã hàng, tên hàng, vị trí"
            />
          </div>
          <div class="col-md-3">
            <select v-model="filters.status" class="admin-toolbar__select">
              <option value="">Tất cả trạng thái</option>
              <option value="available">Có sẵn</option>
              <option value="locked">Đang khóa</option>
              <option value="sold_out">Hết hàng</option>
            </select>
          </div>
          <div class="col-md-4">
            <select
              v-model="filters.inventoryItemId"
              class="admin-toolbar__select"
              :disabled="itemLoading"
            >
              <option value="">Tất cả hàng kho</option>
              <option
                v-for="item in inventoryItems"
                :key="getId(item)"
                :value="getId(item)"
              >
                {{ itemOptionLabel(item) }}
              </option>
            </select>
          </div>
        </div>

        <div v-if="filters.inventoryItemId" class="inventory-filter-chip">
          Đang lọc hàng kho: <strong>{{ selectedInventoryItemLabel() }}</strong>
        </div>

        <div v-if="loading" class="admin-empty-state">Đang tải lô hàng...</div>
        <div v-else-if="!filteredBatches.length" class="admin-empty-state">
          Chưa có lô hàng phù hợp
        </div>

        <div v-else class="table-responsive">
          <table class="admin-table admin-table--orders">
            <thead>
              <tr>
                <th>Lô</th>
                <th>Hàng kho</th>
                <th>Số lượng</th>
                <th>Giá nhập</th>
                <th>Hạn dùng</th>
                <th>Vị trí</th>
                <th>Trạng thái</th>
                <th>Ngày tạo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in paginatedBatches" :key="getId(item)">
                <td>
                  <strong>{{ item.batchNumber || getId(item) }}</strong>
                  <div class="inventory-sub">ID: {{ getId(item) }}</div>
                </td>
                <td>
                  <strong>{{ item.itemCode || "---" }}</strong>
                  <div class="inventory-sub">{{ item.itemName || "---" }}</div>
                  <div class="inventory-sub">Item: {{ normalizeId(item.inventoryItemId) || "---" }}</div>
                </td>
                <td>{{ item.quantity || 0 }} {{ item.unit || "" }}</td>
                <td>{{ formatPrice(item.importPrice) }}</td>
                <td>{{ formatDate(item.expiryDate) }}</td>
                <td>{{ item.warehouseLocation || "---" }}</td>
                <td>
                  <span class="admin-badge" :class="statusClass(item.status)">
                    {{ statusText(item.status) }}
                  </span>
                </td>
                <td>{{ formatDate(item.createdAt) }}</td>
                <td>
                  <div class="admin-action-stack admin-action-stack--row">
                    <button
                      v-if="item.status === 'locked'"
                      class="admin-btn admin-btn--success"
                      :disabled="actionLoadingId === getId(item)"
                      @click="unlockBatch(item)"
                    >
                      Mở khóa
                    </button>
                    <button
                      v-else-if="item.status !== 'sold_out'"
                      class="admin-btn admin-btn--warning"
                      :disabled="actionLoadingId === getId(item)"
                      @click="lockBatch(item)"
                    >
                      Khóa
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          <AdminPagination
            v-model="currentPage"
            :total-items="filteredBatches.length"
            :page-size="pageSize"
          />
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.inventory-sub {
  color: #7b8794;
  font-size: 12px;
  margin-top: 4px;
  max-width: 260px;
}

.inventory-filter-chip {
  background: #eef6ff;
  border: 1px solid #cfe5ff;
  border-radius: 6px;
  color: #255d91;
  font-size: 13px;
  margin: 0 0 14px;
  padding: 8px 10px;
}
</style>
