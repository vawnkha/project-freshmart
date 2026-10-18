<script setup>
import { computed, onMounted, ref, watch } from "vue";
import userService from "@/services/user.service";
import roleService from "@/services/role.service";
import AdminPagination from "@/components/admin/common/AdminPagination.vue";
import { useAuthStore } from "@/stores/user/auth";
import { hasPermission } from "@/utils/permission.util";
import { normalizeId } from "@/utils/id.util";

const authStore = useAuthStore();
const users = ref([]);
const roles = ref([]);
const loading = ref(false);
const currentPage = ref(1);
const pageSize = ref(12);
const keyword = ref("");
const selectedRole = ref("");
const selectedStatus = ref("");
const assigningRoleUserId = ref("");
const canUpdateUsers = computed(() => hasPermission(authStore, "user:update"));
const canDeleteUsers = computed(() => hasPermission(authStore, "user:delete"));
const canManageRoles = computed(() => hasPermission(authStore, "role:manage"));

function resolveType(role) {
  const matchedRole = roles.value.find((item) => item.code === role);
  if (matchedRole) return matchedRole.name;
  if (role === "admin") return "ADMIN";
  return "Khách hàng";
}

function roleBadgeClass(role) {
  if (role === "admin") return "admin-user-role admin-user-role--admin";
  return "admin-user-role admin-user-role--customer";
}

function statusBadgeClass(status) {
  if (status === "blocked")
    return "admin-user-status admin-user-status--blocked";
  return "admin-user-status admin-user-status--active";
}

function statusText(status) {
  if (status === "blocked") return "Đã chặn";
  return "Hoạt động";
}

async function fetchUsers() {
  loading.value = true;
  try {
    const res = await userService.getAll();
    users.value = res?.data || res || [];
  } catch (error) {
    alert(error?.message || "Không thể tải danh sách người dùng");
  } finally {
    loading.value = false;
  }
}

async function fetchRoles() {
  if (!canManageRoles.value) {
    roles.value = [];
    return;
  }

  try {
    roles.value = await roleService.getRoles();
  } catch (error) {
    roles.value = [];
  }
}

function roleIdForUser(user) {
  return normalizeId(
    user.role_id ||
    roles.value.find((role) => role.code === user.role)?._id ||
    ""
  );
}

async function changeUserRole(user, event) {
  if (!canManageRoles.value) {
    alert("Ban khong co quyen gan vai tro cho nguoi dung");
    event.target.value = roleIdForUser(user);
    return;
  }

  const roleId = event.target.value;
  if (!roleId || roleId === roleIdForUser(user)) return;

  assigningRoleUserId.value = user._id;

  try {
    await roleService.assignRoleToUser(user._id, roleId);
    await fetchUsers();
  } catch (error) {
    alert(error?.response?.data?.message || "Khong the gan role cho nguoi dung");
    event.target.value = roleIdForUser(user);
  } finally {
    assigningRoleUserId.value = "";
  }
}

const paginatedUser = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  const end = start + pageSize.value;
  return filteredUsers.value.slice(start, end);
});

async function blockUser(user) {
  if (!canUpdateUsers.value) {
    alert("Ban khong co quyen cap nhat nguoi dung");
    return;
  }

  try {
    await userService.updateUser(user._id, { status: "blocked" });
    await fetchUsers();
  } catch (error) {
    alert(error?.message || "Không thể chặn người dùng");
  }
}

async function restoreUser(user) {
  if (!canUpdateUsers.value) {
    alert("Ban khong co quyen cap nhat nguoi dung");
    return;
  }

  try {
    await userService.updateUser(user._id, { status: "active" });
    await fetchUsers();
  } catch (error) {
    alert(error?.message || "Không thể khôi phục người dùng");
  }
}

async function removeUser(user) {
  if (!canDeleteUsers.value) {
    alert("Ban khong co quyen xoa nguoi dung");
    return;
  }

  if (!window.confirm("Bạn có chắc muốn xóa người dùng này?\n\nDữ liệu sau khi xóa sẽ không thể khôi phục.")) return;

  try {
    await userService.deleteUser(user._id);
    await fetchUsers();
  } catch (error) {
    alert(error?.response?.data?.message || error?.message || "Không thể xóa người dùng");
  }
}

const filteredUsers = computed(() => {
  const q = keyword.value.trim().toLowerCase();

  return users.value.filter((item) => {
    const matchKeyword =
      !q ||
      String(item.name || "")
        .toLowerCase()
        .includes(q) ||
      String(item.email || "")
        .toLowerCase()
        .includes(q) ||
      String(item.phone || "")
        .toLowerCase()
        .includes(q) ||
      String(item.address || "")
        .toLowerCase()
        .includes(q) ||
      String(item.city || "")
        .toLowerCase()
        .includes(q);

    const matchRole = !selectedRole.value || item.role === selectedRole.value;
    const matchStatus =
      !selectedStatus.value ||
      (item.status || "active") === selectedStatus.value;

    return matchKeyword && matchRole && matchStatus;
  });
});

