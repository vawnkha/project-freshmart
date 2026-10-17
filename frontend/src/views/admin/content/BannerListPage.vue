<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useSchemaForm } from "@/composables/useSchemaForm";
import { toTypedSchema } from "@vee-validate/zod";
import AdminPagination from "@/components/common/AdminPagination.vue";
import bannerService from "@/services/banner.service";
import uploadService from "@/services/upload.service";
import {
  dateStringSchema,
  imageFileSchema,
  nonNegativeNumberSchema,
  optionalString,
  statusSchema,
  z,
} from "@/validators/common.validator";
import { mapBackendValidationErrors } from "@/utils/validation-error.util";
import { normalizeId } from "@/utils/id.util";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const banners = ref([]);
const loading = ref(false);
const saving = ref(false);
const uploading = ref(false);
const togglingIds = ref(new Set());
const keyword = ref("");
const positionFilter = ref("");
const statusFilter = ref("");
const showModal = ref(false);
const modalMode = ref("create");
const currentId = ref("");
const currentPage = ref(1);
const pageSize = ref(12);
const desktopInput = ref(null);
const mobileInput = ref(null);
const desktopFile = ref(null);
const mobileFile = ref(null);
const desktopPreview = ref("");
const mobilePreview = ref("");

const form = reactive({
  title: "",
  subtitle: "",
  description: "",
  imageUrl: "",
  mobileImageUrl: "",
  link: "",
  buttonText: "",
  position: "home_hero",
  sortOrder: 0,
  startDate: "",
  endDate: "",
  status: "active",
});

const bannerSchema = toTypedSchema(
  z
    .object({
      title: optionalString,
      subtitle: optionalString,
      description: optionalString,
      image: imageFileSchema,
      mobileImage: imageFileSchema,
      imageUrl: optionalString,
      mobileImageUrl: optionalString,
      link: optionalString,
      buttonText: optionalString,
      position: z.enum(["home_hero", "home_middle", "home_bottom"], {
        message: "Vi tri banner khong hop le",
      }),
      sortOrder: nonNegativeNumberSchema,
      startDate: dateStringSchema,
      endDate: dateStringSchema,
      status: statusSchema,
    })
    .superRefine((value, ctx) => {
      if (!desktopFile.value && !String(value.imageUrl || "").trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["image"],
          message: "Vui long chon anh desktop banner",
        });
      }

      if (
        value.startDate &&
        value.endDate &&
        new Date(value.startDate).getTime() > new Date(value.endDate).getTime()
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["endDate"],
          message: "Ngay ket thuc phai sau ngay bat dau",
        });
      }
    }),
);

const {
  errors,
  resetForm: resetValidation,
  setErrors,
  setValues,
  validate: validateVee,
} = useSchemaForm({
  validationSchema: bannerSchema,
  values: () => ({
    ...form,
    image: desktopFile.value,
    mobileImage: mobileFile.value,
  }),
});

const filteredBanners = computed(() => {
  const q = keyword.value.trim().toLowerCase();

  return banners.value.filter((item) => {
    const matchKeyword =
      !q ||
      [item.title, item.subtitle, item.description, item.link]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    const matchPosition =
      !positionFilter.value || item.position === positionFilter.value;
    const matchStatus = !statusFilter.value || item.status === statusFilter.value;
    return matchKeyword && matchPosition && matchStatus;
  });
});

const paginatedBanners = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return filteredBanners.value.slice(start, start + pageSize.value);
});

const activeCount = computed(
  () => banners.value.filter((item) => item.status === "active").length,
);

const inactiveCount = computed(
  () => banners.value.filter((item) => item.status === "inactive").length,
);

function normalizeList(res) {
  return Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
}

function getId(item) {
  return normalizeId(item);
}

function positionText(position) {
  if (position === "home_hero") return "Home hero";
  if (position === "home_middle") return "Home giữa";
  if (position === "home_bottom") return "Home cuối";
  return position || "---";
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

function isStatusToggling(item) {
  return togglingIds.value.has(getId(item));
}

function formatDate(value) {
  if (!value) return "---";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "---";
  return date.toLocaleDateString("vi-VN");
}

function formatDateInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function validateImageFile(file) {
  if (!file) return "";
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return "Ảnh banner chỉ hỗ trợ JPG, PNG, WEBP hoặc GIF";
  }
  if (file.size > MAX_FILE_SIZE) {
    return "Ảnh banner tối đa 10MB";
  }
  return "";
}

