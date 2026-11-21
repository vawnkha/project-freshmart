<script setup>
import { computed } from 'vue';
import DiagnosisImage from './DiagnosisImage.vue';
const props = defineProps({ record: { type: Object, required: true }, inDialog: Boolean });
const prediction = computed(() => props.record.prediction || {});
const probabilities = computed(() => prediction.value.probabilities || []);
const highest = computed(() => Math.max(...probabilities.value.map(item => item.probability)));
const englishLabels = { black_gill: 'Black Gill Disease', black_spot: 'Black Spot Disease', healthy: 'Healthy Shrimp', white_spot: 'White Spot Disease' };
const percent = value => Number.isFinite(value)
  ? new Intl.NumberFormat('vi-VN', { style: 'percent', maximumFractionDigits: 2 }).format(value)
  : 'Không có dữ liệu';
const dateTime = value => new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
</script>
<template>
  <section class="diagnosis-result" :class="{ 'diagnosis-result--dialog': inDialog }" aria-label="Kết quả phân tích đã lưu">
    <div v-if="inDialog" class="diagnosis-result-image">
      <DiagnosisImage v-if="record._id" :id="record._id" />
      <p v-else>Không có ảnh đã lưu.</p>
    </div>
    <div>
      <p class="diagnosis-status">Kết quả đã được lưu vào lịch sử</p>
      <h2>{{ prediction.classNameVi || 'Không có tên lớp dự đoán' }}</h2>
      <p v-if="prediction.className" lang="en">{{ englishLabels[prediction.className] || prediction.className }}</p>
      <div class="diagnosis-result-meta">
        <p>Điểm tin cậy (softmax): <strong>{{ percent(prediction.confidence) }}</strong></p>
        <p v-if="record.createdAt">Phân tích lúc <time :datetime="record.createdAt">{{ dateTime(record.createdAt) }}</time> (giờ Việt Nam)</p>
        <p v-else>Không có thời điểm phân tích.</p>
      </div>
      <p v-if="prediction.className">{{ ['healthy', 'Healthy Shrimp'].includes(prediction.className) ? 'Ảnh có đặc trưng gần với lớp tôm khỏe mạnh trong dữ liệu huấn luyện. Kết quả này không loại trừ bệnh.' : 'Ảnh có đặc trưng gần với lớp bệnh được dự đoán trong dữ liệu huấn luyện. Cần chuyên gia đánh giá để xác nhận.' }}</p>
      <p v-if="prediction.lowConfidence" role="status" class="diagnosis-limit">Độ tin cậy thấp hơn ngưỡng {{ percent(prediction.confidenceThreshold) }}. Nên chụp lại ảnh rõ hơn hoặc nhờ chuyên gia kiểm tra. Ngưỡng này là quy tắc hiển thị, chưa được hiệu chuẩn thành xác suất mắc bệnh.</p>
      <template v-if="probabilities.length">
        <h3>Điểm của tất cả {{ probabilities.length }} lớp</h3>
        <ul class="diagnosis-probabilities">
          <li v-for="item in probabilities" :key="item.classIndex" :class="{ 'diagnosis-probability--highest': inDialog && item.probability === highest }">
            <div>
              <span>{{ item.classNameVi || item.className }}<small v-if="inDialog && item.probability === highest">Điểm cao nhất</small></span>
              <strong>{{ percent(item.probability) }}</strong>
            </div>
            <meter :value="item.probability" min="0" max="1" :aria-label="item.classNameVi || item.className" />
          </li>
        </ul>
      </template>
      <p v-else>Không có điểm dự đoán theo lớp.</p>
    </div>
    <div class="diagnosis-result-notes">
      <p class="diagnosis-limit">Điểm softmax chưa được hiệu chuẩn thành xác suất mắc bệnh. Mô hình chỉ phân loại các lớp đã huấn luyện, có thể dự đoán sai với ảnh không phải tôm, ảnh mờ hoặc bệnh khác.</p>
      <p class="diagnosis-disclaimer">Kết quả được dự đoán bằng trí tuệ nhân tạo, chỉ mang tính tham khảo và không thay thế việc chẩn đoán của chuyên gia thủy sản.</p>
      <details class="diagnosis-model"><summary :tabindex="inDialog ? 0 : undefined">Thông tin ảnh và mô hình</summary>
        <p>Ảnh: {{ record.image?.originalName || 'Không xác định' }}</p>
        <p>Thời điểm chụp: {{ record.capturedAt ? dateTime(record.capturedAt) : 'Không xác định' }}</p>
        <dl>
          <dt>Mô hình đã sử dụng</dt><dd>{{ record.model?.name || 'Không có thông tin mô hình' }}</dd>
          <template v-if="record.model?.modelId"><dt>Mã mô hình</dt><dd>{{ record.model.modelId }}</dd></template>
          <template v-if="record.model?.version"><dt>Phiên bản đã lưu</dt><dd>{{ record.model.version }}</dd></template>
        </dl>
      </details>
    </div>
  </section>
