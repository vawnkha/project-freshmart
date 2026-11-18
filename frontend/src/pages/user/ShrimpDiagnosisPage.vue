<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import PageHeading from '@/components/user/common/PageHeading.vue';
import SageButton from '@/components/user/sage/SageButton.vue';
import SageDialog from '@/components/user/sage/SageDialog.vue';
import DiagnosisImage from '@/components/user/diagnosis/DiagnosisImage.vue';
import DiagnosisResult from '@/components/user/diagnosis/DiagnosisResult.vue';
import { useAuthStore, captureAuthRequestContext } from '@/stores/user/auth';
import service from '@/services/shrimp-diagnosis.service';

const auth = useAuthStore();
const tab = ref('ai'), fileInput = ref(null), cameraInput = ref(null);
const selectedFile = ref(null), previewUrl = ref(''), error = ref(''), result = ref(null), analyzing = ref(false);
const history = ref([]), historyError = ref(''), loading = ref(false), page = ref(1), pages = ref(0), total = ref(0);
const disease = ref(''), fromDate = ref(''), toDate = ref('');
const selectedId = ref(null), detail = ref(null), detailError = ref('');
const pendingDelete = ref(null), deleteOpen = ref(false), deleting = ref(false), deleteError = ref('');
const deleteDescription = computed(() => {
  const record = pendingDelete.value;
  if (!record) return undefined;
  return `Bạn có chắc chắn muốn xóa kết quả chẩn đoán ${record.label} lúc ${dateTime(record.createdAt)} và hình ảnh đã lưu không?\n\nHành động này không thể hoàn tác.`;
});
const currentCheckpointClasses = [
  { name: 'black_gill', label: 'Bệnh đen mang' }, { name: 'black_spot', label: 'Bệnh đốm đen' },
  { name: 'healthy', label: 'Tôm khỏe mạnh' }, { name: 'white_spot', label: 'Bệnh đốm trắng' },
];
const classes = computed(() => {
  const labels = new Map(currentCheckpointClasses.map(item => [item.name, item.label]));
  for (const record of [...history.value, result.value]) {
    for (const item of record?.prediction?.probabilities || []) labels.set(item.className, item.classNameVi);
  }
  return [...labels].map(([name, label]) => ({ name, label }));
});
const percent = value => new Intl.NumberFormat('vi-VN', { style: 'percent', maximumFractionDigits: 2 }).format(value);
const dateTime = value => new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const diagnosisIdPattern = /^[a-f0-9]{24}$/i;
let generation = 0, listGeneration = 0, detailRequest;
const controllers = new Set();
function request() {
  const controller = new AbortController(); controllers.add(controller);
  const current = generation, context = captureAuthRequestContext();
  return { signal: controller.signal, cancel: () => controller.abort(), valid: () => current === generation && (!context || context.isCurrent()), done: () => controllers.delete(controller) };
}
function message(err) {
  if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') return 'Yêu cầu quá thời gian chờ. Vui lòng thử lại.';
  if (err.response?.status === 401) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  return err.response?.data?.message || 'Không thể kết nối máy chủ. Vui lòng thử lại.';
}
function releaseImage() { if (previewUrl.value) URL.revokeObjectURL(previewUrl.value); previewUrl.value = ''; selectedFile.value = null; }
function clearImage() {
  if (analyzing.value) return;
  releaseImage(); error.value = ''; result.value = null; forget();
}
function chooseImage(event) {
  if (analyzing.value) return;
  const file = event.target.files?.[0]; event.target.value = '';
  if (!file) return;
  clearImage();
  if (!allowedTypes.has(file.type)) { error.value = 'Vui lòng chọn ảnh JPEG, PNG hoặc WebP.'; return; }
  if (!file.size || file.size > 5 * 1024 * 1024) { error.value = file.size ? 'Ảnh vượt quá 5 MB. Vui lòng chọn ảnh nhỏ hơn.' : 'File ảnh trống. Vui lòng chọn ảnh khác.'; return; }
  try { previewUrl.value = URL.createObjectURL(file); selectedFile.value = file; }
  catch { imageError(); }
}
function imageError() { releaseImage(); error.value = 'Không thể đọc ảnh này. Vui lòng chọn một ảnh JPEG, PNG hoặc WebP khác.'; }
async function analyze() {
  if (!selectedFile.value || analyzing.value || !auth.isLoggedIn) return;
  const req = request(); analyzing.value = true; error.value = ''; result.value = null;
  try {
    const record = await service.create(selectedFile.value, req.signal);
    if (req.valid()) { result.value = record; remember(record); }
  } catch (err) { if (req.valid() && err.code !== 'ERR_CANCELED') error.value = message(err); }
  finally { if (req.valid()) analyzing.value = false; req.done(); }
}
async function loadHistory(target = 1, deletedId) {
  if (!auth.isLoggedIn) return;
  const req = request(), current = ++listGeneration;
  closeDetail();
  loading.value = true; historyError.value = '';
  try {
    if (fromDate.value && toDate.value && fromDate.value > toDate.value) throw new Error('DATE_RANGE');
    const data = await service.list({ page: target, limit: 8, className: disease.value || undefined,
      from: fromDate.value ? new Date(fromDate.value + 'T00:00:00+07:00').toISOString() : undefined,
      to: toDate.value ? new Date(toDate.value + 'T23:59:59.999+07:00').toISOString() : undefined }, req.signal);
    if (!req.valid() || current !== listGeneration) return;
    history.value = data.items; page.value = data.page; pages.value = data.pages; total.value = data.total;
  } catch (err) {
    if (req.valid() && current === listGeneration && err.code !== 'ERR_CANCELED') {
      if (deletedId) {
        history.value = history.value.filter(item => item._id !== deletedId);
        total.value = Math.max(0, total.value - 1);
      }
      historyError.value = err.message === 'DATE_RANGE' ? 'Ngày kết thúc phải từ ngày bắt đầu trở đi.' : message(err);
    }
  } finally { if (req.valid() && current === listGeneration) loading.value = false; req.done(); }
}
function switchTab(next) {
  if (deleting.value) return;
  closeDelete();
  tab.value = next;
  if (next === 'history') void loadHistory();
  else closeDetail();
}
function closeDetail() {
  selectedId.value = null;
  detailRequest?.cancel();
  detailRequest = undefined;
}
function clearDetail() {
  detail.value = null;
  detailError.value = '';
}
async function openDetail(id, event) {
  if (deleting.value || deleteOpen.value || selectedId.value) return;
  event.currentTarget.focus({ preventScroll: true });
  clearDetail();
  selectedId.value = id;
  const req = detailRequest = request();
  const isCurrent = () => req === detailRequest && req.valid();
  try {
    const record = await service.detail(id, req.signal);
    if (!isCurrent()) return;
    if (record?._id === id && record.prediction) detail.value = record;
    else detailError.value = 'Bản ghi không có kết quả chẩn đoán.';
  } catch (err) {
    if (isCurrent() && err.code !== 'ERR_CANCELED') detailError.value = message(err);
  } finally {
    if (req === detailRequest) detailRequest = undefined;
    req.done();
  }
}
function openDelete(item, event) {
  if (deleting.value || deleteOpen.value || selectedId.value) return;
  event.currentTarget.focus({ preventScroll: true });
  pendingDelete.value = { id: item._id, label: item.prediction.classNameVi, createdAt: item.createdAt };
  deleteError.value = '';
  deleteOpen.value = true;
}
function closeDelete() {
  if (!deleting.value) deleteOpen.value = false;
}
function clearDelete() {
  pendingDelete.value = null;
  deleteError.value = '';
}
async function removeHistory() {
  if (!deleteOpen.value || deleting.value || !auth.isLoggedIn) return;
  const id = pendingDelete.value?.id;
  if (!diagnosisIdPattern.test(id || '')) {
    deleteError.value = 'Mã kết quả chẩn đoán không hợp lệ.';
    return;
  }
  const req = request(), scrollY = window.scrollY;
  deleting.value = true; deleteError.value = '';
  try {
    await service.remove(id, req.signal);
    if (!req.valid()) return;
    if (result.value?._id === id) { result.value = null; forget(); }
    deleteOpen.value = false;
    await loadHistory(history.value.length === 1 && page.value > 1 ? page.value - 1 : page.value, id);
    await nextTick();
    if (req.valid()) window.scrollTo({ top: scrollY, behavior: 'instant' });
  } catch (err) { if (req.valid() && err.code !== 'ERR_CANCELED') deleteError.value = message(err); }
  finally { if (req.valid()) deleting.value = false; req.done(); }
}
function resetSession() {
  generation++; listGeneration++;
  closeDetail(); clearDetail();
  for (const controller of controllers) controller.abort(); controllers.clear();
  releaseImage(); result.value = null; history.value = [];
  deleteOpen.value = false; clearDelete();
  error.value = ''; historyError.value = ''; analyzing.value = false; loading.value = false; deleting.value = false;
  page.value = 1; pages.value = 0; total.value = 0;
}
// Retain only an owned record ID in this tab; details/images are fetched with JWT.
const lastResultKey = 'freshmart-diagnosis-last-result';
function forget() { try { sessionStorage.removeItem(lastResultKey); } catch { /* storage may be disabled */ } }
function remember(record) {
  try { sessionStorage.setItem(lastResultKey, JSON.stringify({ owner: auth.userId, id: record._id })); } catch { /* history remains durable */ }
}
onMounted(async () => {
  let saved;
  try { saved = JSON.parse(sessionStorage.getItem(lastResultKey) || 'null'); } catch { forget(); }
  if (!auth.isLoggedIn || saved?.owner !== auth.userId || !diagnosisIdPattern.test(saved?.id || '')) return;
  const req = request();
  try { const record = await service.detail(saved.id, req.signal); if (req.valid() && !selectedFile.value && !analyzing.value) result.value = record; }
  catch (err) { if (req.valid() && err.response?.status === 404) forget(); }
  finally { req.done(); }
});
watch(() => [auth.accessToken, auth.userId, auth.isLoggedIn], () => { forget(); resetSession(); if (tab.value === 'history' && auth.isLoggedIn) void loadHistory(); }, { flush: 'sync' });
onBeforeUnmount(resetSession);
</script>

