<script setup>
import { onBeforeUnmount, ref, watch } from 'vue';
import { useAuthStore, captureAuthRequestContext } from '@/stores/user/auth';
import service from '@/services/shrimp-diagnosis.service';
const props = defineProps({ id: { type: String, required: true }, alt: { type: String, default: 'Ảnh tôm đã phân tích' } });
const auth = useAuthStore();
const url = ref(''), error = ref('');
let controller, generation = 0;
function release() { if (url.value) URL.revokeObjectURL(url.value); url.value = ''; }
function imageFailed() { release(); error.value = 'Không thể tải ảnh đã lưu.'; }
watch(() => [props.id, auth.accessToken, auth.userId], async () => {
  const current = ++generation;
  controller?.abort(); controller = new AbortController(); release(); error.value = '';
  if (!auth.isLoggedIn || !props.id) return;
  const context = captureAuthRequestContext();
  try {
    const data = await service.image(props.id, controller.signal);
    if (current !== generation || (context && !context.isCurrent())) return;
    url.value = URL.createObjectURL(data);
  } catch (err) { if (current === generation && err.code !== 'ERR_CANCELED') imageFailed(); }
}, { immediate: true, flush: 'sync' });
onBeforeUnmount(() => { generation++; controller?.abort(); release(); });
</script>
<template>
  <img v-if="url" :src="url" :alt="alt" class="diagnosis-saved-image" @error="imageFailed" />
  <p v-else role="status" class="diagnosis-image-status">{{ error || 'Đang tải ảnh…' }}</p>
</template>
  
