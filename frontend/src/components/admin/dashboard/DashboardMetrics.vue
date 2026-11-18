<script setup>
import { computed } from "vue";
import { money, number } from "@/utils/admin-dashboard-display.util";
import DashboardHint from "./DashboardHint.vue";
const props = defineProps({
  financial: { type: Object, default: null },
  orders: { type: Object, default: null },
  permitted: Boolean,
});
const kpis = computed(() => {
  const f = props.financial,
    o = props.orders;
  return [
    {
      label: "Doanh thu ghi nhận",
      value: f?.revenue,
      display: money(f?.revenue),
      icon: "fa-chart-line",
      change: f?.revenueGrowth,
      note: f
        ? `${number(f.completedOrders)} đơn hoàn thành · ${number(f.returns)} đảo ghi nhận`
        : props.permitted
          ? "Số liệu chưa tải được"
          : "Cần quyền xem đơn hàng",
      tip: "Tổng giá trị đơn tại mốc hoàn thành, đã trừ giảm giá và cộng phí giao thu khách. Hủy/hoàn sau hoàn thành được đảo tại mốc hủy/hoàn.",
    },
    {
      label: "Giá vốn hàng đã bán",
      value: f?.cogs,
      display: money(f?.cogs),
      icon: "fa-boxes-stacked",
      change: f?.cogsGrowth,
      neutralChange: true,
      note: f?.missingCosts
        ? `${f.missingCosts} phát sinh thiếu giá vốn`
        : "Theo giá nhập lô lúc bán",
      tip: "Tổng số lượng × giá nhập trong snapshot phân bổ lô, trừ giá vốn đảo ghi nhận. Giá vốn không phải tổng chi phí; thiếu phân bổ thì không suy đoán.",
    },
    {
      label: "Lãi gộp tạm tính",
      value: f?.profit,
      display: money(f?.profit),
      icon: "fa-coins",
      change: f?.profitGrowth,
      note: "Trước chi phí vận hành, giao hàng",
      tip: "Giữ nguyên công thức: doanh thu ghi nhận trừ giá vốn. Chưa trừ chi phí vận hành, giao hàng thực tế và phí thanh toán, nên chưa phải lợi nhuận ròng.",
    },
    {
      label: "Tổng đơn hàng",
      value: o?.total,
      display: number(o?.total),
      icon: "fa-bag-shopping",
      change: o?.growth,
      note: `TB đơn hoàn thành: ${f ? money(f.averageOrderValue) : "—"}`,
      tip: "Đơn được tạo trong kỳ, gồm mọi trạng thái. Giá trị trung bình dựa trên phát sinh hoàn thành dương trong kỳ, trước đảo ghi nhận.",
    },
  ];
});
</script>
<template>
  <div class="fm-kpis">
    <article
      v-for="(kpi, index) in kpis"
      :key="kpi.label"
      class="fm-kpi"
      :data-kind="index"
    >
      <div class="fm-kpi-top">
        <span class="fm-kpi-icon" aria-hidden="true"
          ><i :class="'fa-solid ' + kpi.icon"></i></span
        ><span class="fm-kpi-label">{{ kpi.label }}</span
        ><DashboardHint :label="kpi.label" :text="kpi.tip" />
      </div>
      <strong
        class="fm-kpi-value"
        :class="{ 'fm-kpi-missing': kpi.value == null }"
        >{{ kpi.display }}</strong
      >
      <div class="fm-kpi-foot">
        <span
          v-if="kpi.change != null"
          class="fm-change"
          :class="
            kpi.neutralChange || kpi.change === 0
              ? 'fm-change--neutral'
              : kpi.change >= 0
                ? 'fm-positive'
                : 'fm-negative'
          "
          ><i
            :class="
              'fa-solid ' +
              (kpi.change > 0
                ? 'fa-arrow-trend-up'
                : kpi.change < 0
                  ? 'fa-arrow-trend-down'
                  : 'fa-minus')
            "
            aria-hidden="true"
          ></i
          >{{ kpi.change > 0 ? "+" : "" }}{{ number(kpi.change) }}%
          <small>so với kỳ trước</small></span
        ><span v-else class="fm-comparison-empty"
          >Chưa có cơ sở so sánh kỳ trước</span
        >
        <p class="fm-note">{{ kpi.note }}</p>
      </div>
    </article>
  </div>
</template>
