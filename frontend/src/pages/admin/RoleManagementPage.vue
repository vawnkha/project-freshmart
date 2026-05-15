<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import roleService from "@/services/role.service";

const roles = ref([]);
const permissions = ref([]);
const loading = ref(false);
const saving = ref(false);
const showForm = ref(false);
const editingRole = ref(null);

const form = reactive({
  code: "",
  name: "",
  description: "",
  status: "active",
  permissionIds: [],
});

const groupedPermissions = computed(() => {
  return permissions.value.reduce((groups, permission) => {
    const group = permission.group || "other";
    groups[group] ||= [];
    groups[group].push(permission);
    return groups;
  }, {});
});

const totalRoles = computed(() => roles.value.length);
const activeRoles = computed(
  () => roles.value.filter((role) => role.status !== "inactive").length,
);
const customRoles = computed(
  () => roles.value.filter((role) => !role.is_system).length,
);
const totalPermissions = computed(() => permissions.value.length);

const isEditing = computed(() => Boolean(editingRole.value));
const isEditingSystemRole = computed(() => Boolean(editingRole.value?.is_system));
const isEditingAdminRole = computed(() => editingRole.value?.code === "admin");

async function fetchData() {
  loading.value = true;

  try {
    const [roleList, permissionList] = await Promise.all([
      roleService.getRoles(),
      roleService.getPermissions(),
    ]);

    roles.value = roleList;
    permissions.value = permissionList;
  } catch (error) {
    alert(error?.response?.data?.message || "Khong the tai du lieu phan quyen");
  } finally {
    loading.value = false;
  }
}

function resetForm() {
  editingRole.value = null;
  form.code = "";
  form.name = "";
  form.description = "";
  form.status = "active";
  form.permissionIds = [];
}

function openCreateForm() {
  resetForm();
  showForm.value = true;
}

function openEditForm(role) {
  editingRole.value = role;
  form.code = role.code || "";
  form.name = role.name || "";
  form.description = role.description || "";
  form.status = role.status || "active";
  form.permissionIds = [...(role.permissionIds || [])];
  showForm.value = true;
}

function closeForm() {
  showForm.value = false;
  resetForm();
}

function groupPermissionIds(items = []) {
  return items.map((permission) => permission._id);
}

function isGroupChecked(items = []) {
  const ids = groupPermissionIds(items);
  return ids.length && ids.every((id) => form.permissionIds.includes(id));
}

function toggleGroup(items = []) {
  if (isEditingAdminRole.value) return;

  const ids = groupPermissionIds(items);
  const selected = new Set(form.permissionIds);
  const shouldSelectAll = !ids.every((id) => selected.has(id));

  ids.forEach((id) => {
    if (shouldSelectAll) selected.add(id);
    else selected.delete(id);
  });

  form.permissionIds = [...selected];
}

async function submitRole() {
  if (!form.name.trim()) {
    alert("Ten role la bat buoc");
    return;
  }

  if (!isEditing.value && !form.code.trim()) {
    alert("Ma role la bat buoc");
    return;
  }

  saving.value = true;

  try {
    const payload = {
      name: form.name,
      description: form.description,
      status: form.status,
    };

    if (!isEditingSystemRole.value) {
      payload.code = form.code;
    }

    if (!isEditingAdminRole.value) {
      payload.permissionIds = form.permissionIds;
    }

    if (isEditing.value) {
      await roleService.updateRole(editingRole.value._id, payload);
    } else {
      await roleService.createRole(payload);
    }

    await fetchData();
    closeForm();
  } catch (error) {
    alert(error?.response?.data?.message || "Khong the luu role");
  } finally {
    saving.value = false;
  }
}

async function removeRole(role) {
  if (!window.confirm(`Ban co chac muon xoa role "${role.name}"?`)) return;

  try {
    await roleService.deleteRole(role._id);
    await fetchData();
  } catch (error) {
    alert(error?.response?.data?.message || "Khong the xoa role");
  }
}

function permissionText(role) {
  const count = role.permissions?.length || 0;
  if (count === permissions.value.length && count > 0) return "Tat ca quyen";
  return `${count} quyen`;
}

onMounted(fetchData);
</script>

