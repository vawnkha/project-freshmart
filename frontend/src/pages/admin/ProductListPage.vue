<script setup>
import { computed, nextTick, onMounted, reactive, ref, watch } from "vue";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import categoryService from "@/services/category.service";
import productService from "@/services/product.service";
import AdminPagination from "@/components/common/AdminPagination.vue";
import {
  imageFileSchema,
  optionalNonNegativeNumberSchema,
  optionalObjectIdSchema,
  optionalString,
  requiredString,
  z,
} from "@/validators/common.validator";
import { mapBackendValidationErrors } from "@/utils/validation-error.util";

const products = ref([]);
const categories = ref([]);
const keyword = ref("");
const showEditModal = ref(false);
const saving = ref(false);

const currentPage = ref(1);
const pageSize = ref(12);

const thumbnailInputRef = ref(null);
const imagesInputRef = ref(null);

const currentThumbnail = ref("");
const currentImages = ref([]);
const newThumbnailPreview = ref("");
const newImagePreviews = ref([]);

const editForm = reactive({
  _id: "",
  name: "",
  category_id: "",
  description: "",
  price: "",
  stock: "",
  unit: "",
  inventoryItemId: "",
  thumbnail: null,
  images: [],
});

const productEditSchema = toTypedSchema(
  z.object({
    name: requiredString("Ten san pham la bat buoc"),
    category_id: optionalObjectIdSchema,
    description: optionalString,
    price: optionalNonNegativeNumberSchema,
    stock: optionalNonNegativeNumberSchema,
    unit: optionalString,
    inventoryItemId: optionalObjectIdSchema,
    thumbnail: imageFileSchema.optional(),
    images: z.array(imageFileSchema).max(4, "Anh chi tiet toi da 4 file"),
  }),
);

const {
  errors: editErrors,
  resetForm: resetEditValidation,
  setErrors: setEditErrors,
  setValues: setEditValues,
  validate: validateEditVee,
} = useForm({
  validationSchema: productEditSchema,
});

const filteredProducts = computed(() => {
  const q = keyword.value.trim().toLowerCase();
  if (!q) return products.value;

  return products.value.filter((item) =>
    [
      item.name,
      item.description,
      item.category_name,
      item.category?.name,
      item.category_id,
      item.productCode,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(q)),
  );
});

const paginatedProducts = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return filteredProducts.value.slice(start, start + pageSize.value);
});

const totalProducts = computed(() => products.value.length);
const inStockProducts = computed(
  () => products.value.filter((item) => Number(item.stock) > 0).length,
);
const outOfStockProducts = computed(
  () => products.value.filter((item) => Number(item.stock) <= 0).length,
);
const isEditingInventoryProduct = computed(() => Boolean(editForm.inventoryItemId));

async function fetchData() {
  try {
    const [productRes, categoryRes] = await Promise.all([
      productService.getAll(),
      categoryService.getAll(),
    ]);

    products.value = productRes?.data || [];
    categories.value = categoryRes?.data || categoryRes || [];
  } catch (error) {
    console.error("Lỗi tải dữ liệu sản phẩm:", error);
    alert(error?.response?.data?.message || "Không thể tải danh sách sản phẩm");
  }
}

function normalizeId(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value.$oid) return value.$oid;
  return String(value);
}

function hasInventoryLink(item) {
  return Boolean(normalizeId(item?.inventoryItemId));
}

function openEditModal(item) {
  resetEditValidation();
  editForm._id = item._id || item.id;
  editForm.name = item.name || "";
  editForm.category_id = item.category_id || "";
  editForm.description = item.description || "";
  editForm.price = item.price ?? "";
  editForm.stock = item.stock ?? "";
  editForm.unit = item.unit || "";
  editForm.inventoryItemId = normalizeId(item.inventoryItemId);
  editForm.thumbnail = null;
  editForm.images = [];

  currentThumbnail.value = item.thumbnail || "";
  currentImages.value = Array.isArray(item.images) ? item.images : [];
  newThumbnailPreview.value = "";
  newImagePreviews.value = [];

  showEditModal.value = true;

  nextTick(() => {
    if (thumbnailInputRef.value) thumbnailInputRef.value.value = "";
    if (imagesInputRef.value) imagesInputRef.value.value = "";
  });
}

