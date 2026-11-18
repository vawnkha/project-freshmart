<script setup>
import { computed, ref } from "vue";
import {
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
const mode = ref("products");
const rows = computed(() => props.model?.[mode.value] || []);
const maximum = computed(() =>
  Math.max(
    0,
    ...rows.value.map((item) =>
      mode.value === "products" ? item.quantity : item.grossSales,
    ),
  ),
);
</script>
<template>
  <section class="fm-panel fm-sales-panel">
    <header class="fm-section-head">
      <div>
        <span class="fm-panel-kicker">Bán hàng trong kỳ</span>
        <h2>Sản phẩm & danh mục</h2>
      </div>
      <span class="fm-scope">{{
        rows.length ? "Top " + rows.length : "Trong kỳ"
      }}</span>
    </header>
    <div class="fm-segments" role="group" aria-label="Xếp hạng bán hàng">
      <button
        type="button"
        :aria-pressed="mode === 'products'"
        @click="mode = 'products'"
      >
        Sản phẩm bán chạy</button
      ><button
        type="button"
        :aria-pressed="mode === 'categories'"
        @click="mode = 'categories'"
      >
        Danh mục
      </button>
    </div>
    <div class="fm-ranking-heading">
      <span>{{
        mode === "products"
          ? "Xếp hạng theo số lượng"
          : "Tiền hàng trước giảm giá"
      }}</span
      ><DashboardHint
        v-if="mode === 'categories'"
        label="Tiền hàng danh mục"
        text="Tổng tiền hàng của các đơn hiện còn hoàn thành trong kỳ, trước giảm giá và phí giao. Chưa phân bổ voucher theo danh mục nên không gọi là doanh thu thuần."
      />
    </div>
    <ol v-if="rows.length" class="fm-rankings">
      <li v-for="(item, i) in rows" :key="item._id || i">
        <span class="fm-rank" :data-first="i === 0">{{
          String(i + 1).padStart(2, "0")
        }}</span>
        <div class="fm-ranking-body">
          <div class="fm-ranking-row">
            <span>{{
              item.name ||
              (mode === "products" ? "Sản phẩm đã xóa" : "Chưa phân loại")
            }}</span
            ><strong
              >{{
                mode === "products"
                  ? number(item.quantity)
                  : money(item.grossSales)
              }}<small v-if="mode === 'products'">đã bán</small></strong
            >
          </div>
          <div v-if="rows.length > 1" class="fm-track" aria-hidden="true">
            <span
              :style="{
                width:
                  shareWidth(
                    mode === 'products' ? item.quantity : item.grossSales,
                    maximum,
                  ) + '%',
              }"
            ></span>
          </div>
        </div>
      </li>
    </ol>
    <DashboardEmpty
      v-else
      :title="model ? 'Chưa có giao dịch phù hợp' : 'Chưa có dữ liệu bán hàng'"
      :detail="
        model
          ? 'Sản phẩm và danh mục có đơn hoàn thành sẽ xuất hiện ở đây.'
          : permitted
            ? 'Khu vực bán hàng chưa tải được.'
            : 'Tài khoản cần quyền xem đơn hàng.'
      "
      icon="fa-ranking-star"
    />
    <footer class="fm-panel-footer fm-note">
      Đơn hoàn thành trong kỳ, chưa hủy hoặc hoàn trả.<span
        v-if="rows.length > 1"
        >Thanh so sánh với mục cao nhất trong danh sách.</span
      >
    </footer>
  </section>
</template>
