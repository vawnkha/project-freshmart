<script setup>
import { computed, nextTick, ref, watch, onMounted, onBeforeUnmount } from 'vue';
import aiService from '@/services/ai.service';
import { useAuthStore, captureAuthRequestContext } from '@/stores/user/auth';
import { userError } from '@/utils/user-error.util';
import { productPrice, formatMoney } from '@/utils/storefront.util';
import { catalogStock } from '@/utils/catalog-query.util';
import { normalizeId } from '@/utils/id.util';
import ResponsiveImage from '@/components/user/common/ResponsiveImage.vue';
const auth = useAuthStore();
const opened = ref(false);
const loading = ref(false);
const input = ref('');
const bodyRef = ref(null);
const panel = ref(null);
const widget = ref(null);
const composer = ref(null);
const viewportStyle = ref({});
const compactViewport = ref(false);
const canSend = computed(() => !loading.value && !!input.value.trim() && input.value.trim().length <= 1000);
let request = null;
let disposed = false;
let trigger, modalObserver;
const initialMessages = () => [{ role: 'assistant', text: 'Xin chào! Mình có thể giúp bạn tìm sản phẩm, hỏi giá và xem tình trạng còn hàng trên website.', products: [] }];
const messages = ref(initialMessages());
// Presentation entry point for the approved Home support callout.
defineExpose({ open: () => { opened.value = true; } });
function close(restore = true) {
  const ownsFocus = panel.value?.contains(document.activeElement);
  opened.value = false;
  if (restore && ownsFocus && trigger?.isConnected) trigger.focus({ preventScroll: true });
}
function preparePanel(element) {
  element.inert = false;
  element.removeAttribute('aria-hidden');
}
function hidePanel(element) {
  // Vue keeps the leaving DOM until the Sage transition finishes. It must
  // stop receiving Tab immediately, including when reopened during that exit.
  element.inert = true;
  element.setAttribute('aria-hidden', 'true');
}
function resetSession() {
  const previous = request;
  request = null;
  previous?.controller.abort();
  loading.value = false;
  input.value = '';
  messages.value = initialMessages();
  close(false);
}
// These are local presentation fences, not a second auth/session store. The
// existing authority also catches a same-ID/same-JWT login intent.
const stopActions = auth.$onAction(({ name }) => {
  if (['login', 'logout', '$reset'].includes(name)) resetSession();
});
watch(() => [auth.userId, auth.accessToken, auth.isLoggedIn], resetSession, { flush: 'sync' });
watch(opened, async (value) => {
  if (!value) return;
  trigger = document.activeElement;
  await nextTick();
  if (!disposed && opened.value) composer.value?.focus({ preventScroll: true });
});
async function scrollToBottom() {
  await nextTick();
  if (bodyRef.value) bodyRef.value.scrollTop = bodyRef.value.scrollHeight;
}
async function sendMessage(text = input.value.trim()) {
  text = String(text).trim();
  if (disposed || !text || loading.value || text.length > 1000) return;
  const context = captureAuthRequestContext();
  const current = { controller: new AbortController() };
  const isCurrent = () => !disposed && request === current && (!context || context.isCurrent());
  request = current;
  messages.value.push({ role: 'user', text, products: [] });
  input.value = '';
  loading.value = true;
  await scrollToBottom();
  try {
    if (!isCurrent()) return;
    const response = await aiService.chat(text, { signal: current.controller.signal });
    if (!isCurrent()) return;
    if (typeof response.reply !== 'string' || !response.reply.trim()) throw new Error('Chưa nhận được câu trả lời. Vui lòng thử lại.');
    messages.value.push({ role: 'assistant', text: response.reply, products: Array.isArray(response.products) ? response.products.filter(product => !!normalizeId(product?._id)) : [] });
  } catch (error) {
    if (isCurrent()) messages.value.push({ role: 'assistant', text: userError(error, 'Chưa thể kết nối hỗ trợ trực tuyến. Vui lòng thử lại.'), products: [], retry: text });
  } finally {
    if (isCurrent()) {
      request = null;
      loading.value = false;
      await scrollToBottom();
    }
  }
}
function handleEnter(event) {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); sendMessage(); }
}
function updateViewport() {
  const viewport = window.visualViewport;
  compactViewport.value = (viewport?.height ?? window.innerHeight) < 480;
  viewportStyle.value = viewport ? {
    '--chat-visible-height': `${viewport.height}px`,
    '--chat-keyboard-inset': `${Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)}px`,
  } : {};
}
onMounted(() => {
  updateViewport();
  window.visualViewport?.addEventListener('resize', updateViewport);
  window.visualViewport?.addEventListener('scroll', updateViewport);
  const root = widget.value?.closest('.user-app.sage-storefront');
  if (root && typeof MutationObserver !== 'undefined') {
    modalObserver = new MutationObserver(() => {
      if (opened.value && root.querySelector('dialog[open]')) close(false);
    });
    modalObserver.observe(root, { subtree: true, attributes: true, attributeFilter: ['open'] });
  }
});
onBeforeUnmount(() => {
  disposed = true;
  request?.controller.abort();
  request = null;
  stopActions();
  modalObserver?.disconnect();
  window.visualViewport?.removeEventListener('resize', updateViewport);
  window.visualViewport?.removeEventListener('scroll', updateViewport);
});
</script>
<template>
  <div ref="widget" class="ai-chat" :class="{ 'ai-chat--compact': compactViewport }" :style="viewportStyle">
    <button aria-label="Mở hỗ trợ trực tuyến" :aria-expanded="opened" aria-controls="support-panel" class="ai-chat__toggle" @click="opened = !opened">
      <i class="fa-solid fa-comment" aria-hidden="true"></i>
    </button>
    <Transition name="client-chat-panel" @before-enter="preparePanel" @before-leave="hidePanel">
    <section v-if="opened" id="support-panel" ref="panel" class="ai-chat__panel" role="dialog" aria-label="Hỗ trợ trực tuyến" tabindex="-1" @keydown.esc.stop.prevent="close()">
      <div class="ai-chat__header"><div><strong>Hỗ trợ trực tuyến</strong><div class="ai-chat__sub">Hỏi giá hoặc tìm sản phẩm</div></div>
        <button aria-label="Đóng hỗ trợ trực tuyến" class="ai-chat__close" @click="close()">×</button>
      </div>
      <div ref="bodyRef" class="ai-chat__body" role="log" aria-live="polite" aria-relevant="additions" :aria-busy="loading">
        <div v-for="(message, index) in messages" :key="index" class="ai-chat__msg" :class="message.role">
          <div class="ai-chat__bubble" :role="message.retry ? 'alert' : undefined">{{ message.text }}</div>
          <button v-if="message.retry" class="text-button" :disabled="loading" @click="sendMessage(message.retry)">Thử gửi lại câu hỏi</button>
          <div v-if="message.products.length" class="ai-chat__products">
            <router-link v-for="product in message.products" :key="product._id" class="ai-chat__product" :to="'/products/' + product._id">
              <ResponsiveImage :src="product.thumbnail" :alt="product.name" class="ai-chat__product-thumb" />
              <div class="ai-chat__product-info"><div class="ai-chat__product-name">{{ product.name }}</div>
                <div>{{ productPrice(product) === null ? 'Chưa có giá' : formatMoney(productPrice(product)) }}</div>
                <div class="ai-chat__product-stock">{{ catalogStock(product) === null ? 'Chưa xác định tồn kho' : catalogStock(product) > 0 ? 'Còn hàng' : 'Hết hàng' }}</div>
              </div>
            </router-link>
          </div>
        </div>
        <div v-if="loading" class="ai-chat__bubble" role="status">Đang trả lời...</div>
      </div>
      <div class="ai-chat__footer">
        <textarea ref="composer" v-model="input" class="ai-chat__input" rows="2" maxlength="1000" placeholder="Tìm chế phẩm sinh học hoặc hỏi giá sản phẩm..." aria-label="Tin nhắn hỗ trợ" aria-describedby="support-limit support-ai-note" @keydown="handleEnter"></textarea>
        <small id="support-limit">{{ input.length }}/1000 ký tự · Shift + Enter để xuống dòng</small>
        <button class="btn btn-primary btn-block ai-chat__send" :disabled="!canSend" :aria-busy="loading" @click="sendMessage()">{{ loading ? 'Đang gửi...' : 'Gửi' }}</button>
        <p id="support-ai-note" class="ai-chat__note">Trợ lý AI hỗ trợ tra cứu sản phẩm. Kết quả chỉ để tham khảo.</p>
      </div>
    </section>
    </Transition>
  </div>
</template>
