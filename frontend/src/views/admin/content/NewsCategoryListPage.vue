<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import AdminPagination from "@/components/common/AdminPagination.vue";
import newsCategoryService from "@/services/news-category.service";
import {
  optionalString,
  requiredString,
  slugSchema,
  statusSchema,
  z,
} from "@/validators/common.validator";
import { mapBackendValidationErrors } from "@/utils/validation-error.util";

const categories = ref([]);
const loading = ref(false);
const saving = ref(false);
const keyword = ref("");
const statusFilter = ref("");
const showModal = ref(false);
const modalMode = ref("create");
const currentId = ref("");
const currentPage = ref(1);
const pageSize = ref(12);
const slugTouched = ref(false);

const form = reactive({
  name: "",
  slug: "",
  description: "",
  status: "active",
});

const newsCategorySchema = toTypedSchema(
  z.object({
    name: requiredString("Ten danh muc tin tuc la bat buoc"),
    slug: slugSchema,
    description: optionalString,
    status: statusSchema,
  }),
);

const {
  errors,
  resetForm: resetValidation,
  setErrors,
  setValues,
  validate: validateVee,
} = useForm({
  validationSchema: newsCategorySchema,
});

const filteredCategories = computed(() => {
  const q = keyword.value.trim().toLowerCase();

  return categories.value.filter((item) => {
    const matchKeyword =
      !q ||
      [item.name, item.slug, item.description]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    const matchStatus = !statusFilter.value || item.status === statusFilter.value;
    return matchKeyword && matchStatus;
  });
});

const paginatedCategories = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return filteredCategories.value.slice(start, start + pageSize.value);
});

const activeCount = computed(
  () => categories.value.filter((item) => item.status === "active").length,
);

const inactiveCount = computed(
  () => categories.value.filter((item) => item.status === "inactive").length,
);

function normalizeList(res) {
  return Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
}

function getId(item) {
  return item?._id || item?.id || "";
}

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function statusText(status) {
  if (status === "active") return "Đang hoạt động";
  if (status === "inactive") return "Ngưng hoạt động";
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
    slug: "",
    description: "",
    status: "active",
  });
  slugTouched.value = false;
  resetValidation();
}

function fillForm(item) {
  Object.assign(form, {
    name: item.name || "",
    slug: item.slug || "",
    description: item.description || "",
    status: item.status || "active",
  });
  slugTouched.value = true;
}

function buildPayload() {
  const payload = {
    name: form.name.trim(),
    slug: form.slug.trim(),
    description: form.description.trim(),
    status: form.status || "active",
  };

  Object.keys(payload).forEach((key) => {
    if (payload[key] === "") delete payload[key];
  });

  return payload;
}

async function validateForm() {
  setValues({ ...form });
  const result = await validateVee();
  return result.valid;
}

async function fetchCategories() {
  loading.value = true;
  try {
    const res = await newsCategoryService.getAll();
    categories.value = normalizeList(res);
  } catch (error) {
    console.error(error);
    alert(error?.response?.data?.message || "Không thể tải danh mục tin tức");
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
      await newsCategoryService.create(buildPayload());
      alert("Tạo danh mục tin tức thành công");
    } else {
      await newsCategoryService.update(currentId.value, buildPayload());
      alert("Cập nhật danh mục tin tức thành công");
    }

    closeModal();
    await fetchCategories();
  } catch (error) {
    console.error(error);
    setErrors(mapBackendValidationErrors(error));
    alert(error?.response?.data?.message || "Không thể lưu danh mục tin tức");
  } finally {
    saving.value = false;
  }
}

async function removeCategory(item) {
  if (item.status === "inactive") return;

  if (!window.confirm("Bạn có chắc muốn xóa danh mục tin tức này?")) return;

  try {
    await newsCategoryService.remove(getId(item));
    await fetchCategories();
    alert("Đã xóa danh mục tin tức");
  } catch (error) {
    console.error(error);
    alert(error?.response?.data?.message || "Không thể xóa danh mục tin tức");
  }
}

function handleSlugInput() {
  slugTouched.value = true;
  form.slug = slugify(form.slug);
}

watch(
  () => form.name,
  (value) => {
    if (modalMode.value === "create" && !slugTouched.value) {
      form.slug = slugify(value);
    }
  },
);

watch([keyword, statusFilter], () => {
  currentPage.value = 1;
});

watch(filteredCategories, (list) => {
  const maxPage = Math.max(1, Math.ceil(list.length / pageSize.value));
  if (currentPage.value > maxPage) currentPage.value = maxPage;
});

onMounted(fetchCategories);
</script>

