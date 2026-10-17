<script setup>
import { nextTick, ref } from 'vue';
import SageButton from '@/components/user/sage/SageButton.vue';
import SageInput from '@/components/user/sage/SageInput.vue';
import SageSelect from '@/components/user/sage/SageSelect.vue';
import SageTextarea from '@/components/user/sage/SageTextarea.vue';
import SageCard from '@/components/user/sage/SageCard.vue';
import SageBadge from '@/components/user/sage/SageBadge.vue';
import SageTabs from '@/components/user/sage/SageTabs.vue';
import SageAccordion from '@/components/user/sage/SageAccordion.vue';
import SageDialog from '@/components/user/sage/SageDialog.vue';
import SageDrawer from '@/components/user/sage/SageDrawer.vue';
import SageToast from '@/components/user/sage/SageToast.vue';
import SageLoading from '@/components/user/sage/SageLoading.vue';
import SageEmptyState from '@/components/user/sage/SageEmptyState.vue';
import SageErrorState from '@/components/user/sage/SageErrorState.vue';
import SageSkeleton from '@/components/user/sage/SageSkeleton.vue';
import { useStorefrontMotion } from '@/composables/useStorefrontMotion';
import { useSageReducedMotion } from '@/composables/useSageReducedMotion';
import { useFormAccessibility } from '@/composables/useFormAccessibility';
const root = ref(null);
useFormAccessibility(root);
const { enterPage, feedback, refresh } = useStorefrontMotion(root);
const reduced = useSageReducedMotion();
const value = ref(''); const topic = ref('ui'); const notes = ref(''); const error = ref('');
const tab = ref('tokens'); const accordion = ref(false);
const dialog = ref(false); const drawer = ref(false); const edge = ref('right'); const mounted = ref(true);
const toast = ref(false); const message = ref(''); const preview = ref(null); const counter = ref(0);
const items = [{value:'tokens',label:'Design tokens'},{value:'motion',label:'Animation'},{value:'disabled',label:'Disabled',disabled:true},{value:'usage',label:'Cách dùng'}];
function notify(text = 'Tương tác showcase; không gửi dữ liệu tới API.') { message.value = text; toast.value = true; }
function validate() { error.value = value.value.trim() ? '' : 'Nhập nội dung để thử trạng thái lỗi của component.'; if (!error.value) notify('Biểu mẫu showcase hợp lệ. Không có request nghiệp vụ.'); }
function openDrawer(direction) { edge.value = direction; drawer.value = true; }
async function toggleMount() { mounted.value = !mounted.value; await nextTick(); refresh(); }
</script>
<template>
  <div ref="root" class="user-app sage-storefront sage-showcase">
    <a class="skip-link" href="#showcase-main">Đi đến nội dung</a>
    <header class="sage-showcase-top"><a href="/login">Về Client hiện tại</a><SageBadge>Development only · Phase 01</SageBadge></header>
    <main id="showcase-main" tabindex="-1">
      <section class="sage-showcase-hero sage-dark-surface">
        <div><p class="hero-fade">Design system cho Client thủy sản</p><h1 class="sage-display"><span class="hero-line" style="--i:0"><span>Nền tảng</span></span><span class="hero-line" style="--i:1"><span>Sage Client</span></span></h1><p class="hero-fade" style="--i:1">Typography, controls và motion. Mọi dữ liệu trên trang này chỉ để thử component.</p></div>
        <figure class="aquaculture-hero-media"><img src="/demo/pond-banner.svg" alt="Minh họa ao nuôi dùng cho showcase" width="640" height="420"><figcaption>Ảnh minh họa, không phải hình ảnh sản phẩm.</figcaption></figure>
      </section>
      <section class="sage-showcase-section" aria-labelledby="type-heading"><h2 id="type-heading">01 / Typography và token</h2><p>Tiếng Việt: Tôm thẻ chân trắng · Chế phẩm sinh học · Đường dẫn · Khả năng truy cập.</p><p class="sage-numeric">Dãy số kiểm tra: 1.234.567,89 ₫ · 0123456789</p><div class="sage-showcase-swatches"><span v-for="tone in ['primary','sage','accent','surface','success','warning','danger']" :key="tone" class="sage-showcase-swatch" :style="{ '--swatch': 'var(--' + tone + ')' }"><i aria-hidden="true"></i>{{ tone }}</span></div><p>Motion preference: <strong>{{ reduced ? 'Reduced motion' : 'Full motion' }}</strong></p></section>
      <section class="sage-showcase-section" aria-labelledby="button-heading"><h2 id="button-heading">02 / Button — 8 trạng thái</h2><div class="sage-showcase-buttons"><SageButton @click="notify()">Default</SageButton><SageButton class="is-hover" @click="notify()">Hover</SageButton><SageButton class="is-focus" @click="notify()">Focus</SageButton><SageButton class="is-active" @click="notify()">Active</SageButton><SageButton disabled title="Disabled minh họa">Disabled</SageButton><SageButton loading>Loading</SageButton><SageButton state="error" @click="notify()">Error</SageButton><SageButton state="success" @click="notify()">Success</SageButton><SageButton variant="secondary" @click="notify()">Secondary</SageButton><SageButton variant="danger" @click="notify()">Danger</SageButton></div></section>
      <section class="sage-showcase-section" aria-labelledby="form-heading"><h2 id="form-heading">03 / Form controls</h2><form class="sage-showcase-grid" novalidate @submit.prevent="validate"><SageInput v-model="value" label="Nội dung kiểm tra" hint="Label, hint và error có ID ổn định." :error="error" required @update:model-value="error = ''" /><SageSelect v-model="topic" label="Chủ đề kiểm tra" :options="[{value:'ui',label:'Giao diện'},{value:'motion',label:'Motion'},{value:'disabled',label:'Tùy chọn disabled',disabled:true}]" /><SageTextarea v-model="notes" label="Ghi chú" hint="Đây là dữ liệu cục bộ, không lưu vào tài khoản." /><div class="sage-showcase-stack"><SageInput label="Disabled field" model-value="Không chỉnh sửa" disabled /><SageInput label="Success field" model-value="Tiếng Việt hiển thị đầy đủ" success="Trạng thái thành công minh họa" /></div><SageButton type="submit">Kiểm tra biểu mẫu</SageButton></form></section>
      <section class="sage-showcase-section" aria-labelledby="card-heading"><h2 id="card-heading">04 / Cards và badges</h2><div class="sage-showcase-grid"><SageCard media-hover><template #media><img src="/demo/catalog-0.svg" alt="Minh họa thủy sản cho thử image hover" width="360" height="360" /></template><SageBadge>Card minh họa</SageBadge><h3>Tên nội dung dài để kiểm tra khả năng xuống dòng tiếng Việt</h3><p>Ảnh minh họa; không đại diện SKU, giá, tồn kho hoặc cam kết sản phẩm.</p><template #footer><SageButton variant="secondary" @click="notify()">Thử tương tác</SageButton></template></SageCard><div class="sage-showcase-stack"><SageCard><h3>Surface và spacing</h3><p>Card chỉ chứa nội dung cần nhóm. Không áp dụng card cho mọi section.</p></SageCard><div class="sage-showcase-buttons"><SageBadge tone="success">Thành công</SageBadge><SageBadge tone="warning">Cần lưu ý</SageBadge><SageBadge tone="danger">Có lỗi</SageBadge></div><SageSkeleton media :lines="3" /></div></div></section>
      <section class="sage-showcase-section" aria-labelledby="tab-heading"><h2 id="tab-heading">05 / Tabs và accordion</h2><SageTabs v-model="tab" :items="items" label="Nội dung foundation"><template #tokens><p>Color, spacing và radius chỉ được khai báo trong root Client.</p></template><template #motion><p>Tab panel: 360ms; accordion: 260ms; focus ring xuất hiện ngay.</p></template><template #usage><p>Arrow Left/Right, Home/End để chọn tab; tab disabled được bỏ qua.</p></template></SageTabs><SageAccordion v-model="accordion" title="Thử mở nội dung bằng bàn phím"><p>Panel đóng không nhận Tab. Animation dùng grid 0fr → 1fr.</p><SageButton variant="secondary" @click="notify()">Action trong panel</SageButton></SageAccordion><SageAccordion title="Accordion disabled" disabled><p>Không thể mở.</p></SageAccordion></section>
      <section class="sage-showcase-section" aria-labelledby="overlay-heading"><h2 id="overlay-heading">06 / Dialog, drawer và bottom sheet</h2><div class="sage-showcase-buttons"><SageButton id="dialog-trigger" @click="dialog = true">Mở dialog</SageButton><SageButton @click="openDrawer('right')">Drawer phải</SageButton><SageButton @click="openDrawer('left')">Drawer trái</SageButton><SageButton @click="openDrawer('bottom')">Bottom sheet</SageButton><SageButton variant="secondary" @click="notify()">Hiện toast</SageButton><SageButton variant="secondary" @click="toggleMount()">{{ mounted ? 'Unmount overlays' : 'Mount overlays' }}</SageButton></div><template v-if="mounted"><SageDialog v-model="dialog" title="Dialog Client" description="Focus nằm trong dialog, Escape đóng và trở về trigger."><SageInput label="Field trong dialog" placeholder="Thử Tab / Shift+Tab" /><SageButton variant="secondary" @click="openDrawer('right')">Mở drawer trên dialog</SageButton><template #footer><SageButton @click="dialog = false">Đóng dialog</SageButton></template></SageDialog><SageDrawer v-model="drawer" :edge="edge" title="Drawer Client"><p>Không có dữ liệu giỏ hàng trong showcase.</p><SageInput label="Field trong drawer" /><template #footer><SageButton @click="drawer = false">Đóng drawer</SageButton></template></SageDrawer></template></section>
      <section class="sage-showcase-section" aria-labelledby="feedback-heading"><h2 id="feedback-heading">07 / Loading, empty, error và feedback</h2><SageLoading /><div class="sage-showcase-grid"><SageEmptyState title="Danh sách trống minh họa" description="Chỉ kiểm tra component, không gọi API." action-label="Thử action" @action="notify()" /><SageErrorState description="Lỗi giả lập có nhãn để kiểm tra cách trình bày." @retry="notify('Retry chỉ là tương tác showcase.')" /></div><div ref="preview" class="sage-showcase-preview"><p>Page transition / feedback: {{ counter }}</p></div><div class="sage-showcase-buttons"><SageButton variant="secondary" @click="counter++; enterPage(preview)">Page entrance</SageButton><SageButton variant="secondary" @click="feedback(preview, 'success')">Success motion</SageButton><SageButton variant="secondary" @click="feedback(preview, 'error')">Error motion</SageButton><SageButton variant="secondary" @click="feedback(preview, 'bump')">Badge bump</SageButton></div></section>
      <section class="sage-showcase-section" aria-labelledby="reveal-heading"><h2 id="reveal-heading">08 / Scroll reveal</h2><div class="sage-showcase-grid"><SageCard v-for="i in 4" :key="i" class="reveal" :style="{'--i':i-1}"><h3>Reveal {{ i }}</h3><p>Nội dung hiện khi thiếu observer hoặc bật reduced motion.</p></SageCard></div></section>
    </main>
    <SageToast v-model="toast" :message="message" />
    <footer class="sage-showcase-bottom">Phase 01 · không API, không auth giả, không dữ liệu nghiệp vụ.</footer>
  </div>
