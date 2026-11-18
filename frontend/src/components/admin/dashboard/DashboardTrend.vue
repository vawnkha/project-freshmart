<script setup>
import { computed, onBeforeUnmount, onMounted, ref, useId, watch } from "vue";
import { date, money, number } from "@/utils/admin-dashboard-display.util";
import DashboardEmpty from "./DashboardEmpty.vue";
const props = defineProps({
  rows: { type: Array, default: () => [] },
  mode: { type: String, default: "line" },
});
const surface = ref(null),
  width = ref(720),
  active = ref(null),
  focused = ref(null),
  id = useId();
const targets = [];
let observer, frame;
const series = computed(() =>
  [
    { key: "revenue", label: "Doanh thu", color: "revenue" },
    { key: "cogs", label: "Giá vốn", color: "cost" },
    { key: "profit", label: "Lãi gộp tạm tính", color: "profit" },
  ].filter((item) => props.rows.some((row) => Number.isFinite(row[item.key]))),
);
const values = computed(() =>
  props.rows.flatMap((row) =>
    series.value.map((item) => row[item.key]).filter(Number.isFinite),
  ),
);
const floor = computed(() => Math.min(0, ...values.value));
const ceiling = computed(() => Math.max(1, ...values.value));
const plotWidth = computed(() => Math.max(160, width.value - 82));
const x = (index) =>
  68 + ((index + 0.5) * plotWidth.value) / Math.max(props.rows.length, 1);
const y = (value) =>
  200 - ((value - floor.value) / (ceiling.value - floor.value)) * 176;
const paths = (key) => {
  let joined = false;
  return props.rows
    .map((row, i) => {
      if (!Number.isFinite(row[key])) {
        joined = false;
        return "";
      }
      const point = `${joined ? "L" : "M"}${x(i)},${y(row[key])}`;
      joined = true;
      return point;
    })
    .join(" ");
};
const labels = computed(() => {
  const count = Math.min(
    props.rows.length,
    Math.max(2, Math.floor(plotWidth.value / 70)),
  );
  if (count < 2) return new Set([0]);
  return new Set(
    Array.from({ length: count }, (_, i) =>
      Math.round((i * (props.rows.length - 1)) / (count - 1)),
    ),
  );
});
const shortDate = (value) =>
  value.length === 7
    ? `${value.slice(5)}/${value.slice(0, 4)}`
    : date(value, { year: undefined });