<template>
  <div class="admin-page">
    <div class="admin-page-title admin-page-title--stack">
      <h1>Danh mục tin tức</h1>
      <p>Quản lý nhóm nội dung blog hiển thị trên website.</p>
    </div>

    <div class="admin-stat-row admin-stat-row--orders">
      <div class="admin-stat-card">
        <div class="admin-stat-card__label">Tổng danh mục</div>
        <div class="admin-stat-card__value">{{ categories.length }}</div>
      </div>
      <div class="admin-stat-card">
        <div class="admin-stat-card__label">Đang hoạt động</div>
        <div class="admin-stat-card__value">{{ activeCount }}</div>
      </div>
      <div class="admin-stat-card">
        <div class="admin-stat-card__label">Ngưng hoạt động</div>
        <div class="admin-stat-card__value">{{ inactiveCount }}</div>
      </div>
    </div>

    <section class="admin-panel">
      <div class="admin-panel__header admin-panel__header--flex">
        <div>
          <div class="admin-panel__header-title">Danh sách danh mục</div>
          <div class="admin-panel__header-subtitle">
            Dữ liệu lấy từ /api/news-categories, filter xử lý ở frontend.
          </div>
        </div>
        <button type="button" class="admin-btn admin-btn--primary" @click="openCreateModal">
          Thêm danh mục
        </button>
      </div>

      <div class="admin-panel__body">
        <div class="row admin-toolbar">
          <div class="col-md-8">
            <input
              v-model="keyword"
              class="admin-toolbar__input"
              type="search"
              placeholder="Tìm theo tên, slug, mô tả..."
            />
          </div>
          <div class="col-md-4">
            <select v-model="statusFilter" class="admin-toolbar__select">
              <option value="">Tất cả trạng thái</option>
              <option value="active">Đang hoạt động</option>
              <option value="inactive">Ngưng hoạt động</option>
            </select>
          </div>
        </div>

        <div v-if="loading" class="admin-empty-state">Đang tải danh mục tin tức...</div>
        <div v-else-if="!filteredCategories.length" class="admin-empty-state">
          Chưa có danh mục phù hợp.
        </div>
        <div v-else class="table-responsive">
          <table class="admin-table admin-table--orders">
            <thead>
              <tr>
                <th>Tên danh mục</th>
                <th>Slug</th>
                <th>Mô tả</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in paginatedCategories" :key="getId(item)">
                <td>{{ item.name }}</td>
                <td>{{ item.slug }}</td>
                <td>{{ item.description || "---" }}</td>
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
                      v-if="item.status !== 'inactive'"
                      type="button"
                      class="admin-btn admin-btn--danger"
                      @click.stop="removeCategory(item)"
                    >
                      Xóa
                    </button>
                    <span v-else class="admin-badge admin-badge--danger">Đã xóa</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <AdminPagination
          v-model="currentPage"
          :total-items="filteredCategories.length"
          :page-size="pageSize"
        />
      </div>
    </section>

    <div v-if="showModal" class="admin-modal-mask" @click.self="closeModal">
      <div class="admin-modal">
        <div class="admin-modal__header">
          <div class="admin-modal__title">
            {{ modalMode === "create" ? "Thêm danh mục tin tức" : "Sửa danh mục tin tức" }}
          </div>
          <button type="button" class="admin-btn admin-btn--secondary" @click="closeModal">
            Đóng
          </button>
        </div>

        <div class="admin-modal__body">
          <form class="admin-form" @submit.prevent="submitForm">
            <div class="admin-form__row">
              <label class="admin-form__label">Tên danh mục *</label>
              <div>
                <input
                  v-model="form.name"
                  class="admin-form__control"
                  type="text"
                  :class="{ 'is-invalid': errors.name }"
                />
                <div v-if="errors.name" class="admin-form__error">{{ errors.name }}</div>
              </div>
            </div>
            <div class="admin-form__row">
              <label class="admin-form__label">Slug *</label>
              <div>
                <input
                  v-model="form.slug"
                  class="admin-form__control"
                  type="text"
                  :class="{ 'is-invalid': errors.slug }"
                  @input="handleSlugInput"
                />
                <div v-if="errors.slug" class="admin-form__error">{{ errors.slug }}</div>
              </div>
            </div>
            <div class="admin-form__row">
              <label class="admin-form__label">Trạng thái</label>
              <select v-model="form.status" class="admin-form__select">
                <option value="active">Đang hoạt động</option>
                <option value="inactive">Ngưng hoạt động</option>
              </select>
            </div>
            <div class="admin-form__row">
              <label class="admin-form__label">Mô tả</label>
              <textarea v-model="form.description" class="admin-form__textarea" rows="4" />
            </div>
          </form>
        </div>

        <div class="admin-modal__footer">
          <button type="button" class="admin-btn admin-btn--secondary" @click="closeModal">Hủy</button>
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
