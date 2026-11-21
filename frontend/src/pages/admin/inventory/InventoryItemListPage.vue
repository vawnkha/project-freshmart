<script setup>
import { computed, onMounted, ref } from 'vue';
import inventoryItemService from '@/services/inventory-item.service';
import AdminPagination from '@/components/admin/common/AdminPagination.vue';
const rows = ref([]), keyword = ref(''), loading = ref(false), error = ref('');
const page = ref(1);
const filtered = computed(() => {
  const query = keyword.value.trim().toLocaleLowerCase();
  return rows.value.filter(row => `${row.itemCode || ''} ${row.itemName || ''}`.toLocaleLowerCase().includes(query));
});
const visible = computed(() => filtered.value.slice((page.value - 1) * 12, page.value * 12));
const money = value => value == null ? 'Chưa có lần nhập' : Number(value).toLocaleString('vi-VN') + ' VNĐ';
async function load() {
  loading.value = true;
  error.value = '';
  try { const response = await inventoryItemService.getAll(); rows.value = response?.data || []; }
  catch (failure) { error.value = failure?.response?.data?.message || 'Không thể tải tồn kho'; }
  finally { loading.value = false; }
}
onMounted(load);
</script>
<template>
  <div>
    <h1 class="admin-page-title">Kho hàng</h1>
    <section class="admin-panel" :aria-busy="loading">
      <div class="admin-panel__header">
        <div class="admin-panel__header-title">Tồn kho sản phẩm</div>
        <button class="admin-btn admin-btn--secondary" :disabled="loading" @click="load">Làm mới</button>
      </div>
      <div class="admin-panel__body">
        <p v-if="error" role="alert" class="admin-form__error">{{ error }}</p>
        <div class="admin-toolbar"><input v-model="keyword" class="admin-toolbar__input" placeholder="Tìm mã hoặc tên sản phẩm" @input="page = 1" /></div>
        <div class="table-responsive">
          <table class="admin-table">
            <thead><tr><th>Mã sản phẩm</th><th>Tên sản phẩm</th><th>Đơn vị</th><th>Quy cách</th><th>Tổng tồn</th><th>Khả dụng</th><th>Giá nhập gần nhất</th><th></th></tr></thead>
            <tbody>
              <tr v-for="row in visible" :key="row._id">
                <td>{{ row.itemCode || 'Chưa liên kết' }}</td>
                <td>{{ row.itemName || 'Hồ sơ kho chưa liên kết sản phẩm' }}<div v-if="!row.productId" class="admin-note">Cần đối chiếu dữ liệu cũ</div></td>
                <td>{{ row.unit || '—' }}</td><td>{{ row.packageSize || '—' }}</td>
                <td>{{ row.quantity }}</td><td>{{ row.availableQuantity }}</td><td>{{ money(row.lastImportPrice) }}</td>
                <td><div class="admin-action-stack">
                  <RouterLink class="admin-btn admin-btn--secondary" :to="{ name: 'admin-inventory-batches', query: { inventoryItemId: row._id } }">Lô hàng</RouterLink>
                  <RouterLink class="admin-btn admin-btn--secondary" :to="{ name: 'admin-inventory-transactions', query: { inventoryItemId: row._id } }">Lịch sử kho</RouterLink>
                  <RouterLink class="admin-btn admin-btn--secondary" :to="{ name: 'admin-inventory-expiry', query: { inventoryItemId: row._id } }">Hạn sử dụng</RouterLink>
                </div></td>
              </tr>
              <tr v-if="!loading && !filtered.length"><td colspan="8">Không có sản phẩm phù hợp</td></tr>
            </tbody>
          </table>
        </div>
        <AdminPagination v-model="page" :total-items="filtered.length" :page-size="12" />
      </div>
    </section>
  </div>
</template>