</template>
<style>
.user-app.sage-storefront.sage-showcase { font-family: var(--font-body); }
.user-app.sage-storefront.sage-showcase main { max-width: var(--container); padding-inline: var(--gutter); margin-inline: auto; }
.user-app.sage-storefront .sage-showcase-top { display: flex; flex-wrap: wrap; justify-content: space-between; gap: var(--space-4); padding: var(--space-6) var(--gutter); }
.user-app.sage-storefront .sage-showcase-top a { color: var(--primary); text-decoration: underline; }
.user-app.sage-storefront .sage-showcase-hero { display: grid; grid-template-columns: minmax(0,1.2fr) minmax(0,1fr); gap: var(--space-8); padding: var(--space-12); border-radius: var(--radius-container); }
.user-app.sage-storefront .sage-showcase-hero > div { display: grid; gap: var(--space-6); min-width: 0; }
.user-app.sage-storefront .sage-showcase-hero figure { min-width: 0; margin: 0; }
.user-app.sage-storefront .sage-showcase-hero img { display: block; width: 100%; height: auto; border-radius: var(--radius-card); }
.user-app.sage-storefront .sage-showcase-hero figcaption { font-size: var(--text-meta); padding-top: var(--space-2); }
.user-app.sage-storefront .sage-showcase-section { display: grid; gap: var(--space-6); padding-block: var(--space-12); border-bottom: 1px solid var(--border); }
.user-app.sage-storefront .sage-showcase-section > h2 { font-size: var(--text-section); }
.user-app.sage-storefront .sage-showcase-buttons { display: flex; flex-wrap: wrap; gap: var(--space-3); align-items: center; }
.user-app.sage-storefront .sage-showcase-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: var(--space-6); min-width: 0; }
.user-app.sage-storefront .sage-showcase-stack { display: grid; gap: var(--space-6); align-content: start; min-width: 0; }
.user-app.sage-storefront .sage-showcase-swatches { display: flex; gap: var(--space-4); flex-wrap: wrap; }
.user-app.sage-storefront .sage-showcase-swatch { display: grid; gap: var(--space-2); font-size: var(--text-meta); }
.user-app.sage-storefront .sage-showcase-swatch i { display: block; width: 64px; height: 48px; border-radius: var(--radius-input); background: var(--swatch); border: 1px solid var(--input-border); }
.user-app.sage-storefront .sage-showcase-preview { padding: var(--space-6); background: var(--primary-soft); border-radius: var(--radius-card); }
.user-app.sage-storefront .sage-showcase-bottom { padding: var(--space-8) var(--gutter); font-size: var(--text-meta); color: var(--text-secondary); }
@media(max-width:900px) { .user-app.sage-storefront .sage-showcase-hero { grid-template-columns: minmax(0,1fr); padding: var(--space-8); } }
@media(max-width:700px) { .user-app.sage-storefront .sage-showcase-grid { grid-template-columns: minmax(0,1fr); } .user-app.sage-storefront .sage-showcase-hero { padding: var(--space-6); } .user-app.sage-storefront .sage-showcase-section { padding-block: var(--space-8); } }
</style>
