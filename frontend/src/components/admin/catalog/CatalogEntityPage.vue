<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useSchemaForm } from "@/composables/useSchemaForm";
import { toTypedSchema } from "@vee-validate/zod";
import AdminPagination from "@/components/admin/common/AdminPagination.vue";
import {
  imageFileSchema,
  optionalEmailSchema,
  optionalString,
  requiredString,
  slugSchema,
  statusSchema,
  z,
} from "@/validators/common.validator";
import { mapBackendValidationErrors } from "@/utils/validation-error.util";
import { normalizeId } from "@/utils/id.util";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const IMAGE_MAX_SIZE = 10 * 1024 * 1024;

const props = defineProps({
  service: {
    type: Object,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  subtitle: {
    type: String,
    default: "",
  },
  entityLabel: {
    type: String,
    required: true,
  },
  mode: {
    type: String,
    default: "catalog",
  },
  showContactFields: {
    type: Boolean,
    default: false,
  },
  showImageField: {
    type: Boolean,
    default: false,
  },
});

const items = ref([]);
const loading = ref(false);
const saving = ref(false);
const errorMessage = ref("");
const keyword = ref("");
const selectedStatus = ref("");
const currentPage = ref(1);
const pageSize = ref(12);
const showModal = ref(false);
const modalMode = ref("create");
const currentId = ref("");
const imageInputRef = ref(null);
const imageFile = ref(null);
const imagePreview = ref("");
const imageRemoved = ref(false);

const form = reactive({
  code: "",
  name: "",
  slug: "",
  description: "",
  email: "",
  phone: "",
  address: "",
  note: "",
  status: "active",
});

const validationSchema = computed(() =>
  toTypedSchema(
    z
      .object({
        code: optionalString,
        name: requiredString(`Ten ${props.entityLabel} la bat buoc`),
        slug: props.showImageField ? slugSchema : optionalString,
        description: optionalString,
        email: props.showContactFields ? optionalEmailSchema : optionalString,
        phone: optionalString,
        address: optionalString,
        note: optionalString,
        status: statusSchema.optional(),
        image: imageFileSchema,
      })
      .superRefine((value, ctx) => {
        if (
          props.showImageField &&
          modalMode.value === "create" &&
          !value.image
        ) {
          ctx.addIssue({
            code: "custom",
            path: ["image"],
            message: "Anh dai dien la bat buoc",
          });
        }
      }),
  ),
);

const {
  errors,
  resetForm: resetValidation,
  setErrors,
  setValues,
  validate: validateVee,
} = useSchemaForm({
  validationSchema,
  values: () => ({ ...form, image: imageFile.value }),
});

const hasStatus = computed(() =>
  items.value.some((item) => item.status !== undefined && item.status !== null),
);

const filteredItems = computed(() => {
  const q = keyword.value.trim().toLowerCase();

  return items.value.filter((item) => {
    const matchKeyword =
      !q ||
      [
        item.code,
        item.name,
        item.slug,
        item.description,
        item.email,
        item.phone,
        item.address,
        item.note,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));

    const matchStatus =
      !selectedStatus.value || item.status === selectedStatus.value;

    return matchKeyword && matchStatus;
  });
});

const paginatedItems = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return filteredItems.value.slice(start, start + pageSize.value);
});

const activeCount = computed(
  () => items.value.filter((item) => item.status === "active").length,
);

const inactiveCount = computed(
  () => items.value.filter((item) => item.status === "inactive").length,
);

function getId(item) {
  return normalizeId(item);
}

function normalizeList(res) {
  return Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
}

function resetForm() {
  imageRemoved.value = false;
  Object.assign(form, {
    code: "",
    name: "",
    slug: "",
    description: "",
    email: "",
    phone: "",
    address: "",
    note: "",
    status: "active",
  });
  clearImage();
  resetValidation();
}

function fillForm(item) {
  imageRemoved.value = false;
  Object.assign(form, {
    code: item.code || "",
    name: item.name || "",
    slug: item.slug || "",
    description: item.description || "",
    email: item.email || "",
    phone: item.phone || "",
    address: item.address || "",
    note: item.note || "",
    status: item.status || "active",
  });
  imagePreview.value = item.image_url || "";
}