<template>
  <div class="admin-page">
    <div class="admin-page-title admin-page-title--stack">
      <h1>Quan ly phan quyen</h1>
      <p>Tao role dong va gan permission theo tung nhom nghiep vu.</p>
    </div>

    <div class="admin-stat-row admin-stat-row--roles">
      <div class="admin-stat-card">
        <div class="admin-stat-card__label">Tong role</div>
        <div class="admin-stat-card__value">{{ totalRoles }}</div>
      </div>

      <div class="admin-stat-card">
        <div class="admin-stat-card__label">Dang hoat dong</div>
        <div class="admin-stat-card__value">{{ activeRoles }}</div>
      </div>

      <div class="admin-stat-card">
        <div class="admin-stat-card__label">Role tuy chinh</div>
        <div class="admin-stat-card__value">{{ customRoles }}</div>
      </div>

      <div class="admin-stat-card">
        <div class="admin-stat-card__label">Permission</div>
        <div class="admin-stat-card__value">{{ totalPermissions }}</div>
      </div>
    </div>

    <section class="admin-panel admin-panel--roles">
      <div class="admin-panel__header admin-panel__header--flex">
        <div>
          <div class="admin-panel__header-title">Danh sach role</div>
          <div class="admin-panel__header-subtitle">
            Moi role duoc gan mot tap permission rieng va co the gan cho nhieu
            nguoi dung.
          </div>
        </div>

        <div class="admin-role-actions">
          <button class="admin-btn admin-btn--secondary" @click="fetchData">
            Lam moi
          </button>
          <button class="admin-btn admin-btn--primary" @click="openCreateForm">
            Them role
          </button>
        </div>
      </div>

      <div class="admin-panel__body">
        <div v-if="loading" class="admin-empty-state">
          Dang tai du lieu phan quyen...
        </div>

        <div v-else class="admin-role-grid">
          <article v-for="role in roles" :key="role._id" class="admin-role-card">
            <div class="admin-role-card__top">
              <div>
                <div class="admin-role-card__name">{{ role.name }}</div>
                <div class="admin-role-card__code">{{ role.code }}</div>
              </div>

              <span
                class="admin-role-card__status"
                :class="{ 'is-inactive': role.status === 'inactive' }"
              >
                {{ role.status === "inactive" ? "Inactive" : "Active" }}
              </span>
            </div>

            <p class="admin-role-card__description">
              {{ role.description || "Chua co mo ta" }}
            </p>

            <div class="admin-role-card__meta">
              <span>{{ permissionText(role) }}</span>
              <span v-if="role.is_system">Role he thong</span>
              <span v-else>Role tuy chinh</span>
            </div>

            <div class="admin-role-card__chips">
              <span
                v-for="permission in (role.permissions || []).slice(0, 5)"
                :key="permission._id"
                class="admin-role-chip"
              >
                {{ permission.key }}
              </span>
              <span
                v-if="(role.permissions?.length || 0) > 5"
                class="admin-role-chip admin-role-chip--more"
              >
                +{{ role.permissions.length - 5 }}
              </span>
            </div>

            <div class="admin-role-card__actions">
              <button
                class="admin-btn admin-btn--success"
                @click="openEditForm(role)"
              >
                Sua
              </button>
              <button
                class="admin-btn admin-btn--danger"
                :disabled="role.is_system"
                @click="removeRole(role)"
              >
                Xoa
              </button>
            </div>
          </article>
        </div>
      </div>
    </section>

    <div v-if="showForm" class="admin-modal-mask" @click.self="closeForm">
      <div class="admin-modal admin-modal--role">
        <div class="admin-modal__header">
          <div class="admin-modal__title">
            {{ isEditing ? "Cap nhat role" : "Them role moi" }}
          </div>
          <button class="admin-btn admin-btn--secondary" @click="closeForm">
            x
          </button>
        </div>

        <form class="admin-modal__body" @submit.prevent="submitRole">
          <div class="admin-role-form-grid">
            <div class="admin-form__row">
              <label class="admin-form__label">Ten role *</label>
              <input v-model="form.name" class="admin-form__control" />
            </div>

            <div class="admin-form__row">
              <label class="admin-form__label">Ma role *</label>
              <input
                v-model="form.code"
                class="admin-form__control"
                :disabled="isEditingSystemRole"
                placeholder="warehouse_staff"
              />
            </div>
          </div>

          <div class="admin-form__row">
            <label class="admin-form__label">Mo ta</label>
            <textarea
              v-model="form.description"
              class="admin-form__textarea"
              rows="3"
            />
          </div>

          <div class="admin-form__row">
            <label class="admin-form__label">Trang thai</label>
            <select v-model="form.status" class="admin-form__control">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div class="admin-role-permissions">
            <div
              v-for="(items, group) in groupedPermissions"
              :key="group"
              class="admin-role-permission-group"
            >
              <div class="admin-role-permission-group__header">
                <strong>{{ group }}</strong>
                <button
                  type="button"
                  class="admin-btn admin-btn--secondary admin-role-permission-group__toggle"
                  :disabled="isEditingAdminRole"
                  @click="toggleGroup(items)"
                >
                  {{ isGroupChecked(items) ? "Bo chon nhom" : "Chon nhom" }}
                </button>
              </div>

              <label
                v-for="permission in items"
                :key="permission._id"
                class="admin-role-permission"
              >
                <input
                  v-model="form.permissionIds"
                  type="checkbox"
                  :value="permission._id"
                  :disabled="isEditingAdminRole"
                />
                <span>
                  <strong>{{ permission.label || permission.key }}</strong>
                  <small>{{ permission.key }}</small>
                </span>
              </label>
            </div>
          </div>
        </form>

        <div class="admin-modal__footer">
          <button class="admin-btn admin-btn--secondary" @click="closeForm">
            Huy
          </button>
          <button
            class="admin-btn admin-btn--primary"
            :disabled="saving"
            @click="submitRole"
          >
            {{ saving ? "Dang luu..." : "Luu role" }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-panel__header--flex {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.admin-role-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.admin-role-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.admin-role-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 260px;
  border: 1px solid var(--admin-border);
  border-radius: 10px;
  background: #fff;
  padding: 16px;
}

.admin-role-card__top,
.admin-role-card__meta,
.admin-role-card__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.admin-role-card__name {
  color: var(--admin-title);
  font-size: 17px;
  font-weight: 700;
}

.admin-role-card__code {
  margin-top: 4px;
  color: #6f839b;
  font-size: 13px;
  word-break: break-word;
}

.admin-role-card__status {
  min-width: 72px;
  border-radius: 999px;
  background: rgba(40, 167, 69, 0.12);
  color: #239146;
  padding: 6px 10px;
  text-align: center;
  font-size: 12px;
  font-weight: 700;
}

.admin-role-card__status.is-inactive {
  background: rgba(108, 117, 125, 0.14);
  color: #6c757d;
}

.admin-role-card__description {
  min-height: 42px;
  margin: 0;
  color: #6f839b;
  line-height: 1.5;
}

.admin-role-card__meta {
  color: #5c7088;
  font-size: 13px;
  font-weight: 700;
}

.admin-role-card__chips {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  min-height: 64px;
}

.admin-role-chip {
  max-width: 100%;
  border-radius: 999px;
  background: #eef3f8;
  color: #5c7088;
  padding: 5px 9px;
  font-size: 12px;
  font-weight: 700;
  word-break: break-word;
}

.admin-role-chip--more {
  background: rgba(13, 110, 253, 0.12);
  color: #0d6efd;
}

.admin-modal--role {
  width: min(960px, calc(100vw - 32px));
  max-height: calc(100vh - 48px);
  overflow: auto;
}

.admin-role-form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.admin-role-permissions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-top: 12px;
}