function closeEditModal() {
  showEditModal.value = false;
  resetEditValidation();
}

function triggerThumbnailInput() {
  thumbnailInputRef.value?.click();
}

function triggerImagesInput() {
  imagesInputRef.value?.click();
}

function onEditThumbnailChange(event) {
  const file = event.target.files?.[0] || null;
  editForm.thumbnail = file;
  newThumbnailPreview.value = file ? URL.createObjectURL(file) : "";
}

function onEditImagesChange(event) {
  const files = Array.from(event.target.files || []).slice(0, 4);
  editForm.images = files;
  newImagePreviews.value = files.map((file) => URL.createObjectURL(file));
}

function clearNewThumbnail() {
  editForm.thumbnail = null;
  newThumbnailPreview.value = "";
  if (thumbnailInputRef.value) {
    thumbnailInputRef.value.value = "";
  }
}

function removeNewImage(index) {
  editForm.images.splice(index, 1);
  newImagePreviews.value.splice(index, 1);

  if (editForm.images.length === 0 && imagesInputRef.value) {
    imagesInputRef.value.value = "";
  }
}

function clearAllNewImages() {
  editForm.images = [];
  newImagePreviews.value = [];
  if (imagesInputRef.value) {
    imagesInputRef.value.value = "";
  }
}

async function validateEditForm() {
  setEditValues({
    name: editForm.name,
    category_id: editForm.category_id,
    description: editForm.description,
    price: editForm.price,
    stock: isEditingInventoryProduct.value ? "" : editForm.stock,
    unit: editForm.unit,
    inventoryItemId: editForm.inventoryItemId,
    thumbnail: editForm.thumbnail,
    images: [...editForm.images],
  });
  const result = await validateEditVee();
  return result.valid;
}

async function submitEdit() {
  const valid = await validateEditForm();
  if (!valid) return;

  saving.value = true;
  try {
    const data = new FormData();
    data.append("name", editForm.name);
    data.append("category_id", editForm.category_id);
    data.append("description", editForm.description);
    data.append("price", String(editForm.price));
    if (!isEditingInventoryProduct.value) {
      data.append("stock", String(editForm.stock));
    }
    data.append("unit", editForm.unit);

    if (editForm.thumbnail) {
      data.append("thumbnail", editForm.thumbnail);
    }

    if (editForm.images.length > 0) {
      editForm.images.forEach((file) => {
        data.append("images", file);
      });
    }

    await productService.update(editForm._id, data);
    closeEditModal();
    await fetchData();
    alert("Cập nhật sản phẩm thành công");
  } catch (error) {
    console.error("Lỗi cập nhật sản phẩm:", error);
    setEditErrors(mapBackendValidationErrors(error));
    alert(error?.response?.data?.message || "Cập nhật sản phẩm thất bại");
  } finally {
    saving.value = false;
  }
}

async function removeProduct(id) {
  if (!window.confirm("Bạn có chắc muốn xóa sản phẩm này?")) return;

  try {
    await productService.delete(id);

    if (paginatedProducts.value.length === 1 && currentPage.value > 1) {
      currentPage.value -= 1;
    }

    await fetchData();
    alert("Xóa sản phẩm thành công");
  } catch (error) {
    console.error("Lỗi xóa sản phẩm:", error);
    alert(error?.response?.data?.message || "Xóa sản phẩm thất bại");
  }
}

function resolveStatus(stock) {
  return Number(stock) > 0 ? "Còn hàng" : "Hết hàng";
}

function handlePageChange(page) {
  currentPage.value = page;
}

watch(keyword, () => {
  currentPage.value = 1;
});

watch(filteredProducts, (list) => {
  const maxPage = Math.max(1, Math.ceil(list.length / pageSize.value));
  if (currentPage.value > maxPage) currentPage.value = maxPage;
});

onMounted(fetchData);
</script>