function revokePreview() {
  if (imageFile.value && imagePreview.value) {
    URL.revokeObjectURL(imagePreview.value);
  }
}

function clearImage() {
  revokePreview();
  imageFile.value = null;
  imagePreview.value = "";
  if (imageInputRef.value) imageInputRef.value.value = "";
}

function removeImage() {
  clearImage();
  imageRemoved.value = modalMode.value === "edit";
}

function validateImage(file) {
  if (!file) return "";
  if (!IMAGE_TYPES.includes(file.type)) {
    return "Chỉ chấp nhận ảnh jpeg, png, webp hoặc gif";
  }
  if (file.size > IMAGE_MAX_SIZE) {
    return "Mỗi file ảnh tối đa 10MB";
  }
  return "";
}

function onImageChange(event) {
  const file = event.target.files?.[0] || null;
  if (!file) {
    clearImage();
    return;
  }

  const message = validateImage(file);
  if (message) {
    setErrors({ image: message });
    clearImage();
    return;
  }

  revokePreview();
  imageFile.value = file;
  imageRemoved.value = false;
  imagePreview.value = URL.createObjectURL(file);
  setErrors({ image: "" });
}

function buildPayload() {
  if (props.showImageField) {
    const data = new FormData();
    data.append("name", form.name.trim());
    data.append("slug", form.slug.trim());
    data.append("description", form.description.trim());
    if (imageFile.value) data.append("image", imageFile.value);
    if (imageRemoved.value) data.append("removeImage", "true");
    return data;
  }

  const payload = {
    code: form.code.trim(),
    name: form.name.trim(),
    description: form.description.trim(),
    email: form.email.trim(),
    phone: form.phone.trim(),
    address: form.address.trim(),
    note: form.note.trim(),
    status: form.status || "active",
  };

  Object.keys(payload).forEach((key) => {
    if (payload[key] === "" && !["code", "description", "email", "phone", "address", "note"].includes(key)) delete payload[key];
  });

  return payload;
}

async function validateForm() {
  setValues({
    ...form,
    image: imageFile.value,
  });
  const result = await validateVee();
  return result.valid;
}

async function fetchItems() {
  loading.value = true;
  errorMessage.value = "";
  try {
    items.value = normalizeList(await props.service.getAll());
  } catch (error) {
    console.error(error);
    errorMessage.value =
      error?.response?.data?.message || `Không thể tải ${props.entityLabel}`;
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
  clearImage();
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
      await props.service.create(buildPayload());
      alert(`Tạo ${props.entityLabel} thành công`);
    } else {
      await props.service.update(currentId.value, buildPayload());
      alert(`Cập nhật ${props.entityLabel} thành công`);
    }
    closeModal();
    await fetchItems();
  } catch (error) {
    console.error(error);
    setErrors(mapBackendValidationErrors(error));
    alert(error?.response?.data?.message || `Không thể lưu ${props.entityLabel}`);
  } finally {
    saving.value = false;
  }
}

