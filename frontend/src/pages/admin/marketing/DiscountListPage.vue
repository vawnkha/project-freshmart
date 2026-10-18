<script setup>
import { normalizeId } from "@/utils/id.util";
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useSchemaForm } from "@/composables/useSchemaForm";
import { toTypedSchema } from "@vee-validate/zod";
import AdminPagination from "@/components/admin/common/AdminPagination.vue";
import MultiSelectSearch from "@/components/admin/common/MultiSelectSearch.vue";
import discountService from "@/services/discount.service";
import productService from "@/services/admin-product.service";
import categoryService from "@/services/category.service";
import {
  dateStringSchema,
  nonNegativeNumberSchema,
  objectIdArraySchema,
  positiveNumberSchema,
  requiredString,
  statusSchema,
  z,
} from "@/validators/common.validator";
import { mapBackendValidationErrors } from "@/utils/validation-error.util";
import { useAuthStore } from "@/stores/user/auth";
import { loadWhenAllowed } from "@/utils/authorized-load.util";
const authStore = useAuthStore();

const discounts = ref([]);
const products = ref([]);
const categories = ref([]);
const loading = ref(false);
const saving = ref(false);
const optionLoading = ref(false);
const keyword = ref("");
const scopeFilter = ref("");
const statusFilter = ref("");
const showModal = ref(false);
const modalMode = ref("create");
const currentId = ref("");
const currentPage = ref(1);
const pageSize = ref(12);

const form = reactive({
  code: "",
  name: "",
  description: "",
  isPublic: false,
  scope: "order",
  type: "percent",
  value: 0,
  minOrderValue: 0,
  maxDiscountAmount: 0,
  quantity: 0,
  productIds: [],
  categoryIds: [],
  startDate: "",
  endDate: "",
  status: "active",
});

