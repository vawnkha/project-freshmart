<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import { useRouter } from "vue-router";
import inventoryItemService from "@/services/inventory-item.service";
import adminProductService from "@/services/admin-product.service";
import productService from "@/services/product.service";
import uploadService from "@/services/upload.service";
import categoryService from "@/services/category.service";
import brandService from "@/services/brand.service";
import manufacturerService from "@/services/manufacturer.service";
import AdminPagination from "@/components/common/AdminPagination.vue";
import { useAuthStore } from "@/stores/user/auth";
import { hasPermission } from "@/utils/permission.util";
import {
  nonNegativeNumberSchema,
  optionalNonNegativeNumberSchema,
  optionalObjectIdSchema,
  optionalSlugSchema,
  optionalString,
  requiredString,
  z,
} from "@/validators/common.validator";
import { mapBackendValidationErrors } from "@/utils/validation-error.util";

const PRODUCT_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const PRODUCT_IMAGE_MAX_SIZE = 10 * 1024 * 1024;
const PRODUCT_DETAIL_IMAGE_LIMIT = 4;

const router = useRouter();
const authStore = useAuthStore();
const inventoryItems = ref([]);
const products = ref([]);
const categories = ref([]);
const brands = ref([]);
const manufacturers = ref([]);
const loading = ref(false);
const catalogLoading = ref(false);
const saving = ref(false);
const productSaving = ref(false);
const showItemModal = ref(false);
const showProductModal = ref(false);
const itemModalMode = ref("create");
const currentItemId = ref("");
const selectedItem = ref(null);
const currentPage = ref(1);
const pageSize = ref(12);
const productThumbnailInputRef = ref(null);
const productImagesInputRef = ref(null);
const productThumbnailFile = ref(null);
const productThumbnailPreview = ref("");
const productImageFiles = ref([]);
const productImagePreviews = ref([]);
const createdProduct = ref(null);

const filters = reactive({
  keyword: "",
  itemType: "",
  status: "",
});

const itemForm = reactive({
  categoryId: "",
  brandId: "",
  manufacturerId: "",
  itemCode: "",
  itemName: "",
  itemType: "",
  barcode: "",
  packageSize: "",
  unit: "",
  storageInstruction: "",
  expiryMonths: "",
  note: "",
  status: "active",
});

const inventoryItemSchema = toTypedSchema(
  z.object({
    categoryId: optionalObjectIdSchema,
    brandId: optionalObjectIdSchema,
    manufacturerId: optionalObjectIdSchema,
    itemCode: requiredString("Ma hang kho la bat buoc"),
    itemName: requiredString("Ten hang kho la bat buoc"),
    itemType: optionalString,
    barcode: optionalString,
    packageSize: optionalString,
    unit: requiredString("Don vi tinh la bat buoc"),
    storageInstruction: optionalString,
    expiryMonths: nonNegativeNumberSchema.optional(),
    note: optionalString,
    status: z.enum(["active", "inactive", "discontinued"], {
      message: "Trang thai hang kho khong hop le",
    }),
  }),
);

const {
  errors: itemErrors,
  resetForm: resetItemValidation,
  setErrors: setItemErrors,
  setValues: setItemValues,
  validate: validateItemVee,
} = useForm({
  validationSchema: inventoryItemSchema,
});

const productForm = reactive({
  name: "",
  slug: "",
  sellingPrice: "",
  shortDescription: "",
  description: "",
  status: "draft",
});

const productFromInventorySchema = toTypedSchema(
  z.object({
    name: optionalString,
    slug: optionalSlugSchema,
    sellingPrice: optionalNonNegativeNumberSchema,
    shortDescription: optionalString,
    description: optionalString,
    status: z.enum(["draft", "active", "inactive"], {
      message: "Trang thai san pham khong hop le",
    }),
  }),
);

const {
  errors: productErrors,
  resetForm: resetProductValidation,
  setErrors: setProductErrors,
  setValues: setProductValues,
  validate: validateProductVee,
} = useForm({
  validationSchema: productFromInventorySchema,
});

const totalItems = computed(() => inventoryItems.value.length);
const activeItems = computed(
  () => inventoryItems.value.filter((item) => item.status === "active").length,
);
const inactiveItems = computed(
  () => inventoryItems.value.filter((item) => item.status === "inactive").length,
);
const canCreateProductFromInventory = computed(() =>
  hasPermission(authStore, "product:manage"),
);

const productByInventoryItemId = computed(() => {
  const map = new Map();

  products.value.forEach((product) => {
    const inventoryItemId = normalizeId(product.inventoryItemId);
    if (inventoryItemId) map.set(inventoryItemId, product);
  });

  return map;
});

const itemTypes = computed(() => {
  return [
    ...new Set(
      inventoryItems.value
        .map((item) => String(item.itemType || "").trim())
        .filter(Boolean),
    ),
  ];
});

