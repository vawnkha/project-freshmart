<script setup>
import { computed } from "vue";
import {
  date,
  money,
  number,
  shareWidth,
} from "@/utils/admin-dashboard-display.util";
import DashboardEmpty from "./DashboardEmpty.vue";
import DashboardHint from "./DashboardHint.vue";
const props = defineProps({
  model: { type: Object, default: null },
  permitted: Boolean,
});
const metrics = computed(() =>
  props.model
    ? [
        {
          label: "SKU đang hoạt động",
          value: props.model.skus,
          icon: "fa-boxes-stacked",
          tone: "navy",
        },
        {
          label: "Hết tồn khả dụng",
          value: props.model.outOfStock,
          icon: "fa-box-open",
          tone: "danger",
          to: "/admin/inventory-summaries",
        },
        {
          label: "Dưới ngưỡng tối thiểu",
          value: props.model.lowStock,
          icon: "fa-arrow-down-short-wide",
          tone: "warning",
          to: "/admin/inventory-summaries",
        },
        {
          label: `Cận hạn ≤ ${props.model.expiry.config.warningDays} ngày`,
          value: props.model.expiry.warning + props.model.expiry.urgent,
          icon: "fa-hourglass-half",
          tone: "warning",
          to: "/admin/inventory-expiry",
        },
        {
          label: "Lô hết hạn còn tồn",
          value: props.model.expiry.expired,
          icon: "fa-calendar-xmark",
          tone: "danger",
          to: "/admin/inventory-expiry?status=expired",
        },
        {
          label: "Lô chưa rõ hạn",
          value: props.model.expiry.unknown,
          icon: "fa-circle-question",
          tone: "muted",
          to: "/admin/inventory-expiry?status=unknown",
        },
      ]
    : [],
);
</script>
<template>
  <section class="fm-panel fm-inventory-panel">
    <header class="fm-section-head">
      <div>
        <span class="fm-panel-kicker">Tồn kho hiện tại</span>
        <h2>Sức khỏe kho hàng</h2>
      </div>
      <span class="fm-scope"
        ><i class="fa-solid fa-circle" aria-hidden="true"></i> Hiện tại</span
      >
    </header>
    <template v-if="model"
      ><div class="fm-stock-metrics">
        <div
          v-for="item in metrics"
          :key="item.label"
          class="fm-stock-metric"
          :data-tone="item.tone"
        >
          <span class="fm-stock-icon" aria-hidden="true"
            ><i :class="'fa-solid ' + item.icon"></i></span
          ><strong>{{ number(item.value) }}</strong
          ><RouterLink v-if="item.to" :to="item.to">{{ item.label }}</RouterLink
          ><span v-else>{{ item.label }}</span>
        </div>
      </div>
      <div class="fm-stock-value">
        <span
          ><i class="fa-solid fa-warehouse" aria-hidden="true"></i> Giá trị tồn
          vật lý
          <DashboardHint
            label="Giá trị tồn vật lý"
            text="Quantity × giá nhập của tất cả lô còn tồn, gồm cả hàng khóa và hết hạn. Không phải giá trị riêng phần có thể bán; chưa trích lập giảm giá." /></span
        ><strong>{{ money(model.value) }}</strong>
      </div>
      <div class="fm-subsection-head">
        <h3>Cần bổ sung tồn</h3>
        <span class="fm-note">Theo ngưỡng từng SKU</span>
      </div>
      <ul v-if="model.alerts.length" class="fm-stock-list">
        <li v-for="item in model.alerts" :key="item._id">
          <div class="fm-stock-row">
            <div>
              <RouterLink
                :to="{
                  path: '/admin/inventory-batches',
                  query: { inventoryItemId: item._id },
                }"
                >{{ item.itemName }}</RouterLink
              ><small>{{ item.itemCode }}</small>
            </div>
            <strong :class="item.available === 0 ? 'fm-negative' : 'fm-warning'"
              >{{ number(item.available) }} {{ item.unit }}</strong
            >
          </div>
          <div v-if="item.threshold > 0" class="fm-stock-meter">
            <div
              class="fm-track"
              :data-tone="item.available === 0 ? 'danger' : 'warning'"
              aria-hidden="true"
            >
              <span
                :style="{
                  width: shareWidth(item.available, item.threshold) + '%',
                }"
              ></span>
            </div>
            <span>Ngưỡng {{ number(item.threshold) }} {{ item.unit }}</span>
          </div>
        </li>
      </ul>
      <DashboardEmpty
        v-else
        compact
        title="Tồn kho chưa có cảnh báo thiếu hàng"
        detail="Tồn khả dụng được tổng hợp từ các lô còn hạn, được phép bán."
        icon="fa-boxes-stacked" />
      <details v-if="model.expiring.length" class="fm-more">
        <summary>Lô gần hết hạn cần xem ({{ model.expiring.length }})</summary>
        <ul class="fm-compact-list">
          <li v-for="batch in model.expiring" :key="batch._id">
            <RouterLink :to="'/admin/inventory-expiry/' + batch._id"
              ><b>{{ batch.batchNumber }}</b
              ><small>{{ batch.itemName }}</small></RouterLink
            ><span class="fm-negative">{{ date(batch.expiryDate) }}</span>
          </li>
        </ul>
      </details>
      <p v-if="model.unlinkedProducts" class="fm-notice">
        {{ number(model.unlinkedProducts) }} sản phẩm chưa liên kết kho; thống
        kê tồn theo lô chưa bao gồm những sản phẩm này.
      </p>
      <footer class="fm-panel-footer">
        <span class="fm-note"
          >{{ number(model.products) }} sản phẩm kinh doanh · Tồn khả dụng khác
          tồn vật lý</span
        ><RouterLink class="fm-text-link" to="/admin/inventory-expiry"
          >Xem hạn sử dụng
          <i class="fa-solid fa-arrow-right" aria-hidden="true"></i
        ></RouterLink></footer></template
    ><DashboardEmpty
      v-else
      title="Chưa có số liệu kho"
      :detail="
        permitted
          ? 'Khu vực kho chưa tải được. Dùng Làm mới để thử lại.'
          : 'Tài khoản cần quyền quản lý kho.'
      "
      icon="fa-warehouse"
    />
  </section>
</template>
