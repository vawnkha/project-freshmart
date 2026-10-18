<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useSchemaForm } from "@/composables/useSchemaForm";
import { toTypedSchema } from "@vee-validate/zod";
import AdminPagination from "@/components/admin/common/AdminPagination.vue";
import shippingMethodService from "@/services/shipping-method.service";
import {
  nonNegativeNumberSchema,
  optionalString,
  requiredString,
  statusSchema,
  z,
} from "@/validators/common.validator";
import { mapBackendValidationErrors } from "@/utils/validation-error.util";
import { normalizeId } from "@/utils/id.util";

const methods = ref([]);
const loading = ref(false);
const saving = ref(false);
const keyword = ref("");
const statusFilter = ref("");
const showModal = ref(false);
const modalMode = ref("create");
const currentId = ref("");
const currentPage = ref(1);
const pageSize = ref(12);

const form = reactive({
  name: "",
  code: "",
  description: "",
  fee: 0,
  estimatedDays: 1,
  status: "active",
});

const shippingSchema = toTypedSchema(
  z.object({
    name: requiredString("Ten phuong thuc van chuyen la bat buoc"),
    code: optionalString,
    description: optionalString,
    fee: nonNegativeNumberSchema,
    estimatedDays: nonNegativeNumberSchema,
    status: statusSchema,
  }),
);

const {
  errors,
  resetForm: resetValidation,
  setErrors,
  setValues,
  validate: validateVee,
} = useSchemaForm({
  validationSchema: shippingSchema,
  values: () => ({ ...form }),
});

const filteredMethods = computed(() => {
  const q = keyword.value.trim().toLowerCase();

  return methods.value.filter((item) => {
    const matchKeyword =
      !q ||
      [item.name, item.code, item.description]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    const matchStatus = !statusFilter.value || item.status === statusFilter.value;
    return matchKeyword && matchStatus;
  });
});

const paginatedMethods = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return filteredMethods.value.slice(start, start + pageSize.value);
});

const activeCount = computed(
  () => methods.value.filter((item) => item.status === "active").length,
);

const inactiveCount = computed(
  () => methods.value.filter((item) => item.status === "inactive").length,
);

function normalizeList(res) {
  return Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
}

function getId(item) {
  return normalizeId(item);
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("vi-VN") + " VND";
}

function statusText(status) {
  if (status === "active") return "Đang hoạt động";
  if (status === "inactive") return "Ngừng hoạt động";
  return status || "---";
}

function statusClass(status) {
  if (status === "active") return "admin-badge--success";
  if (status === "inactive") return "admin-badge--danger";
  return "admin-badge--info";
}

function resetForm() {
  Object.assign(form, {
    name: "",
    code: "",
    description: "",
    fee: 0,
    estimatedDays: 1,
    status: "active",
  });
  resetValidation();
}

function fillForm(item) {
  Object.assign(form, {
    name: item.name || "",
    code: item.code || "",
    description: item.description || "",
    fee: item.fee ?? 0,
    estimatedDays: item.estimatedDays ?? 1,
    status: item.status || "active",
  });
}

function buildPayload() {
  const payload = {
    name: form.name.trim(),
    code: form.code.trim(),
    description: form.description.trim(),
    fee: Number(form.fee || 0),
    estimatedDays: Number(form.estimatedDays || 0),
    status: form.status || "active",
  };

  Object.keys(payload).forEach((key) => {
    if (payload[key] === "" && !["code", "description"].includes(key)) delete payload[key];
  });

  return payload;
}

async function validateForm() {
  setValues({ ...form });
  const result = await validateVee();
  return result.valid;
}

async function fetchMethods() {
  loading.value = true;
  try {
    const res = await shippingMethodService.getAll();
    methods.value = normalizeList(res);
  } catch (error) {
    console.error(error);
    alert(error?.response?.data?.message || "Không thể tải phương thức vận chuyển");
  } finally {
    loading.value = false;
  }
}

function openCreateModal() {
  modalMode.value = "create";
  currentId.value = "";
  resetForm();
  showModal.value = true;
}