const filteredItems = computed(() => {
  const keyword = filters.keyword.trim().toLowerCase();

  return inventoryItems.value.filter((item) => {
    const matchKeyword =
      !keyword ||
      [
        item.itemCode,
        item.itemName,
        item.itemType,
        item.barcode,
        item.packageSize,
        item.unit,
        item.note,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword));

    const matchType = !filters.itemType || item.itemType === filters.itemType;
    const matchStatus = !filters.status || item.status === filters.status;

    return matchKeyword && matchType && matchStatus;
  });
});

const paginatedItems = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  const end = start + pageSize.value;
  return filteredItems.value.slice(start, end);
});

function getItemId(item) {
  return item?._id || item?.id || "";
}

function getEntityId(item) {
  return String(item?._id || item?.id || "");
}

function normalizeId(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value.$oid) return value.$oid;
  return String(value);
}

function normalizeList(res) {
  return Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
}

function findCatalogItem(list, id) {
  const normalized = normalizeId(id);
  return list.find((item) => getEntityId(item) === normalized);
}

function catalogName(list, id) {
  return findCatalogItem(list, id)?.name || normalizeId(id) || "---";
}

function activeCatalogOptions(list) {
  return list.filter((item) => item.status !== "inactive");
}

function getLinkedProduct(item) {
  return productByInventoryItemId.value.get(getItemId(item)) || null;
}

function hasLinkedProduct(item) {
  return Boolean(getLinkedProduct(item));
}

function linkedProductLabel(item) {
  const product = getLinkedProduct(item);
  return product?.name || product?.productCode || "Đã tạo sản phẩm";
}

function resetItemForm() {
  Object.assign(itemForm, {
    categoryId: "",
    brandId: "",
    manufacturerId: "",
    itemCode: "",
    itemName: "",
    itemType: "",
    barcode: "",
    packageSize: "",
    unit: "",
    storageInstruction: "",
    expiryMonths: "",
    note: "",
    status: "active",
  });
  resetItemValidation();
}

function resetProductForm() {
  createdProduct.value = null;
  resetProductValidation();
  Object.assign(productForm, {
    name: selectedItem.value?.itemName || "",
    slug: "",
    sellingPrice: "",
    shortDescription: "",
    description: "",
    status: "draft",
  });
  clearSelectedProductImages();
}

function trimValue(value) {
  return String(value ?? "").trim();
}

function appendIfValue(payload, key, value) {
  const normalized = trimValue(value);
  if (normalized) payload[key] = normalized;
}

function buildItemPayload() {
  const payload = {
    itemCode: trimValue(itemForm.itemCode),
    itemName: trimValue(itemForm.itemName),
    unit: trimValue(itemForm.unit),
    status: itemForm.status || "active",
  };

  [
    "categoryId",
    "brandId",
    "manufacturerId",
    "itemType",
    "barcode",
    "packageSize",
    "storageInstruction",
    "note",
  ].forEach((key) => appendIfValue(payload, key, itemForm[key]));

  if (trimValue(itemForm.expiryMonths)) {
    payload.expiryMonths = Number(itemForm.expiryMonths);
  }

  return payload;
}

function buildProductPayload(uploadedImages = {}) {
  const payload = {
    status: productForm.status || "draft",
  };

  appendIfValue(payload, "name", productForm.name);
  appendIfValue(payload, "slug", productForm.slug);
  appendIfValue(payload, "shortDescription", productForm.shortDescription);
  appendIfValue(payload, "description", productForm.description);

  if (trimValue(productForm.sellingPrice)) {
    const price = Number(productForm.sellingPrice);
    payload.sellingPrice = price;
    payload.price = price;
  }

  if (uploadedImages.thumbnail) {
    payload.thumbnail = uploadedImages.thumbnail;
  }

  if (Array.isArray(uploadedImages.images) && uploadedImages.images.length) {
    payload.images = uploadedImages.images;
  }

  return payload;
}

async function validateItemForm() {
  setItemValues({ ...itemForm });
  const result = await validateItemVee();
  return result.valid;
}

async function validateProductForm() {
  setProductValues({ ...productForm });
  const result = await validateProductVee();
  if (!result.valid) return false;

  if (
    trimValue(productForm.sellingPrice) &&
    Number(productForm.sellingPrice) < 0
  ) {
    return "Giá bán không hợp lệ";
  }

  const files = [
    productThumbnailFile.value,
    ...productImageFiles.value,
  ].filter(Boolean);
  for (const file of files) {
    const message = validateImageFile(file);
    if (message) {
      setProductErrors({ thumbnail: message });
      return false;
    }
  }

  return true;
}

