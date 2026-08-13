<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRoute } from "vue-router";
import inventoryTransactionService from "@/services/inventory-transaction.service";
import inventoryItemService from "@/services/inventory-item.service";
import AdminPagination from "@/components/common/AdminPagination.vue";

const route = useRoute();
const transactions = ref([]);
const inventoryItems = ref([]);
const loading = ref(false);
const itemLoading = ref(false);
const currentPage = ref(1);
const pageSize = ref(12);

const filters = reactive({
  keyword: "",
  type: "",
  inventoryItemId: "",
});

const filteredTransactions = computed(() => {
  const q = filters.keyword.trim().toLowerCase();

  return transactions.value.filter((item) => {
    const referenceText = formatReference(item.reference);
    const matchKeyword =
      !q ||
      [
        item.itemCode,
        item.itemName,
        item.batchNumber,
        item.note,
        referenceText,
        normalizeId(item.batchId),
        normalizeId(item.inventoryItemId),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));

    const matchType = !filters.type || item.type === filters.type;
    const matchItem =
      !filters.inventoryItemId ||
      normalizeId(item.inventoryItemId) === filters.inventoryItemId;

    return matchKeyword && matchType && matchItem;
  });
});

const paginatedTransactions = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return filteredTransactions.value.slice(start, start + pageSize.value);
});

const importQuantity = computed(() =>
  filteredTransactions.value
    .filter((item) => item.type === "import")
    .reduce((sum, item) => sum + Number(item.quantity || 0), 0),
);

const exportQuantity = computed(() =>
  filteredTransactions.value
    .filter((item) => item.type === "export")
    .reduce((sum, item) => sum + Number(item.quantity || 0), 0),
);

const cancelQuantity = computed(() =>
  filteredTransactions.value
    .filter((item) => item.type === "cancel")
    .reduce((sum, item) => sum + Number(item.quantity || 0), 0),
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

function typeText(type) {
  if (type === "import") return "Nhập kho";
  if (type === "export") return "Xuất kho";
  if (type === "cancel") return "Hoàn kho";
  return type || "---";
}

function typeClass(type) {
  if (type === "import") return "admin-badge--success";
  if (type === "export") return "admin-badge--primary";
  if (type === "cancel") return "admin-badge--warning";
  return "admin-badge--info";
}

function formatReference(reference) {
  if (!reference) return "---";
  if (typeof reference === "string") return reference;

  const type = reference.type || "reference";
  const code = reference.code || reference.orderCode || reference.purchaseCode;
  const id = normalizeId(reference.id || reference.orderId || reference.purchaseOrderId);
  return [type, code, id].filter(Boolean).join(" / ");
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

function syncQueryFilter() {
  const itemId = route.query.inventoryItemId;
  filters.inventoryItemId = typeof itemId === "string" ? itemId : "";
}

async function fetchTransactions() {
  loading.value = true;
  try {
    const res = await inventoryTransactionService.getAll();
    transactions.value = normalizeList(res);
  } catch (error) {
    console.error(error);
    alert(error?.response?.data?.message || "Không thể tải giao dịch kho");
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

watch(
  () => route.query.inventoryItemId,
  () => {
    syncQueryFilter();
    currentPage.value = 1;
  },
  { immediate: true },
);

watch(
  () => [filters.keyword, filters.type, filters.inventoryItemId],
  () => {
    currentPage.value = 1;
  },
);

watch(filteredTransactions, (list) => {
  const maxPage = Math.max(1, Math.ceil(list.length / pageSize.value));
  if (currentPage.value > maxPage) currentPage.value = maxPage;
});

onMounted(() => {
  fetchTransactions();
  fetchInventoryItems();
});
</script>

<template>
  <div class="admin-page">
    <div class="admin-page-title admin-page-title--stack">
      <h1>Giao dịch kho</h1>
      <p>Theo dõi nhập kho, xuất kho và hoàn kho của inventory.</p>
    </div>

    <div class="admin-stat-row admin-stat-row--orders">
      <div class="admin-stat-card">
        <div class="admin-stat-card__label">Tổng giao dịch</div>
        <div class="admin-stat-card__value">{{ filteredTransactions.length }}</div>
      </div>
      <div class="admin-stat-card">
        <div class="admin-stat-card__label">Nhập kho</div>
        <div class="admin-stat-card__value">{{ importQuantity }}</div>
      </div>
      <div class="admin-stat-card">
        <div class="admin-stat-card__label">Xuất kho</div>
        <div class="admin-stat-card__value">{{ exportQuantity }}</div>
      </div>
      <div class="admin-stat-card">
        <div class="admin-stat-card__label">Hoàn kho</div>
        <div class="admin-stat-card__value">{{ cancelQuantity }}</div>
      </div>
    </div>

    <section class="admin-panel">
      <div class="admin-panel__header admin-panel__header--flex">
        <div>
          <div class="admin-panel__header-title">Lịch sử giao dịch</div>
          <!-- <div class="admin-panel__header-subtitle">
            Transaction type gồm import/export/cancel, không dùng variant.
          </div> -->
        </div>
        <button class="admin-btn admin-btn--secondary" @click="fetchTransactions">
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
              placeholder="Tìm mã hàng, tên hàng, batch, reference"
            />
          </div>
          <div class="col-md-3">
            <select v-model="filters.type" class="admin-toolbar__select">
              <option value="">Tất cả loại</option>
              <option value="import">Nhập kho</option>
              <option value="export">Xuất kho</option>
              <option value="cancel">Hoàn kho</option>
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

        <div v-if="loading" class="admin-empty-state">Đang tải giao dịch kho...</div>
        <div v-else-if="!filteredTransactions.length" class="admin-empty-state">
          Chưa có giao dịch phù hợp
        </div>

        <div v-else class="table-responsive">
          <table class="admin-table admin-table--orders">
            <thead>
              <tr>
                <th>Loại</th>
                <th>Hàng kho</th>
                <th>Số lượng</th>
                <th>Tồn trước/sau</th>
                <th>Batch</th>
                <th>Reference</th>
                <th>Ghi chú</th>
                <th>Ngày tạo</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in paginatedTransactions" :key="getId(item)">
                <td>
                  <span class="admin-badge" :class="typeClass(item.type)">
                    {{ typeText(item.type) }}
                  </span>
                </td>
                <td>
                  <strong>{{ item.itemCode || "---" }}</strong>
                  <div class="inventory-sub">{{ item.itemName || "---" }}</div>
                  <div class="inventory-sub">Item: {{ normalizeId(item.inventoryItemId) }}</div>
                </td>
                <td>{{ item.quantity || 0 }}</td>
                <td>{{ item.beforeQuantity || 0 }} -> {{ item.afterQuantity || 0 }}</td>
                <td>
                  <strong>{{ item.batchNumber || "---" }}</strong>
                  <div class="inventory-sub">{{ normalizeId(item.batchId) || "---" }}</div>
                </td>
                <td>{{ formatReference(item.reference) }}</td>
                <td>{{ item.note || "---" }}</td>
                <td>{{ formatDate(item.createdAt) }}</td>
              </tr>
            </tbody>
          </table>

          <AdminPagination
            v-model="currentPage"
            :total-items="filteredTransactions.length"
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
