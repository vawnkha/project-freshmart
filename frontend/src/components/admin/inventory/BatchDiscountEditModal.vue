<script setup>
import { computed, reactive, ref, watch } from "vue";
import DiscountEditorDialog from "@/components/admin/marketing/DiscountEditorDialog.vue";
import discountService from "@/services/discount.service";
import { useAuthStore } from "@/stores/user/auth";
import { batchOfferCondition, batchOfferLotLabel, vietnamInput } from "@/utils/expiry.util";
import { hasPermission } from "@/utils/permission.util";

const props = defineProps({ discount: Object });
const emit = defineEmits(["close", "saved"]);
const saving = ref(false), error = ref("");
const details = ref(null), detailsLoading = ref(false), detailsError = ref("");
const auth = useAuthStore();
const open = computed(() => !!props.discount);
const editTerms = computed(() => props.discount?.status === "active" && Date.parse(props.discount.endDate) > Date.now());
const statusLabel = computed(() => {
  if (!editTerms.value) return "Đã kết thúc";
  return Date.parse(props.discount.startDate) > Date.now() ? "Chờ bắt đầu" : "Đang hoạt động";
});
const usedQuantity = computed(() => Number(props.discount?.usedQuantity || 0));
const form = reactive({});
let initial = {};
let detailsVersion = 0;
const termFields = ["value", "batchQuantity", "startDate", "endDate"];

watch(() => props.discount, item => {
  detailsVersion++;
  details.value = null;
  detailsLoading.value = false;
  detailsError.value = "";
  if (!item) return;
  initial = {
    code: item.code ?? "", name: item.name ?? "", description: item.publicDescription ?? "",
    isPublic: item.isPublic === true, value: item.value ?? 0, batchQuantity: item.batchQuantity ?? 0,
    startDate: vietnamInput(item.startDate), endDate: vietnamInput(item.endDate),
  };
  Object.assign(form, initial);
  error.value = "";
  void loadDetails();
});

async function loadDetails() {
  if (!props.discount || detailsLoading.value) return;
  const request = ++detailsVersion;
  detailsLoading.value = true;
  detailsError.value = "";
  try {
    const data = await discountService.getById(props.discount._id || props.discount.id);
    if (!data?.batchDetails) throw new Error("Thiếu thông tin lô.");
    if (request === detailsVersion) details.value = data.batchDetails;
  } catch {
    if (request === detailsVersion) detailsError.value = "Chưa tải được thông tin sản phẩm và lô.";
  } finally {
    if (request === detailsVersion) detailsLoading.value = false;
  }
}