const totalUsers = computed(() => users.value.length);
const totalAdmins = computed(
  () => users.value.filter((item) => item.role === "admin").length,
);
const totalCustomers = computed(
  () => users.value.filter((item) => item.role !== "admin").length,
);
const totalBlocked = computed(
  () => users.value.filter((item) => item.status === "blocked").length,
);

watch([keyword, selectedRole, selectedStatus], () => {
  currentPage.value = 1;
});

watch(filteredUsers, (list) => {
  const maxPage = Math.max(1, Math.ceil(list.length / pageSize.value));
  if (currentPage.value > maxPage) {
    currentPage.value = maxPage;
  }
});

async function initialize() {
  await Promise.all([fetchUsers(), fetchRoles()]);
}

onMounted(initialize);
</script>

<template>
  <div class="admin-page">
    <div class="admin-page-title admin-page-title--stack">
      <h1>Quản lý người dùng</h1>
      <p>
        Theo dõi thông tin tài khoản, tìm kiếm và quản lý trạng thái người dùng.
      </p>
    </div>

    <div class="admin-stat-row admin-stat-row--users">
      <div class="admin-stat-card">
        <div class="admin-stat-card__label">Tổng người dùng</div>
        <div class="admin-stat-card__value">{{ totalUsers }}</div>
      </div>

      <div class="admin-stat-card">
        <div class="admin-stat-card__label">Admin</div>
        <div class="admin-stat-card__value">{{ totalAdmins }}</div>
      </div>

      <div class="admin-stat-card">
        <div class="admin-stat-card__label">Khách hàng</div>
        <div class="admin-stat-card__value">{{ totalCustomers }}</div>
      </div>

      <div class="admin-stat-card">
        <div class="admin-stat-card__label">Đã chặn</div>
        <div class="admin-stat-card__value">{{ totalBlocked }}</div>
      </div>
    </div>

    <section class="admin-panel admin-panel--users">
      <div class="admin-panel__header admin-panel__header--flex">
        <div>
          <div class="admin-panel__header-title">Danh sách tài khoản</div>
          <div class="admin-panel__header-subtitle">
            Tìm kiếm và quản lý tất cả người dùng trong hệ thống.
          </div>
        </div>

        <button class="admin-btn admin-btn--secondary" @click="fetchUsers">
          Làm mới
        </button>
      </div>

      <div class="admin-panel__body">
        <div class="admin-user-toolbar">
          <input
            v-model="keyword"
            type="text"
            class="admin-user-toolbar__input"
            placeholder="Tìm theo tên, email, số điện thoại, địa chỉ..."
          />

          <select v-model="selectedRole" class="admin-user-toolbar__select">
            <option value="">Tất cả vai trò</option>
            <option v-for="role in roles" :key="role._id" :value="role.code">
              {{ role.name }}
            </option>
          </select>

          <select v-model="selectedStatus" class="admin-user-toolbar__select">
            <option value="">Tất cả trạng thái</option>
            <option value="active">Hoạt động</option>
            <option value="blocked">Đã chặn</option>
          </select>
        </div>

        <div v-if="loading" class="admin-empty-state">
          Đang tải danh sách người dùng...
        </div>

        <div v-else-if="!filteredUsers.length" class="admin-empty-state">
          Không có người dùng phù hợp
        </div>

        <div v-else class="admin-user-grid admin-user-grid--modern">
          <div
            v-for="item in paginatedUser"
            :key="item._id"
            class="admin-user-card admin-user-card--modern"
          >
            <div class="admin-user-card__top">
              <span :class="roleBadgeClass(item.role)">
                {{ resolveType(item.role) }}
              </span>

              <span :class="statusBadgeClass(item.status || 'active')">
                {{ statusText(item.status || "active") }}
              </span>
            </div>

            <div class="admin-user-card__body admin-user-card__body--modern">
              <img
                :src="item.avatar_url || item.avatar || '/img/avatar.jpg'"
                class="admin-user-card__image admin-user-card__image--modern"
                alt="avatar"
              />

              <div class="admin-user-card__info">
                <div class="admin-user-card__name">{{ item.name }}</div>

                <div class="admin-user-card__meta">
                  <span>Email:</span>
                  <strong>{{ item.email || "---" }}</strong>
                </div>

                <div class="admin-user-card__meta">
                  <span>Địa chỉ:</span>
                  <strong>{{ item.address || item.city || "---" }}</strong>
                </div>

                <div class="admin-user-card__meta">
                  <span>Số điện thoại:</span>
                  <strong>{{ item.phone || "---" }}</strong>
                </div>

                <div class="admin-user-card__meta">
                  <span>Vai trò:</span>
                  <strong>{{ resolveType(item.role) }}</strong>
                </div>

                <select
                  v-if="canManageRoles && roles.length"
                  class="admin-user-card__role-select"
                  :value="roleIdForUser(item)"
                  :disabled="assigningRoleUserId === item._id"
                  @change="changeUserRole(item, $event)"
                >
                  <option
                    v-for="role in roles"
                    :key="role._id"
                    :value="role._id"
                    :disabled="role.status === 'inactive'"
                  >
                    {{ role.name }}
                  </option>
                </select>
              </div>
            </div>

            <div
              class="admin-user-card__actions admin-user-card__actions--modern"
            >
              <button
                v-if="canUpdateUsers && item.status !== 'blocked'"
                class="admin-btn admin-btn--warning"
                @click="blockUser(item)"
              >
                <i class="fa-solid fa-ban me-1"></i>
                Chặn
              </button>

              <button
                v-if="canUpdateUsers && item.status === 'blocked'"
                class="admin-btn admin-btn--success"
                @click="restoreUser(item)"
              >
                <i class="fa-solid fa-rotate-left me-1"></i>
                Khôi phục
              </button>

              <button
                v-if="canDeleteUsers"
                class="admin-btn admin-btn--danger"
                @click="removeUser(item)"
              >
                <i class="fa-solid fa-trash me-1"></i>
                Xóa
              </button>
            </div>
          </div>
        </div>
        <AdminPagination
          v-model="currentPage"
          :total-items="filteredUsers.length"
          :page-size="pageSize"
        />
      </div>
    </section>
  </div>
