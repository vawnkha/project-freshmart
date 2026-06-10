<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import { useRouter } from "vue-router";
import purchaseOrderService from "@/services/purchase-order.service";
import supplierService from "@/services/supplier.service";
import inventoryItemService from "@/services/inventory-item.service";
import {
  dateStringSchema,
  nonNegativeNumberSchema,
  objectIdSchema,
  optionalString,
  positiveNumberSchema,
  requiredString,
  z,
} from "@/validators/common.validator";
import { mapBackendValidationErrors } from "@/utils/validation-error.util";

const router = useRouter();
const suppliers = ref([]);
const inventoryItems = ref([]);
const loading = ref(false);
const saving = ref(false);

const form = reactive({
  supplierId: "",
  purchaseCode: "",
  note: "",
  items: [],
});

const purchaseOrderItemSchema = z
  .object({
    inventoryItemId: objectIdSchema,
    quantity: positiveNumberSchema,
    importPrice: nonNegativeNumberSchema,
    batchNumber: requiredString("So lo la bat buoc"),
    manufacturingDate: dateStringSchema,
    expiryDate: z
      .string()
      .min(1, "Han dung la bat buoc")
      .refine((value) => !Number.isNaN(new Date(value).getTime()), {
        message: "Han dung khong hop le",
      }),
    warehouseLocation: optionalString,
  })
  .refine(
    (value) =>
      !value.manufacturingDate ||
      !value.expiryDate ||
      new Date(value.expiryDate).getTime() >
        new Date(value.manufacturingDate).getTime(),
    {
      message: "Han dung phai lon hon ngay san xuat",
      path: ["expiryDate"],
    },
  );

const purchaseOrderSchema = toTypedSchema(
  z.object({
    supplierId: objectIdSchema,
    purchaseCode: optionalString,
    note: optionalString,
    items: z.array(purchaseOrderItemSchema).min(1, {
      message: "Vui long them hang nhap",
    }),
  }),
);

const {
  errors,
  setErrors,
  setValues,
  validate: validateVee,
} = useForm({
  validationSchema: purchaseOrderSchema,
});

const totalAmount = computed(() =>
  form.items.reduce(
    (sum, item) => sum + Number(item.quantity || 0) * Number(item.importPrice || 0),
    0,
  ),
);

function normalizeList(res) {
  return Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
}

function getId(item) {
  return item?._id || item?.id || "";
}

function activeItems(list) {
  return list.filter((item) => item.status !== "inactive");
}

function getInventoryItem(id) {
  return inventoryItems.value.find((item) => getId(item) === id);
}

function formatPrice(value) {
  return Number(value || 0).toLocaleString("vi-VN") + " VND";
}

function makeBatchNumber() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return `LO${y}${m}${d}${hh}${mm}-${form.items.length + 1}`;
}

function addItemRow() {
  form.items.push({
    inventoryItemId: "",
    quantity: 1,
    importPrice: 0,
    batchNumber: makeBatchNumber(),
    manufacturingDate: "",
    expiryDate: "",
    warehouseLocation: "",
  });
}

function removeItemRow(index) {
  form.items.splice(index, 1);
  if (!form.items.length) addItemRow();
}

function itemError(index, field) {
  const source = errors.value || errors;
  return (
    source?.[`items[${index}].${field}`] ||
    source?.[`items.${index}.${field}`] ||
    ""
  );
}

function onInventoryItemChange(row) {
  const item = getInventoryItem(row.inventoryItemId);
  row.unit = item?.unit || "";
  row.packageSize = item?.packageSize || "";
}

async function validateForm() {
  setValues({
    ...form,
    items: form.items.map((item) => ({ ...item })),
  });
  const result = await validateVee();
  return result.valid;
}

function buildPayload() {
  const payload = {
    supplierId: form.supplierId,
    note: form.note.trim(),
    items: form.items.map((item) => ({
      inventoryItemId: item.inventoryItemId,
      quantity: Number(item.quantity || 0),
      importPrice: Number(item.importPrice || 0),
      batchNumber: String(item.batchNumber || "").trim(),
      manufacturingDate: item.manufacturingDate || undefined,
      expiryDate: item.expiryDate,
      warehouseLocation: String(item.warehouseLocation || "").trim(),
    })),
  };

  if (form.purchaseCode.trim()) payload.purchaseCode = form.purchaseCode.trim();
  if (!payload.note) delete payload.note;

  return payload;
}

