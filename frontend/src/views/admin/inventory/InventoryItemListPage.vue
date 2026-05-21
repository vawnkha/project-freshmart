<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue";
import inventoryItemService from "@/services/inventory-item.service";
import adminProductService from "@/services/admin-product.service";
import uploadService from "@/services/upload.service";
import categoryService from "@/services/category.service";
import brandService from "@/services/brand.service";
import manufacturerService from "@/services/manufacturer.service";
import AdminPagination from "@/components/common/AdminPagination.vue";
import { useAuthStore } from "@/stores/user/auth";
import { hasPermission } from "@/utils/permission.util";

const PRODUCT_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const PRODUCT_IMAGE_MAX_SIZE = 10 * 1024 * 1024;
const PRODUCT_DETAIL_IMAGE_LIMIT = 4;

const authStore = useAuthStore();
const inventoryItems = ref([]);
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

const productForm = reactive({
  name: "",
  slug: "",
  sellingPrice: "",
  shortDescription: "",
  description: "",
  status: "draft",
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
}

function resetProductForm() {
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

function validateItemForm() {
  if (!trimValue(itemForm.itemCode)) return "Ma hang kho la bat buoc";
  if (!trimValue(itemForm.itemName)) return "Ten hang kho la bat buoc";
  if (!trimValue(itemForm.unit)) return "Don vi tinh la bat buoc";

  if (
    trimValue(itemForm.expiryMonths) &&
    Number(itemForm.expiryMonths) < 0
  ) {
    return "Han su dung theo thang khong hop le";
  }

  return "";
}

function validateProductForm() {
  if (
    trimValue(productForm.sellingPrice) &&
    Number(productForm.sellingPrice) < 0
  ) {
    return "Gia ban khong hop le";
  }

  const files = [
    productThumbnailFile.value,
    ...productImageFiles.value,
  ].filter(Boolean);
  for (const file of files) {
    const message = validateImageFile(file);
    if (message) return message;
  }

  return "";
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
    alert(`Anh chi tiet toi da ${PRODUCT_DETAIL_IMAGE_LIMIT} file`);
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
    console.error("Loi tai danh sach hang kho:", error);
    alert(error?.response?.data?.message || "Khong the tai danh sach hang kho");
  } finally {
    loading.value = false;
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
    console.error("Loi tai danh muc du lieu:", error);
    alert(error?.response?.data?.message || "Khong the tai danh muc du lieu");
  } finally {
    catalogLoading.value = false;
  }
}

async function loadPageData() {
  await Promise.all([fetchItems(), fetchCatalogOptions()]);
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
  const message = validateItemForm();
  if (message) {
    alert(message);
    return;
  }

  saving.value = true;
  try {
    const payload = buildItemPayload();

    if (itemModalMode.value === "create") {
      await inventoryItemService.create(payload);
      alert("Tao hang kho thanh cong");
    } else {
      await inventoryItemService.update(currentItemId.value, payload);
      alert("Cap nhat hang kho thanh cong");
    }

    closeItemModal();
    await fetchItems();
  } catch (error) {
    console.error("Loi luu hang kho:", error);
    alert(error?.response?.data?.message || "Khong the luu hang kho");
  } finally {
    saving.value = false;
  }
}

async function removeItem(item) {
  if (item.status === "inactive") return;

  if (!window.confirm("Ban co chac muon ngung hoat dong hang kho nay?")) {
    return;
  }

  try {
    await inventoryItemService.remove(getItemId(item));
    await fetchItems();
    alert("Da ngung hoat dong hang kho");
  } catch (error) {
    console.error("Loi xoa hang kho:", error);
    alert(error?.response?.data?.message || "Khong the ngung hoat dong hang kho");
  }
}

function openProductModal(item) {
  if (!canCreateProductFromInventory.value) {
    alert("Ban khong co quyen tao san pham tu hang kho");
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
    alert("Ban khong co quyen tao san pham tu hang kho");
    return;
  }

  const message = validateProductForm();
  if (message) {
    alert(message);
    return;
  }

  productSaving.value = true;
  try {
    const uploadedImages = await uploadSelectedProductImages();
    await adminProductService.createFromInventory(
      getItemId(selectedItem.value),
      buildProductPayload(uploadedImages),
    );
    alert("Tao san pham tu hang kho thanh cong");
    closeProductModal();
    await fetchItems();
  } catch (error) {
    console.error("Loi tao san pham tu hang kho:", error);
    alert(
      error?.response?.data?.message ||
        "Khong the tao san pham tu hang kho nay",
    );
  } finally {
    productSaving.value = false;
  }
}

function statusText(status) {
  if (status === "active") return "Dang hoat dong";
  if (status === "inactive") return "Ngung hoat dong";
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
      <h1>Quan ly hang kho</h1>
      <p>Quan ly inventory items va tao san pham website tu hang kho.</p>
    </div>

    <div class="admin-stat-row admin-stat-row--products">
      <div class="admin-stat-card">
        <div class="admin-stat-card__label">Tong hang kho</div>
        <div class="admin-stat-card__value">{{ totalItems }}</div>
      </div>

      <div class="admin-stat-card">
        <div class="admin-stat-card__label">Dang hoat dong</div>
        <div class="admin-stat-card__value">{{ activeItems }}</div>
      </div>

      <div class="admin-stat-card">
        <div class="admin-stat-card__label">Ngung hoat dong</div>
        <div class="admin-stat-card__value">{{ inactiveItems }}</div>
      </div>

      <div class="admin-stat-card">
        <div class="admin-stat-card__label">Dang loc</div>
        <div class="admin-stat-card__value">{{ filteredItems.length }}</div>
      </div>
    </div>

    <section class="admin-panel">
      <div class="admin-panel__header admin-panel__header--flex">
        <div>
          <div class="admin-panel__header-title">Danh sach hang kho</div>
          <div class="admin-panel__header-subtitle">
            Du lieu lay tu /api/inventory-items, filter va phan trang duoc xu ly
            o frontend.
          </div>
        </div>

        <div class="inventory-header-actions">
          <button class="admin-btn admin-btn--secondary" @click="loadPageData">
            Lam moi
          </button>
          <button class="admin-btn admin-btn--primary" @click="openCreateModal">
            <i class="fa-solid fa-plus me-1"></i>
            Them hang kho
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
              placeholder="Tim theo ma, ten, barcode, don vi"
            />
          </div>

          <div class="col-md-3 col-lg-3">
            <select v-model="filters.itemType" class="admin-toolbar__select">
              <option value="">Tat ca loai hang</option>
              <option v-for="type in itemTypes" :key="type" :value="type">
                {{ type }}
              </option>
            </select>
          </div>

          <div class="col-md-3 col-lg-3">
            <select v-model="filters.status" class="admin-toolbar__select">
              <option value="">Tat ca trang thai</option>
              <option value="active">Dang hoat dong</option>
              <option value="inactive">Ngung hoat dong</option>
            </select>
          </div>
        </div>

        <div v-if="loading" class="admin-empty-state">
          Dang tai danh sach hang kho...
        </div>
        <div v-else-if="catalogLoading" class="admin-empty-state">
          Dang tai danh muc, thuong hieu va nha san xuat...
        </div>

        <div v-else-if="!filteredItems.length" class="admin-empty-state">
          Khong co hang kho phu hop
        </div>

        <div v-else class="table-responsive">
          <table class="admin-table admin-table--products">
            <thead>
              <tr>
                <th>Ma hang</th>
                <th>Ten hang</th>
                <th>Loai</th>
                <th>Danh muc</th>
                <th>Thuong hieu</th>
                <th>Nha san xuat</th>
                <th>Don vi</th>
                <th>Quy cach</th>
                <th>Trang thai</th>
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
                        !canCreateProductFromInventory
                      "
                      :title="
                        !canCreateProductFromInventory
                          ? 'Ban can quyen product:manage de dua hang len website'
                          : ''
                      "
                      @click="openProductModal(item)"
                    >
                      <i class="fa-solid fa-store me-1"></i>
                      Dua len website
                    </button>

                    <button
                      class="admin-btn admin-btn--success"
                      @click="openEditModal(item)"
                    >
                      <i class="fa-solid fa-pen-to-square me-1"></i>
                      Sua
                    </button>

                    <button
                      class="admin-btn admin-btn--danger"
                      :disabled="item.status === 'inactive'"
                      @click="removeItem(item)"
                    >
                      <i class="fa-solid fa-trash me-1"></i>
                      Ngung
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

    <div
      v-if="showItemModal"
      class="admin-modal-mask"
      @click.self="closeItemModal"
    >
      <div class="admin-modal admin-modal--wide">
        <div class="admin-modal__header">
          <div class="admin-modal__title">
            {{ itemModalMode === "create" ? "Them hang kho" : "Cap nhat hang kho" }}
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
              <label class="admin-form__label">Ma hang *</label>
              <input v-model="itemForm.itemCode" class="admin-form__control" />
            </div>

            <div class="admin-form__row">
              <label class="admin-form__label">Ten hang *</label>
              <input v-model="itemForm.itemName" class="admin-form__control" />
            </div>

            <div class="admin-form__row">
              <label class="admin-form__label">Loai hang</label>
              <input v-model="itemForm.itemType" class="admin-form__control" />
            </div>

            <div class="admin-form__row">
              <label class="admin-form__label">Don vi *</label>
              <input v-model="itemForm.unit" class="admin-form__control" />
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
              <label class="admin-form__label">Bao quan</label>
              <textarea
                v-model="itemForm.storageInstruction"
                class="admin-form__textarea"
                rows="3"
              />
            </div>

            <div class="admin-form__row">
              <label class="admin-form__label">Han SD thang</label>
              <input
                v-model="itemForm.expiryMonths"
                type="number"
                min="0"
                class="admin-form__control"
              />
            </div>

            <div class="admin-form__row">
              <label class="admin-form__label">Trang thai</label>
              <select v-model="itemForm.status" class="admin-form__select">
                <option value="active">Dang hoat dong</option>
                <option value="inactive">Ngung hoat dong</option>
              </select>
            </div>

            <div class="admin-form__row">
              <label class="admin-form__label">Ghi chu</label>
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
              Quay lai
            </button>
            <button
              type="submit"
              class="admin-btn admin-btn--primary"
              :disabled="saving"
            >
              {{ saving ? "Dang luu..." : "Luu hang kho" }}
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
          <div class="admin-modal__title">Dua hang kho len website</div>
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
                <span>Hang kho</span>
                <strong>{{ selectedItem?.itemName || "---" }}</strong>
              </div>
              <div>
                <span>Ma hang</span>
                <strong>{{ selectedItem?.itemCode || "---" }}</strong>
              </div>
              <div>
                <span>Don vi</span>
                <strong>{{ selectedItem?.unit || "---" }}</strong>
              </div>
            </div>

            <div class="admin-form__row">
              <label class="admin-form__label">Ten san pham</label>
              <input v-model="productForm.name" class="admin-form__control" />
            </div>

            <div class="admin-form__row">
              <label class="admin-form__label">Slug</label>
              <input v-model="productForm.slug" class="admin-form__control" />
            </div>

            <div class="admin-form__row">
              <label class="admin-form__label">Gia ban</label>
              <input
                v-model="productForm.sellingPrice"
                type="number"
                min="0"
                class="admin-form__control"
              />
            </div>

            <div class="admin-form__row">
              <label class="admin-form__label">Anh dai dien</label>
              <div class="inventory-upload-block">
                <input
                  ref="productThumbnailInputRef"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  class="admin-form__control"
                  @change="onProductThumbnailChange"
                />

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
                    Xoa anh
                  </button>
                </div>
              </div>
            </div>

            <div class="admin-form__row">
              <label class="admin-form__label">Anh chi tiet</label>
              <div class="inventory-upload-block">
                <input
                  ref="productImagesInputRef"
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  class="admin-form__control"
                  @change="onProductImagesChange"
                />

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
                      Xoa
                    </button>
                  </div>
                </div>

                <button
                  v-if="productImagePreviews.length"
                  type="button"
                  class="admin-btn admin-btn--secondary"
                  @click="clearProductImages"
                >
                  Xoa tat ca anh chi tiet
                </button>
              </div>
            </div>

            <div class="admin-form__row">
              <label class="admin-form__label">Trang thai</label>
              <select v-model="productForm.status" class="admin-form__select">
                <option value="draft">Draft</option>
                <option value="active">Active</option>
              </select>
            </div>

            <div class="admin-form__row">
              <label class="admin-form__label">Mo ta ngan</label>
              <textarea
                v-model="productForm.shortDescription"
                class="admin-form__textarea"
                rows="3"
              />
            </div>

            <div class="admin-form__row">
              <label class="admin-form__label">Mo ta</label>
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
              Quay lai
            </button>
            <button
              type="submit"
              class="admin-btn admin-btn--primary"
              :disabled="productSaving"
            >
              {{ productSaving ? "Dang tao..." : "Tao san pham" }}
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
