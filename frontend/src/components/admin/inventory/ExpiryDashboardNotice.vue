<script setup>
import { onMounted, onBeforeUnmount, ref } from "vue";
import { useAuthStore } from "@/stores/user/auth";
import { hasPermission } from "@/utils/permission.util";
import expiryService from "@/services/expiry.service";
const auth = useAuthStore(), summary = ref(null), error = ref("");
let timer, disposed = false;
async function load() {
  if (!hasPermission(auth, "inventory:manage")) return;
  try { const result = await expiryService.summary(); if (!disposed) { summary.value = result; error.value = ""; } }
  catch { if (!disposed) error.value = "Chưa tải được thống kê hạn sử dụng."; }
}
onMounted(() => { void load(); timer = setInterval(load, 60000); });
onBeforeUnmount(() => { disposed = true; clearInterval(timer); });
</script>
<template>
  <aside v-if="hasPermission(auth,'inventory:manage')" class="admin-panel mb-3"><div class="admin-panel__body">
    <p v-if="error" role="alert">{{ error }} <button class="admin-btn admin-btn--secondary" @click="load">Thử lại</button></p>
    <p v-else-if="!summary" role="status">Đang kiểm tra cảnh báo kho…</p>
    <template v-else><p>Có <strong>{{ summary.warning + summary.urgent }}</strong> lô sắp hết hạn, trong đó <strong>{{ summary.urgent }}</strong> lô cần ưu tiên. Có {{ summary.expired }} lô hết hạn còn tồn và {{ summary.unknown }} lô cần bổ sung hạn sử dụng.</p><RouterLink to="/admin/inventory-expiry">Xem cảnh báo hạn sử dụng →</RouterLink></template>
  </div></aside>
</template>
