<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRoute } from "vue-router";
import inventoryTransactionService from "@/services/inventory-transaction.service";
import AdminPagination from "@/components/common/AdminPagination.vue";

const route = useRoute();
const transactions = ref([]);
const loading = ref(false);
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
  if (type === "import") return "Import";
  if (type === "export") return "Export";
  if (type === "cancel") return "Cancel";
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
    alert(error?.response?.data?.message || "Khong the tai giao dich kho");
  } finally {
    loading.value = false;
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

onMounted(fetchTransactions);
</script>

<template>
  <div class="admin-page">
    <div class="admin-page-title admin-page-title--stack">
      <h1>Giao dich kho</h1>
      <p>Theo doi import, export va cancel transaction cua inventory.</p>
    </div>

    <div class="admin-stat-row admin-stat-row--orders">
      <div class="admin-stat-card">
        <div class="admin-stat-card__label">Tong giao dich</div>
        <div class="admin-stat-card__value">{{ filteredTransactions.length }}</div>
      </div>
      <div class="admin-stat-card">
        <div class="admin-stat-card__label">Import</div>
        <div class="admin-stat-card__value">{{ importQuantity }}</div>
      </div>
      <div class="admin-stat-card">
        <div class="admin-stat-card__label">Export</div>
        <div class="admin-stat-card__value">{{ exportQuantity }}</div>
      </div>
      <div class="admin-stat-card">
        <div class="admin-stat-card__label">Cancel</div>
        <div class="admin-stat-card__value">{{ cancelQuantity }}</div>
      </div>
    </div>

    <section class="admin-panel">
      <div class="admin-panel__header admin-panel__header--flex">
        <div>
          <div class="admin-panel__header-title">Lich su giao dich</div>
          <div class="admin-panel__header-subtitle">
            Transaction type gom import/export/cancel, khong dung variant.
          </div>
        </div>
        <button class="admin-btn admin-btn--secondary" @click="fetchTransactions">
          Lam moi
        </button>
      </div>

      <div class="admin-panel__body">
        <div class="row admin-toolbar">
          <div class="col-md-5">
            <input
              v-model="filters.keyword"
              type="text"
              class="admin-toolbar__input"
              placeholder="Tim ma hang, ten hang, batch, reference"
            />
          </div>
          <div class="col-md-3">
            <select v-model="filters.type" class="admin-toolbar__select">
              <option value="">Tat ca loai</option>
              <option value="import">Import</option>
              <option value="export">Export</option>
              <option value="cancel">Cancel</option>
            </select>
          </div>
          <div class="col-md-4">
            <input
              v-model="filters.inventoryItemId"
              type="text"
              class="admin-toolbar__input"
              placeholder="Loc theo inventoryItemId"
            />
          </div>
        </div>

        <div v-if="filters.inventoryItemId" class="inventory-filter-chip">
          Dang loc inventoryItemId: <strong>{{ filters.inventoryItemId }}</strong>
        </div>

        <div v-if="loading" class="admin-empty-state">Dang tai giao dich kho...</div>
        <div v-else-if="!filteredTransactions.length" class="admin-empty-state">
          Chua co giao dich phu hop
        </div>

        <div v-else class="table-responsive">
          <table class="admin-table admin-table--orders">
            <thead>
              <tr>
                <th>Loai</th>
                <th>Hang kho</th>
                <th>So luong</th>
                <th>Ton truoc/sau</th>
                <th>Batch</th>
                <th>Reference</th>
                <th>Ghi chu</th>
                <th>Ngay tao</th>
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