</template>

<style scoped>
.admin-page-title--stack h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  color: var(--admin-title);
}

.admin-page-title--stack p {
  margin: 6px 0 0;
  color: var(--admin-title);
  font-size: 15px;
  font-weight: 500;
}

.admin-stat-row--users {
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 3px 10px rgba(34, 58, 87, 0.04);
}

.admin-panel--users {
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 3px 10px rgba(34, 58, 87, 0.04);
}

.admin-panel__header--flex {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.admin-panel__header-title {
  font-size: 16px;
  color: var(--admin-title);
  font-weight: 700;
}

.admin-panel__header-subtitle {
  margin-top: 6px;
  color: var(--admin-text);
  font-size: 14px;
}

.admin-user-toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1.8fr) 220px 220px;
  gap: 12px;
  margin-bottom: 18px;
}

.admin-user-toolbar__input,
.admin-user-toolbar__select {
  width: 100%;
  min-height: 40px;
  border: 1px solid #d8e0e8;
  background: #fff;
  padding: 8px 12px;
  font-size: 14px;
  outline: none;
  border-radius: 6px;
}

.admin-user-grid--modern {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.admin-user-card--modern {
  border: 1px solid var(--admin-border);
  border-radius: 14px;
  overflow: hidden;
  background: #fff;
  box-shadow: 0 4px 14px rgba(34, 58, 87, 0.05);
}

.admin-user-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 0;
  gap: 12px;
}

.admin-user-card__body--modern {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 12px;
}

.admin-user-card__image--modern {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid #eef3f8;
  flex-shrink: 0;
}

.admin-user-card__info {
  min-width: 0;
  flex: 1;
}

.admin-user-card__name {
  font-size: 16px;
  font-weight: 700;
  color: #637892;
  margin-bottom: 12px;
  word-break: break-word;
}

.admin-user-card__meta {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  color: #6f839b;
  line-height: 1.45;
  font-size: 13px;
}

.admin-user-card__meta span {
  min-width: 90px;
  font-weight: 600;
  color: #8092a7;
}

.admin-user-card__meta strong {
  color: #5c7088;
  word-break: break-word;
}

.admin-user-card__role-select {
  width: 100%;
  min-height: 38px;
  border: 1px solid #d8e0e8;
  border-radius: 6px;
  background: #fff;
  color: #5c7088;
  padding: 7px 10px;
  font-size: 13px;
  outline: none;
}

.admin-user-card__actions--modern {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  padding: 0 12px 12px;
  flex-wrap: wrap;
}

.admin-user-role,
.admin-user-status {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 5px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.admin-user-role--admin {
  background: rgba(13, 110, 253, 0.12);
  color: #0d6efd;
}

.admin-user-role--customer {
  background: rgba(25, 183, 165, 0.14);
  color: #129788;
}

.admin-user-status--active {
  background: rgba(40, 167, 69, 0.12);
  color: #239146;
}

.admin-user-status--blocked {
  background: rgba(231, 76, 60, 0.12);
  color: #d64535;
}

@media (max-width: 1200px) {
  .admin-user-grid--modern {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 992px) {
  .admin-user-toolbar {
    grid-template-columns: 1fr;
  }

  .admin-user-card__body--modern {
    flex-direction: column;
    align-items: flex-start;
  }

  .admin-user-card__actions--modern {
    justify-content: flex-start;
  }

  .admin-user-card__meta {
    flex-direction: column;
    gap: 2px;
  }

  .admin-user-card__meta span {
    min-width: 0;
  }
}
</style>
