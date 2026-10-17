<script setup>
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import { Swiper, SwiperSlide } from 'swiper/vue';
import { A11y } from 'swiper/modules';
import 'swiper/css';
import { productGallery } from '@/utils/product-detail.util';
import { useSageReducedMotion } from '@/composables/useSageReducedMotion';
import { SAGE_MOTION } from '@/utils/storefront-motion.util';
import ResponsiveImage from '@/components/user/common/ResponsiveImage.vue';
import SageButton from '@/components/user/sage/SageButton.vue';
import SageDialog from '@/components/user/sage/SageDialog.vue';

const props = defineProps({ product: { type: Object, required: true } });
const images = computed(() => productGallery(props.product)), source = computed(() => images.value[active.value] || '');
const active = ref(0), swapping = ref(false), zoomed = ref(false), dialog = ref(false), trigger = ref(null), stage = ref(null);
const origin = ref('50% 50%'), swiper = shallowRef(null), failed = ref(new Set());
const reduced = useSageReducedMotion();
let timer, pendingIndex = 0;
const canZoom = computed(() => !!source.value && !failed.value.has(source.value));
function cancelSwap() { clearTimeout(timer); timer = undefined; swapping.value = false; }
function ready(instance) { swiper.value = instance; }
function changed(instance) { active.value = instance.activeIndex; zoomed.value = false; }
function commit(index) { active.value = index; swiper.value?.slideTo(index, reduced.value ? 0 : SAGE_MOTION.gallery); swapping.value = false; }
function select(index) {
  if (index < 0 || index >= images.value.length || (index === active.value && !swapping.value)) return;
  cancelSwap(); zoomed.value = false; pendingIndex = index;
  if (reduced.value || dialog.value) { commit(index); return; }
  swapping.value = true;
  timer = setTimeout(() => { timer = undefined; commit(index); }, SAGE_MOTION.gallerySwap);
}
function keyboard(event) {
  if (!images.value.length || event.target.closest('button')) return;
  const next = { ArrowLeft: active.value - 1, ArrowRight: active.value + 1, Home: 0, End: images.value.length - 1 }[event.key];
  if (next !== undefined) { event.preventDefault(); select(next); }
}
function thumbnailKeyboard(event) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  const buttons = [...event.currentTarget.querySelectorAll('button')];
  const index = buttons.indexOf(event.target);
  if (index < 0) return;
  event.preventDefault();
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
    : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
  select(next); buttons[next]?.focus({ preventScroll: true });
  // Keep the focused thumbnail visible inside its own rail, without moving the page.
  const rail = event.currentTarget, button = buttons[next];
  if (button.offsetLeft < rail.scrollLeft) rail.scrollLeft = button.offsetLeft;
  else if (button.offsetLeft + button.offsetWidth > rail.scrollLeft + rail.clientWidth)
    rail.scrollLeft = button.offsetLeft + button.offsetWidth - rail.clientWidth;
}
function pointer(event) {
  if (reduced.value || !canZoom.value || event.pointerType !== 'mouse' || !window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) return;
  const box = stage.value.getBoundingClientRect();
  origin.value = Math.min(100, Math.max(0, (event.clientX - box.left) / box.width * 100)) + '% ' +
    Math.min(100, Math.max(0, (event.clientY - box.top) / box.height * 100)) + '%';
  zoomed.value = true;
}
function failedImage(event) {
  if (event.target.tagName !== 'IMG') return;
  const url = event.target.getAttribute('src');
  if (url) failed.value = new Set([...failed.value, url]);
  zoomed.value = false;
}
async function closed() { await nextTick(); if (!document.querySelector('dialog[open]')) trigger.value?.$el?.focus({ preventScroll: true }); }
watch(images, () => { cancelSwap(); active.value = 0; failed.value = new Set(); zoomed.value = false; dialog.value = false; swiper.value?.slideTo(0, 0); });
watch(reduced, value => { if (value) { zoomed.value = false; if (swapping.value) { cancelSwap(); commit(pendingIndex); } } });
onBeforeUnmount(() => { cancelSwap(); swiper.value = null; });
</script>
<template>
  <section class="pdp-gallery sage-panel-in" aria-label="Hình ảnh sản phẩm">
    <div ref="stage" class="pdp-gallery-stage" :class="{ 'is-zoomed': zoomed, 'is-swapping': swapping }"
      :style="{ '--pdp-zoom-origin': origin }" tabindex="0" aria-label="Ảnh sản phẩm; dùng phím mũi tên để đổi ảnh"
      @keydown="keyboard" @pointermove="pointer" @pointerleave="zoomed = false" @error.capture="failedImage">
      <Swiper v-if="images.length > 1" :modules="[A11y]" :speed="reduced ? 0 : SAGE_MOTION.gallery" :slides-per-view="1" :loop="false"
        :a11y="{ slideLabelMessage: 'Ảnh {{index}} trên {{slidesLength}}', containerRoleDescriptionMessage: 'Bộ ảnh sản phẩm', itemRoleDescriptionMessage: 'Ảnh sản phẩm' }"
        class="pdp-swiper" @swiper="ready" @slide-change="changed">
        <SwiperSlide v-for="(image, index) in images" :key="image" :aria-hidden="index !== active" :inert="index !== active ? '' : undefined">
          <ResponsiveImage :src="image" :alt="`${product.name || 'Sản phẩm'} — ảnh ${index + 1}`" :eager="index === 0" />
        </SwiperSlide>
      </Swiper>
      <ResponsiveImage v-else :src="source" :alt="product.name || 'Sản phẩm'" eager />
    </div>
    <div class="pdp-gallery-tools">
      <p class="pdp-gallery-position" role="status">{{ images.length ? `Ảnh ${active + 1} / ${images.length}` : 'Chưa có hình ảnh sản phẩm' }}</p>
      <SageButton ref="trigger" variant="secondary" :disabled="!canZoom" :aria-expanded="dialog" aria-haspopup="dialog" @click="dialog = true">
        <i class="fa-solid fa-magnifying-glass-plus" aria-hidden="true"></i> Xem ảnh lớn
      </SageButton>
    </div>
    <div v-if="images.length > 1" class="pdp-thumbnails" role="group" aria-label="Chọn ảnh sản phẩm" @keydown="thumbnailKeyboard">
      <button v-for="(image, index) in images" :key="image" type="button" :aria-label="`Xem ảnh ${index + 1} của ${product.name || 'sản phẩm'}`"
        :aria-pressed="active === index" @click="select(index)">
        <ResponsiveImage :src="image" alt="" />
      </button>
    </div>
    <SageDialog v-model="dialog" class="pdp-image-dialog" :title="product.name || 'Ảnh sản phẩm'" @closed="closed">
      <div class="pdp-expanded-image"><ResponsiveImage :src="source" :alt="`${product.name || 'Sản phẩm'} — ảnh ${active + 1}`" eager /></div>
      <template v-if="images.length > 1" #footer>
        <SageButton variant="secondary" :disabled="active === 0" @click="select(active - 1)">Ảnh trước</SageButton>
        <span aria-live="polite">Ảnh {{ active + 1 }} / {{ images.length }}</span>
        <SageButton variant="secondary" :disabled="active === images.length - 1" @click="select(active + 1)">Ảnh tiếp</SageButton>
      </template>
    </SageDialog>
  </section>
</template>
