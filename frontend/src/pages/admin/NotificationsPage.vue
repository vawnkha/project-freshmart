<script setup>
import { computed, onMounted, reactive, watch } from "vue";
import { useRouter } from "vue-router";
import { useAdminNotificationStore } from "@/stores/admin/notification";
import AdminPagination from "@/components/common/AdminPagination.vue";

const router = useRouter();
const notificationStore = useAdminNotificationStore();

const filters = reactive({
  keyword: "",
  type: "",
  is_read: "",
});

function formatTime(value) {
  if (!value) return "---";
  return new Date(value).toLocaleString("vi-VN");
}

function iconByType(type) {
  if (type === "order") return "fa-cart-shopping";
  if (type === "contact") return "fa-envelope";
  return "fa-bell";
}

const notifications = computed(() => {
  const start = (notificationStore.currentPage - 1) * notificationStore.pageSize;
  return notificationStore.items.slice(start, start + notificationStore.pageSize);
});
const selectedIds = computed(() => notificationStore.selectedIds);

const isAllCurrentPageSelected = computed(() => {
  if (!notifications.value.length) return false;
  return notifications.value.every((item) =>
    selectedIds.value.includes(item._id || item.id),
  );
});

function changePage(page = 1) {
  notificationStore.currentPage = page;
}

async function applyFilters() {
  await notificationStore.fetchNotifications({
    keyword: filters.keyword,
    type: filters.type,
    is_read: filters.is_read,
  });
}

async function resetFilters() {
  filters.keyword = "";
  filters.type = "";
  filters.is_read = "";
  await applyFilters();
}

function toggleSelect(id) {
  notificationStore.toggleSelectedId(id);
}

function toggleSelectAll() {
  const ids = notifications.value.map((item) => item._id || item.id);
  notificationStore.toggleSelectAllCurrentPage(ids);
}

async function handleClick(item) {
  await notificationStore.markOneAsRead(item._id || item.id);

  if (item.type === "order" && item.data?.order_id) {
    router.push(`/admin/orders/${item.data.order_id}`);
    return;
  }

  if (item.type === "contact") {
    router.push("/admin/contacts");
  }
}

async function removeNotification(item) {
  await notificationStore.removeOne(item._id || item.id);
}

async function removeSelected() {
  if (!selectedIds.value.length) return;
  await notificationStore.removeSelected();
}

async function removeAllFiltered() {
  await notificationStore.removeAllFiltered();
}

async function markAllAsRead() {
  await notificationStore.markAllAsRead();
}

watch(
  () => notificationStore.items.length,
  (count) => {
    const maxPage = Math.max(1, Math.ceil(count / notificationStore.pageSize));
    if (notificationStore.currentPage > maxPage) {
      notificationStore.currentPage = maxPage;
    }
  },
);

onMounted(async () => {
  await notificationStore.loadInitialData();

  filters.keyword = notificationStore.filters.keyword;
  filters.type = notificationStore.filters.type;
  filters.is_read = notificationStore.filters.is_read;
});
</script>

<template>
  <div class="admin-page">
    <div class="admin-page-title admin-page-title--stack">
      <h1>Thông báo</h1>
      <p>Quản lý toàn bộ thông báo đơn hàng và liên hệ khách hàng.</p>
    </div>

    <section class="admin-panel">
      <div class="admin-panel__header">Danh sách thông báo</div>

      <div class="admin-panel__body">
        <div class="notification-toolbar">
          <input
            v-model="filters.keyword"
            type="text"
            class="notification-toolbar__input"
            placeholder="Tìm theo tiêu đề hoặc nội dung"
          />

          <select v-model="filters.type" class="notification-toolbar__select">
            <option value="">Tất cả loại</option>
            <option value="order">Đơn hàng</option>
            <option value="contact">Liên hệ</option>
          </select>

          <select
            v-model="filters.is_read"
            class="notification-toolbar__select"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="false">Chưa đọc</option>
            <option value="true">Đã đọc</option>
          </select>

          <button class="admin-btn admin-btn--primary" @click="applyFilters">
            Lọc
          </button>

          <button class="admin-btn admin-btn--secondary" @click="resetFilters">
            Đặt lại
          </button>
        </div>

        <div class="notification-actions">
          <label class="notification-check-all">
            <input
              type="checkbox"
              :checked="isAllCurrentPageSelected"
              @change="toggleSelectAll"
            />
            Chọn tất cả trang này
          </label>

          <div class="notification-actions__right">
            <!-- <button class="admin-btn admin-btn--warning" @click="markAllAsRead">
              Đánh dấu đã đọc
            </button> -->

            <button
              class="admin-btn admin-btn--danger"
              :disabled="!selectedIds.length"
              @click="removeSelected"
            >
              Xóa đã chọn
            </button>

            <button
              class="admin-btn admin-btn--danger"
              @click="removeAllFiltered"
            >
              Xóa tất cả theo bộ lọc
            </button>
          </div>
        </div>

        <div v-if="notificationStore.loading" class="admin-empty-state">
          Đang tải thông báo...
        </div>

        <div v-else-if="!notifications.length" class="admin-empty-state">
          Chưa có thông báo nào
        </div>

        <div v-else class="notification-list">
          <div
            v-for="item in notifications"
            :key="item._id || item.id"
            class="notification-item"
            :class="{ 'is-unread': !item.is_read }"
          >
            <div class="notification-item__left">
              <input
                type="checkbox"
                :checked="selectedIds.includes(item._id || item.id)"
                @change="toggleSelect(item._id || item.id)"
              />

              <div class="notification-item__icon">
                <i :class="['fa-solid', iconByType(item.type)]"></i>
              </div>

              <div class="notification-item__body" @click="handleClick(item)">
                <div class="notification-item__title-row">
                  <div class="notification-item__title">{{ item.title }}</div>

                  <span
                    class="notification-badge"
                    :class="
                      item.is_read
                        ? 'notification-badge--read'
                        : 'notification-badge--unread'
                    "
                  >
                    {{ item.is_read ? "Đã đọc" : "Chưa đọc" }}
                  </span>
                </div>

                <div class="notification-item__content">{{ item.content }}</div>

                <div class="notification-item__meta">
                  <span>Loại: {{ item.type }}</span>
                  <span>{{ formatTime(item.created_at) }}</span>
                </div>
              </div>
            </div>

            <div class="notification-item__right">
              <button
                v-if="!item.is_read"
                class="admin-btn admin-btn--warning"
                @click="notificationStore.markOneAsRead(item._id || item.id)"
              >
                Đã đọc
              </button>

              <button
                class="admin-btn admin-btn--danger"
                @click="removeNotification(item)"
              >
                Xóa
              </button>
            </div>
          </div>
        </div>

        <AdminPagination
          v-model="notificationStore.currentPage"
          :total-items="notificationStore.items.length"
          :page-size="notificationStore.pageSize"
          :max-visible="5"
          @change="changePage"
        />
      </div>
    </section>
  </div>
</template>
