<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRouter } from "vue-router";
import inventorySummaryService from "@/services/inventory-summary.service";
import AdminPagination from "@/components/common/AdminPagination.vue";

const router = useRouter();
const summaries = ref([]);
const loading = ref(false);
const currentPage = ref(1);
const pageSize = ref(12);

const filters = reactive({
  keyword: "",
  stockState: "",
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

    return matchKeyword && matchState;
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

function getAvailableQuantity(item) {
  return Number(item.availableQuantity ?? item.quantity ?? 0);
}

function stockClass(item) {
  if (getAvailableQuantity(item) <= 0) return "admin-badge--danger";
  if (Number(item.lockedQuantity || 0) > 0) return "admin-badge--warning";
  return "admin-badge--success";
}

function stockText(item) {
  if (getAvailableQuantity(item) <= 0) return "Het hang";
  if (Number(item.lockedQuantity || 0) > 0) return "Co khoa";
  return "Con hang";
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
    alert(error?.response?.data?.message || "Khong the tai ton kho tong");
  } finally {
    loading.value = false;
  }
}

watch(
  () => [filters.keyword, filters.stockState],
  () => {
    currentPage.value = 1;
  },
);

watch(filteredSummaries, (list) => {
  const maxPage = Math.max(1, Math.ceil(list.length / pageSize.value));
  if (currentPage.value > maxPage) currentPage.value = maxPage;
});

onMounted(fetchSummaries);
</script>

<template>
  <div class="admin-page">
    <div class="admin-page-title admin-page-title--stack">
      <h1>Ton kho tong</h1>
      <p>Tong hop ton theo inventory item, dung de doi chieu batch va giao dich kho.</p>
    </div>

    <div class="admin-stat-row admin-stat-row--orders">
      <div class="admin-stat-card">
        <div class="admin-stat-card__label">Tong item</div>
        <div class="admin-stat-card__value">{{ filteredSummaries.length }}</div>
      </div>
      <div class="admin-stat-card">
        <div class="admin-stat-card__label">Tong ton</div>
        <div class="admin-stat-card__value">{{ totalQuantity }}</div>
      </div>
      <div class="admin-stat-card">
        <div class="admin-stat-card__label">Co san</div>
        <div class="admin-stat-card__value">{{ totalAvailable }}</div>
      </div>
      <div class="admin-stat-card">
        <div class="admin-stat-card__label">Dang khoa</div>
        <div class="admin-stat-card__value">{{ totalLocked }}</div>
      </div>
    </div>

    <section class="admin-panel">
      <div class="admin-panel__header admin-panel__header--flex">
        <div>
          <div class="admin-panel__header-title">Danh sach ton kho</div>
          <div class="admin-panel__header-subtitle">
            Khong su dung pagination backend; loc va chia trang tai frontend.
          </div>
        </div>
        <button class="admin-btn admin-btn--secondary" @click="fetchSummaries">
          Lam moi
        </button>
      </div>

      <div class="admin-panel__body">
        <div class="row admin-toolbar">
          <div class="col-md-8">
            <input
              v-model="filters.keyword"
              type="text"
              class="admin-toolbar__input"
              placeholder="Tim ma hang, ten hang, don vi, inventoryItemId"
            />
          </div>
          <div class="col-md-4">
            <select v-model="filters.stockState" class="admin-toolbar__select">
              <option value="">Tat ca tinh trang</option>
              <option value="available">Con hang</option>
              <option value="empty">Het hang</option>
              <option value="locked">Co ton dang khoa</option>
            </select>
          </div>
        </div>

        <div v-if="loading" class="admin-empty-state">Dang tai ton kho...</div>
        <div v-else-if="!filteredSummaries.length" class="admin-empty-state">
          Chua co ton kho phu hop
        </div>

        <div v-else class="table-responsive">
          <table class="admin-table admin-table--orders">
            <thead>
              <tr>
                <th>Hang kho</th>
                <th>Tong ton</th>
                <th>Co san</th>
                <th>Dang khoa</th>
                <th>Het han</th>
                <th>Tinh trang</th>
                <th>Cap nhat</th>
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
                      Xem lo
                    </button>
                    <button class="admin-btn admin-btn--secondary" @click="goToTransactions(item)">
                      Giao dich
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
</style>