<template>
  <div class="site-content diagnosis-page">
    <PageHeading title="Chẩn đoán bệnh tôm bằng hình ảnh" breadcrumb-title="Chẩn đoán" description="Phân loại hình ảnh tôm bằng AI và lưu kết quả để theo dõi, xem lại." />
    <div class="container">
      <div class="diagnosis-tabs" aria-label="Chức năng chẩn đoán">
        <SageButton :variant="tab === 'ai' ? 'primary' : 'secondary'" :aria-pressed="tab === 'ai'" @click="switchTab('ai')">Chẩn đoán AI</SageButton>
        <SageButton :variant="tab === 'history' ? 'primary' : 'secondary'" :aria-pressed="tab === 'history'" @click="switchTab('history')">Lịch sử chẩn đoán</SageButton>
      </div>
      <p v-if="!auth.isLoggedIn" class="diagnosis-limit"><RouterLink :to="{ path: '/login', query: { redirect: '/chan-doan' } }">Đăng nhập</RouterLink> để phân tích ảnh và xem lịch sử của bạn. Bạn vẫn có thể chọn ảnh để xem trước.</p>
    </div>
    <div v-if="tab === 'ai'" class="container diagnosis-workspace">
      <section class="diagnosis-upload" aria-labelledby="diagnosis-upload-title">
        <i class="fa-solid fa-camera diagnosis-upload-icon" aria-hidden="true"></i>
        <h2 id="diagnosis-upload-title">Chọn ảnh tôm</h2>
        <p id="diagnosis-file-hint" class="diagnosis-format">JPEG, PNG hoặc WebP · tối đa 5 MB · ảnh tĩnh tối đa 20 triệu pixel</p>
        <label for="diagnosis-file" class="sr-only">Ảnh tôm cần phân tích</label>
        <input id="diagnosis-file" ref="fileInput" type="file" accept="image/jpeg,image/png,image/webp" class="sr-only" tabindex="-1" :disabled="analyzing" :aria-invalid="error ? true : undefined" aria-describedby="diagnosis-file-hint" @change="chooseImage" />
        <input ref="cameraInput" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" class="sr-only" tabindex="-1" aria-label="Chụp ảnh tôm bằng camera" :disabled="analyzing" @change="chooseImage" />
        <div class="diagnosis-actions">
          <SageButton :disabled="analyzing" @click="fileInput?.click()">{{ selectedFile ? 'Đổi ảnh' : 'Chọn ảnh' }}</SageButton>
          <SageButton variant="secondary" :disabled="analyzing" @click="cameraInput?.click()">Chụp ảnh</SageButton>
        </div>
        <div v-if="previewUrl" class="diagnosis-preview"><img :src="previewUrl" alt="Ảnh tôm đã chọn để xem trước" @error="imageError" /></div>
        <p class="diagnosis-file-name" role="status">{{ selectedFile ? selectedFile.name : 'Chưa chọn ảnh' }}</p>
        <SageButton v-if="selectedFile" variant="secondary" :disabled="analyzing" @click="clearImage">Xóa ảnh</SageButton>
        <p class="diagnosis-privacy">Khi nhấn phân tích, ảnh được gửi đến máy chủ và lưu riêng trong lịch sử tài khoản của bạn.</p>
        <p class="diagnosis-format">Chụp rõ tôm ở nơi đủ sáng. Camera được mở trên thiết bị hỗ trợ; máy tính vẫn có thể chọn tệp ảnh.</p>
      </section>
      <section class="diagnosis-information" aria-labelledby="diagnosis-status-title">
        <h2 id="diagnosis-status-title">Phân tích bằng AI</h2>
        <p>Mô hình hiện tại phân loại toàn ảnh vào bốn lớp: đen mang, đốm đen, khỏe mạnh và đốm trắng. Mô hình không định vị vùng bệnh và không hỗ trợ AHPND.</p>
        <SageButton :disabled="!selectedFile || !auth.isLoggedIn" :loading="analyzing" @click="analyze">{{ analyzing ? 'Đang phân tích…' : 'Phân tích ảnh' }}</SageButton>
        <p v-if="analyzing" role="status" class="diagnosis-limit">Đang gửi ảnh, chạy mô hình và lưu kết quả. Vui lòng chờ.</p>
        <p v-if="error" class="diagnosis-error" role="alert">{{ error }}</p>
        <DiagnosisResult v-if="result" :record="result" />
        <div v-else class="diagnosis-results"><h3>Kết quả phân tích</h3><p>Chọn ảnh và nhấn “Phân tích ảnh” để nhận kết quả.</p></div>
        <p v-if="!result" class="diagnosis-limit">Kết quả được dự đoán bằng trí tuệ nhân tạo, chỉ mang tính tham khảo và không thay thế việc chẩn đoán của chuyên gia thủy sản.</p>
      </section>
    </div>
    <section v-else class="container diagnosis-history" aria-label="Lịch sử chẩn đoán của bạn">
      <template v-if="auth.isLoggedIn">
        <form class="diagnosis-filters" @submit.prevent="loadHistory(1)">
          <label>Lớp dự đoán<select v-model="disease"><option value="">Tất cả lớp</option><option v-for="item in classes" :key="item.name" :value="item.name">{{ item.label }}</option></select></label>
          <label>Từ ngày<input v-model="fromDate" type="date" /></label><label>Đến ngày<input v-model="toDate" type="date" /></label>
          <SageButton type="submit" variant="secondary" :disabled="loading || deleting">Lọc lịch sử</SageButton>
        </form>
        <p v-if="historyError" class="diagnosis-error" role="alert">{{ historyError }}</p>
        <p v-if="loading && !deleting" role="status">Đang tải lịch sử…</p>
        <template v-else>
          <p v-if="!history.length && !historyError" class="diagnosis-limit">Chưa có lần phân tích nào phù hợp. Kết quả sẽ xuất hiện tại đây sau khi bạn phân tích ảnh.</p>
          <p v-if="history.length">{{ total }} lần phân tích · Giờ Việt Nam</p>
          <div class="diagnosis-history-grid">
            <article v-for="item in history" :key="item._id" class="diagnosis-history-card">
              <DiagnosisImage :id="item._id" />
              <h3>{{ item.prediction.classNameVi }}</h3><p>Điểm tin cậy: {{ percent(item.prediction.confidence) }}</p>
              <time :datetime="item.createdAt">{{ dateTime(item.createdAt) }}</time>
              <div class="diagnosis-actions"><SageButton variant="secondary" :disabled="deleting" aria-haspopup="dialog" @click="openDetail(item._id, $event)">Xem chi tiết</SageButton><SageButton variant="secondary" :disabled="deleting" aria-haspopup="dialog" @click="openDelete(item, $event)">Xóa</SageButton></div>
            </article>
          </div>
          <nav v-if="pages > 1" class="diagnosis-pagination" aria-label="Phân trang lịch sử"><SageButton variant="secondary" :disabled="page <= 1 || deleting" @click="loadHistory(page - 1)">Trang trước</SageButton><span>Trang {{ page }} / {{ pages }}</span><SageButton variant="secondary" :disabled="page >= pages || deleting" @click="loadHistory(page + 1)">Trang sau</SageButton></nav>
        </template>
      </template>
    </section>
    <SageDialog class="diagnosis-detail-dialog" :model-value="selectedId !== null" title="Chi tiết chẩn đoán" @update:model-value="closeDetail" @closed="clearDetail">
      <DiagnosisResult v-if="detail" :record="detail" in-dialog />
      <p v-else-if="detailError" class="diagnosis-error" role="alert">{{ detailError }}</p>
      <p v-else role="status">Đang tải chi tiết…</p>
    </SageDialog>
    <SageDialog class="diagnosis-delete-dialog" role="alertdialog" :model-value="deleteOpen" :dismissible="!deleting"
      title="Xác nhận xóa kết quả" :description="deleteDescription" @update:model-value="closeDelete" @closed="clearDelete">
      <p v-if="deleteError" class="diagnosis-error" role="alert">{{ deleteError }}</p>
      <p v-if="deleteOpen && deleting" role="status">Đang xóa kết quả…</p>
      <template #footer>
        <SageButton variant="secondary" autofocus :disabled="deleting" @click="closeDelete">Giữ lại</SageButton>
        <SageButton variant="danger" :loading="deleting" @click="removeHistory">Xác nhận xóa</SageButton>
      </template>
    </SageDialog>
  </div>
