<script setup>
import {computed} from 'vue';
import {productTechnical} from '@/utils/product-technical.util';
import ScientificDensity from './ScientificDensity.vue';
const props=defineProps({product:Object,showNotes:{type:Boolean,default:true}});const data=computed(()=>productTechnical(props.product));
</script>
<template>
  <div class="product-technical-information">
    <section v-if="data.microorganisms.length||data.activeIngredients.length" aria-label="Thành phần chế phẩm">
      <h3>Thành phần chế phẩm</h3>
      <div v-if="data.microorganisms.length" class="technical-table-scroll" tabindex="0" role="region" aria-label="Bảng chủng vi sinh">
        <table class="technical-table"><thead><tr><th scope="col">Chủng vi sinh</th><th scope="col">Mã chủng</th><th scope="col">Mật độ</th><th scope="col">Mật độ bào tử</th></tr></thead><tbody><tr v-for="(row,index) in data.microorganisms" :key="index"><th scope="row">{{row.name||'Chưa công bố tên chủng'}}</th><td>{{row.strainCode||'Chưa công bố'}}</td><td><ScientificDensity :value="row.density" /></td><td><ScientificDensity :value="row.sporeDensity" /></td></tr></tbody></table>
      </div>
      <ul v-if="data.activeIngredients.length" class="technical-ingredients"><li v-for="(row,index) in data.activeIngredients" :key="index"><strong>{{row.name}}</strong><span v-if="row.amount!==undefined&&row.amount!==null&&row.amount!==''">: {{row.amount}}{{row.unit?' '+row.unit:''}}</span><span v-else> — Chưa công bố hàm lượng{{row.unit?' ('+row.unit+')':''}}</span></li></ul>
    </section>
    <section v-if="data.totalDensity||data.sporeDensity" aria-label="Mật độ vi sinh"><h3>Mật độ vi sinh</h3><dl class="pdp-specifications"><div v-if="data.totalDensity"><dt>Mật độ vi sinh tổng</dt><dd><ScientificDensity :value="data.totalDensity" /></dd></div><div v-if="data.sporeDensity"><dt>Mật độ bào tử tổng</dt><dd><ScientificDensity :value="data.sporeDensity" /></dd></div></dl></section>
    <section v-if="showNotes && data.notes" aria-label="Ghi chú kỹ thuật"><h3>Ghi chú kỹ thuật</h3><p class="pdp-field-text">{{data.notes}}</p></section>
  </div>
</template>
<style scoped>
.product-technical-information { min-width:0; }.product-technical-information section+section { margin-top:24px; }.technical-table-scroll { overflow-x:auto; max-width:100%; border:1px solid var(--border); border-radius:10px; }.technical-table { width:100%; min-width:620px; border-collapse:collapse; text-align:left; }.technical-table th,.technical-table td { padding:12px; vertical-align:top; border-bottom:1px solid var(--border); overflow-wrap:anywhere; max-width:300px; }.technical-table thead { background:var(--mist); }.technical-ingredients { padding-left:22px; line-height:1.65; }.technical-ingredients li { overflow-wrap:anywhere; }
</style>
