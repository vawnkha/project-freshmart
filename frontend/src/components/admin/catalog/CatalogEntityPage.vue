<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue";
import AdminPagination from "@/components/common/AdminPagination.vue";

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
  return item?._id || item?.id || "";
}

function normalizeList(res) {
  return Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
}

function resetForm() {
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
}

function fillForm(item) {
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

function validateImage(file) {
  if (!file) return "";
  if (!IMAGE_TYPES.includes(file.type)) {
    return "Chi chap nhan anh jpeg, png, webp hoac gif";
  }
  if (file.size > IMAGE_MAX_SIZE) {
    return "Moi file anh toi da 10MB";
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
    alert(message);
    clearImage();
    return;
  }

  revokePreview();
  imageFile.value = file;
  imagePreview.value = URL.createObjectURL(file);
}

function buildPayload() {
  if (props.showImageField) {
    const data = new FormData();
    data.append("name", form.name.trim());
    data.append("slug", form.slug.trim());
    data.append("description", form.description.trim());
    if (imageFile.value) data.append("image", imageFile.value);
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
    if (payload[key] === "") delete payload[key];
  });

  return payload;
}

function validateForm() {
  if (!form.name.trim()) return `Ten ${props.entityLabel} la bat buoc`;
  if (props.showImageField && !form.slug.trim()) return "Slug la bat buoc";
  if (props.showImageField && modalMode.value === "create" && !imageFile.value) {
    return "Anh dai dien la bat buoc";
  }
  return "";
}