</template>

<style scoped>
/* Hallmark · component: dialog result · genre: editorial · theme: FreshMart
 * Pre-emit critique: P4 H5 E4 S4 R5 V4
 */
.diagnosis-result.diagnosis-result--dialog {
  display: grid;
  grid-template-columns: minmax(0, 38fr) minmax(0, 62fr);
  align-items: start;
  gap: var(--space-4) clamp(var(--space-4), 2vw, var(--space-8));
  margin: 0;
  overflow-wrap: anywhere;
}
.diagnosis-result--dialog .diagnosis-result-image :deep(img) {
  max-height: min(58dvh, 640px);
  margin: 0;
}
.diagnosis-result--dialog p {
  margin-block: var(--space-2);
  line-height: 1.5;
}
.diagnosis-result--dialog .diagnosis-status {
  margin-top: 0;
  color: var(--text-secondary);
}
.diagnosis-result--dialog h2 { font-size: clamp(24px, 2.3vw, 36px); line-height: 1.15; }
.diagnosis-result--dialog h3 { margin: var(--space-3) 0 var(--space-2); font-size: 18px; }
.diagnosis-result--dialog .diagnosis-result-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1) var(--space-4);
  padding-block: var(--space-2);
  border-block: 1px solid var(--border);
}
.diagnosis-result--dialog .diagnosis-result-meta p { margin: 0; }
.diagnosis-result--dialog .diagnosis-limit {
  margin-block: var(--space-2);
  padding: var(--space-2) var(--space-3);
}
.diagnosis-result--dialog .diagnosis-probabilities {
  display: grid;
  gap: var(--space-2) var(--space-4);
  margin: 0;
}
.diagnosis-result--dialog .diagnosis-probabilities li {
  display: grid;
  align-content: center;
  gap: var(--space-1);
  margin: 0;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-input);
  box-shadow: inset 0 0 0 1px var(--border);
  line-height: 1.35;
}
.diagnosis-result--dialog .diagnosis-probabilities meter {
  display: block;
  height: 10px;
}
.diagnosis-probability--highest {
  background: var(--mist);
}
.diagnosis-result--dialog .diagnosis-probability--highest {
  box-shadow: inset 0 0 0 1px var(--sage);
}
.diagnosis-probability--highest small {
  display: inline-block;
  margin-inline-start: var(--space-2);
  color: var(--text-secondary);
}
.diagnosis-result--dialog .diagnosis-result-notes {
  grid-column: 1 / -1;
  padding-top: var(--space-2);
  border-top: 1px solid var(--border);
}
.diagnosis-result--dialog .diagnosis-model { margin-top: var(--space-3); }
.diagnosis-result--dialog .diagnosis-model summary { display: list-item; }
@media (min-width: 1100px) {
  .diagnosis-result--dialog .diagnosis-probabilities { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 700px) {
  .diagnosis-result.diagnosis-result--dialog { grid-template-columns: minmax(0, 1fr); }
  .diagnosis-result--dialog .diagnosis-result-image :deep(img) { max-height: 35dvh; }
}
</style>