function setPreview(file) {
  if (!file) return "";
  return URL.createObjectURL(file);
}

function resetFileInputs() {
  desktopFile.value = null;
  mobileFile.value = null;
  desktopPreview.value = "";
  mobilePreview.value = "";
  if (desktopInput.value) desktopInput.value.value = "";
  if (mobileInput.value) mobileInput.value.value = "";
}

function resetForm() {
  Object.assign(form, {
    title: "",
    subtitle: "",
    description: "",
    imageUrl: "",
    mobileImageUrl: "",
    link: "",
    buttonText: "",
    position: "home_hero",
    sortOrder: 0,
    startDate: "",
    endDate: "",
    status: "active",
  });
  resetFileInputs();
  resetValidation();
}

function fillForm(item) {
  Object.assign(form, {
    title: item.title || "",
    subtitle: item.subtitle || "",
    description: item.description || "",
    imageUrl: item.imageUrl || "",
    mobileImageUrl: item.mobileImageUrl || "",
    link: item.link || "",
    buttonText: item.buttonText || "",
    position: item.position || "home_hero",
    sortOrder: item.sortOrder ?? 0,
    startDate: formatDateInput(item.startDate),
    endDate: formatDateInput(item.endDate),
    status: item.status || "active",
  });
  resetFileInputs();
  desktopPreview.value = form.imageUrl;
  mobilePreview.value = form.mobileImageUrl;
}

function buildPayload() {
  const payload = {
    title: form.title.trim(),
    subtitle: form.subtitle.trim(),
    description: form.description.trim(),
    imageUrl: form.imageUrl.trim(),
    mobileImageUrl: form.mobileImageUrl.trim(),
    link: form.link.trim(),
    buttonText: form.buttonText.trim(),
    position: form.position,
    sortOrder: Number(form.sortOrder || 0),
    startDate: form.startDate,
    endDate: form.endDate,
    status: form.status || "active",
  };

  Object.keys(payload).forEach((key) => {
    const allowEmptyString = [
      "title", "subtitle", "description", "mobileImageUrl", "link",
      "buttonText", "startDate", "endDate",
    ].includes(key);
    if (
      payload[key] === undefined ||
      (payload[key] === "" && !allowEmptyString)
    ) {
      delete payload[key];
    }
  });

  return payload;
}

async function validateForm() {
  setValues({
    ...form,
    image: desktopFile.value,
    mobileImage: mobileFile.value,
  });
  const result = await validateVee();
  return result.valid;
}

function handleImageChange(type, event) {
  const file = event.target.files?.[0] || null;
  if (!file) return;

  const message = validateImageFile(file);
  if (message) {
    setErrors({ [type === "desktop" ? "image" : "mobileImage"]: message });
    event.target.value = "";
    return;
  }

  if (type === "desktop") {
    desktopFile.value = file;
    desktopPreview.value = setPreview(file);
    setErrors({ image: "" });
  } else {
    mobileFile.value = file;
    mobilePreview.value = setPreview(file);
    setErrors({ mobileImage: "" });
  }
}

function clearDesktopImage() {
  desktopFile.value = null;
  desktopPreview.value = form.imageUrl;
  if (desktopInput.value) desktopInput.value.value = "";
}

function clearMobileImage() {
  mobileFile.value = null;
  form.mobileImageUrl = "";
  mobilePreview.value = "";
  if (mobileInput.value) mobileInput.value.value = "";
}

async function uploadSelectedImages() {
  uploading.value = true;
  try {
    if (desktopFile.value) {
      const result = await uploadService.uploadBannerImage(desktopFile.value);
      if (!result?.success || !result?.url) {
        throw new Error("Upload ảnh desktop thất bại");
      }
      form.imageUrl = result.url;
      desktopPreview.value = result.url;
    }

    if (mobileFile.value) {
      const result = await uploadService.uploadBannerImage(mobileFile.value);
      if (!result?.success || !result?.url) {
        throw new Error("Upload ảnh mobile thất bại");
      }
      form.mobileImageUrl = result.url;
      mobilePreview.value = result.url;
    }
  } finally {
    uploading.value = false;
  }
}