function formatFileSize(size) {
  if (!Number.isFinite(size)) return "";
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function validateImageFile(file) {
  if (!file) return "";
  if (!PRODUCT_IMAGE_TYPES.includes(file.type)) {
    return "Chi chap nhan anh jpeg, png, webp hoac gif";
  }
  if (file.size > PRODUCT_IMAGE_MAX_SIZE) {
    return "Moi file anh toi da 10MB";
  }
  return "";
}

function revokePreview(url) {
  if (url) URL.revokeObjectURL(url);
}

function clearProductThumbnail() {
  revokePreview(productThumbnailPreview.value);
  productThumbnailFile.value = null;
  productThumbnailPreview.value = "";
  if (productThumbnailInputRef.value) {
    productThumbnailInputRef.value.value = "";
  }
}

function clearProductImages() {
  productImagePreviews.value.forEach((item) => revokePreview(item.url));
  productImageFiles.value = [];
  productImagePreviews.value = [];
  if (productImagesInputRef.value) {
    productImagesInputRef.value.value = "";
  }
}

function clearSelectedProductImages() {
  clearProductThumbnail();
  clearProductImages();
}

function onProductThumbnailChange(event) {
  const file = event.target.files?.[0] || null;
  if (!file) {
    clearProductThumbnail();
    return;
  }

  const message = validateImageFile(file);
  if (message) {
    alert(message);
    clearProductThumbnail();
    return;
  }

  revokePreview(productThumbnailPreview.value);
  productThumbnailFile.value = file;
  productThumbnailPreview.value = URL.createObjectURL(file);
}

function onProductImagesChange(event) {
  const files = Array.from(event.target.files || []);
  if (!files.length) {
    clearProductImages();
    return;
  }

  if (files.length > PRODUCT_DETAIL_IMAGE_LIMIT) {
    alert(`Ảnh chi tiết tối đa ${PRODUCT_DETAIL_IMAGE_LIMIT} file`);
  }

  const nextFiles = files.slice(0, PRODUCT_DETAIL_IMAGE_LIMIT);
  for (const file of nextFiles) {
    const message = validateImageFile(file);
    if (message) {
      alert(message);
      clearProductImages();
      return;
    }
  }

  clearProductImages();
  productImageFiles.value = nextFiles;
  productImagePreviews.value = nextFiles.map((file) => ({
    file,
    url: URL.createObjectURL(file),
  }));
}

function removeProductImage(index) {
  const preview = productImagePreviews.value[index];
  if (preview) revokePreview(preview.url);
  productImageFiles.value.splice(index, 1);
  productImagePreviews.value.splice(index, 1);

  if (!productImageFiles.value.length && productImagesInputRef.value) {
    productImagesInputRef.value.value = "";
  }
}

function buildProductUploadFormData() {
  const data = new FormData();

  if (productThumbnailFile.value) {
    data.append("thumbnail", productThumbnailFile.value);
  }

  productImageFiles.value.forEach((file) => {
    data.append("images", file);
  });

  return data;
}

async function uploadSelectedProductImages() {
  if (!productThumbnailFile.value && !productImageFiles.value.length) {
    return {};
  }

  const res = await uploadService.uploadProductImages(buildProductUploadFormData());
  const data = res?.data || res || {};

  return {
    thumbnail: data.thumbnail || "",
    images: Array.isArray(data.images) ? data.images : [],
  };
}

async function fetchItems() {
  loading.value = true;
  try {
    const res = await inventoryItemService.getAll();
    inventoryItems.value = normalizeList(res);
  } catch (error) {
    console.error("Lỗi tải danh sách hàng kho:", error);
    alert(error?.response?.data?.message || "Không thể tải danh sách hàng kho");
  } finally {
    loading.value = false;
  }
}

async function fetchProducts() {
  try {
    const res = await productService.getAll();
    products.value = normalizeList(res);
  } catch (error) {
    console.error("Lỗi tải danh sách sản phẩm:", error);
    products.value = [];
  }
}

async function fetchCatalogOptions() {
  catalogLoading.value = true;
  try {
    const [categoryRes, brandRes, manufacturerRes] = await Promise.all([
      categoryService.getAll(),
      brandService.getAll(),
      manufacturerService.getAll(),
    ]);

    categories.value = normalizeList(categoryRes);
    brands.value = normalizeList(brandRes);
    manufacturers.value = normalizeList(manufacturerRes);
  } catch (error) {
    console.error("Lỗi tải danh mục dữ liệu:", error);
    alert(error?.response?.data?.message || "Không thể tải danh mục dữ liệu");
  } finally {
    catalogLoading.value = false;
  }
}

async function loadPageData() {
  await Promise.all([fetchItems(), fetchCatalogOptions(), fetchProducts()]);
}

function openCreateModal() {
  itemModalMode.value = "create";
  currentItemId.value = "";
  resetItemForm();
  showItemModal.value = true;
}

function openEditModal(item) {
  itemModalMode.value = "edit";
  currentItemId.value = getItemId(item);
  Object.assign(itemForm, {
    categoryId: normalizeId(item.categoryId),
    brandId: normalizeId(item.brandId),
    manufacturerId: normalizeId(item.manufacturerId),
    itemCode: item.itemCode || "",
    itemName: item.itemName || "",
    itemType: item.itemType || "",
    barcode: item.barcode || "",
    packageSize: item.packageSize || "",
    unit: item.unit || "",
    storageInstruction: item.storageInstruction || "",
    expiryMonths: item.expiryMonths ?? "",
    note: item.note || "",
    status: item.status || "active",
  });
  showItemModal.value = true;
}

function closeItemModal() {
  showItemModal.value = false;
}

async function submitItemForm() {
  const valid = await validateItemForm();
  if (!valid) return;

  saving.value = true;
  try {
    const payload = buildItemPayload();

    if (itemModalMode.value === "create") {
      await inventoryItemService.create(payload);
      alert("Tạo hàng kho thành công");
    } else {
      await inventoryItemService.update(currentItemId.value, payload);
      alert("Cập nhật hàng kho thành công");
    }

    closeItemModal();
    await fetchItems();
  } catch (error) {
    console.error("Lỗi lưu hàng kho:", error);
    setItemErrors(mapBackendValidationErrors(error));
    alert(error?.response?.data?.message || "Không thể lưu hàng kho");
  } finally {
    saving.value = false;
  }
}

async function removeItem(item) {
  if (item.status === "inactive") return;

  if (!window.confirm("Bạn có chắc muốn xóa hàng kho này?")) {
    return;
  }

  try {
    await inventoryItemService.remove(getItemId(item));
    await fetchItems();
    alert("Đã xóa hàng kho");
  } catch (error) {
    console.error("Lỗi xóa hàng kho:", error);
    alert(error?.response?.data?.message || "Không thể xóa hàng kho");
  }
}

function openProductModal(item) {
  if (!canCreateProductFromInventory.value) {
    alert("Bạn không có quyền tạo sản phẩm từ hàng kho");
    return;
  }

  if (hasLinkedProduct(item)) {
    alert("Hàng kho này đã được đưa lên website");
    return;
  }

  selectedItem.value = item;
  resetProductForm();
  showProductModal.value = true;
}

function closeProductModal() {
  showProductModal.value = false;
  selectedItem.value = null;
  clearSelectedProductImages();
}

async function submitProductForm() {
  if (!canCreateProductFromInventory.value) {
    alert("Bạn không có quyền tạo sản phẩm từ hàng kho");
    return;
  }

  if (createdProduct.value || hasLinkedProduct(selectedItem.value)) {
    alert("Hàng kho này đã được tạo sản phẩm");
    return;
  }

  const valid = await validateProductForm();
  if (!valid) return;

  productSaving.value = true;
  try {
    const uploadedImages = await uploadSelectedProductImages();
    const res = await adminProductService.createFromInventory(
      getItemId(selectedItem.value),
      buildProductPayload(uploadedImages),
    );
    createdProduct.value = res?.data || res || null;
    await Promise.all([fetchItems(), fetchProducts()]);
    alert("Tạo sản phẩm từ hàng kho thành công");
  } catch (error) {
    console.error("Lỗi tạo sản phẩm từ hàng kho:", error);
    setProductErrors(mapBackendValidationErrors(error));
    alert(
      error?.response?.data?.message ||
        "Không thể tạo sản phẩm từ hàng kho này",
    );
  } finally {
    productSaving.value = false;
  }
}

function goToProducts() {
  router.push({ name: "admin-products" });
}

function statusText(status) {
  if (status === "active") return "Đang hoạt động";
  if (status === "inactive") return "Ngừng hoạt động";
  return status || "---";
}

function statusBadgeClass(status) {
  if (status === "active") return "admin-badge--success";
  if (status === "inactive") return "admin-badge--danger";
  return "admin-badge--info";
}

watch(
  () => [filters.keyword, filters.itemType, filters.status],
  () => {
    currentPage.value = 1;
  },
);

watch(filteredItems, (list) => {
  const maxPage = Math.max(1, Math.ceil(list.length / pageSize.value));
  if (currentPage.value > maxPage) {
    currentPage.value = maxPage;
  }
});

onMounted(loadPageData);
</script>

<template>
  <div class="admin-page inventory-items-page">
    <div class="admin-page-title admin-page-title--stack">
      <h1>Quản lý kho hàng</h1>
      <p>Quản lý inventory items và tạo sản phẩm website từ kho hàng.</p>
    </div>

    <div class="admin-stat-row admin-stat-row--products">
      <div class="admin-stat-card">
        <div class="admin-stat-card__label">Tổng kho hàng</div>
        <div class="admin-stat-card__value">{{ totalItems }}</div>
      </div>

      <div class="admin-stat-card">
        <div class="admin-stat-card__label">Đang hoạt động</div>
        <div class="admin-stat-card__value">{{ activeItems }}</div>
      </div>

      <div class="admin-stat-card">
        <div class="admin-stat-card__label">Ngừng hoạt động</div>
        <div class="admin-stat-card__value">{{ inactiveItems }}</div>
      </div>

      <div class="admin-stat-card">
        <div class="admin-stat-card__label">Đang lọc</div>
        <div class="admin-stat-card__value">{{ filteredItems.length }}</div>
      </div>
    </div>

    <section class="admin-panel">
      <div class="admin-panel__header admin-panel__header--flex">
        <div>
          <div class="admin-panel__header-title">Danh sách kho hàng</div>
          <!-- <div class="admin-panel__header-subtitle">
            Dữ liệu lấy từ /api/inventory-items, filter và phân trang được xử lý
            ở frontend.
          </div> -->
        </div>

        <div class="inventory-header-actions">
          <button class="admin-btn admin-btn--secondary" @click="loadPageData">
            Làm mới
          </button>
          <button class="admin-btn admin-btn--primary" @click="openCreateModal">
            <i class="fa-solid fa-plus me-1"></i>
            Thêm sản phẩm vào kho
          </button>
        </div>
      </div>

      <div class="admin-panel__body">
        <div class="row admin-toolbar">
          <div class="col-md-6 col-lg-6">
            <input
              v-model="filters.keyword"
              type="text"
              class="admin-toolbar__input"
              placeholder="Tìm theo mã, tên, barcode, đơn vị"
            />
          </div>

          <div class="col-md-3 col-lg-3">
            <select v-model="filters.itemType" class="admin-toolbar__select">
              <option value="">Tất cả loại hàng</option>
              <option v-for="type in itemTypes" :key="type" :value="type">
                {{ type }}
              </option>
            </select>
          </div>

          <div class="col-md-3 col-lg-3">
            <select v-model="filters.status" class="admin-toolbar__select">
              <option value="">Tất cả trạng thái</option>
              <option value="active">Đang hoạt động</option>
              <option value="inactive">Ngừng hoạt động</option>
            </select>
          </div>
        </div>

        <div v-if="loading" class="admin-empty-state">
          Đang tải danh sách hàng kho...
        </div>
        <div v-else-if="catalogLoading" class="admin-empty-state">
          Đang tải danh mục, thương hiệu và nhà sản xuất...
        </div>

        <div v-else-if="!filteredItems.length" class="admin-empty-state">
          Không có hàng kho phù hợp
        </div>

        <div v-else class="table-responsive">
          <table class="admin-table admin-table--products">
            <thead>
              <tr>
                <th>Mã hàng</th>
                <th>Tên hàng</th>
                <th>Loại</th>
                <th>Danh mục</th>
                <th>Thương hiệu</th>
                <th>Nhà sản xuất</th>
                <th>Đơn vị</th>
                <th>Quy cách</th>
                <th>Website</th>
                <th>Trạng thái</th>
                <th></th>
              </tr>
            </thead>

            <tbody>
              <tr v-for="item in paginatedItems" :key="getItemId(item)">
                <td>
                  <strong>{{ item.itemCode }}</strong>
                  <div class="inventory-cell-sub">{{ item.barcode || "---" }}</div>
                </td>

                <td>
                  <div class="inventory-item-name">{{ item.itemName }}</div>
                  <div class="inventory-cell-sub">
                    {{ item.storageInstruction || item.note || "---" }}
                  </div>
                </td>

                <td>{{ item.itemType || "---" }}</td>
                <td>{{ catalogName(categories, item.categoryId) }}</td>
                <td>{{ catalogName(brands, item.brandId) }}</td>
                <td>{{ catalogName(manufacturers, item.manufacturerId) }}</td>
                <td>{{ item.unit || "---" }}</td>
                <td>{{ item.packageSize || "---" }}</td>

                <td>
                  <span
                    v-if="hasLinkedProduct(item)"
                    class="admin-badge admin-badge--success"
                  >
                    Đã đưa lên website
                  </span>
                  <span v-else class="admin-badge admin-badge--info">
                    Chưa đưa lên website
                  </span>
                  <div v-if="hasLinkedProduct(item)" class="inventory-cell-sub">
                    {{ linkedProductLabel(item) }}
                  </div>
                </td>

                <td>
                  <span
                    class="admin-badge"
                    :class="statusBadgeClass(item.status)"
                  >
                    {{ statusText(item.status) }}
                  </span>
                </td>

                <td>
                  <div class="admin-action-stack admin-action-stack--row">
                    <button
                      class="admin-btn admin-btn--primary"
                      :disabled="
                        item.status !== 'active' ||
                        !canCreateProductFromInventory ||
                        hasLinkedProduct(item)
                      "
                      :title="
                        !canCreateProductFromInventory
                          ? 'Bạn cần quyền product:manage để đưa hàng lên website'
                          : hasLinkedProduct(item)
                            ? 'Hàng kho này đã tạo sản phẩm website'
                          : ''
                      "
                      @click="openProductModal(item)"
                    >
                      <i class="fa-solid fa-store me-1"></i>
                      {{ hasLinkedProduct(item) ? "Đã tạo sản phẩm" : "Đưa lên website" }}
                    </button>

                    <button
                      type="button"
                      class="admin-btn admin-btn--success"
                      @click.stop="openEditModal(item)"
                    >
                      <i class="fa-solid fa-pen-to-square me-1"></i>
                      Sửa
                    </button>

                    <button
                      v-if="item.status !== 'inactive'"
                      type="button"
                      class="admin-btn admin-btn--danger"
                      @click.stop="removeItem(item)"
                    >
                      <i class="fa-solid fa-trash me-1"></i>
                      Xóa
                    </button>
                    <span v-else class="admin-badge admin-badge--danger">Đã xóa</span>
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

    <div
      v-if="showItemModal"
      class="admin-modal-mask"
      @click.self="closeItemModal"
    >
      <div class="admin-modal admin-modal--wide">
        <div class="admin-modal__header">
          <div class="admin-modal__title">
            {{ itemModalMode === "create" ? "Thêm sản phẩm vào kho" : "Cập nhật sản phẩm trong kho" }}
          </div>
          <button
            type="button"
            class="admin-btn admin-btn--secondary"
            @click="closeItemModal"
          >
            x
          </button>
        </div>

        <form class="admin-form inventory-form" @submit.prevent="submitItemForm">
          <div class="admin-modal__body">
            <div class="admin-form__row">
              <label class="admin-form__label">Mã hàng *</label>
              <div>
                <input
                  v-model="itemForm.itemCode"
                  class="admin-form__control"
                  :class="{ 'is-invalid': itemErrors.itemCode }"
                />
                <div v-if="itemErrors.itemCode" class="admin-form__error">
                  {{ itemErrors.itemCode }}
                </div>
              </div>
            </div>

            <div class="admin-form__row">
              <label class="admin-form__label">Tên hàng *</label>
              <div>
                <input
                  v-model="itemForm.itemName"
                  class="admin-form__control"
                  :class="{ 'is-invalid': itemErrors.itemName }"
                />
                <div v-if="itemErrors.itemName" class="admin-form__error">
                  {{ itemErrors.itemName }}
                </div>
              </div>
            </div>

            <div class="admin-form__row">
              <label class="admin-form__label">Loại hàng</label>
              <input v-model="itemForm.itemType" class="admin-form__control" />
            </div>

            <div class="admin-form__row">
              <label class="admin-form__label">Đơn vị *</label>
              <div>
                <input
                  v-model="itemForm.unit"
                  class="admin-form__control"
                  :class="{ 'is-invalid': itemErrors.unit }"
                />
                <div v-if="itemErrors.unit" class="admin-form__error">
                  {{ itemErrors.unit }}
                </div>
              </div>
            </div>

            <div class="admin-form__row">
              <label class="admin-form__label">Quy cach</label>
              <input v-model="itemForm.packageSize" class="admin-form__control" />
            </div>

            <div class="admin-form__row">
              <label class="admin-form__label">Barcode</label>
              <input v-model="itemForm.barcode" class="admin-form__control" />
            </div>

            <div class="admin-form__row">
              <label class="admin-form__label">Danh mục</label>
              <select v-model="itemForm.categoryId" class="admin-form__select">
                <option value="">-- Chọn danh mục --</option>
                <option
                  v-for="item in activeCatalogOptions(categories)"
                  :key="getEntityId(item)"
                  :value="getEntityId(item)"
                >
                  {{ item.name }}
                </option>
              </select>
            </div>

            <div class="admin-form__row">
              <label class="admin-form__label">Thương hiệu</label>
              <select v-model="itemForm.brandId" class="admin-form__select">
                <option value="">-- Chọn thương hiệu --</option>
                <option
                  v-for="item in activeCatalogOptions(brands)"
                  :key="getEntityId(item)"
                  :value="getEntityId(item)"
                >
                  {{ item.name }}
                </option>
              </select>
            </div>

            <div class="admin-form__row">
              <label class="admin-form__label">Nhà sản xuất</label>
              <select
                v-model="itemForm.manufacturerId"
                class="admin-form__select"
              >
                <option value="">-- Chọn nhà sản xuất --</option>
                <option
                  v-for="item in activeCatalogOptions(manufacturers)"
                  :key="getEntityId(item)"
                  :value="getEntityId(item)"
                >
                  {{ item.name }}
                </option>
              </select>
            </div>

            <div class="admin-form__row">
              <label class="admin-form__label">Bảo quản</label>
              <textarea
                v-model="itemForm.storageInstruction"
                class="admin-form__textarea"
                rows="3"
              />
            </div>

            <div class="admin-form__row">
              <label class="admin-form__label">Hạn SD theo tháng</label>
              <input
                v-model="itemForm.expiryMonths"
                type="number"
                min="0"
                class="admin-form__control"
                :class="{ 'is-invalid': itemErrors.expiryMonths }"
              />
              <div v-if="itemErrors.expiryMonths" class="admin-form__error">
                {{ itemErrors.expiryMonths }}
              </div>
            </div>

            <div class="admin-form__row">
              <label class="admin-form__label">Trạng thái</label>
              <select v-model="itemForm.status" class="admin-form__select">
                <option value="active">Đang hoạt động</option>
                <option value="inactive">Ngừng hoạt động</option>
              </select>
            </div>

            <div class="admin-form__row">
              <label class="admin-form__label">Ghi chú</label>
              <textarea
                v-model="itemForm.note"
                class="admin-form__textarea"
                rows="3"
              />
            </div>
          </div>

          <div class="admin-modal__footer">
            <button
              type="button"
              class="admin-btn admin-btn--secondary"
              @click="closeItemModal"
            >
              Quay lại
            </button>
            <button
              type="submit"
              class="admin-btn admin-btn--primary"
              :disabled="saving"
            >
              {{ saving ? "Đang lưu..." : "Lưu hàng kho" }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <div
      v-if="showProductModal"
      class="admin-modal-mask"
      @click.self="closeProductModal"
    >
      <div class="admin-modal admin-modal--wide">
        <div class="admin-modal__header">
          <div class="admin-modal__title">Đưa hàng kho lên website</div>
          <button
            type="button"
            class="admin-btn admin-btn--secondary"
            @click="closeProductModal"
          >
            x
          </button>
        </div>

        <form class="admin-form inventory-form" @submit.prevent="submitProductForm">
          <div class="admin-modal__body">
            <div class="inventory-source-box">
              <div>
                <span>Hàng kho</span>
                <strong>{{ selectedItem?.itemName || "---" }}</strong>
              </div>
              <div>
                <span>Mã hàng</span>
                <strong>{{ selectedItem?.itemCode || "---" }}</strong>
              </div>
              <div>
                <span>Đơn vị</span>
                <strong>{{ selectedItem?.unit || "---" }}</strong>
              </div>
            </div>

            <div v-if="createdProduct" class="inventory-product-created">
              <div>
                <strong>Đã tạo sản phẩm từ hàng kho.</strong>
                <span>
                  {{ createdProduct.name || createdProduct.productCode || "Sản phẩm mới" }}
                </span>
              </div>
              <button
                type="button"
                class="admin-btn admin-btn--success"
                @click="goToProducts"
              >
                Xem sản phẩm
              </button>
            </div>

            <div class="admin-form__row">
              <label class="admin-form__label">Tên sản phẩm</label>
              <div>
                <input
                  v-model="productForm.name"
                  class="admin-form__control"
                  :class="{ 'is-invalid': productErrors.name }"
                />
                <div v-if="productErrors.name" class="admin-form__error">
                  {{ productErrors.name }}
                </div>
              </div>
            </div>

            <div class="admin-form__row">
              <label class="admin-form__label">Slug</label>
              <div>
                <input
                  v-model="productForm.slug"
                  class="admin-form__control"
                  :class="{ 'is-invalid': productErrors.slug }"
                />
                <div v-if="productErrors.slug" class="admin-form__error">
                  {{ productErrors.slug }}
                </div>
              </div>
            </div>

            <div class="admin-form__row">
              <label class="admin-form__label">Giá bán</label>
              <input
                v-model="productForm.sellingPrice"
                type="number"
                min="0"
                class="admin-form__control"
                :class="{ 'is-invalid': productErrors.sellingPrice }"
              />
              <div v-if="productErrors.sellingPrice" class="admin-form__error">
                {{ productErrors.sellingPrice }}
              </div>
            </div>

            <div class="admin-form__row">
              <label class="admin-form__label">Ảnh đại diện</label>
              <div class="inventory-upload-block">
                <input
                  ref="productThumbnailInputRef"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  class="admin-form__control"
                  @change="onProductThumbnailChange"
                />
                <div v-if="productErrors.thumbnail" class="admin-form__error">
                  {{ productErrors.thumbnail }}
                </div>

                <div
                  v-if="productThumbnailFile"
                  class="inventory-selected-file"
                >
                  <div class="inventory-image-preview inventory-image-preview--large">
                    <img :src="productThumbnailPreview" alt="thumbnail-preview" />
                  </div>
                  <div class="inventory-file-meta">
                    <strong>{{ productThumbnailFile.name }}</strong>
                    <span>{{ formatFileSize(productThumbnailFile.size) }}</span>
                  </div>
                  <button
                    type="button"
                    class="admin-btn admin-btn--danger"
                    @click="clearProductThumbnail"
                  >
                    Xóa ảnh
                  </button>
                </div>
              </div>
            </div>

            <div class="admin-form__row">
              <label class="admin-form__label">Ảnh chi tiết</label>
              <div class="inventory-upload-block">
                <input
                  ref="productImagesInputRef"
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  class="admin-form__control"
                  @change="onProductImagesChange"
                />
                <div v-if="productErrors.images" class="admin-form__error">
                  {{ productErrors.images }}
                </div>

                <div
                  v-if="productImagePreviews.length"
                  class="inventory-image-grid"
                >
                  <div
                    v-for="(preview, index) in productImagePreviews"
                    :key="preview.url"
                    class="inventory-image-card"
                  >
                    <div class="inventory-image-preview">
                      <img :src="preview.url" :alt="preview.file.name" />
                    </div>
                    <div class="inventory-file-meta">
                      <strong>{{ preview.file.name }}</strong>
                      <span>{{ formatFileSize(preview.file.size) }}</span>
                    </div>
                    <button
                      type="button"
                      class="admin-btn admin-btn--danger"
                      @click="removeProductImage(index)"
                    >
                      Xóa
                    </button>
                  </div>
                </div>

                <button
                  v-if="productImagePreviews.length"
                  type="button"
                  class="admin-btn admin-btn--secondary"
                  @click="clearProductImages"
                >
                  Xóa tất cả ảnh chi tiết
                </button>
              </div>
            </div>

            <div class="admin-form__row">
              <label class="admin-form__label">Trạng thái</label>
              <select v-model="productForm.status" class="admin-form__select">
                <option value="draft">Nháp</option>
                <option value="active">Đang hoạt động</option>
              </select>
            </div>

            <div class="admin-form__row">
              <label class="admin-form__label">Mô tả ngắn</label>
              <textarea
                v-model="productForm.shortDescription"
                class="admin-form__textarea"
                rows="3"
              />
            </div>

            <div class="admin-form__row">
              <label class="admin-form__label">Mô tả</label>
              <textarea
                v-model="productForm.description"
                class="admin-form__textarea"
                rows="4"
              />
            </div>
          </div>

          <div class="admin-modal__footer">
            <button
              type="button"
              class="admin-btn admin-btn--secondary"
              @click="closeProductModal"
            >
              Quay lại
            </button>
            <button
              v-if="createdProduct"
              type="button"
              class="admin-btn admin-btn--success"
              @click="goToProducts"
            >
              Xem sản phẩm
            </button>
            <button
              type="submit"
              class="admin-btn admin-btn--primary"
              :disabled="productSaving || Boolean(createdProduct)"
            >
              {{ productSaving ? "Đang tạo..." : "Tạo sản phẩm" }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.inventory-header-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: flex-end;
}

.inventory-cell-sub {
  color: #7b8794;
  font-size: 12px;
  margin-top: 4px;
  max-width: 260px;
}

.inventory-item-name {
  font-weight: 700;
  color: #23364d;
}

.inventory-form {
  margin: 0;
  max-width: none;
}

.inventory-source-box {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 18px;
}

.inventory-source-box > div {
  border: 1px solid #e8edf3;
  border-radius: 6px;
  padding: 12px;
  background: #f8fafc;
}

.inventory-source-box span {
  display: block;
  color: #7b8794;
  font-size: 12px;
  margin-bottom: 4px;
}

.inventory-source-box strong {
  color: #23364d;
  font-size: 14px;
}

.inventory-product-created {
  align-items: center;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 6px;
  color: #166534;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: space-between;
  margin-bottom: 18px;
  padding: 12px;
}

.inventory-product-created div {
  display: grid;
  gap: 4px;
}

.inventory-product-created span {
  font-size: 13px;
}

.inventory-upload-block {
  display: grid;
  gap: 12px;
}

.inventory-selected-file {
  align-items: center;
  border: 1px solid #e8edf3;
  border-radius: 6px;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 12px;
}

.inventory-image-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
}

.inventory-image-card {
  border: 1px solid #e8edf3;
  border-radius: 6px;
  display: grid;
  gap: 8px;
  padding: 10px;
}

.inventory-image-preview {
  aspect-ratio: 1;
  background: #f8fafc;
  border: 1px solid #e8edf3;
  border-radius: 6px;
  overflow: hidden;
  width: 100%;
}

.inventory-image-preview--large {
  height: 96px;
  width: 96px;
}

.inventory-image-preview img {
  display: block;
  height: 100%;
  object-fit: cover;
  width: 100%;
}

.inventory-file-meta {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.inventory-file-meta strong {
  color: #23364d;
  font-size: 13px;
  overflow-wrap: anywhere;
}

.inventory-file-meta span {
  color: #7b8794;
  font-size: 12px;
}

@media (max-width: 768px) {
  .inventory-header-actions,
  .inventory-source-box {
    display: block;
  }

  .inventory-header-actions .admin-btn,
  .inventory-source-box > div {
    margin-top: 10px;
  }
}
</style>
