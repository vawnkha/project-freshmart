<script setup>
import { productPath } from "@/utils/product-route.util";
import {computed,onMounted,reactive,ref,watch} from 'vue';
import {useRoute,useRouter} from 'vue-router';
import {useDosageCalculator} from '@/composables/useDosageCalculator';
import {dosageText,formatCalculatedNumber as number} from '@/utils/dosage-calculator.util';
import categoryService from '@/services/category.service';
import ResponsiveImage from '@/components/user/common/ResponsiveImage.vue';
const route=useRoute(),router=useRouter(),c=reactive(useDosageCalculator());
const categories=ref([]),categoryError=ref('');
const money=value=>value==null?'Chưa có giá':number(value)+' đ';
const levels=computed(()=>c.result?(c.result.isRange?[{key:'min',label:'Mức thấp'},{key:'max',label:'Mức cao'}]:[{key:'min',label:'Liều cố định'}]):[]);
const pages=computed(()=>Math.max(1,Math.ceil(c.pagination.total/c.pagination.limit)));
watch(()=>route.query.productId,value=>{c.selectedId=typeof value==='string'?value:value===undefined?'':'invalid';},{immediate:true});
function selectProduct(id){c.selectedId=id;router.replace({path:'/tools/dosage-calculator',query:{productId:id}});}
async function loadCategories(){categoryError.value='';try{const response=await categoryService.getAll();categories.value=(response.data||response||[]).filter(row=>row.status!=='inactive');}catch{categoryError.value='Chưa tải được danh mục.';}}
onMounted(loadCategories);
</script>
<template>
  <div class="site-content dosage-page"><div class="container">
    <nav aria-label="Đường dẫn"><RouterLink to="/products">Sản phẩm</RouterLink> / Công cụ tính liều lượng</nav>
    <header class="dosage-intro"><p class="dosage-eyebrow">Công cụ tiện ích</p><h1>Công cụ tính liều lượng chế phẩm</h1><p>Tính theo thông số bạn nhập và hướng dẫn được khai báo cho từng sản phẩm.</p></header>
    <div class="dosage-layout">
      <section class="dosage-panel dosage-inputs" aria-label="Thông số tính liều">
        <h2>1. Chọn sản phẩm</h2>
        <label for="dosage-search">Tìm sản phẩm</label><input id="dosage-search" v-model="c.filters.q" type="search" maxlength="120" placeholder="Tên sản phẩm có hướng dẫn tính tự động" />
        <div class="dosage-filter-grid">
          <div><label for="dosage-category">Danh mục</label><select id="dosage-category" v-model="c.filters.categoryId"><option value="">Tất cả danh mục</option><option v-for="category in categories" :key="category._id" :value="category._id">{{category.name}}</option></select></div>
          <div><label for="dosage-basis-filter">Nhóm sử dụng</label><select id="dosage-basis-filter" v-model="c.filters.calculationBasis"><option value="">Tất cả</option><option value="water_volume">Theo thể tích nước</option><option value="feed_mass">Theo khối lượng thức ăn</option></select></div>
        </div>
        <p v-if="categoryError" role="status">{{categoryError}} <button type="button" @click="loadCategories">Tải lại danh mục</button></p>
        <p v-if="c.catalogLoading" role="status">Đang tìm sản phẩm…</p>
        <div v-else-if="c.catalogError" role="alert"><p>{{c.catalogError}}</p><button type="button" @click="c.loadCatalog">Thử lại danh sách</button></div>
        <template v-else>
          <p v-if="!c.catalog.length" class="dosage-notice">Chưa có sản phẩm phù hợp với hướng dẫn tính tự động được bật. Quản trị viên cần cập nhật liều lượng và cho phép tính tại hồ sơ kỹ thuật.</p>
          <ul v-else class="dosage-products"><li v-for="product in c.catalog" :key="product._id">
            <button type="button" class="dosage-product-option" :aria-pressed="c.selectedId===String(product._id)" :aria-label="'Chọn '+product.name" @click="selectProduct(String(product._id))">
              <ResponsiveImage :src="product.thumbnail" :alt="product.name" /><span><strong>{{product.name}}</strong><small>{{product.packageSize||'Chưa có quy cách'}} · {{product.category?.name||'Chưa có danh mục'}}</small><small>{{money(product.price)}} / {{product.unit}} · {{product.inStock?'Còn '+number(product.availableStock)+' '+product.unit:'Hết hàng'}}</small></span>
            </button>
          </li></ul>
          <nav v-if="c.pagination.total>c.pagination.limit" class="dosage-pagination" aria-label="Phân trang sản phẩm tính liều"><button type="button" :disabled="c.filters.page<=1" @click="c.filters.page--">Trang trước</button><span>Trang {{c.pagination.page}} / {{pages}}</span><button type="button" :disabled="c.filters.page>=pages" @click="c.filters.page++">Trang sau</button></nav>
        </template>
        <p v-if="c.detailLoading" role="status">Đang tải hướng dẫn sản phẩm…</p>
        <div v-else-if="c.detailError" role="alert"><p>{{c.detailError}}</p><RouterLink to="/products">Chọn sản phẩm tại cửa hàng</RouterLink></div>
        <template v-else-if="c.product">
          <div class="dosage-selected"><strong>{{c.product.name}}</strong><p>{{c.product.packageSize||'Chưa có quy cách'}} · {{money(c.product.price)}} / {{c.product.unit}}</p><p v-if="c.product.technicalNotes">{{c.product.technicalNotes}}</p></div>
          <div v-if="!c.product.canCalculate" class="dosage-notice" role="status"><p>{{c.product.unavailableReason}}</p><p v-if="c.product.legacyDosageText" class="dosage-text">{{c.product.legacyDosageText}}</p></div>
          <details v-if="c.product.dosageInstructions.some(row=>!row.canCalculate)"><summary>Hướng dẫn chưa dùng để tính tự động</summary><div v-for="row in c.product.dosageInstructions.filter(row=>!row.canCalculate)" :key="row.id"><p class="dosage-text">{{dosageText(row)}}</p><p>{{row.unavailableReason}}</p></div></details>
          <form class="dosage-form" @submit.prevent="c.calculate" novalidate>
            <h2>2. Mục đích và thông số</h2>
            <label for="dosage-instruction">Mục đích sử dụng</label><select id="dosage-instruction" v-model="c.instructionId" :disabled="!c.product.canCalculate"><option value="">Chọn hướng dẫn sản phẩm</option><option v-for="row in c.product.dosageInstructions" :key="row.id" :value="row.id" :disabled="!row.canCalculate">{{row.purpose}}</option></select>
            <p v-if="c.instruction" class="dosage-text dosage-notice">{{dosageText(c.instruction)}}</p>
            <template v-if="c.instruction?.canCalculate&&c.instruction.calculationBasis==='water_volume'">
              <label for="dosage-area">Diện tích mặt nước ao (m²)</label><input id="dosage-area" v-model="c.inputs.areaM2" inputmode="decimal" maxlength="48" :aria-invalid="!!c.errors.areaM2" aria-describedby="dosage-area-error" />
              <p v-if="c.errors.areaM2" id="dosage-area-error" class="dosage-error" role="alert">{{c.errors.areaM2}}</p>
              <label for="dosage-depth">Độ sâu nước trung bình (m)</label><input id="dosage-depth" v-model="c.inputs.averageDepthM" inputmode="decimal" maxlength="48" :aria-invalid="!!c.errors.averageDepthM" aria-describedby="dosage-depth-error" />
              <p v-if="c.errors.averageDepthM" id="dosage-depth-error" class="dosage-error" role="alert">{{c.errors.averageDepthM}}</p>
            </template>
            <template v-else-if="c.instruction?.canCalculate&&c.instruction.calculationBasis==='feed_mass'">
              <label for="dosage-feed">Khối lượng thức ăn cho lần trộn (kg)</label><input id="dosage-feed" v-model="c.inputs.feedWeightKg" inputmode="decimal" maxlength="48" :aria-invalid="!!c.errors.feedWeightKg" aria-describedby="dosage-feed-error" />
              <p v-if="c.errors.feedWeightKg" id="dosage-feed-error" class="dosage-error" role="alert">{{c.errors.feedWeightKg}}</p>
            </template>
            <p class="dosage-help">Nhập số không có dấu phân cách hàng nghìn; số thập phân có thể dùng dấu phẩy hoặc dấu chấm.</p>
            <button type="submit" class="dosage-primary" :disabled="!c.instruction?.canCalculate||c.calculating||c.detailLoading" :aria-busy="c.calculating">{{c.calculating?'Đang tính…':'Tính liều lượng'}}</button>
            <p v-if="c.calculationError" class="dosage-error" role="alert">{{c.calculationError}} Bạn có thể kiểm tra và nhấn tính lại.</p>
          </form>
        </template>
        <p v-else-if="!c.detailLoading&&!c.detailError" class="dosage-help">Chọn một sản phẩm để xem các mục đích sử dụng đã được khai báo.</p>
      </section>
      <section class="dosage-panel dosage-results" aria-label="Kết quả tính liều" :aria-busy="c.calculating">
        <h2>Kết quả tính toán</h2>
        <p v-if="c.calculating" role="status">Đang tính từ dữ liệu sản phẩm mới nhất…</p>
        <div v-else-if="c.result" class="dosage-result" aria-live="polite">
          <h3>{{c.result.product.name}}</h3><p>{{c.result.instruction.purpose}}</p>
          <dl class="dosage-facts">
            <template v-if="c.result.calculationBasis==='water_volume'"><div><dt>Diện tích đã nhập</dt><dd>{{number(c.result.inputs.areaM2)}} m²</dd></div><div><dt>Độ sâu trung bình đã nhập</dt><dd>{{number(c.result.inputs.averageDepthM)}} m</dd></div><div><dt>Thể tích nước tính được</dt><dd data-result="volume">{{number(c.result.pondVolumeM3)}} m³ · {{number(c.result.pondVolumeLitres)}} L</dd></div></template>
            <div v-else><dt>Thức ăn cho lần trộn</dt><dd>{{number(c.result.feedWeightKg)}} kg</dd></div>
            <div><dt>Giá bán một {{c.result.product.unit}}</dt><dd>{{money(c.result.pricePerPackage)}}</dd></div>
            <div><dt>Tồn khả dụng</dt><dd>{{number(c.result.availableStock)}} {{c.result.product.unit}}</dd></div>
          </dl>
          <p class="dosage-text">{{dosageText(c.result.instruction)}}</p>
          <div class="dosage-levels"><article v-for="item in levels" :key="item.key" :data-level="item.key">
            <h3>{{item.label}}</h3><p class="dosage-quantity" :data-result="'required-'+item.key">{{number(c.result.requiredDosage[item.key])}} {{c.result.requiredDosage.unit}}</p><p>Lượng chế phẩm cần dùng</p>
            <template v-if="c.result.packagesRequired"><dl class="dosage-facts"><div><dt>Số đơn vị cần mua</dt><dd :data-result="'packages-'+item.key">{{number(c.result.packagesRequired[item.key])}} {{c.result.product.unit}}</dd></div><div><dt>Tổng lượng mua theo quy cách</dt><dd>{{number(c.result.purchasedQuantity[item.key])}} {{c.result.purchasedQuantity.unit}}</dd></div><div><dt>Dư lý thuyết</dt><dd>{{number(c.result.theoreticalRemainder[item.key])}} {{c.result.theoreticalRemainder.unit}}</dd></div><div><dt>Chi phí dự kiến</dt><dd :data-result="'cost-'+item.key">{{c.result.estimatedCost?money(c.result.estimatedCost[item.key]):'Chưa có giá để tính chi phí'}}</dd></div></dl></template>
          </article></div>
          <p v-if="c.result.packagingUnavailableReason" class="dosage-notice" role="status">{{c.result.packagingUnavailableReason}}</p>
          <p v-if="c.result.packaging">Quy cách tính: {{number(c.result.packaging.quantityPerPackage)}} {{c.result.packaging.unit}} / {{c.result.packaging.packageLabel}}.</p>
          <p class="dosage-help">{{c.result.remainderNote}}</p>
          <section v-if="c.result.packagesRequired" class="dosage-purchase" aria-label="Chọn số lượng mua">
            <fieldset v-if="c.result.isRange"><legend>Chọn mức để xác định số lượng mua</legend><label><input v-model="c.level" type="radio" value="min" name="dosage-purchase-level" /> Mua đủ cho mức thấp: {{number(c.result.packagesRequired.min)}} {{c.result.product.unit}}</label><label><input v-model="c.level" type="radio" value="max" name="dosage-purchase-level" /> Mua đủ cho mức cao: {{number(c.result.packagesRequired.max)}} {{c.result.product.unit}}</label><p>Mua đủ cho giới hạn trên không có nghĩa mức liều cao là khuyến nghị mặc định.</p></fieldset>
            <template v-if="c.level">
              <p v-if="c.targetQuantity>c.result.availableStock" class="dosage-warning" role="status">Cần {{number(c.targetQuantity)}} {{c.result.product.unit}} để đáp ứng lượng đã tính, hiện chỉ còn {{number(c.result.availableStock)}} {{c.result.product.unit}} có thể bán.</p>
              <label for="dosage-purchase-quantity">Số {{c.result.product.unit}} muốn thêm vào giỏ</label><input id="dosage-purchase-quantity" v-model="c.purchaseQuantity" type="number" min="1" step="1" inputmode="numeric" />
              <p v-if="c.purchase.quantity(c.result.product)>0" class="dosage-help">Đã có {{c.purchase.quantity(c.result.product)}} trong giỏ. Có thể thêm tối đa {{c.purchase.maximum(c.result.product)}} {{c.result.product.unit}}.</p>
              <label v-if="c.partialPurchase" class="dosage-warning"><input v-model="c.partialConfirmed" type="checkbox" /> Tôi chọn mua một phần; số lượng này chưa đáp ứng đủ {{number(c.targetQuantity)}} {{c.result.product.unit}} đã tính.</label>
              <button type="button" class="dosage-primary" :disabled="!c.canAdd" @click="c.addToCart">Thêm vào giỏ hàng</button>
            </template>
          </section>
          <div class="dosage-actions"><RouterLink :to="productPath(c.result.product || { productId: c.result.productId })">Xem chi tiết sản phẩm</RouterLink><button type="button" :disabled="c.calculating" @click="c.calculate">Tính lại với giá và tồn mới nhất</button></div>
          <p class="dosage-help">{{c.result.priceNote}}</p><p class="dosage-help">{{c.result.disclaimer}}</p>
        </div>
        <p v-else class="dosage-placeholder">Kết quả sẽ hiển thị sau khi bạn tính theo sản phẩm và thông số hiện tại. Khi thay đổi đầu vào, cần tính lại.</p>
        <div v-if="c.purchase.state.error||c.purchase.state.success" :role="c.purchase.state.error?'alert':'status'"><p>{{c.purchase.state.error||c.purchase.state.success}}</p><template v-if="c.purchase.state.uncertain"><button type="button" :disabled="!!c.purchase.state.busy" @click="c.purchase.refresh">Tải lại giỏ để đối soát</button><button v-if="c.purchase.state.fresh" type="button" @click="c.purchase.acknowledge">Đã kiểm tra, tiếp tục</button></template></div>
      </section>
    </div>
  </div></div>