async function fetchOptions() {
  loading.value = true;
  try {
    const [supplierRes, itemRes] = await Promise.all([
      supplierService.getAll(),
      inventoryItemService.getAll(),
    ]);

    suppliers.value = normalizeList(supplierRes);
    inventoryItems.value = normalizeList(itemRes);
  } catch (error) {
    console.error(error);
    alert(error?.response?.data?.message || "Không thể tải dữ liệu tạo phiếu");
  } finally {
    loading.value = false;
  }
}

async function submitForm() {
  const valid = await validateForm();
  if (!valid) return;

  saving.value = true;
  try {
    const res = await purchaseOrderService.create(buildPayload());
    const id = res?.data?._id || res?.data?.insertedId;
    alert(res?.message || "Tạo phiếu nhập thành công");
    router.push({
      name: "admin-purchase-order-detail",
      params: { id },
    });
  } catch (error) {
    console.error(error);
    setErrors(mapBackendValidationErrors(error));
    alert(error?.response?.data?.message || "Không thể tạo phiếu nhập");
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  addItemRow();
  await fetchOptions();
});
</script>

<template>
  <div class="admin-page">
    <div class="admin-page-title admin-page-title--stack">
      <h1>Tạo phiếu nhập kho</h1>
      <p>Chọn nhà cung cấp và hàng kho bằng dropdown, không nhập ObjectId thủ công.</p>
    </div>

    <section class="admin-panel">
      <div class="admin-panel__header admin-panel__header--flex">
        <div>
          <div class="admin-panel__header-title">Thông tin phiếu nhập</div>
          <div class="admin-panel__header-subtitle">
            Sau khi tạo, phiếu ở trạng thái nháp và cần confirm import để tạo lô,
            summary, transaction.
          </div>
        </div>
        <button
          type="button"
          class="admin-btn admin-btn--secondary"
          @click="router.push({ name: 'admin-purchase-orders' })"
        >
          Quay lại
        </button>
      </div>

      <div class="admin-panel__body">
        <div v-if="loading" class="admin-empty-state">Đang tải dữ liệu...</div>

        <form v-else class="admin-form purchase-order-form" @submit.prevent="submitForm">
          <div class="admin-form__row">
            <label class="admin-form__label">Nhà cung cấp *</label>
            <div>
              <select
                v-model="form.supplierId"
                class="admin-form__select"
                :class="{ 'is-invalid': errors.supplierId }"
              >
                <option value="">-- Chọn nhà cung cấp --</option>
                <option
                  v-for="supplier in activeItems(suppliers)"
                  :key="getId(supplier)"
                  :value="getId(supplier)"
                >
                  {{ supplier.name }}
                </option>
              </select>
              <div v-if="errors.supplierId" class="admin-form__error">
                {{ errors.supplierId }}
              </div>
            </div>
          </div>

          <div class="admin-form__row">
            <label class="admin-form__label">Mã phiếu</label>
            <input
              v-model="form.purchaseCode"
              class="admin-form__control"
              placeholder="Để trống để backend tự sinh"
            />
          </div>

          <div class="admin-form__row">
            <label class="admin-form__label">Ghi chú</label>
            <textarea v-model="form.note" class="admin-form__textarea" rows="3" />
          </div>

          <div class="purchase-order-items">
            <div class="purchase-order-items__header">
              <strong>Hàng nhập</strong>
              <button
                type="button"
                class="admin-btn admin-btn--primary"
                @click="addItemRow"
              >
                <i class="fa-solid fa-plus me-1"></i>
                Thêm dòng
              </button>
            </div>

            <div
              v-for="(row, index) in form.items"
              :key="index"
              class="purchase-order-line"
            >
              <div class="purchase-order-line__top">
                <strong>Dòng {{ index + 1 }}</strong>
                <button
                  type="button"
                  class="admin-btn admin-btn--danger"
                  @click="removeItemRow(index)"
                >
                  Xóa
                </button>
              </div>

              <div class="purchase-order-grid">
                <div class="purchase-order-field purchase-order-field--wide">
                  <label>Hàng kho *</label>
                  <select
                    v-model="row.inventoryItemId"
                    class="admin-form__select"
                    :class="{ 'is-invalid': itemError(index, 'inventoryItemId') }"
                    @change="onInventoryItemChange(row)"
                  >
                    <option value="">-- Chọn hàng kho --</option>
                    <option
                      v-for="item in activeItems(inventoryItems)"
                      :key="getId(item)"
                      :value="getId(item)"
                    >
                      {{ item.itemCode }} - {{ item.itemName }}
                    </option>
                  </select>
                  <div v-if="itemError(index, 'inventoryItemId')" class="admin-form__error">
                    {{ itemError(index, "inventoryItemId") }}
                  </div>
                </div>

                <div class="purchase-order-field">
                  <label>Đơn vị</label>
                  <input
                    :value="getInventoryItem(row.inventoryItemId)?.unit || row.unit || ''"
                    class="admin-form__control"
                    disabled
                  />
                </div>

                <div class="purchase-order-field">
                  <label>Quy cách</label>
                  <input
                    :value="
                      getInventoryItem(row.inventoryItemId)?.packageSize ||
                      row.packageSize ||
                      ''
                    "
                    class="admin-form__control"
                    disabled
                  />
                </div>

                <div class="purchase-order-field">
                  <label>Số lượng *</label>
                  <input
                    v-model="row.quantity"
                    type="number"
                    min="1"
                    class="admin-form__control"
                    :class="{ 'is-invalid': itemError(index, 'quantity') }"
                  />
                  <div v-if="itemError(index, 'quantity')" class="admin-form__error">
                    {{ itemError(index, "quantity") }}
                  </div>
                </div>

                <div class="purchase-order-field">
                  <label>Giá nhập *</label>
                  <input
                    v-model="row.importPrice"
                    type="number"
                    min="0"
                    class="admin-form__control"
                    :class="{ 'is-invalid': itemError(index, 'importPrice') }"
                  />
                  <div v-if="itemError(index, 'importPrice')" class="admin-form__error">
                    {{ itemError(index, "importPrice") }}
                  </div>
                </div>

                <div class="purchase-order-field">
                  <label>Thành tiền</label>
                  <input
                    :value="formatPrice(Number(row.quantity || 0) * Number(row.importPrice || 0))"
                    class="admin-form__control"
                    disabled
                  />
                </div>

                <div class="purchase-order-field">
                  <label>Số lô *</label>
                  <input
                    v-model="row.batchNumber"
                    class="admin-form__control"
                    :class="{ 'is-invalid': itemError(index, 'batchNumber') }"
                  />
                  <div v-if="itemError(index, 'batchNumber')" class="admin-form__error">
                    {{ itemError(index, "batchNumber") }}
                  </div>
                </div>

                <div class="purchase-order-field">
                  <label>Ngày sản xuất</label>
                  <input
                    v-model="row.manufacturingDate"
                    type="date"
                    class="admin-form__control"
                  />
                </div>

                <div class="purchase-order-field">
                  <label>Hạn dùng *</label>
                  <input
                    v-model="row.expiryDate"
                    type="date"
                    class="admin-form__control"
                    :class="{ 'is-invalid': itemError(index, 'expiryDate') }"
                  />
                  <div v-if="itemError(index, 'expiryDate')" class="admin-form__error">
                    {{ itemError(index, "expiryDate") }}
                  </div>
                </div>

                <div class="purchase-order-field purchase-order-field--wide">
                  <label>Vị trí kho</label>
                  <input
                    v-model="row.warehouseLocation"
                    class="admin-form__control"
                  />
                </div>
              </div>
            </div>
          </div>

          <div class="purchase-order-total">
            <span>Tổng tiền nhập</span>
            <strong>{{ formatPrice(totalAmount) }}</strong>
          </div>

          <div class="admin-form__actions">
            <button
              type="button"
              class="admin-btn admin-btn--secondary"
              @click="router.push({ name: 'admin-purchase-orders' })"
            >
              Hủy
            </button>
            <button
              type="submit"
              class="admin-btn admin-btn--success"
              :disabled="saving"
            >
              {{ saving ? "Đang tạo..." : "Tạo phiếu nhập" }}
            </button>
          </div>
        </form>
      </div>
    </section>
  </div>
</template>

<style scoped>
.purchase-order-form {
  margin: 0;
  max-width: none;
}

.purchase-order-items {
  display: grid;
  gap: 14px;
  margin-top: 20px;
}

.purchase-order-items__header,
.purchase-order-line__top,
.purchase-order-total {
  align-items: center;
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.purchase-order-line {
  border: 1px solid #e8edf3;
  border-radius: 6px;
  display: grid;
  gap: 14px;
  padding: 14px;
}

.purchase-order-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.purchase-order-field {
  display: grid;
  gap: 6px;
}

.purchase-order-field--wide {
  grid-column: span 2;
}

.purchase-order-field label {
  color: #667a93;
  font-size: 13px;
  font-weight: 700;
}

.purchase-order-total {
  background: #f8fafc;
  border: 1px solid #e8edf3;
  border-radius: 6px;
  margin-top: 18px;
  padding: 14px;
}

.purchase-order-total strong {
  color: #1f7a4d;
  font-size: 20px;
}

@media (max-width: 900px) {
  .purchase-order-grid {
    grid-template-columns: 1fr;
  }

  .purchase-order-field--wide {
    grid-column: auto;
  }
}
</style>