async function removeItem(item) {
  if (!window.confirm(`Bạn có chắc muốn xóa ${props.entityLabel} này?\n\nDữ liệu sau khi xóa sẽ không thể khôi phục.`)) {
    return;
  }

  try {
    await props.service.remove(getId(item));
    await fetchItems();
    alert(`Đã xóa ${props.entityLabel}`);
  } catch (error) {
    if (!error?.response || error.response.status >= 500) console.error(error);
    alert(error?.response?.data?.message || `Không thể xóa ${props.entityLabel}`);
  }
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

watch([keyword, selectedStatus], () => {
  currentPage.value = 1;
});

watch(filteredItems, (list) => {
  const maxPage = Math.max(1, Math.ceil(list.length / pageSize.value));
  if (currentPage.value > maxPage) currentPage.value = maxPage;
});

onMounted(fetchItems);
</script>

<template>
  <div class="admin-page catalog-page">
    <div class="admin-page-title admin-page-title--stack">
      <h1>{{ title }}</h1>
      <p>{{ subtitle }}</p>
    </div>

    <div class="admin-stat-row admin-stat-row--categories">
      <div class="admin-stat-card">
        <div class="admin-stat-card__label">Tổng số</div>
        <div class="admin-stat-card__value">{{ items.length }}</div>
      </div>
      <div class="admin-stat-card">
        <div class="admin-stat-card__label">Đang lọc</div>
        <div class="admin-stat-card__value">{{ filteredItems.length }}</div>
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
          <div class="admin-panel__header-title">Danh sách</div>
          <div class="admin-panel__header-subtitle">
            Tìm kiếm và quản lý dữ liệu dùng chung cho kho hàng.
          </div>
        </div>
        <div class="catalog-header-actions">
          <button class="admin-btn admin-btn--secondary" @click="fetchItems">
            Làm mới
          </button>
          <button class="admin-btn admin-btn--primary" @click="openCreateModal">
            <i class="fa-solid fa-plus me-1"></i>
            Thêm mới
          </button>
        </div>
      </div>

      <div class="admin-panel__body">
        <div class="row admin-toolbar">
          <div :class="hasStatus ? 'col-md-8 col-lg-8' : 'col-md-12 col-lg-12'">
            <input
              v-model="keyword"
              type="text"
              class="admin-toolbar__input"
              placeholder="Tìm theo mã, tên, mô tả"
            />
          </div>
          <div v-if="hasStatus" class="col-md-4 col-lg-4">
            <select v-model="selectedStatus" class="admin-toolbar__select">
              <option value="">Tất cả trạng thái</option>
              <option value="active">Đang hoạt động</option>
              <option value="inactive">Ngừng hoạt động</option>
            </select>
          </div>
        </div>

        <div v-if="loading" class="admin-empty-state">Đang tải dữ liệu...</div>
        <div v-else-if="errorMessage" class="admin-empty-state">
          {{ errorMessage }}
        </div>
        <div v-else-if="!filteredItems.length" class="admin-empty-state">
          Chưa có dữ liệu phù hợp
        </div>

        <div v-else class="table-responsive">
          <table class="admin-table admin-table--categories">
            <thead>
              <tr>
                <th v-if="showImageField">Ảnh</th>
                <th>Mã/Slug</th>
                <th>Tên</th>
                <th>Mô tả</th>
                <th v-if="showContactFields">Liên hệ</th>
                <th v-if="hasStatus">Trạng thái</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in paginatedItems" :key="getId(item)">
                <td v-if="showImageField">
                  <img
                    v-if="item.image_url"
                    :src="item.image_url"
                    class="catalog-thumb"
                    :alt="item.name"
                  />
                  <div v-else class="admin-thumb-placeholder">Không ảnh</div>
                </td>
                <td>
                  <strong>{{ item.code || item.slug || "---" }}</strong>
                </td>
                <td>{{ item.name || "---" }}</td>
                <td>
                  <div class="admin-description-cell">
                    {{ item.description || item.note || "---" }}
                  </div>
                </td>
                <td v-if="showContactFields">
                  <div>{{ item.email || "---" }}</div>
                  <div class="catalog-sub">{{ item.phone || item.address || "" }}</div>
                </td>
                <td v-if="hasStatus">
                  <span class="admin-badge" :class="statusClass(item.status)">
                    {{ statusText(item.status) }}
                  </span>
                </td>
                <td>
                  <div class="admin-action-stack admin-action-stack--row">
                    <button
                      type="button"
                      class="admin-btn admin-btn--success"
                      @click.stop="openEditModal(item)"
                    >
                      Sửa
                    </button>
                    <button
                      type="button"
                      class="admin-btn admin-btn--danger"
                      @click.stop="removeItem(item)"
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
            :total-items="filteredItems.length"
            :page-size="pageSize"
          />
        </div>
      </div>
    </section>

    <div v-if="showModal" class="admin-modal-mask" @click.self="closeModal">
      <div class="admin-modal admin-modal--wide">
        <div class="admin-modal__header">
          <div class="admin-modal__title">
            {{ modalMode === "create" ? "Thêm mới" : "Cập nhật" }}
          </div>
          <button
            type="button"
            class="admin-btn admin-btn--secondary"
            @click="closeModal"
          >
            x
          </button>
        </div>

        <form class="admin-form catalog-form" @submit.prevent="submitForm">
          <div class="admin-modal__body">
            <div v-if="!showImageField" class="admin-form__row">
              <label class="admin-form__label">Mã</label>
              <input v-model="form.code" class="admin-form__control" />
            </div>

            <div class="admin-form__row">
              <label class="admin-form__label">Tên *</label>
              <div>
                <input
                  v-model="form.name"
                  class="admin-form__control"
                  :class="{ 'is-invalid': errors.name }"
                />
                <div v-if="errors.name" class="admin-form__error">{{ errors.name }}</div>
              </div>
            </div>

            <div v-if="showImageField" class="admin-form__row">
              <label class="admin-form__label">Slug *</label>
              <div>
                <input
                  v-model="form.slug"
                  class="admin-form__control"
                  :class="{ 'is-invalid': errors.slug }"
                />
                <div v-if="errors.slug" class="admin-form__error">{{ errors.slug }}</div>
              </div>
            </div>

            <div class="admin-form__row">
              <label class="admin-form__label">Mô tả</label>
              <textarea
                v-model="form.description"
                class="admin-form__textarea"
                rows="3"
              />
            </div>

            <template v-if="showContactFields">
              <div class="admin-form__row">
                <label class="admin-form__label">Email</label>
                <div>
                  <input
                    v-model="form.email"
                    class="admin-form__control"
                    :class="{ 'is-invalid': errors.email }"
                  />
                  <div v-if="errors.email" class="admin-form__error">{{ errors.email }}</div>
                </div>
              </div>
              <div class="admin-form__row">
                <label class="admin-form__label">Điện thoại</label>
                <input v-model="form.phone" class="admin-form__control" />
              </div>
              <div class="admin-form__row">
                <label class="admin-form__label">Địa chỉ</label>
                <input v-model="form.address" class="admin-form__control" />
              </div>
            </template>

            <div v-if="!showImageField" class="admin-form__row">
              <label class="admin-form__label">Trạng thái</label>
              <select v-model="form.status" class="admin-form__select">
                <option value="active">Đang hoạt động</option>
                <option value="inactive">Ngừng hoạt động</option>
              </select>
            </div>

            <div v-if="!showImageField" class="admin-form__row">
              <label class="admin-form__label">Ghi chú</label>
              <textarea v-model="form.note" class="admin-form__textarea" rows="3" />
            </div>

            <div v-if="showImageField" class="admin-form__row">
              <label class="admin-form__label">Ảnh đại diện</label>
              <div class="catalog-upload">
                <input
                  ref="imageInputRef"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  class="admin-form__control"
                  :class="{ 'is-invalid': errors.image }"
                  @change="onImageChange"
                />
                <div v-if="errors.image" class="admin-form__error">{{ errors.image }}</div>
                <div v-if="imagePreview" class="catalog-image-preview">
                  <img :src="imagePreview" alt="preview" />
                  <button
                    type="button"
                    class="admin-btn admin-btn--danger"
                    @click="removeImage"
                  >
                    Xóa ảnh
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div class="admin-modal__footer">
            <button
              type="button"
              class="admin-btn admin-btn--secondary"
              @click="closeModal"
            >
              Quay lại
            </button>
            <button
              type="submit"
              class="admin-btn admin-btn--primary"
              :disabled="saving"
            >
              {{ saving ? "Đang lưu..." : "Lưu" }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.catalog-header-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.catalog-form {
  margin: 0;
  max-width: none;
}

.catalog-thumb {
  border-radius: 6px;
  height: 56px;
  object-fit: cover;
  width: 56px;
}

.catalog-sub {
  color: #7b8794;
  font-size: 12px;
  margin-top: 4px;
}

.catalog-upload {
  display: grid;
  gap: 12px;
}

.catalog-image-preview {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.catalog-image-preview img {
  border: 1px solid #e8edf3;
  border-radius: 6px;
  height: 110px;
  object-fit: cover;
  width: 110px;
}
</style>
