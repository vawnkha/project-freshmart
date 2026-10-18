<script setup>
import { onBeforeUnmount, ref } from 'vue';
import PageHeading from '@/components/user/common/PageHeading.vue';
import SageButton from '@/components/user/sage/SageButton.vue';

const fileInput = ref(null);
const selectedFile = ref(null);
const previewUrl = ref('');
const error = ref('');
const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const maxSize = 5 * 1024 * 1024;

function releaseImage() {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  previewUrl.value = '';
  selectedFile.value = null;
}
function clearImage() {
  releaseImage();
  error.value = '';
  if (fileInput.value) fileInput.value.value = '';
}
function chooseImage(event) {
  const file = event.target.files?.[0];
  // Reset the native input so the same file can be chosen after removal/error.
  event.target.value = '';
  if (!file) return;
  clearImage();
  if (!allowedTypes.has(file.type)) {
    error.value = 'Vui lòng chọn ảnh JPEG, PNG hoặc WebP.';
    return;
  }
  if (!file.size || file.size > maxSize) {
    error.value = file.size ? 'Ảnh vượt quá 5 MB. Vui lòng chọn ảnh nhỏ hơn.' : 'File ảnh trống. Vui lòng chọn ảnh khác.';
    return;
  }
  try {
    previewUrl.value = URL.createObjectURL(file);
    selectedFile.value = file;
  } catch {
    imageError();
  }
}
function imageError() {
  clearImage();
  error.value = 'Không thể đọc ảnh này. Vui lòng chọn một ảnh JPEG, PNG hoặc WebP khác.';
}
onBeforeUnmount(releaseImage);
</script>

<template>
  <div class="site-content diagnosis-page">
    <PageHeading
      title="Chẩn đoán bệnh tôm bằng hình ảnh"
      breadcrumb-title="Chẩn đoán"
      description="Tải lên hình ảnh tôm để chuẩn bị phân tích dấu hiệu bệnh bằng trí tuệ nhân tạo. Chức năng chẩn đoán sẽ được kích hoạt sau khi tích hợp mô hình AI."
    />
    <div class="container diagnosis-workspace">
      <section class="diagnosis-upload" aria-labelledby="diagnosis-upload-title">
        <i class="fa-solid fa-camera diagnosis-upload-icon" aria-hidden="true"></i>
        <h2 id="diagnosis-upload-title">Chọn ảnh tôm</h2>
        <p id="diagnosis-file-hint" class="diagnosis-format">JPEG, PNG hoặc WebP · tối đa 5 MB</p>
        <label for="diagnosis-file" class="sr-only">Ảnh tôm cần xem trước</label>
        <input
          id="diagnosis-file"
          ref="fileInput"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          class="sr-only"
          tabindex="-1"
          :aria-invalid="error ? true : undefined"
          :aria-describedby="error ? 'diagnosis-file-hint diagnosis-file-error' : 'diagnosis-file-hint'"
          @change="chooseImage"
        />
        <SageButton type="button" :aria-describedby="error ? 'diagnosis-file-error' : 'diagnosis-file-hint'" @click="fileInput?.click()">
          {{ selectedFile ? 'Đổi ảnh' : 'Chọn ảnh' }}
        </SageButton>
        <div v-if="previewUrl" class="diagnosis-preview">
          <img :src="previewUrl" alt="Ảnh tôm đã chọn để xem trước" @error="imageError" />
        </div>
        <p class="diagnosis-file-name" role="status">{{ selectedFile ? selectedFile.name : 'Chưa chọn ảnh' }}</p>
        <p v-if="error" id="diagnosis-file-error" class="diagnosis-error" role="alert">{{ error }}</p>
        <SageButton v-if="selectedFile" type="button" variant="secondary" @click="clearImage">Xóa ảnh</SageButton>
        <p class="diagnosis-privacy">Ảnh chỉ được xem trước trên thiết bị của bạn, chưa được gửi lên máy chủ.</p>
      </section>

      <section class="diagnosis-information" aria-labelledby="diagnosis-status-title">
        <p class="diagnosis-status"><i class="fa-regular fa-clock" aria-hidden="true"></i> Chưa triển khai</p>
        <h2 id="diagnosis-status-title">Chưa tích hợp mô hình AI</h2>
        <p>Bạn có thể chọn ảnh và kiểm tra ảnh xem trước. Chức năng phân tích hiện chưa được kích hoạt.</p>
        <SageButton type="button" disabled aria-describedby="diagnosis-status-title diagnosis-limit">Phân tích ảnh</SageButton>
        <p id="diagnosis-limit" class="diagnosis-limit">Phiên bản hiện tại chưa đưa ra kết quả nhận diện bệnh. Khi được tích hợp, kết quả AI sẽ hỗ trợ tham khảo và cần được đánh giá chuyên môn.</p>
        <div class="diagnosis-results" aria-labelledby="diagnosis-results-title">
          <h3 id="diagnosis-results-title">Kết quả phân tích</h3>
          <p>Chưa có kết quả chẩn đoán. Khu vực này sẽ hiển thị kết quả sau khi mô hình AI được tích hợp.</p>
        </div>
        <div class="diagnosis-guidance">
          <h3>Chuẩn bị ảnh rõ nét</h3>
          <p>Nên chụp tôm ở nơi đủ sáng, hình ảnh rõ nét và quan sát được các bộ phận cần kiểm tra.</p>
          <RouterLink to="/blog" class="text-link">Xem kiến thức nuôi tôm <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></RouterLink>
        </div>
      </section>
    </div>
  </div>
</template>