function openEditModal(item) {
  resetValidation();
  modalMode.value = "edit";
  currentId.value = getId(item);
  fillForm(item);
  showModal.value = true;
}

function closeModal() {
  showModal.value = false;
  currentId.value = "";
  resetForm();
}

async function submitForm() {
  const valid = await validateForm();
  if (!valid) return;

  saving.value = true;
  try {
    if (modalMode.value === "create") {
      await shippingMethodService.create(buildPayload());
      alert("Tạo phương thức vận chuyển thành công");
    } else {
      await shippingMethodService.update(currentId.value, buildPayload());
      alert("Cập nhật phương thức vận chuyển thành công");
    }

    closeModal();
    await fetchMethods();
  } catch (error) {
    console.error(error);
    setErrors(mapBackendValidationErrors(error));
    alert(error?.response?.data?.message || "Không thể lưu phương thức vận chuyển");
  } finally {
    saving.value = false;
  }
}

async function removeMethod(item) {
  if (!window.confirm("Bạn có chắc muốn xóa phương thức vận chuyển này?\n\nDữ liệu sau khi xóa sẽ không thể khôi phục.")) {
    return;
  }

  try {
    await shippingMethodService.remove(getId(item));
    await fetchMethods();
    alert("Đã xóa phương thức vận chuyển");
  } catch (error) {
    console.error(error);
    alert(error?.response?.data?.message || "Không thể xóa phương thức vận chuyển");
  }
}

watch([keyword, statusFilter], () => {
  currentPage.value = 1;
});

watch(filteredMethods, (list) => {
  const maxPage = Math.max(1, Math.ceil(list.length / pageSize.value));
  if (currentPage.value > maxPage) currentPage.value = maxPage;
});

onMounted(fetchMethods);
</script>