const discountSchema = toTypedSchema(
  z
    .object({
      code: requiredString("Ma giam gia la bat buoc"),
      name: requiredString("Ten ma giam gia la bat buoc"),
      description: z.string().optional(),
      isPublic: z.boolean(),
      scope: z.enum(["order", "product", "category"], {
        message: "Pham vi ap dung khong hop le",
      }),
      type: z.enum(["percent", "fixed"], {
        message: "Loai giam gia khong hop le",
      }),
      value: positiveNumberSchema,
      minOrderValue: nonNegativeNumberSchema,
      maxDiscountAmount: nonNegativeNumberSchema,
      quantity: nonNegativeNumberSchema,
      productIds: objectIdArraySchema,
      categoryIds: objectIdArraySchema,
      startDate: dateStringSchema,
      endDate: dateStringSchema,
      status: statusSchema,
    })
    .superRefine((value, ctx) => {
      if (value.type === "percent" && Number(value.value || 0) > 100) {
        ctx.addIssue({
          code: "custom",
          path: ["value"],
          message: "Giam theo phan tram khong duoc vuot qua 100",
        });
      }

      if (
        value.startDate &&
        value.endDate &&
        new Date(value.startDate).getTime() >= new Date(value.endDate).getTime()
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
  validationSchema: discountSchema,
  values: () => ({ ...form }),
});

const filteredDiscounts = computed(() => {
  const q = keyword.value.trim().toLowerCase();

  return discounts.value.filter((item) => {
    const matchKeyword =
      !q ||
      [item.code, item.name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    const matchScope = !scopeFilter.value || item.scope === scopeFilter.value;
    const matchStatus = !statusFilter.value || item.status === statusFilter.value;
    return matchKeyword && matchScope && matchStatus;
  });
});

const paginatedDiscounts = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return filteredDiscounts.value.slice(start, start + pageSize.value);
});

const activeCount = computed(
  () => discounts.value.filter((item) => item.status === "active").length,
);

const inactiveCount = computed(
  () => discounts.value.filter((item) => item.status === "inactive").length,
);

const categoryMap = computed(
  () => new Map(categories.value.map((category) => [getId(category), category])),
);

const productOptions = computed(() =>
  products.value.map((product) => {
    const categoryId = normalizeId(
      product.category_id || product.categoryId || product.category?._id || product.category?.id,
    );
    const category = categoryMap.value.get(categoryId);

    return {
      ...product,
      discountLabel: product.name || product.productName || "Sản phẩm chưa đặt tên",
      discountCode: product.productCode || product.itemCode || product.code || product.sku || "",
      discountCategoryLabel:
        product.category?.name || categoryLabel(category) || "Chưa phân loại",
    };
  }),
);

const categoryOptions = computed(() =>
  categories.value.map((category) => {
    const parentId = normalizeId(
      category.parentId || category.parent_id || category.parent?._id || category.parent?.id,
    );
    const parent = categoryMap.value.get(parentId);

    return {
      ...category,
      discountLabel: category.name || category.title || "Danh mục chưa đặt tên",
      discountCode: category.code || category.slug || "",
      discountParentLabel:
        category.parent?.name || categoryLabel(parent) || "Danh mục gốc",
    };
  }),
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

function formatDateInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function formatDate(value) {
  if (!value) return "---";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "---";
  return date.toLocaleDateString("vi-VN");
}

function scopeText(scope) {
  if (scope === "order") return "Đơn hàng";
  if (scope === "product") return "Sản phẩm";
  if (scope === "category") return "Danh mục";
  return scope || "---";
}

function typeText(type) {
  if (type === "percent") return "Phần trăm";
  if (type === "fixed") return "Số tiền";
  return type || "---";
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

function categoryLabel(category) {
  return category?.name || category?.slug || "";
}

function resetForm() {
  Object.assign(form, {
    code: "",
    name: "",
    description: "",
    isPublic: false,
    scope: "order",
    type: "percent",
    value: 0,
    minOrderValue: 0,
    maxDiscountAmount: 0,
    quantity: 0,
    productIds: [],
    categoryIds: [],
    startDate: "",
    endDate: "",
    status: "active",
  });
  resetValidation();
}

function fillForm(item) {
  const applicable = item.applicable || {};
  Object.assign(form, {
    code: item.code || "",
    name: item.name || "",
    description: item.description || "",
    isPublic: item.isPublic === true,
    scope: item.scope || "order",
    type: item.type || "percent",
    value: item.value ?? 0,
    minOrderValue: item.minOrderValue ?? 0,
    maxDiscountAmount: item.maxDiscountAmount ?? 0,
    quantity: item.quantity ?? 0,
    productIds: (applicable.productIds || []).map(normalizeId),
    categoryIds: (applicable.categoryIds || []).map(normalizeId),
    startDate: formatDateInput(item.startDate),
    endDate: formatDateInput(item.endDate),
    status: item.status || "active",
  });
}

function buildPayload() {
  const payload = {
    code: form.code.trim(),
    name: form.name.trim(),
    description: form.description.trim(),
    isPublic: form.isPublic,
    scope: form.scope,
    type: form.type,
    value: Number(form.value || 0),
    minOrderValue: Number(form.minOrderValue || 0),
    maxDiscountAmount: Number(form.maxDiscountAmount || 0),
    quantity: Number(form.quantity || 0),
    applicable: {
      productIds: form.scope === "product" ? [...form.productIds] : [],
      categoryIds: form.scope === "category" ? [...form.categoryIds] : [],
    },
    startDate: form.startDate,
    endDate: form.endDate,
    status: form.status || "active",
  };

  Object.keys(payload).forEach((key) => {
    if (payload[key] === "" && !["startDate", "endDate", "description"].includes(key)) delete payload[key];
  });

  return payload;
}

async function validateForm() {
  setValues({ ...form });
  const result = await validateVee();
  return result.valid;
}

async function fetchDiscounts() {
  loading.value = true;
  try {
    const res = await discountService.getAll();
    discounts.value = normalizeList(res);
  } catch (error) {
    console.error(error);
    alert(error?.response?.data?.message || "Không thể tải mã giảm giá");
  } finally {
    loading.value = false;
  }
}

async function fetchOptions() {
  optionLoading.value = true;
  try {
    const [productRes, categoryRes] = await Promise.all([
      loadWhenAllowed(authStore, ["admin:access", "product:manage"], () => productService.getAll()),
      categoryService.getAll(),
    ]);
    products.value = normalizeList(productRes);
    categories.value = normalizeList(categoryRes);
  } catch (error) {
    console.error(error);
    products.value = [];
    categories.value = [];
  } finally {
    optionLoading.value = false;
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
      await discountService.create(buildPayload());
      alert("Tạo mã giảm giá thành công");
    } else {
      await discountService.update(currentId.value, buildPayload());
      alert("Cập nhật mã giảm giá thành công");
    }

    closeModal();
    await fetchDiscounts();
  } catch (error) {
    console.error(error);
    setErrors(mapBackendValidationErrors(error));
    alert(error?.response?.data?.message || "Không thể lưu mã giảm giá");
  } finally {
    saving.value = false;
  }
}

async function removeDiscount(item) {
  if (!window.confirm("Bạn có chắc muốn xóa mã giảm giá này?\n\nDữ liệu sau khi xóa sẽ không thể khôi phục.")) return;

  try {
    await discountService.remove(getId(item));
    await fetchDiscounts();
    alert("Đã xóa mã giảm giá");
  } catch (error) {
    console.error(error);
    alert(error?.response?.data?.message || "Không thể xóa mã giảm giá");
  }
}

watch([keyword, scopeFilter, statusFilter], () => {
  currentPage.value = 1;
});

watch(filteredDiscounts, (list) => {
  const maxPage = Math.max(1, Math.ceil(list.length / pageSize.value));
  if (currentPage.value > maxPage) currentPage.value = maxPage;
});

watch(
  () => form.scope,
  (scope) => {
    if (scope !== "product") form.productIds = [];
    if (scope !== "category") form.categoryIds = [];
  },
);

onMounted(() => {
  fetchDiscounts();
  fetchOptions();
});
</script>

<template>
  <div class="admin-page">
    <div class="admin-page-title admin-page-title--stack">
      <h1>Mã giảm giá</h1>
      <p>Quản lý mã giảm giá theo đơn hàng, sản phẩm hoặc danh mục.</p>
    </div>

    <div class="admin-stat-row admin-stat-row--orders">
      <div class="admin-stat-card">
        <div class="admin-stat-card__label">Tổng mã</div>
        <div class="admin-stat-card__value">{{ discounts.length }}</div>
      </div>
      <div class="admin-stat-card">
        <div class="admin-stat-card__label">Đang lọc</div>
        <div class="admin-stat-card__value">{{ filteredDiscounts.length }}</div>
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
          <div class="admin-panel__header-title">Danh sách mã giảm giá</div>
          <div class="admin-panel__header-subtitle">
            Dữ liệu lấy từ /api/discounts, filter và phân trang xử lý ở frontend.
          </div>
        </div>

        <button class="admin-btn admin-btn--primary" @click="openCreateModal">
          <i class="fa-solid fa-plus me-1"></i>
          Thêm mã giảm giá
        </button>
      </div>

      <div class="admin-panel__body">
        <div class="row admin-toolbar">
          <div class="col-md-5">
            <input
              v-model="keyword"
              type="text"
              class="admin-toolbar__input"
              placeholder="Tìm theo mã hoặc tên"
            />
          </div>
          <div class="col-md-3">
            <select v-model="scopeFilter" class="admin-toolbar__select">
              <option value="">Tất cả phạm vi</option>
              <option value="order">Đơn hàng</option>
              <option value="product">Sản phẩm</option>
              <option value="category">Danh mục</option>
            </select>
          </div>
          <div class="col-md-4">
            <select v-model="statusFilter" class="admin-toolbar__select">
              <option value="">Tất cả trạng thái</option>
              <option value="active">Đang hoạt động</option>
              <option value="inactive">Ngừng hoạt động</option>
            </select>
          </div>
        </div>

        <div v-if="loading" class="admin-empty-state">Đang tải mã giảm giá...</div>
        <div v-else-if="!filteredDiscounts.length" class="admin-empty-state">
          Không có mã giảm giá phù hợp
        </div>

        <div v-else class="table-responsive">
          <table class="admin-table admin-table--orders">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Tên</th>
                <th>Phạm vi</th>
                <th>Loại</th>
                <th>Giá trị</th>
                <th>Lượt dùng</th>
                <th>Thời gian</th>
                <th>Trạng thái</th>
                <th>Homepage</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in paginatedDiscounts" :key="getId(item)">
                <td><strong>{{ item.code }}</strong></td>
                <td>{{ item.name }}</td>
                <td>{{ scopeText(item.scope) }}</td>
                <td>{{ typeText(item.type) }}</td>
                <td>
                  <span v-if="item.type === 'percent'">{{ Number(item.value || 0) }}%</span>
                  <span v-else>{{ formatCurrency(item.value) }}</span>
                </td>
                <td>{{ Number(item.usedCount || 0) }} / {{ Number(item.quantity || 0) || "∞" }}</td>
                <td>{{ formatDate(item.startDate) }} - {{ formatDate(item.endDate) }}</td>
                <td>
                  <span class="admin-badge" :class="statusClass(item.status)">
                    {{ statusText(item.status) }}
                  </span>
                </td>
                <td>{{ item.isPublic === true ? 'Công khai' : 'Riêng tư' }}</td>
                <td>
                  <div class="admin-table__actions">
                    <button type="button" class="admin-btn admin-btn--secondary" @click.stop="openEditModal(item)">
                      Sửa
                    </button>
                    <button
                      type="button"
                      class="admin-btn admin-btn--danger"
                      @click.stop="removeDiscount(item)"
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
            :total-items="filteredDiscounts.length"
            :page-size="pageSize"
          />
        </div>
      </div>
    </section>

    <div v-if="showModal" class="admin-modal-mask" @click.self="closeModal">
      <div class="admin-modal admin-modal--wide">
        <div class="admin-modal__header">
          <div class="admin-modal__title">
            {{ modalMode === "create" ? "Thêm mã giảm giá" : "Sửa mã giảm giá" }}
          </div>
          <button type="button" class="admin-btn admin-btn--secondary" @click="closeModal">
            Đóng
          </button>
        </div>

        <div class="admin-modal__body">
          <form class="admin-form" @submit.prevent="submitForm">
            <div class="admin-form__row">
              <label class="admin-form__label">Mã *</label>
              <div>
                <input
                  v-model="form.code"
                  class="admin-form__control"
                  :class="{ 'is-invalid': errors.code }"
                  placeholder="VD: SALE10"
                />
                <div v-if="errors.code" class="admin-form__error">{{ errors.code }}</div>
              </div>
            </div>

            <div class="admin-form__row">
              <label class="admin-form__label">Tên mã *</label>
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
              <label for="discount-description" class="admin-form__label">Mô tả hiển thị</label>
              <textarea id="discount-description" v-model="form.description" class="admin-form__textarea" rows="2" />
            </div>
            <div class="admin-form__row">
              <span class="admin-form__label">Hiển thị Homepage</span>
              <div>
                <label><input v-model="form.isPublic" type="checkbox" /> Công khai mã trên Homepage</label>
                <p class="admin-form__hint">Chỉ mã đang hoạt động, trong thời gian áp dụng và còn lượt dùng được hiển thị.</p>
              </div>
            </div>
            <div class="admin-form__row">
              <label class="admin-form__label">Phạm vi *</label>
              <select v-model="form.scope" class="admin-form__select">
                <option value="order">Đơn hàng</option>
                <option value="product">Sản phẩm</option>
                <option value="category">Danh mục</option>
              </select>
            </div>

            <div v-if="form.scope === 'product'" class="admin-form__row">
              <label class="admin-form__label">Sản phẩm áp dụng</label>
              <MultiSelectSearch
                :items="productOptions"
                :selected-ids="form.productIds"
                label-key="discountLabel"
                value-key="_id"
                code-key="discountCode"
                group-key="discountCategoryLabel"
                group-label-key="discountCategoryLabel"
                :search-keys="[
                  'discountCode',
                  'discountLabel',
                  'name',
                  'productName',
                  'itemCode',
                  'productCode',
                  'slug',
                  'discountCategoryLabel',
                ]"
                placeholder="Tìm sản phẩm theo mã, tên hoặc danh mục..."
                :loading="optionLoading"
                helper-text="Để trống nếu áp dụng cho mọi sản phẩm."
                empty-text="Không tìm thấy sản phẩm phù hợp"
                @update:selected-ids="form.productIds = $event"
              />
              <div v-if="errors.productIds" class="admin-form__error">
                {{ errors.productIds }}
              </div>
            </div>

            <div v-if="form.scope === 'category'" class="admin-form__row">
              <label class="admin-form__label">Danh mục áp dụng</label>
              <MultiSelectSearch
                :items="categoryOptions"
                :selected-ids="form.categoryIds"
                label-key="discountLabel"
                value-key="_id"
                code-key="discountCode"
                group-key="discountParentLabel"
                group-label-key="discountParentLabel"
                :search-keys="['discountCode', 'discountLabel', 'name', 'title', 'slug', 'discountParentLabel']"
                placeholder="Tìm danh mục theo tên, slug hoặc danh mục cha..."
                :loading="optionLoading"
                helper-text="Để trống nếu áp dụng cho mọi danh mục."
                empty-text="Không tìm thấy danh mục phù hợp"
                @update:selected-ids="form.categoryIds = $event"
              />
              <div v-if="errors.categoryIds" class="admin-form__error">
                {{ errors.categoryIds }}
              </div>
            </div>

            <div class="admin-form__row">
              <label class="admin-form__label">Loại giảm *</label>
              <select v-model="form.type" class="admin-form__select">
                <option value="percent">Phần trăm</option>
                <option value="fixed">Số tiền cố định</option>
              </select>
            </div>

            <div class="admin-form__row">
              <label class="admin-form__label">Giá trị *</label>
              <div>
                <input
                  v-model="form.value"
                  type="number"
                  min="0"
                  class="admin-form__control"
                  :class="{ 'is-invalid': errors.value }"
                />
                <div v-if="errors.value" class="admin-form__error">{{ errors.value }}</div>
              </div>
            </div>

            <div class="admin-form__row">
              <label class="admin-form__label">Giá trị đơn tối thiểu</label>
              <div>
                <input
                  v-model="form.minOrderValue"
                  type="number"
                  min="0"
                  class="admin-form__control"
                  :class="{ 'is-invalid': errors.minOrderValue }"
                />
                <div v-if="errors.minOrderValue" class="admin-form__error">
                  {{ errors.minOrderValue }}
                </div>
              </div>
            </div>

            <div class="admin-form__row">
              <label class="admin-form__label">Giảm tối đa</label>
              <div>
                <input
                  v-model="form.maxDiscountAmount"
                  type="number"
                  min="0"
                  class="admin-form__control"
                  :class="{ 'is-invalid': errors.maxDiscountAmount }"
                />
                <div v-if="errors.maxDiscountAmount" class="admin-form__error">
                  {{ errors.maxDiscountAmount }}
                </div>
              </div>
            </div>

            <div class="admin-form__row">
              <label class="admin-form__label">Số lượng mã</label>
              <div>
                <input
                  v-model="form.quantity"
                  type="number"
                  min="0"
                  class="admin-form__control"
                  :class="{ 'is-invalid': errors.quantity }"
                />
                <div v-if="errors.quantity" class="admin-form__error">{{ errors.quantity }}</div>
              </div>
            </div>

            <div class="admin-form__row">
              <label class="admin-form__label">Ngày bắt đầu</label>
              <input v-model="form.startDate" type="date" class="admin-form__control" />
            </div>

            <div class="admin-form__row">
              <label class="admin-form__label">Ngày kết thúc</label>
              <div>
                <input
                  v-model="form.endDate"
                  type="date"
                  class="admin-form__control"
                  :class="{ 'is-invalid': errors.endDate }"
                />
                <div v-if="errors.endDate" class="admin-form__error">
                  {{ errors.endDate }}
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