</template>

<style scoped>
.diagnosis-tabs, .diagnosis-actions, .diagnosis-pagination { display: flex; flex-wrap: wrap; gap: var(--space-3); align-items: center; }
.diagnosis-tabs { margin-bottom: var(--space-6); }
.diagnosis-upload .diagnosis-actions { justify-content: center; }
.diagnosis-history { padding-bottom: var(--section); }
.diagnosis-filters { display: flex; flex-wrap: wrap; align-items: end; gap: var(--space-4); margin-block: var(--space-6); }
.diagnosis-filters label { display: grid; gap: var(--space-2); min-width: 0; }
.diagnosis-filters input, .diagnosis-filters select { max-width: 100%; padding: var(--space-3); border: 1px solid var(--input-border); border-radius: var(--radius-input); background: var(--surface); color: var(--text-primary); font: inherit; }
.diagnosis-history-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--space-4); margin-block: var(--space-6); }
.diagnosis-history-card { min-width: 0; padding: var(--space-4); border: 1px solid var(--border); border-radius: var(--radius-card); background: var(--surface); }
.diagnosis-history-card h3 { margin-block: var(--space-4) var(--space-2); font-size: 20px; }
.diagnosis-history-card .diagnosis-actions { margin-top: var(--space-4); }
.diagnosis-history-card time { color: var(--text-secondary); }
.diagnosis-history-card :deep(.diagnosis-saved-image) { width: 100%; height: 160px; object-fit: contain; }
.diagnosis-detail-dialog.sage-overlay {
  --diagnosis-gutter: clamp(var(--space-3), 2vw, var(--space-6));
  overflow: clip;
}
.diagnosis-detail-dialog.sage-overlay :deep(.sage-overlay-panel) {
  width: min(100%, 90vw, 1680px);
  max-height: min(90dvh, calc(100dvh - var(--space-8)));
  overflow: hidden;
}
.diagnosis-detail-dialog.sage-overlay :deep(.sage-overlay-header) {
  flex-shrink: 0;
  padding: var(--space-2) var(--diagnosis-gutter);
}
.diagnosis-detail-dialog :deep(.sage-overlay-header button) { flex-shrink: 0; }
.diagnosis-detail-dialog.sage-overlay :deep(.sage-overlay-content) {
  padding: var(--space-4) var(--diagnosis-gutter);
  overscroll-behavior: contain;
}
@media (max-width: 1024px) {
  .diagnosis-detail-dialog.sage-overlay :deep(.sage-overlay-panel) { width: min(100%, 94vw); }
}
@media (max-width: 600px) {
  .diagnosis-detail-dialog.sage-overlay { padding: var(--space-2); }
  .diagnosis-detail-dialog.sage-overlay :deep(.sage-overlay-panel) {
    width: 100%;
    max-height: min(96dvh, calc(100dvh - var(--space-4)));
  }
}
.diagnosis-delete-dialog.sage-overlay :deep(.sage-overlay-panel) { width: min(100%, 480px); }
.diagnosis-delete-dialog.sage-overlay :deep(.sage-overlay-description) {
  padding-block: var(--space-4) 0;
  white-space: pre-line;
  overflow-wrap: anywhere;
}
.diagnosis-delete-dialog.sage-overlay :deep(.sage-overlay-header button) { flex-shrink: 0; }
.diagnosis-delete-dialog.sage-overlay :deep(.sage-overlay-content) { padding-block: 0; overscroll-behavior: contain; }
.diagnosis-delete-dialog.sage-overlay :deep(.sage-overlay-footer) {
  justify-content: flex-end;
  margin-top: var(--space-4);
  padding: var(--space-3) var(--space-6);
}
.diagnosis-pagination { justify-content: center; }
:deep(.diagnosis-result) { margin-top: var(--space-6); }
:deep(.diagnosis-saved-image) { display: block; width: 100%; max-height: 440px; object-fit: contain; border-radius: var(--radius-card); margin-bottom: var(--space-4); }
:deep(.diagnosis-result p) { margin-block: var(--space-3); }
:deep(.diagnosis-probabilities) { list-style: none; padding: 0; margin-block: var(--space-4); }
:deep(.diagnosis-probabilities li) { margin-bottom: var(--space-3); }
:deep(.diagnosis-probabilities li > div) { display: flex; justify-content: space-between; gap: var(--space-2); }
:deep(meter) { width: 100%; height: 18px; accent-color: var(--sage); }
:deep(.diagnosis-model) { overflow-wrap: anywhere; margin-top: var(--space-6); }
:deep(.diagnosis-model summary) { cursor: pointer; }
:deep(.diagnosis-disclaimer) { font-weight: 600; }
@media (max-width: 1100px) { .diagnosis-history-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 600px) { .diagnosis-history-grid { grid-template-columns: 1fr; } .diagnosis-filters label { width: 100%; } .diagnosis-tabs > button { flex: 1; } }
</style>