const axisMoney = (value) => {
  const abs = Math.abs(value);
  return abs >= 1e9
    ? number(value / 1e9) + " tỷ"
    : abs >= 1e6
      ? number(value / 1e6) + " tr"
      : abs >= 1e3
        ? number(value / 1e3) + " nghìn"
        : number(value);
};
const activeDates = computed(() =>
  props.rows.filter((row) =>
    series.value.some(
      (item) => Number.isFinite(row[item.key]) && row[item.key] !== 0,
    ),
  ),
);
const hasActivity = computed(() => values.value.some((value) => value !== 0));
const barWidth = computed(() =>
  Math.max(
    1,
    Math.min(
      26,
      (plotWidth.value /
        Math.max(props.rows.length, 1) /
        Math.max(series.value.length, 1)) *
        0.65,
    ),
  ),
);
const activeRow = computed(() =>
  active.value == null ? null : props.rows[active.value],
);
const tooltipLeft = computed(() =>
  Math.max(108, Math.min(width.value - 108, x(active.value || 0))),
);
const incomplete = computed(() =>
  props.rows.some((row) => row.cogs == null || row.profit == null),
);
function focusPoint(index) {
  targets[Math.max(0, Math.min(props.rows.length - 1, index))]?.focus();
}
function leave() {
  active.value = focused.value;
}
onMounted(() => {
  width.value = Math.max(240, surface.value?.clientWidth || 720);
  observer = new ResizeObserver((entries) => {
    const nextWidth = Math.max(240, Math.floor(entries[0].contentRect.width));
    if (nextWidth === width.value) return;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      width.value = nextWidth;
    });
  });
  if (surface.value) observer.observe(surface.value);
});
onBeforeUnmount(() => {
  observer?.disconnect();
  cancelAnimationFrame(frame);
});
watch(
  () => props.rows,
  () => {
    active.value = null;
    focused.value = null;
  },
);
</script>
<template>
  <div class="fm-trend">
    <div class="fm-chart-meta">
      <div class="fm-chart-legend">
        <span v-for="item in series" :key="item.key"
          ><i
            :class="'fm-legend-marker fm-' + item.color"
            aria-hidden="true"
          ></i
          >{{ item.label }}</span
        >
      </div>
      <span class="fm-note">Đơn vị VND</span>
    </div>
    <div ref="surface" class="fm-chart-surface" @mouseleave="leave">
      <DashboardEmpty
        v-if="!hasActivity"
        title="Chưa có số liệu khác 0 để vẽ biểu đồ."
        detail="Chọn khoảng thời gian khác để xem kết quả kinh doanh."
        icon="fa-chart-column"
      />
      <template v-else>
        <svg
          :viewBox="`0 0 ${width} 244`"
          role="group"
          aria-label="Biểu đồ doanh thu, giá vốn và lãi gộp tạm tính"
        >
          <g v-for="tick in 5" :key="tick">
            <line
              x1="68"
              :x2="width - 14"
              :y1="24 + (tick - 1) * 44"
              :y2="24 + (tick - 1) * 44"
              class="fm-chart-grid"
            />
            <text x="58" :y="28 + (tick - 1) * 44" text-anchor="end">
              {{ axisMoney(ceiling - ((ceiling - floor) * (tick - 1)) / 4) }}
            </text>
          </g>
          <line
            x1="68"
            :x2="width - 14"
            :y1="y(0)"
            :y2="y(0)"
            class="fm-chart-baseline"
          />
          <line
            v-if="activeRow"
            :x1="x(active)"
            :x2="x(active)"
            y1="20"
            y2="203"
            class="fm-chart-crosshair"
          />
          <template v-for="(item, s) in series" :key="item.key">
            <path
              v-if="mode === 'line' && rows.length > 2"
              :d="paths(item.key)"
              fill="none"
              :class="'fm-chart-line fm-' + item.color"
            />
            <template v-for="(row, i) in rows" :key="row.date">
              <rect
                v-if="mode === 'bar' && Number.isFinite(row[item.key])"
                :x="x(i) + (s - series.length / 2) * barWidth"
                :y="Math.min(y(row[item.key]), y(0))"
                :width="Math.max(0.5, barWidth - 2)"
                :height="Math.abs(y(row[item.key]) - y(0))"
                rx="2"
                :class="'fm-chart-bar fm-' + item.color"
              />
              <circle
                v-else-if="mode === 'line' && Number.isFinite(row[item.key])"
                :cx="x(i)"
                :cy="y(row[item.key])"
                :r="rows.length <= 2 || active === i ? 5 : 3"
                :class="'fm-chart-point fm-' + item.color"
              />
            </template>
          </template>
          <g v-for="(row, i) in rows" :key="row.date">
            <rect
              :ref="(el) => (targets[i] = el)"
              :x="x(i) - plotWidth / rows.length / 2"
              y="14"
              :width="plotWidth / rows.length"
              height="198"
              fill="transparent"
              tabindex="0"
              role="button"
              :aria-label="`${date(row.date.length === 7 ? row.date + '-01' : row.date)}: ${series.map((item) => item.label + ' ' + money(row[item.key])).join(', ')}`"
              :aria-describedby="active === i ? id : undefined"
              @mouseenter="active = i"
              @focus="
                focused = i;
                active = i;
              "
              @blur="
                focused = null;
                active = null;
              "
              @click="active = i"
              @keydown.enter.prevent="active = i"
              @keydown.space.prevent="active = i"
              @keydown.esc.stop="active = null"
              @keydown.right.prevent="focusPoint(i + 1)"
              @keydown.left.prevent="focusPoint(i - 1)"
              @keydown.home.prevent="focusPoint(0)"
              @keydown.end.prevent="focusPoint(rows.length - 1)"
            />
            <text v-if="labels.has(i)" :x="x(i)" y="227" text-anchor="middle">
              {{ shortDate(row.date) }}
            </text>
          </g>
        </svg>
        <div
          v-if="activeRow"
          :id="id"
          role="tooltip"
          class="fm-chart-tooltip"
          :style="{ left: tooltipLeft + 'px' }"
        >
          <strong>{{
            activeRow.date.length === 7
              ? shortDate(activeRow.date)
              : date(activeRow.date)
          }}</strong>
          <div v-for="item in series" :key="item.key">
            <span
              ><i :class="'fm-dot fm-' + item.color" aria-hidden="true"></i
              >{{ item.label }}</span
            ><b>{{ money(activeRow[item.key]) }}</b>
          </div>
        </div>
      </template>
    </div>
    <p v-if="hasActivity && rows.length <= 2" class="fm-chart-readout">
      <i class="fa-solid fa-circle-info" aria-hidden="true"></i
      >{{ rows.length }} mốc thời gian ·
      {{
        mode === "line"
          ? "Chỉ hiển thị điểm, không nội suy xu hướng."
          : "Mỗi cột thể hiện giá trị của đúng mốc thời gian."
      }}
    </p>
    <p v-else-if="hasActivity" class="fm-chart-readout">
      <span v-if="activeDates.length === 1"
        >Chỉ có giá trị khác 0 tại {{ shortDate(activeDates[0].date) }}. </span
      >Di chuột, chạm hoặc dùng Tab để xem giá trị.
    </p>
    <p v-if="incomplete" class="fm-note fm-warning">
      Giá vốn và lãi gộp chưa đủ dữ liệu; không vẽ thành giá trị 0.
    </p>
    <details v-if="rows.length" class="fm-data-table">
      <summary>
        Xem bảng số liệu
        <i class="fa-solid fa-chevron-down" aria-hidden="true"></i>
      </summary>
      <div
        class="fm-table-scroll"
        tabindex="0"
        role="region"
        aria-label="Bảng xu hướng tài chính"
      >
        <table>
          <caption>
            Đơn vị VND · Ngày theo giờ Việt Nam
          </caption>
          <thead>
            <tr>
              <th scope="col">Ngày / tháng</th>
              <th v-for="item in series" :key="item.key" scope="col">
                {{ item.label }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.date">
              <th scope="row">{{ shortDate(row.date) }}</th>
              <td v-for="item in series" :key="item.key">
                {{ money(row[item.key]) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </details>
  </div>
</template>