.admin-role-permission-group {
  border: 1px solid var(--admin-border);
  border-radius: 10px;
  overflow: hidden;
}

.admin-role-permission-group__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: #f7fafc;
  padding: 12px;
}

.admin-role-permission-group__header strong {
  color: var(--admin-title);
  text-transform: capitalize;
}

.admin-role-permission-group__toggle {
  min-height: 32px;
  padding: 5px 10px;
  white-space: nowrap;
}

.admin-role-permission {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  gap: 10px;
  align-items: flex-start;
  margin: 0;
  padding: 11px 12px;
  border-top: 1px solid var(--admin-border);
  cursor: pointer;
}

.admin-role-permission input {
  margin-top: 3px;
}

.admin-role-permission strong,
.admin-role-permission small {
  display: block;
}

.admin-role-permission strong {
  color: #5c7088;
  line-height: 1.35;
}

.admin-role-permission small {
  margin-top: 3px;
  color: #8092a7;
  word-break: break-word;
}

@media (max-width: 992px) {
  .admin-panel__header--flex,
  .admin-role-card__top,
  .admin-role-card__meta,
  .admin-role-card__actions {
    align-items: flex-start;
    flex-direction: column;
  }

  .admin-role-form-grid,
  .admin-role-permissions {
    grid-template-columns: 1fr;
  }
}
</style>
