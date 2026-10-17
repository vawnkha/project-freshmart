<script setup>
import { normalizeId } from "@/utils/id.util";
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import inventorySummaryService from "@/services/inventory-summary.service";
import inventoryItemService from "@/services/inventory-item.service";
import AdminPagination from "@/components/common/AdminPagination.vue";

const route = useRoute();
const router = useRouter();
const summaries = ref([]);
const inventoryItems = ref([]);
const loading = ref(false);
const itemLoading = ref(false);
const currentPage = ref(1);
const pageSize = ref(12);

const filters = reactive({
  keyword: "",
  stockState: "",
  inventoryItemId: "",
});

const filteredSummaries = computed(() => {
  const q = filters.keyword.trim().toLowerCase();

  return summaries.value.filter((item) => {
    const available = getAvailableQuantity(item);
    const locked = Number(item.lockedQuantity || 0);
    const matchKeyword =
      !q ||
      [item.itemCode, item.itemName, item.unit, normalizeId(item.inventoryItemId)]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));

    const matchState =
      !filters.stockState ||
      (filters.stockState === "available" && available > 0) ||
      (filters.stockState === "empty" && available <= 0) ||
      (filters.stockState === "locked" && locked > 0);
    const matchItem =
      !filters.inventoryItemId ||
      normalizeId(item.inventoryItemId) === filters.inventoryItemId;

    return matchKeyword && matchState && matchItem;
  });
});

const paginatedSummaries = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return filteredSummaries.value.slice(start, start + pageSize.value);
});

const totalQuantity = computed(() =>
  filteredSummaries.value.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
);

const totalAvailable = computed(() =>
  filteredSummaries.value.reduce(
    (sum, item) => sum + Number(getAvailableQuantity(item) || 0),
    0,
  ),
);

const totalLocked = computed(() =>
  filteredSummaries.value.reduce(
    (sum, item) => sum + Number(item.lockedQuantity || 0),
    0,
  ),
);

function normalizeList(res) {
  return Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
}

function getId(item) {
  return item?._id || item?.id || "";
}

function formatDate(value) {
  if (!value) return "---";
  return new Date(value).toLocaleString("vi-VN");
}

function getAvailableQuantity(item) {
  return Number(item.availableQuantity ?? item.quantity ?? 0);
}

function stockClass(item) {
  if (getAvailableQuantity(item) <= 0) return "admin-badge--danger";
  if (Number(item.lockedQuantity || 0) > 0) return "admin-badge--warning";
  return "admin-badge--success";
}

function stockText(item) {
  if (getAvailableQuantity(item) <= 0) return "Hết hàng";
  if (Number(item.lockedQuantity || 0) > 0) return "Có khóa";
  return "Còn hàng";
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

function goToBatches(item) {
  router.push({
    name: "admin-inventory-batches",
    query: { inventoryItemId: normalizeId(item.inventoryItemId) },
  });
}

function goToTransactions(item) {
  router.push({
    name: "admin-inventory-transactions",
    query: { inventoryItemId: normalizeId(item.inventoryItemId) },
  });
}

async function fetchSummaries() {
  loading.value = true;
  try {
    const res = await inventorySummaryService.getAll();
    summaries.value = normalizeList(res);
  } catch (error) {
    console.error(error);
    alert(error?.response?.data?.message || "Không thể tải tồn kho tổng");
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

function syncQueryFilter() {
  const itemId = route.query.inventoryItemId;
  filters.inventoryItemId = typeof itemId === "string" ? itemId : "";
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
  () => [filters.keyword, filters.stockState, filters.inventoryItemId],
  () => {
    currentPage.value = 1;
  },
);

watch(filteredSummaries, (list) => {
  const maxPage = Math.max(1, Math.ceil(list.length / pageSize.value));
  if (currentPage.value > maxPage) currentPage.value = maxPage;
});

onMounted(() => {
  fetchSummaries();
  fetchInventoryItems();
});
</script>

<template>
  <div class="admin-page">
    <div class="admin-page-title admin-page-title--stack">
      <h1>Tồn kho tổng</h1>
      <p>Tổng hợp tồn theo inventory item, dùng để đối chiếu batch và giao dịch kho.</p>
    </div>

    <div class="admin-stat-row admin-stat-row--orders">
      <div class="admin-stat-card">
        <div class="admin-stat-card__label">Tổng item</div>
        <div class="admin-stat-card__value">{{ filteredSummaries.length }}</div>
      </div>
      <div class="admin-stat-card">
        <div class="admin-stat-card__label">Tổng tồn</div>
        <div class="admin-stat-card__value">{{ totalQuantity }}</div>
      </div>
      <div class="admin-stat-card">
        <div class="admin-stat-card__label">Có sẵn</div>
        <div class="admin-stat-card__value">{{ totalAvailable }}</div>
      </div>
      <div class="admin-stat-card">
        <div class="admin-stat-card__label">Đang khóa</div>
        <div class="admin-stat-card__value">{{ totalLocked }}</div>
      </div>
    </div>

    <section class="admin-panel">
      <div class="admin-panel__header admin-panel__header--flex">
        <div>
          <div class="admin-panel__header-title">Danh sách tồn kho</div>
        </div>
        <button class="admin-btn admin-btn--secondary" @click="fetchSummaries">
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
              placeholder="Tìm mã hàng, tên hàng, đơn vị"
            />
          </div>
          <div class="col-md-3">
            <select v-model="filters.stockState" class="admin-toolbar__select">
              <option value="">Tất cả tình trạng</option>
              <option value="available">Còn hàng</option>
              <option value="empty">Hết hàng</option>
              <option value="locked">Có tồn đang khóa</option>
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

        <div v-if="loading" class="admin-empty-state">Đang tải tồn kho...</div>
        <div v-else-if="!filteredSummaries.length" class="admin-empty-state">
          Chưa có tồn kho phù hợp
        </div>

        <div v-else class="table-responsive">
          <table class="admin-table admin-table--orders">
            <thead>
              <tr>
                <th>Hàng kho</th>
                <th>Tổng tồn</th>
                <th>Có sẵn</th>
                <th>Đang khóa</th>
                <th>Hết hạn</th>
                <th>Tình trạng</th>
                <th>Cập nhật</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in paginatedSummaries" :key="getId(item)">
                <td>
                  <strong>{{ item.itemCode || "---" }}</strong>
                  <div class="inventory-sub">{{ item.itemName || "---" }}</div>
                  <div class="inventory-sub">Item: {{ normalizeId(item.inventoryItemId) }}</div>
                </td>
                <td>{{ item.quantity || 0 }} {{ item.unit || "" }}</td>
                <td>{{ getAvailableQuantity(item) }} {{ item.unit || "" }}</td>
                <td>{{ item.lockedQuantity || 0 }} {{ item.unit || "" }}</td>
                <td>{{ item.expiredQuantity || 0 }} {{ item.unit || "" }}</td>
                <td>
                  <span class="admin-badge" :class="stockClass(item)">
                    {{ stockText(item) }}
                  </span>
                </td>
                <td>{{ formatDate(item.updatedAt) }}</td>
                <td>
                  <div class="admin-action-stack admin-action-stack--row">
                    <button class="admin-btn admin-btn--primary" @click="goToBatches(item)">
                      Xem lô
                    </button>
                    <button class="admin-btn admin-btn--secondary" @click="goToTransactions(item)">
                      Giao dịch
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          <AdminPagination
            v-model="currentPage"
            :total-items="filteredSummaries.length"
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