async function fetchBanners() {
  loading.value = true;
  try {
    const res = await bannerService.getAll();
    banners.value = normalizeList(res);
  } catch (error) {
    console.error(error);
    alert(error?.response?.data?.message || "Không thể tải banner");
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
    await uploadSelectedImages();

    if (modalMode.value === "create") {
      await bannerService.create(buildPayload());
      alert("Tạo banner thành công");
    } else {
      await bannerService.update(currentId.value, buildPayload());
      alert("Cập nhật banner thành công");
    }

    closeModal();
    await fetchBanners();
  } catch (error) {
    console.error(error);
    setErrors(mapBackendValidationErrors(error));
    alert(error?.response?.data?.message || error.message || "Không thể lưu banner");
  } finally {
    saving.value = false;
  }
}

async function removeBanner(item) {
  if (!window.confirm("Bạn có chắc muốn xóa banner này?\n\nDữ liệu sau khi xóa sẽ không thể khôi phục.")) return;

  try {
    await bannerService.remove(getId(item));
    await fetchBanners();
    alert("Đã xóa banner");
  } catch (error) {
    console.error(error);
    alert(error?.response?.data?.message || "Không thể xóa banner");
  }
}

async function toggleBannerStatus(item) {
  const id = getId(item);
  if (!id || isStatusToggling(item)) return;

  const nextStatus = item.status === "active" ? "inactive" : "active";
  togglingIds.value = new Set([...togglingIds.value, id]);

  try {
    const res = await bannerService.update(id, { status: nextStatus });
    const updated = res?.data || { ...item, status: nextStatus };
    banners.value = banners.value.map((banner) =>
      getId(banner) === id ? { ...banner, ...updated } : banner,
    );
  } catch (error) {
    console.error(error);
    alert(error?.response?.data?.message || "Không thể cập nhật trạng thái banner");
  } finally {
    const nextIds = new Set(togglingIds.value);
    nextIds.delete(id);
    togglingIds.value = nextIds;
  }
}

watch([keyword, positionFilter, statusFilter], () => {
  currentPage.value = 1;
});

watch(filteredBanners, (list) => {
  const maxPage = Math.max(1, Math.ceil(list.length / pageSize.value));
  if (currentPage.value > maxPage) currentPage.value = maxPage;
});

onMounted(fetchBanners);
</script>

