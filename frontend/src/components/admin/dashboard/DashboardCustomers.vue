<script setup>
import { number, shareWidth } from "@/utils/admin-dashboard-display.util";
import DashboardHint from "./DashboardHint.vue";
defineProps({
  customers: { type: Object, default: null },
  sales: { type: Object, default: null },
});
</script>
<template>
  <section class="fm-panel fm-customers-panel">
    <header class="fm-section-head">
      <div>
        <span class="fm-panel-kicker">Khách hàng trong kỳ</span>
        <h2>Mua mới & quay lại</h2>
      </div>
      <span class="fm-panel-icon" aria-hidden="true"
        ><i class="fa-solid fa-users"></i
      ></span>
    </header>
    <div class="fm-customer-metrics">
      <div>
        <span class="fm-mini-icon" aria-hidden="true"
          ><i class="fa-solid fa-user-plus"></i></span
        ><strong>{{ number(customers?.new) }}</strong
        ><span>Khách hàng mới</span>
      </div>
      <div>
        <span class="fm-mini-icon" aria-hidden="true"
          ><i class="fa-solid fa-bag-shopping"></i></span
        ><strong>{{ number(sales?.transacting) }}</strong
        ><span>Có đơn hoàn thành</span>
      </div>
      <div>
        <span class="fm-mini-icon" aria-hidden="true"
          ><i class="fa-solid fa-user-check"></i></span
        ><strong>{{ number(sales?.returning) }}</strong
        ><span>Khách quay lại</span>
      </div>
    </div>
    <div class="fm-returning">
      <div>
        <span
          >Tỷ lệ quay lại
          <DashboardHint
            label="Tỷ lệ khách quay lại"
            text="Trong nhóm khách có đơn hoàn thành trong kỳ, đếm khách đã có đơn còn hoàn thành trước kỳ chọn. Tỷ lệ = số khách quay lại / số khách giao dịch; không có khách giao dịch thì chưa có tỷ lệ." /></span
        ><strong>{{
          sales?.returningRate == null ? "—" : number(sales.returningRate) + "%"
        }}</strong>
      </div>
      <div
        v-if="sales?.returningRate != null"
        class="fm-track"
        aria-hidden="true"
      >
        <span
          :style="{ width: shareWidth(sales.returningRate, 100) + '%' }"
        ></span>
      </div>
      <p class="fm-note">
        {{
          sales?.returningRate == null
            ? "Chưa có cơ sở xác định tỷ lệ."
            : "Trong nhóm khách có đơn hoàn thành của kỳ này."
        }}
      </p>
    </div>
    <footer class="fm-panel-footer fm-note">
      Khách mới tính theo ngày tạo tài khoản; khách giao dịch tính theo ngày
      hoàn thành đơn.<span v-if="!customers || !sales"
        >Một số dữ liệu chưa tải được hoặc chưa được cấp quyền.</span
      >
    </footer>
  </section>
</template>