<template>
  <div class="admin-page">
    <div class="admin-page-title admin-page-title--stack">
      <h1>Quản lý sản phẩm</h1>
      <p>Danh sách tất cả sản phẩm</p>
    </div>

    <div class="admin-stat-row admin-stat-row--products">
      <div class="admin-stat-card">
        <div class="admin-stat-card__label">Tổng sản phẩm</div>
        <div class="admin-stat-card__value">{{ totalProducts }}</div>
      </div>

      <div class="admin-stat-card">
        <div class="admin-stat-card__label">Còn hàng</div>
        <div class="admin-stat-card__value">{{ inStockProducts }}</div>
      </div>

      <div class="admin-stat-card">
        <div class="admin-stat-card__label">Hết hàng</div>
        <div class="admin-stat-card__value">{{ outOfStockProducts }}</div>
      </div>

      <div class="admin-stat-card">
        <div class="admin-stat-card__label">Danh mục</div>
        <div class="admin-stat-card__value">{{ categories.length }}</div>
      </div>
    </div>

    <section class="admin-panel admin-panel--products">
      <div class="admin-panel__header admin-panel__header--flex">
        <div>
          <div class="admin-panel__header-title">Danh sách sản phẩm</div>
          <div class="admin-panel__header-subtitle">
            Trang quản lý sản phẩm cho phép admin chỉnh sửa và xóa các sản phẩm
            hiện có.
          </div>
        </div>

        <button class="admin-btn admin-btn--secondary" @click="fetchData">
          Làm mới
        </button>
      </div>

      <div class="admin-panel__body">
        <div class="admin-toolbar admin-toolbar--single">
          <input
            v-model="keyword"
            type="text"
            class="admin-toolbar__input"
            placeholder="Tìm kiếm"
          />
        </div>

        <div v-if="!filteredProducts.length" class="admin-empty-state">
          Không có sản phẩm phù hợp
        </div>

        <div v-else class="table-responsive">
          <table class="admin-table admin-table--products">
            <thead>
              <tr>
                <th>Hình ảnh</th>
                <th>Tên sản phẩm</th>
                <th>Danh mục</th>
                <th>Mô tả</th>
                <th>SL</th>
                <th>Giá</th>
                <th>ĐV</th>
                <th>Trạng thái</th>
                <th></th>
              </tr>
            </thead>

            <tbody>
              <tr v-for="item in paginatedProducts" :key="item._id || item.id">
                <td>
                  <div class="admin-product-thumb-wrap">
                    <img
                      :src="item.thumbnail"
                      class="admin-thumb admin-thumb--product"
                      :alt="item.name"
                    />
                  </div>
                </td>

                <td>
                  <div class="admin-product-info">
                    <strong>{{ item.name }}</strong>
                    <div class="mt-2">
                      <span
                        class="admin-badge"
                        :class="
                          hasInventoryLink(item)
                            ? 'admin-badge--info'
                            : 'admin-badge--warning'
                        "
                      >
                        {{ hasInventoryLink(item) ? "Từ kho" : "Legacy" }}
                      </span>
                    </div>
                  </div>
                </td>

                <td>
                  {{
                    item.category_name ||
                    item.category?.name ||
                    item.category_id ||
                    "---"
                  }}
                </td>

                <td>
                  <div class="admin-description-cell">
                    {{ item.description || "---" }}
                  </div>
                </td>

                <td>
                  <strong>{{ item.stock }}</strong>
                  <div v-if="hasInventoryLink(item)" class="admin-note">
                    Từ tổng tồn kho
                  </div>
                </td>

                <td class="admin-price-cell">
                  {{ Number(item.price || 0).toLocaleString("vi-VN") }} VND
                </td>

                <td>{{ item.unit || "---" }}</td>

                <td>
                  <span
                    class="admin-badge"
                    :class="
                      Number(item.stock) > 0
                        ? 'admin-badge--success'
                        : 'admin-badge--danger'
                    "
                  >
                    {{ resolveStatus(item.stock) }}
                  </span>
                </td>

                <td>
                  <div class="admin-action-stack admin-action-stack--row">
                    <button
                      class="admin-btn admin-btn--success"
                      @click="openEditModal(item)"
                    >
                      <i class="fa-solid fa-pen-to-square me-1"></i>
                      Chỉnh sửa
                    </button>

                    <button
                      class="admin-btn admin-btn--danger"
                      @click="removeProduct(item._id || item.id)"
                    >
                      <i class="fa-solid fa-trash me-1"></i>
                      Xóa
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          <AdminPagination
            v-model="currentPage"
            :total-items="filteredProducts.length"
            :page-size="pageSize"
            @change="handlePageChange"
          />
        </div>
      </div>
    </section>

    <div
      v-if="showEditModal"
      class="admin-modal-mask"
      @click.self="closeEditModal"
    >
      <div class="admin-modal admin-modal--product">
        <div class="admin-modal__header">
          <div class="admin-modal__title">Chỉnh sửa sản phẩm</div>
          <button
            type="button"
            class="admin-btn admin-btn--secondary"
            @click="closeEditModal"
          >
            ×
          </button>
        </div>

        <div class="admin-modal__body">
          <div class="admin-form__row">
            <label class="admin-form__label">Tên sản phẩm *</label>
            <div>
              <input
                v-model="editForm.name"
                class="admin-form__control"
                :class="{ 'is-invalid': editErrors.name }"
              />
              <div v-if="editErrors.name" class="admin-form__error">
                {{ editErrors.name }}
              </div>
            </div>
          </div>

          <div class="admin-form__row">
            <label class="admin-form__label">Danh mục *</label>
            <select v-model="editForm.category_id" class="admin-form__select">
              <option value="">Chọn danh mục</option>
              <option
                v-for="item in categories"
                :key="item._id || item.id"
                :value="item._id || item.id"
              >
                {{ item.name }}
              </option>
            </select>
          </div>

          <div class="admin-form__row">
            <label class="admin-form__label">Mô tả *</label>
            <textarea
              v-model="editForm.description"
              class="admin-form__textarea"
              rows="5"
            />
          </div>

          <div class="admin-form__row">
            <label class="admin-form__label">Giá</label>
            <div>
              <input
                v-model="editForm.price"
                type="number"
                min="0"
                class="admin-form__control"
                :class="{ 'is-invalid': editErrors.price }"
              />
              <div v-if="editErrors.price" class="admin-form__error">
                {{ editErrors.price }}
              </div>
            </div>
          </div>

          <div class="admin-form__row">
            <label class="admin-form__label">Số lượng</label>
            <input
              v-model="editForm.stock"
              type="number"
              min="0"
              class="admin-form__control"
              :class="{ 'is-invalid': editErrors.stock }"
              :disabled="isEditingInventoryProduct"
            />
            <div v-if="editErrors.stock" class="admin-form__error">
              {{ editErrors.stock }}
            </div>
            <div v-if="isEditingInventoryProduct" class="admin-note mt-2">
              Tồn kho được quản lý bằng lô hàng và tổng tồn, không sửa trực tiếp tại sản phẩm.
            </div>
          </div>

          <div class="admin-form__row">
            <label class="admin-form__label">Đơn vị</label>
            <input v-model="editForm.unit" class="admin-form__control" />
          </div>

          <div class="admin-form__row">
            <label class="admin-form__label">Ảnh đại diện hiện tại</label>
            <div class="admin-image-block">
              <div v-if="currentThumbnail" class="admin-image-grid">
                <div class="admin-image-card admin-image-card--large">
                  <div class="admin-image-preview admin-image-preview--large">
                    <img :src="currentThumbnail" alt="thumbnail-current" />
                  </div>
                  <div class="admin-image-meta">Ảnh đại diện hiện tại</div>
                </div>
              </div>
              <div v-else class="admin-empty-box admin-empty-box--large">
                Chưa có ảnh đại diện
              </div>
            </div>
          </div>

          <div class="admin-form__row">
            <label class="admin-form__label">Đổi ảnh đại diện</label>
            <div class="admin-image-block">
              <div class="admin-upload-box">
                <input
                  ref="thumbnailInputRef"
                  type="file"
                  accept="image/*"
                  class="admin-hidden-input"
                  @change="onEditThumbnailChange"
                />

                <div class="admin-upload-actions">
                  <button
                    type="button"
                    class="admin-btn admin-btn--primary admin-upload-trigger"
                    @click="triggerThumbnailInput"
                  >
                    <i class="fa-solid fa-image"></i>
                    Chọn ảnh đại diện
                  </button>

                  <button
                    v-if="newThumbnailPreview"
                    type="button"
                    class="admin-btn admin-btn--danger"
                    @click="clearNewThumbnail"
                  >
                    Bỏ ảnh mới
                  </button>
                </div>

                <div class="admin-note mt-2">
                  Chọn 1 ảnh làm thumbnail mới cho sản phẩm.
                </div>
              </div>

              <div v-if="newThumbnailPreview" class="admin-image-grid">
                <div class="admin-image-card admin-image-card--large">
                  <div class="admin-image-preview admin-image-preview--large">
                    <img :src="newThumbnailPreview" alt="thumbnail-new" />
                  </div>
                  <div class="admin-image-meta">Thumbnail mới</div>
                </div>
              </div>
            </div>
          </div>

          <div class="admin-form__row">
            <label class="admin-form__label">Ảnh chi tiết hiện tại</label>
            <div class="admin-image-block">
              <div v-if="currentImages.length" class="admin-image-grid">
                <div
                  v-for="(img, index) in currentImages"
                  :key="`current-${index}`"
                  class="admin-image-card"
                >
                  <div class="admin-image-preview">
                    <img :src="img" :alt="`current-image-${index}`" />
                  </div>
                  <div class="admin-image-meta">
                    Ảnh hiện tại {{ index + 1 }}
                  </div>
                </div>
              </div>

              <div v-else class="admin-empty-box">Chưa có ảnh chi tiết</div>
            </div>
          </div>

          <div class="admin-form__row">
            <label class="admin-form__label">Đổi ảnh chi tiết</label>
            <div class="admin-image-block">
              <div class="admin-upload-box">
                <input
                  ref="imagesInputRef"
                  type="file"
                  multiple
                  accept="image/*"
                  class="admin-hidden-input"
                  @change="onEditImagesChange"
                />

                <div class="admin-upload-actions">
                  <button
                    type="button"
                    class="admin-btn admin-btn--primary admin-upload-trigger"
                    @click="triggerImagesInput"
                  >
                    <i class="fa-solid fa-images"></i>
                    Chọn ảnh chi tiết
                  </button>

                  <button
                    v-if="newImagePreviews.length"
                    type="button"
                    class="admin-btn admin-btn--danger"
                    @click="clearAllNewImages"
                  >
                    Xóa toàn bộ ảnh mới
                  </button>
                </div>

                <div class="admin-note mt-2">
                  Tối đa 4 ảnh. Khi chọn ảnh mới, backend sẽ cập nhật lại danh
                  sách ảnh chi tiết.
                </div>
              </div>

              <div v-if="newImagePreviews.length" class="admin-image-grid">
                <div
                  v-for="(img, index) in newImagePreviews"
                  :key="`new-${index}`"
                  class="admin-image-card"
                >
                  <div class="admin-image-preview">
                    <img :src="img" :alt="`new-image-${index}`" />
                  </div>
                  <div class="admin-image-meta">Ảnh mới {{ index + 1 }}</div>
                  <button
                    type="button"
                    class="admin-remove-mini"
                    @click="removeNewImage(index)"
                  >
                    Xóa ảnh này
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="admin-modal__footer">
          <button
            type="button"
            class="admin-btn admin-btn--secondary"
            @click="closeEditModal"
          >
            Quay lại
          </button>
          <button
            type="button"
            class="admin-btn admin-btn--primary"
            :disabled="saving"
            @click="submitEdit"
          >
            {{ saving ? "Đang lưu..." : "Chỉnh sửa" }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