<template>
  <div class="admin-page">
    <div class="admin-page-title admin-page-title--stack">
      <h1>Banner</h1>
      <p>Quản lý banner động hiển thị trên website.</p>
    </div>

    <div class="admin-stat-row admin-stat-row--orders">
      <div class="admin-stat-card">
        <div class="admin-stat-card__label">Tổng banner</div>
        <div class="admin-stat-card__value">{{ banners.length }}</div>
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
          <div class="admin-panel__header-title">Danh sách banner</div>
        </div>

        <button type="button" class="admin-btn admin-btn--primary" @click="openCreateModal">
          <i class="fa-solid fa-plus me-1"></i>
          Thêm banner
        </button>
      </div>

      <div class="admin-panel__body">
        <div class="row admin-toolbar">
          <div class="col-md-5">
            <input
              v-model="keyword"
              type="text"
              class="admin-toolbar__input"
              placeholder="Tìm theo tiêu đề, mô tả, link..."
            />
          </div>
          <div class="col-md-4">
            <select v-model="positionFilter" class="admin-toolbar__select">
              <option value="">Tất cả vị trí</option>
              <option value="home_hero">Home hero</option>
              <option value="home_middle">Home giữa</option>
              <option value="home_bottom">Home cuối</option>
            </select>
          </div>
          <div class="col-md-3">
            <select v-model="statusFilter" class="admin-toolbar__select">
              <option value="">Tất cả trạng thái</option>
              <option value="active">Đang hoạt động</option>
              <option value="inactive">Ngưng hoạt động</option>
            </select>
          </div>
        </div>

        <div v-if="loading" class="admin-empty-state">Đang tải banner...</div>
        <div v-else-if="!filteredBanners.length" class="admin-empty-state">
          {{ banners.length ? "Không có banner phù hợp." : "Chưa có banner nào." }}
        </div>
        <div v-else class="table-responsive">
          <table class="admin-table admin-table--orders">
            <thead>
              <tr>
                <th>Banner</th>
                <th>Vị trí</th>
                <th>Thứ tự</th>
                <th>Thời gian active</th>
                <th>Trạng thái</th>
                <th>Cập nhật</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in paginatedBanners" :key="getId(item)">
                <td>
                  <div class="banner-row">
                    <img
                      class="banner-row__thumb"
                      :src="item.imageUrl"
                      :alt="item.title || 'Banner'"
                    />
                    <div class="banner-row__body">
                      <strong>{{ item.title || "---" }}</strong>
                      <div class="inventory-sub">
                        {{ item.subtitle || item.description || "---" }}
                      </div>
                      <a
                        v-if="item.link"
                        class="banner-row__link"
                        :href="item.link"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {{ item.link }}
                      </a>
                    </div>
                  </div>
                </td>
                <td>{{ positionText(item.position) }}</td>
                <td>
                  <span class="admin-badge admin-badge--info">
                    {{ item.sortOrder ?? 0 }}
                  </span>
                </td>
                <td>{{ formatDate(item.startDate) }} - {{ formatDate(item.endDate) }}</td>
                <td>
                  <div class="banner-status-control">
                    <span class="admin-badge" :class="statusClass(item.status)">
                      {{ statusText(item.status) }}
                    </span>
                    <button
                      type="button"
                      class="admin-btn"
                      :class="
                        item.status === 'active'
                          ? 'admin-btn--secondary'
                          : 'admin-btn--primary'
                      "
                      :disabled="isStatusToggling(item)"
                      @click.stop="toggleBannerStatus(item)"
                    >
                      {{
                        isStatusToggling(item)
                          ? "Đang lưu..."
                          : item.status === "active"
                            ? "Tắt"
                            : "Bật"
                      }}
                    </button>
                  </div>
                </td>
                <td>{{ formatDate(item.updatedAt || item.createdAt) }}</td>
                <td>
                  <div class="admin-table__actions">
                    <button
                      type="button"
                      class="admin-btn admin-btn--secondary"
                      @click.stop="openEditModal(item)"
                    >
                      Sửa
                    </button>
                    <button
                      type="button"
                      class="admin-btn admin-btn--danger"
                      @click.stop="removeBanner(item)"
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
            :total-items="filteredBanners.length"
            :page-size="pageSize"
          />
        </div>
      </div>
    </section>

    <div v-if="showModal" class="admin-modal-mask" @click.self="closeModal">
      <div class="admin-modal">
        <div class="admin-modal__header">
          <div class="admin-modal__title">
            {{ modalMode === "create" ? "Thêm banner" : "Sửa banner" }}
          </div>
          <button type="button" class="admin-btn admin-btn--secondary" @click="closeModal">
            Đóng
          </button>
        </div>

        <div class="admin-modal__body">
          <form class="admin-form" @submit.prevent="submitForm">
            <div class="admin-form__row">
              <label class="admin-form__label">Tiêu đề</label>
              <input v-model="form.title" class="admin-form__control" />
            </div>

            <div class="admin-form__row">
              <label class="admin-form__label">Phụ đề</label>
              <input v-model="form.subtitle" class="admin-form__control" />
            </div>

            <div class="admin-form__row">
              <label class="admin-form__label">Mô tả</label>
              <textarea v-model="form.description" class="admin-form__textarea" rows="3" />
            </div>

            <div class="admin-form__row">
              <label class="admin-form__label">Ảnh desktop *</label>
              <input
                ref="desktopInput"
                class="admin-form__control"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                :class="{ 'is-invalid': errors.image }"
                @change="handleImageChange('desktop', $event)"
              />
              <div v-if="errors.image" class="admin-form__error">{{ errors.image }}</div>
              <div v-if="desktopPreview" class="banner-upload-preview">
                <img :src="desktopPreview" alt="Desktop banner preview" />
                <button
                  type="button"
                  class="admin-btn admin-btn--secondary"
                  @click="clearDesktopImage"
                >
                  Xóa ảnh đã chọn
                </button>
              </div>
              <div v-else class="banner-upload-empty">Chưa chọn ảnh desktop</div>
            </div>

            <div class="admin-form__row">
              <label class="admin-form__label">Ảnh mobile</label>
              <input
                ref="mobileInput"
                class="admin-form__control"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                :class="{ 'is-invalid': errors.mobileImage }"
                @change="handleImageChange('mobile', $event)"
              />
              <div v-if="errors.mobileImage" class="admin-form__error">
                {{ errors.mobileImage }}
              </div>
              <div
                v-if="mobilePreview"
                class="banner-upload-preview banner-upload-preview--mobile"
              >
                <img :src="mobilePreview" alt="Mobile banner preview" />
                <button
                  type="button"
                  class="admin-btn admin-btn--secondary"
                  @click="clearMobileImage"
                >
                  Xóa ảnh mobile
                </button>
              </div>
              <div v-else class="banner-upload-empty">
                Có thể bỏ trống nếu dùng chung ảnh desktop
              </div>
            </div>

            <div class="admin-form__row">
              <label class="admin-form__label">Link</label>
              <input
                v-model="form.link"
                class="admin-form__control"
                placeholder="/products hoặc https://..."
              />
            </div>

            <div class="admin-form__row">
              <label class="admin-form__label">Nút CTA</label>
              <input
                v-model="form.buttonText"
                class="admin-form__control"
                placeholder="Mua ngay"
              />
            </div>

            <div class="admin-form__row">
              <label class="admin-form__label">Vị trí</label>
              <select v-model="form.position" class="admin-form__select">
                <option value="home_hero">Home hero</option>
                <option value="home_middle">Home giữa</option>
                <option value="home_bottom">Home cuối</option>
              </select>
            </div>

            <div class="admin-form__row">
              <label class="admin-form__label">Thứ tự</label>
              <input
                v-model="form.sortOrder"
                type="number"
                min="0"
                class="admin-form__control"
                :class="{ 'is-invalid': errors.sortOrder }"
              />
              <div v-if="errors.sortOrder" class="admin-form__error">
                {{ errors.sortOrder }}
              </div>
            </div>

            <div class="admin-form__row">
              <label class="admin-form__label">Ngày bắt đầu</label>
              <input v-model="form.startDate" type="date" class="admin-form__control" />
            </div>

            <div class="admin-form__row">
              <label class="admin-form__label">Ngày kết thúc</label>
              <input
                v-model="form.endDate"
                type="date"
                class="admin-form__control"
                :class="{ 'is-invalid': errors.endDate }"
              />
              <div v-if="errors.endDate" class="admin-form__error">{{ errors.endDate }}</div>
            </div>

            <div class="admin-form__row">
              <label class="admin-form__label">Trạng thái</label>
              <select v-model="form.status" class="admin-form__select">
                <option value="active">Đang hoạt động</option>
                <option value="inactive">Ngưng hoạt động</option>
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
            :disabled="saving || uploading"
            @click="submitForm"
          >
            {{ saving || uploading ? "Đang lưu..." : "Lưu" }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.banner-row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 280px;
}

.banner-row__thumb {
  width: 96px;
  height: 54px;
  object-fit: cover;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #f8fafc;
}

.banner-row__body {
  min-width: 0;
}

.banner-row__link {
  display: block;
  max-width: 280px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #2563eb;
  font-size: 12px;
}

.banner-status-control {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.banner-status-control .admin-btn {
  min-width: 64px;
}

.banner-upload-preview {
  display: grid;
  gap: 10px;
  margin-top: 10px;
  max-width: 360px;
}

.banner-upload-preview img {
  width: 100%;
  height: 150px;
  object-fit: cover;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #f8fafc;
}

.banner-upload-preview--mobile {
  max-width: 180px;
}

.banner-upload-preview--mobile img {
  height: 140px;
}

.banner-upload-empty {
  margin-top: 10px;
  padding: 14px;
  border: 1px dashed #cbd5e1;
  border-radius: 6px;
  color: #64748b;
  background: #f8fafc;
}
</style>