<template>
  <div class="admin-page">
    <div class="admin-page-title admin-page-title--stack">
      <h1>Phương thức vận chuyển</h1>
      <p>Quản lý phí giao hàng và thời gian giao dự kiến cho đơn hàng.</p>
    </div>

    <div class="admin-stat-row admin-stat-row--orders">
      <div class="admin-stat-card">
        <div class="admin-stat-card__label">Tổng phương thức</div>
        <div class="admin-stat-card__value">{{ methods.length }}</div>
      </div>
      <div class="admin-stat-card">
        <div class="admin-stat-card__label">Đang lọc</div>
        <div class="admin-stat-card__value">{{ filteredMethods.length }}</div>
      </div>
      <div class="admin-stat-card">
        <div class="admin-stat-card__label">Đang hoạt động</div>
        <div class="admin-stat-card__value">{{ activeCount }}</div>
      </div>
      <div class="admin-stat-card">
        <div class="admin-stat-card__label">Ngừng hoạt động</div>
        <div class="admin-stat-card__value">{{ inactiveCount }}</div>
      </div>
    </div>

    <section class="admin-panel">
      <div class="admin-panel__header admin-panel__header--flex">
        <div>
          <div class="admin-panel__header-title">Danh sách vận chuyển</div>
          <div class="admin-panel__header-subtitle">
            Dữ liệu lấy từ /api/shipping-methods, filter và phân trang xử lý ở frontend.
          </div>
        </div>

        <button class="admin-btn admin-btn--primary" @click="openCreateModal">
          <i class="fa-solid fa-plus me-1"></i>
          Thêm phương thức
        </button>
      </div>

      <div class="admin-panel__body">
        <div class="row admin-toolbar">
          <div class="col-md-8">
            <input
              v-model="keyword"
              type="text"
              class="admin-toolbar__input"
              placeholder="Tìm theo tên, mã, mô tả"
            />
          </div>
          <div class="col-md-4">
            <select v-model="statusFilter" class="admin-toolbar__select">
              <option value="">Tất cả trạng thái</option>
              <option value="active">Đang hoạt động</option>
              <option value="inactive">Ngừng hoạt động</option>
            </select>
          </div>
        </div>

        <div v-if="loading" class="admin-empty-state">
          Đang tải phương thức vận chuyển...
        </div>
        <div v-else-if="!filteredMethods.length" class="admin-empty-state">
          Không có phương thức vận chuyển phù hợp
        </div>
        <div v-else class="table-responsive">
          <table class="admin-table admin-table--orders">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Tên phương thức</th>
                <th>Phí</th>
                <th>Ngày dự kiến</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in paginatedMethods" :key="getId(item)">
                <td>{{ item.code || "---" }}</td>
                <td>
                  <strong>{{ item.name }}</strong>
                  <div class="inventory-sub">{{ item.description || "---" }}</div>
                </td>
                <td>{{ formatCurrency(item.fee) }}</td>
                <td>{{ Number(item.estimatedDays || 0) }} ngày</td>
                <td>
                  <span class="admin-badge" :class="statusClass(item.status)">
                    {{ statusText(item.status) }}
                  </span>
                </td>
                <td>
                  <div class="admin-table__actions">
                    <button type="button" class="admin-btn admin-btn--secondary" @click.stop="openEditModal(item)">
                      Sửa
                    </button>
                    <button
                      type="button"
                      class="admin-btn admin-btn--danger"
                      @click.stop="removeMethod(item)"
                    >
                      Xóa
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          <AdminPagination
            v-model="currentPage"
            :total-items="filteredMethods.length"
            :page-size="pageSize"
          />
        </div>
      </div>
    </section>

    <div v-if="showModal" class="admin-modal-mask" @click.self="closeModal">
      <div class="admin-modal">
        <div class="admin-modal__header">
          <div class="admin-modal__title">
            {{ modalMode === "create" ? "Thêm phương thức vận chuyển" : "Sửa phương thức vận chuyển" }}
          </div>
          <button type="button" class="admin-btn admin-btn--secondary" @click="closeModal">
            Đóng
          </button>
        </div>

        <div class="admin-modal__body">
          <form class="admin-form" @submit.prevent="submitForm">
            <div class="admin-form__row">
              <label class="admin-form__label">Tên phương thức *</label>
              <div>
                <input
                  v-model="form.name"
                  class="admin-form__control"
                  :class="{ 'is-invalid': errors.name }"
                />
                <div v-if="errors.name" class="admin-form__error">{{ errors.name }}</div>
              </div>
            </div>

            <div class="admin-form__row">
              <label class="admin-form__label">Mã</label>
              <input
                v-model="form.code"
                class="admin-form__control"
                placeholder="VD: STANDARD, EXPRESS"
              />
            </div>

            <div class="admin-form__row">
              <label class="admin-form__label">Mô tả</label>
              <textarea v-model="form.description" class="admin-form__textarea" rows="3" />
            </div>

            <div class="admin-form__row">
              <label class="admin-form__label">Phí vận chuyển</label>
              <div>
                <input
                  v-model="form.fee"
                  type="number"
                  min="0"
                  class="admin-form__control"
                  :class="{ 'is-invalid': errors.fee }"
                />
                <div v-if="errors.fee" class="admin-form__error">{{ errors.fee }}</div>
              </div>
            </div>

            <div class="admin-form__row">
              <label class="admin-form__label">Số ngày dự kiến</label>
              <div>
                <input
                  v-model="form.estimatedDays"
                  type="number"
                  min="0"
                  class="admin-form__control"
                  :class="{ 'is-invalid': errors.estimatedDays }"
                />
                <div v-if="errors.estimatedDays" class="admin-form__error">
                  {{ errors.estimatedDays }}
                </div>
              </div>
            </div>

            <div class="admin-form__row">
              <label class="admin-form__label">Trạng thái</label>
              <select v-model="form.status" class="admin-form__select">
                <option value="active">Đang hoạt động</option>
                <option value="inactive">Ngừng hoạt động</option>
              </select>
            </div>
          </form>
        </div>

        <div class="admin-modal__footer">
          <button type="button" class="admin-btn admin-btn--secondary" @click="closeModal">
            Quay lại
          </button>
          <button
            type="button"
            class="admin-btn admin-btn--primary"
            :disabled="saving"
            @click="submitForm"
          >
            {{ saving ? "Đang lưu..." : "Lưu" }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