async function submit() {
  if (!props.discount || saving.value) return;
  const fields = { code: form.code.trim(), name: form.name.trim(), description: form.description.trim(), isPublic: form.isPublic };
  if (editTerms.value) {
    for (const key of termFields) fields[key] = form[key];
  }
  const changes = Object.fromEntries(Object.entries(fields).filter(([key, value]) => value !== initial[key]));
  if (!Object.keys(changes).length) { emit("close"); return; }
  for (const field of ["startDate", "endDate"]) {
    if (changes[field]) changes[field] += ":00+07:00";
  }

  saving.value = true;
  error.value = "";
  try {
    await discountService.update(props.discount._id || props.discount.id, changes);
    emit("saved");
    emit("close");
  } catch (cause) {
    error.value = cause.response?.data?.message || "Không thể lưu thay đổi. Vui lòng thử lại.";
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <DiscountEditorDialog :open="open" title="Sửa mã giảm giá theo lô" :saving="saving" @close="emit('close')" @submit="submit">
    <p v-if="error" class="admin-form__error" role="alert">{{ error }}</p>
    <div class="admin-form__row">
      <label for="batch-discount-code" class="admin-form__label">Mã *</label>
      <input id="batch-discount-code" v-model="form.code" class="admin-form__control" maxlength="100" required :disabled="saving" />
    </div>
    <div class="admin-form__row">
      <label for="batch-discount-name" class="admin-form__label">Tên mã *</label>
      <input id="batch-discount-name" v-model="form.name" class="admin-form__control" maxlength="200" required :disabled="saving" />
    </div>
    <div class="admin-form__row">
      <label for="batch-discount-description" class="admin-form__label">Mô tả hiển thị</label>
      <div>
        <textarea id="batch-discount-description" v-model="form.description" class="admin-form__textarea" maxlength="2000" rows="2"
          :disabled="saving" aria-describedby="batch-discount-description-hint" />
        <p id="batch-discount-description-hint" class="admin-form__hint">
          <template v-if="details?.defaultDescription && !form.description?.trim()">
            <strong>Mô tả mặc định khi để trống</strong><br />{{ details.defaultDescription }}
          </template>
          <template v-else>Để trống để dùng mô tả mặc định của hệ thống.</template>
        </p>
      </div>
    </div>
    <div class="admin-form__row">
      <span class="admin-form__label">Hiển thị Homepage</span>
      <div>
        <label><input v-model="form.isPublic" type="checkbox" :disabled="saving" /> Công khai mã trên Homepage</label>
        <p class="admin-form__hint">Chỉ hiển thị mã còn hiệu lực và còn suất ưu đãi.</p>
      </div>
    </div>
    <div class="admin-form__row">
      <label for="batch-discount-scope" class="admin-form__label">Phạm vi</label>
      <input id="batch-discount-scope" class="admin-form__control batch-discount-readonly" value="Lô hàng (đã duyệt)" readonly />
    </div>
    <div class="admin-form__row">
      <label for="batch-discount-condition" class="admin-form__label">Điều kiện</label>
      <input id="batch-discount-condition" class="admin-form__control batch-discount-readonly" :value="batchOfferCondition" readonly />
    </div>
    <div class="admin-form__row">
      <span class="admin-form__label">Sản phẩm áp dụng</span>
      <div class="admin-action-row">
        <strong>{{ details?.productName || (detailsLoading ? 'Đang tải…' : 'Chưa xác định') }}</strong>
        <RouterLink v-if="hasPermission(auth, 'product:manage')" to="/admin/products" class="admin-btn admin-btn--secondary">Quản lý sản phẩm</RouterLink>
      </div>
    </div>
    <div class="admin-form__row">
      <span class="admin-form__label">Lô được ưu đãi</span>
      <div>
        <p v-if="details" class="admin-form__control batch-discount-readonly batch-discount-summary">{{ batchOfferLotLabel(details) }}</p>
        <p v-else-if="detailsError" class="admin-form__control batch-discount-readonly batch-discount-summary" role="alert">{{ detailsError }}</p>
        <p v-else class="admin-form__control batch-discount-readonly batch-discount-summary" role="status">Đang tải thông tin lô…</p>
        <div v-if="detailsError || (discount.batchId && hasPermission(auth, 'inventory:manage'))" class="admin-action-row">
          <button v-if="detailsError" type="button" class="admin-btn admin-btn--secondary" @click="loadDetails">Thử lại</button>
          <RouterLink v-if="discount.batchId && hasPermission(auth, 'inventory:manage')"
            :to="'/admin/inventory-expiry/' + discount.batchId" class="admin-btn admin-btn--secondary">Xem chi tiết lô</RouterLink>
        </div>
      </div>
    </div>
    <div class="admin-form__row">
      <label for="batch-discount-type" class="admin-form__label">Loại giảm</label>
      <input id="batch-discount-type" class="admin-form__control batch-discount-readonly" value="Phần trăm" readonly />
    </div>
    <div class="admin-form__row">
      <label for="batch-discount-value" class="admin-form__label">Giá trị (%) *</label>
      <input id="batch-discount-value" v-model.number="form.value" class="admin-form__control"
        type="number" min="0.01" max="100" step="0.01" required :disabled="saving || !editTerms" />
    </div>
    <div class="admin-form__row">
      <label for="batch-discount-quantity" class="admin-form__label">Tổng số suất</label>
      <div>
        <input id="batch-discount-quantity" v-model.number="form.batchQuantity" class="admin-form__control"
          type="number" :min="usedQuantity + 1" step="1" required :disabled="saving || !editTerms" />
        <p class="admin-form__hint">Đã dùng {{ usedQuantity }} suất. Số suất còn lại phải nằm trong tồn kho.</p>
      </div>
    </div>
    <div class="admin-form__row">
      <label for="batch-discount-start" class="admin-form__label">Bắt đầu (giờ Việt Nam)</label>
      <input id="batch-discount-start" v-model="form.startDate" class="admin-form__control"
        type="datetime-local" required :disabled="saving || !editTerms" />
    </div>
    <div class="admin-form__row">
      <label for="batch-discount-end" class="admin-form__label">Hạn dùng mã (giờ Việt Nam)</label>
      <div>
        <input id="batch-discount-end" v-model="form.endDate" class="admin-form__control"
          type="datetime-local" required :disabled="saving || !editTerms" />
        <p class="admin-form__hint">Mã hết hiệu lực chậm nhất vào đầu ngày hết hạn của lô.</p>
      </div>
    </div>
    <div class="admin-form__row">
      <label for="batch-discount-status" class="admin-form__label">Trạng thái</label>
      <div>
        <input id="batch-discount-status" class="admin-form__control batch-discount-readonly" :value="statusLabel" readonly />
        <p v-if="!editTerms" class="admin-form__hint">Bạn có thể sửa thông tin hiển thị của mã đã kết thúc.</p>
      </div>
    </div>
  </DiscountEditorDialog>
</template>

<style scoped>
.batch-discount-readonly { background: var(--admin-bg); }
.batch-discount-summary { margin: 0 0 6px; overflow-wrap: anywhere; }
.admin-action-row { min-height: 38px; overflow-wrap: anywhere; }
</style>