async function fetchItems() {
  loading.value = true;
  errorMessage.value = "";
  try {
    items.value = normalizeList(await props.service.getAll());
  } catch (error) {
    console.error(error);
    errorMessage.value =
      error?.response?.data?.message || `Khong the tai ${props.entityLabel}`;
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
  const message = validateForm();
  if (message) {
    alert(message);
    return;
  }

  saving.value = true;
  try {
    if (modalMode.value === "create") {
      await props.service.create(buildPayload());
      alert(`Tao ${props.entityLabel} thanh cong`);
    } else {
      await props.service.update(currentId.value, buildPayload());
      alert(`Cap nhat ${props.entityLabel} thanh cong`);
    }
    closeModal();
    await fetchItems();
  } catch (error) {
    console.error(error);
    alert(error?.response?.data?.message || `Khong the luu ${props.entityLabel}`);
  } finally {
    saving.value = false;
  }
}

async function removeItem(item) {
  if (!window.confirm(`Ban co chac muon xoa/ngung ${props.entityLabel} nay?`)) {
    return;
  }

  try {
    await props.service.remove(getId(item));
    await fetchItems();
    alert(`Da xoa/ngung ${props.entityLabel}`);
  } catch (error) {
    console.error(error);
    alert(error?.response?.data?.message || `Khong the xoa ${props.entityLabel}`);
  }
}

function statusText(status) {
  if (status === "active") return "Dang hoat dong";
  if (status === "inactive") return "Ngung hoat dong";
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
        <div class="admin-stat-card__label">Tong so</div>
        <div class="admin-stat-card__value">{{ items.length }}</div>
      </div>
      <div class="admin-stat-card">
        <div class="admin-stat-card__label">Dang loc</div>
        <div class="admin-stat-card__value">{{ filteredItems.length }}</div>
      </div>
      <div class="admin-stat-card">
        <div class="admin-stat-card__label">Dang hoat dong</div>
        <div class="admin-stat-card__value">{{ activeCount }}</div>
      </div>
      <div class="admin-stat-card">
        <div class="admin-stat-card__label">Ngung hoat dong</div>
        <div class="admin-stat-card__value">{{ inactiveCount }}</div>
      </div>
    </div>

    <section class="admin-panel">
      <div class="admin-panel__header admin-panel__header--flex">
        <div>
          <div class="admin-panel__header-title">Danh sach</div>
          <div class="admin-panel__header-subtitle">
            Tim kiem va quan ly du lieu dung chung cho kho hang.
          </div>
        </div>
        <div class="catalog-header-actions">
          <button class="admin-btn admin-btn--secondary" @click="fetchItems">
            Lam moi
          </button>
          <button class="admin-btn admin-btn--primary" @click="openCreateModal">
            <i class="fa-solid fa-plus me-1"></i>
            Them moi
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
              placeholder="Tim theo ma, ten, mo ta"
            />
          </div>
          <div v-if="hasStatus" class="col-md-4 col-lg-4">
            <select v-model="selectedStatus" class="admin-toolbar__select">
              <option value="">Tat ca trang thai</option>
              <option value="active">Dang hoat dong</option>
              <option value="inactive">Ngung hoat dong</option>
            </select>
          </div>
        </div>

        <div v-if="loading" class="admin-empty-state">Dang tai du lieu...</div>
        <div v-else-if="errorMessage" class="admin-empty-state">
          {{ errorMessage }}
        </div>
        <div v-else-if="!filteredItems.length" class="admin-empty-state">
          Chua co du lieu phu hop
        </div>

        <div v-else class="table-responsive">
          <table class="admin-table admin-table--categories">
            <thead>
              <tr>
                <th v-if="showImageField">Anh</th>
                <th>Ma/Slug</th>
                <th>Ten</th>
                <th>Mo ta</th>
                <th v-if="showContactFields">Lien he</th>
                <th v-if="hasStatus">Trang thai</th>
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
                  <div v-else class="admin-thumb-placeholder">Khong anh</div>
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
                      class="admin-btn admin-btn--success"
                      @click="openEditModal(item)"
                    >
                      Sua
                    </button>
                    <button
                      class="admin-btn admin-btn--danger"
                      @click="removeItem(item)"
                    >
                      Xoa/Ngung
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
            {{ modalMode === "create" ? "Them moi" : "Cap nhat" }}
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
              <label class="admin-form__label">Ma</label>
              <input v-model="form.code" class="admin-form__control" />
            </div>

            <div class="admin-form__row">
              <label class="admin-form__label">Ten *</label>
              <input v-model="form.name" class="admin-form__control" />
            </div>

            <div v-if="showImageField" class="admin-form__row">
              <label class="admin-form__label">Slug *</label>
              <input v-model="form.slug" class="admin-form__control" />
            </div>

            <div class="admin-form__row">
              <label class="admin-form__label">Mo ta</label>
              <textarea
                v-model="form.description"
                class="admin-form__textarea"
                rows="3"
              />
            </div>

            <template v-if="showContactFields">
              <div class="admin-form__row">
                <label class="admin-form__label">Email</label>
                <input v-model="form.email" class="admin-form__control" />
              </div>
              <div class="admin-form__row">
                <label class="admin-form__label">Dien thoai</label>
                <input v-model="form.phone" class="admin-form__control" />
              </div>
              <div class="admin-form__row">
                <label class="admin-form__label">Dia chi</label>
                <input v-model="form.address" class="admin-form__control" />
              </div>
            </template>

            <div v-if="!showImageField" class="admin-form__row">
              <label class="admin-form__label">Trang thai</label>
              <select v-model="form.status" class="admin-form__select">
                <option value="active">Dang hoat dong</option>
                <option value="inactive">Ngung hoat dong</option>
              </select>
            </div>

            <div v-if="!showImageField" class="admin-form__row">
              <label class="admin-form__label">Ghi chu</label>
              <textarea v-model="form.note" class="admin-form__textarea" rows="3" />
            </div>

            <div v-if="showImageField" class="admin-form__row">
              <label class="admin-form__label">Anh dai dien</label>
              <div class="catalog-upload">
                <input
                  ref="imageInputRef"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  class="admin-form__control"
                  @change="onImageChange"
                />
                <div v-if="imagePreview" class="catalog-image-preview">
                  <img :src="imagePreview" alt="preview" />
                  <button
                    v-if="imageFile"
                    type="button"
                    class="admin-btn admin-btn--danger"
                    @click="clearImage"
                  >
                    Xoa anh da chon
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
              Quay lai
            </button>
            <button
              type="submit"
              class="admin-btn admin-btn--primary"
              :disabled="saving"
            >
              {{ saving ? "Dang luu..." : "Luu" }}
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
