<script setup>
import { computed } from "vue";
import { dashboardAlerts, number } from "@/utils/admin-dashboard-display.util";
import DashboardEmpty from "./DashboardEmpty.vue";
const props = defineProps({ data: { type: Object, default: null } });
const alerts = computed(() => dashboardAlerts(props.data));
const limited = computed(
  () =>
    !props.data ||
    props.data.errors.length ||
    !["orders", "inventory"].every((key) => props.data.access[key]),
);
</script>
<template>
  <section class="fm-panel fm-alert-panel">
    <header class="fm-section-head">
      <div>
        <span class="fm-panel-kicker">Ưu tiên vận hành</span>
        <h2>Cần xử lý</h2>
      </div>
      <span class="fm-scope">Hiện tại</span>
    </header>
    <div v-if="alerts.length" class="fm-alert-body">
      <RouterLink
        v-for="alert in alerts.slice(0, 5)"
        :key="alert.label"
        :to="alert.to"
        class="fm-alert"
        :data-tone="alert.tone"
        ><span class="fm-alert-icon" aria-hidden="true"
          ><i :class="'fa-solid ' + alert.icon"></i></span
        ><span class="fm-alert-copy"
          >{{ alert.label
          }}<small v-if="alert.scope === 'Trong kỳ'">Trong kỳ chọn</small></span
        ><b>{{ number(alert.count) }}</b
        ><i class="fa-solid fa-chevron-right fm-chevron" aria-hidden="true"></i
      ></RouterLink>
      <details v-if="alerts.length > 5" class="fm-more">
        <summary>Thêm {{ alerts.length - 5 }} nhóm cảnh báo</summary>
        <RouterLink
          v-for="alert in alerts.slice(5)"
          :key="alert.label"
          :to="alert.to"
          class="fm-alert"
          :data-tone="alert.tone"
          ><span class="fm-alert-icon" aria-hidden="true"
            ><i :class="'fa-solid ' + alert.icon"></i></span
          ><span class="fm-alert-copy"
            >{{ alert.label
            }}<small v-if="alert.scope === 'Trong kỳ'"
              >Trong kỳ chọn</small
            ></span
          ><b>{{ number(alert.count) }}</b></RouterLink
        >
      </details>
    </div>
    <DashboardEmpty
      v-else
      :title="
        limited ? 'Chưa đủ dữ liệu cảnh báo' : 'Không có cảnh báo cần xử lý'
      "
      :detail="
        limited
          ? 'Một số khu vực chưa tải được hoặc chưa được cấp quyền.'
          : 'Các khu vực bạn được phép xem hiện không có cảnh báo.'
      "
      icon="fa-circle-check"
    />
    <footer class="fm-panel-footer fm-note">
      Ưu tiên hàng hết hạn, thiếu tồn và vấn đề thanh toán.
    </footer>
  </section>
</template>