</template>
<style scoped>
.dosage-page { padding: var(--space-6) 0 var(--space-8); font: 400 16px/1.6 var(--font-body); color: var(--ink); }.dosage-intro { max-width: 850px; margin: var(--space-4) 0 var(--space-6); }.dosage-intro h1 { font: 800 var(--text-page)/1.18 var(--font-display); line-height: 1.2; margin: 10px 0 16px; }.dosage-eyebrow { text-transform: uppercase; letter-spacing: .12em; font-size: 13px; }.dosage-layout { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap: var(--space-6); align-items: start; }.dosage-panel { min-width: 0; padding: var(--space-4); border: 1px solid var(--border); border-radius: var(--radius-card); background: var(--surface); }.dosage-panel h2 { font-size: 22px; margin: 0 0 18px; }.dosage-panel h3 { font-size: 18px; }.dosage-panel p { line-height: 1.65; overflow-wrap: anywhere; }.dosage-panel label { display: block; margin: var(--space-3) 0 var(--space-2); font-size: 14px; font-weight: 600; }.dosage-panel input:not([type="checkbox"]):not([type="radio"]),.dosage-panel select { width: 100%; min-width: 0; max-width: 100%; min-height: 44px; padding: 8px 12px; border: 1px solid var(--input-border); border-radius: var(--radius-input); color: inherit; background: var(--surface); font: inherit; }.dosage-panel input[type="checkbox"],.dosage-panel input[type="radio"] { width: auto; margin-right: 7px; }.dosage-panel button { min-height: 44px; padding: 8px 12px; border: 1px solid var(--input-border); border-radius: var(--radius-input); background: var(--mist); color: var(--ink); font: inherit; cursor: pointer; }.dosage-panel button:disabled { opacity: .55; cursor: default; }.dosage-panel .dosage-primary { background: var(--sage); color: var(--on-primary); margin: var(--space-3) 0 5px; }.dosage-filter-grid { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap: 12px; }.dosage-products { list-style: none; padding: 0; display: grid; gap: 8px; max-height: 220px; overflow-y: auto; margin: 16px 0; }.dosage-products li { min-width: 0; }.dosage-panel .dosage-product-option { display: flex; width: 100%; align-items: center; gap: 12px; text-align: left; background: var(--surface); }.dosage-product-option[aria-pressed="true"] { border-color: var(--sage); background: var(--sage-tint); }.dosage-product-option :deep(img),.dosage-product-option :deep(.image-placeholder) { width: 56px; height: 64px; flex-shrink: 0; object-fit: contain; }.dosage-product-option span { min-width: 0; overflow-wrap: anywhere; }.dosage-product-option small { display: block; margin-top: 4px; font-size: 13px; font-weight: 400; }.dosage-pagination { display: flex; align-items: center; gap: 10px; justify-content: space-between; }.dosage-selected,.dosage-notice { margin: var(--space-3) 0; padding: 14px; border-radius: var(--radius-input); background: var(--mist); }.dosage-text { white-space: pre-line; overflow-wrap: anywhere; }.dosage-form { margin-top: var(--space-4); }.dosage-help { font-size: 13px; color: var(--text-secondary); }.dosage-error { color: var(--danger); font-size: 14px; }.dosage-warning { padding: 12px; background: var(--warning-soft); border-radius: var(--radius-input); color: var(--warning); }.dosage-facts { margin: var(--space-3) 0; }.dosage-facts div { display: flex; justify-content: space-between; gap: 14px; padding: 9px 0; border-bottom: 1px solid var(--border); }.dosage-facts dt { font-size: 14px; font-weight: 500; }.dosage-facts dd { margin: 0; text-align: right; font-weight: 600; overflow-wrap: anywhere; }.dosage-levels { display: grid; grid-template-columns: repeat(auto-fit,minmax(min(100%,210px),1fr)); gap: 14px; margin: var(--space-4) 0; }.dosage-levels article { border: 1px solid var(--border); border-radius: var(--radius-input); padding: 16px; background: var(--mist); }.dosage-levels .dosage-quantity { font-size: 26px; font-weight: 700; margin: 12px 0 0; }.dosage-purchase { border-top: 1px solid var(--border); padding-top: 14px; }.dosage-purchase fieldset { min-width: 0; padding: 12px; border: 1px solid var(--border); border-radius: var(--radius-input); }.dosage-purchase legend { float:none; width:auto; font-size:16px; }.dosage-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 14px; margin: var(--space-4) 0; }.dosage-placeholder { padding: var(--space-6) 0; color: var(--text-secondary); }
@media(max-width:900px) { .dosage-layout { grid-template-columns: minmax(0,1fr); }.dosage-panel { padding: 20px; } }
@media(max-width:480px) { .dosage-page { padding-top: 18px; }.dosage-panel { padding: 16px; }.dosage-filter-grid { grid-template-columns: minmax(0,1fr); gap: 0; }.dosage-facts div { flex-wrap: wrap; }.dosage-facts dd { text-align: left; }.dosage-pagination { flex-wrap: wrap; }.dosage-panel .dosage-primary { width: 100%; } }
.dosage-panel :focus-visible { outline:var(--focus-width) solid var(--focus); outline-offset:var(--focus-offset); }
.dosage-panel button:hover:not(:disabled) { border-color:var(--sage); }
@media(min-width:901px) { .dosage-results { position:sticky; top:calc(var(--header-h) + var(--space-4)); } }
</style>
