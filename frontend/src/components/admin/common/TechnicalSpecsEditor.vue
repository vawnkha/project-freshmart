<script setup>
import { ref, watch } from 'vue';
import DensityFields from './DensityFields.vue';
import PackageMeasureFields from './PackageMeasureFields.vue';
import { cleanSpecs, technicalSpecsSchema, packageMeasureSchema } from '@/validators/technical-specs.validator';
import { dosageBasis } from '@/utils/dosage-calculator.util';
const props = defineProps({ modelValue: { type: Object, default: () => ({}) }, packageMeasure: Object, general: Boolean,
  packaging: { type: Boolean, default: true }, packageSize: String, storageInstruction: String, expiryMonths: [String, Number] });
const emit = defineEmits(['update:modelValue','update:packageMeasure','update:packageSize','update:storageInstruction','update:expiryMonths']);
const draft = ref({}), error = ref('');
watch(() => props.modelValue, value => {
  draft.value = { microorganisms: [], activeIngredients: [], purposes: [], dosages: [], ...JSON.parse(JSON.stringify(value || {})) };
  if(typeof draft.value.dosages==='string')draft.value.dosages=[{purpose:'Hướng dẫn cũ',instructions:draft.value.dosages,isActive:false}];
  draft.value.dosages=draft.value.dosages.map(row=>typeof row==='string'?{purpose:'Hướng dẫn cũ',instructions:row,isActive:false}:row);
}, { immediate: true });
function publish() { error.value = ''; emit('update:modelValue', JSON.parse(JSON.stringify(draft.value))); }
function add(key, value) { draft.value[key].push(value); publish(); }
function remove(key, index) { draft.value[key].splice(index, 1); publish(); }
function changeBasis(row,value){
  if(value==='water_volume'&&!['m3_water','L_water'].includes(row.basisUnit))row.basisUnit='m3_water';
  else if(value==='feed_mass'&&!['kg_feed','g_feed'].includes(row.basisUnit))row.basisUnit='kg_feed';
  else if(!value){row.basisUnit='other';row.isActive=false;}
  publish();
}
function validate() {
  const specs = technicalSpecsSchema.safeParse(cleanSpecs(draft.value));
  const measureResult = props.packaging && props.packageMeasure?.value ? packageMeasureSchema.safeParse(props.packageMeasure) : { success: true };
  if (!specs.success || !measureResult.success) {
    const issue = (!specs.success ? specs : measureResult).error.issues[0];
    error.value = `${issue.path.join('.')}: ${issue.message}`; return false;
  }
  if (props.general && props.expiryMonths !== '' && props.expiryMonths != null && (!Number.isFinite(Number(props.expiryMonths)) || Number(props.expiryMonths) < 0 || Number(props.expiryMonths) > 1200)) {
    error.value = 'Thời hạn tham khảo phải từ 0 đến 1200 tháng'; return false;
  }
  return true;
}
defineExpose({ validate });
</script>
<template>
  <section class="technical-editor" aria-label="Thông số kỹ thuật chế phẩm">
    <header class="technical-section-heading"><h3>Thông số kỹ thuật chế phẩm</h3><p>Chỉ nhập số liệu nhà sản xuất công bố. Để trống thông tin chưa có; hệ thống không cộng mật độ các chủng.</p></header>
    <div v-if="general" class="technical-grid technical-general">
      <label>Quy cách mô tả<input :value="packageSize" maxlength="160" @input="emit('update:packageSize', $event.target.value)" /></label>
      <label>Bảo quản<textarea :value="storageInstruction" maxlength="2000" rows="2" @input="emit('update:storageInstruction', $event.target.value)" /></label>
      <label>Thời hạn tham khảo (tháng)<input :value="expiryMonths" type="number" min="0" max="1200" @input="emit('update:expiryMonths', $event.target.value)" /></label>
    </div>
    <PackageMeasureFields v-if="packaging" :model-value="packageMeasure" @update:model-value="emit('update:packageMeasure',$event)" />
    <section class="technical-section" aria-label="Thành phần vi sinh">
      <h4>Thành phần vi sinh</h4>
      <div v-for="(row,index) in draft.microorganisms" :key="index" class="technical-row">
        <div class="technical-row-heading"><h5>Chủng vi sinh {{ index + 1 }}</h5><button type="button" class="technical-remove" :aria-label="'Xóa chủng '+(index+1)" @click="remove('microorganisms',index)"><i class="fa-regular fa-trash-can" aria-hidden="true"></i> Xóa</button></div>
        <div class="technical-grid"><label>Tên chủng vi sinh<input v-model="row.name" maxlength="160" @input="publish" /></label><label>Mã chủng<input v-model="row.strainCode" maxlength="80" @input="publish" /></label></div>
        <div class="technical-density-pair"><DensityFields v-model="row.density" :label="'Mật độ chủng '+(index+1)" @update:model-value="publish" /><DensityFields v-model="row.sporeDensity" :label="'Mật độ bào tử chủng '+(index+1)" @update:model-value="publish" /></div>
      </div>
      <button type="button" :disabled="draft.microorganisms.length>=30" @click="add('microorganisms',{name:'',strainCode:''})">Thêm chủng vi sinh</button>
    </section>
    <section class="technical-section" aria-label="Mật độ tổng"><h4>Mật độ tổng</h4><div class="technical-density-pair"><DensityFields v-model="draft.totalDensity" label="Mật độ vi sinh tổng" @update:model-value="publish" /><DensityFields v-model="draft.sporeDensity" label="Mật độ bào tử tổng" @update:model-value="publish" /></div></section>
    <section class="technical-section" aria-label="Hoạt chất"><h4>Hoạt chất</h4>
      <div v-for="(row,index) in draft.activeIngredients" :key="index" class="technical-ingredient-row">
        <label>Tên hoạt chất<input v-model="row.name" maxlength="160" @input="publish" /></label><label>Hàm lượng<input v-model="row.amount" inputmode="decimal" maxlength="32" @input="publish" /></label><label>Đơn vị hàm lượng<input v-model="row.unit" maxlength="40" @input="publish" /></label>
        <button type="button" class="technical-remove" :aria-label="'Xóa hoạt chất '+(index+1)" @click="remove('activeIngredients',index)"><i class="fa-regular fa-trash-can" aria-hidden="true"></i> Xóa</button>
      </div><button type="button" :disabled="draft.activeIngredients.length>=30" @click="add('activeIngredients',{name:'',amount:'',unit:''})">Thêm hoạt chất</button>
    </section>
    <section class="technical-section" aria-label="Công dụng"><h4>Công dụng</h4>
      <label>Mục đích sử dụng trong nuôi tôm<textarea v-model="draft.applicationPurpose" maxlength="1000" rows="2" @input="publish" /></label>
      <div v-for="(_,index) in draft.purposes" :key="index" class="technical-purpose-row"><label>Công dụng {{ index+1 }}<input v-model="draft.purposes[index]" maxlength="300" @input="publish" /></label><button type="button" class="technical-remove" :aria-label="'Xóa công dụng '+(index+1)" @click="remove('purposes',index)"><i class="fa-regular fa-trash-can" aria-hidden="true"></i> Xóa</button></div>
      <button type="button" :disabled="draft.purposes.length>=20" @click="add('purposes','')">Thêm công dụng</button>
    </section>
    <section class="technical-section" aria-label="Liều lượng và hướng dẫn sử dụng"><h4>Liều lượng và hướng dẫn sử dụng</h4>
      <fieldset v-for="(row,index) in draft.dosages" :key="index" class="technical-dosage"><legend>Liều lượng {{ index+1 }}</legend>
        <div class="technical-dosage-primary">
          <label>Mục đích áp dụng<input v-model="row.purpose" maxlength="300" @input="publish" /></label>
          <label>Loại tính toán<select :value="dosageBasis(row.basisUnit)" @change="changeBasis(row,$event.target.value)"><option value="">Khác / chưa chuẩn hóa</option><option value="water_volume">Theo thể tích nước</option><option value="feed_mass">Theo khối lượng thức ăn</option></select></label>
          <label>Lượng chế phẩm (liều tối thiểu hoặc cố định)<input v-model="row.amount" inputmode="decimal" maxlength="32" @input="publish" /></label>
          <label>Liều tối đa (để trống nếu cố định)<input v-model="row.maxAmount" inputmode="decimal" maxlength="32" @input="publish" /></label>
          <label>Đơn vị chế phẩm<input v-model="row.unit" maxlength="40" placeholder="g, mL…" @input="publish" /></label>
        </div>
        <div class="technical-dosage-basis">
          <label>Lượng môi trường áp dụng<input v-model="row.basisAmount" inputmode="decimal" maxlength="32" placeholder="1000" @input="publish" /></label>
          <label>Môi trường<select v-model="row.basisUnit" @change="publish"><template v-if="dosageBasis(row.basisUnit)==='water_volume'"><option value="m3_water">m³ nước</option><option value="L_water">L nước</option></template><template v-else-if="dosageBasis(row.basisUnit)==='feed_mass'"><option value="kg_feed">kg thức ăn</option><option value="g_feed">g thức ăn</option></template><template v-else><option value="m2_pond">m² ao</option><option value="other">Khác</option></template></select></label>
          <label v-if="row.basisUnit==='other'">Đơn vị áp dụng khác<input v-model="row.basisLabel" maxlength="80" @input="publish" /></label>
          <label>Tần suất sử dụng<input v-model="row.frequency" maxlength="500" @input="publish" /></label>
          <label>Nguồn hướng dẫn<textarea v-model="row.sourceNote" maxlength="2000" rows="1" placeholder="Nhãn sản phẩm hoặc tài liệu nhà sản xuất" @input="publish" /></label>
        </div>
        <label>Hướng dẫn liều dùng<textarea v-model="row.instructions" maxlength="2000" rows="2" @input="publish" /></label>
        <div class="technical-dosage-footer"><label class="technical-checkbox"><input v-model="row.isActive" type="checkbox" @change="publish" /> Cho phép tính tự động</label><button type="button" class="technical-remove" :aria-label="'Xóa liều lượng '+(index+1)" @click="remove('dosages',index)"><i class="fa-regular fa-trash-can" aria-hidden="true"></i> Xóa</button></div>
        <p v-if="!row.isActive" class="technical-help">Hướng dẫn vẫn được lưu và hiển thị; chưa dùng để tính tự động.</p>
      </fieldset>
      <button type="button" :disabled="draft.dosages.length>=30" @click="add('dosages',{purpose:'',amount:'',unit:'g',basisAmount:'1000',basisUnit:'m3_water',instructions:''})">Thêm liều lượng</button>
    </section>
    <section class="technical-section" aria-label="Thông tin bổ sung"><h4>Thông tin bổ sung</h4><label>Hướng dẫn sử dụng chung<textarea v-model="draft.usageInstruction" maxlength="4000" rows="2" @input="publish" /></label><label>Ghi chú kỹ thuật<textarea v-model="draft.notes" maxlength="4000" rows="2" @input="publish" /></label></section>
    <p v-if="error" class="admin-form__error" role="alert">{{ error }}</p>
  </section>
</template>
<style>
/* Admin product editor only. Existing validation and model handlers are unchanged. */
.technical-editor { margin:16px 0; padding:16px; min-width:0; border:1px solid var(--admin-border); border-radius:8px; color:var(--admin-sidebar); font-size:14px; line-height:1.5; }
.technical-editor h3 { margin:0 0 8px; font-size:18px; color:var(--admin-sidebar); }.technical-editor h4 { margin:0 0 12px; font-size:16px; font-weight:600; color:var(--admin-sidebar); }.technical-editor h5 { margin:0; font-size:14px; font-weight:600; }.technical-editor p { margin:8px 0; }.technical-editor .technical-section { margin-top:20px; padding-top:16px; border-top:1px solid var(--admin-border); }
.technical-editor label { display:flex; flex-direction:column; min-width:0; gap:6px; margin:0; font-size:14px; font-weight:500; overflow-wrap:anywhere; }.technical-editor label+label { margin-top:12px; }.technical-editor .technical-grid label,.technical-editor .technical-density-pair label,.technical-editor .package-measure-grid label,.technical-editor .technical-ingredient-row label,.technical-editor .technical-purpose-row label,.technical-editor .technical-dosage-primary label,.technical-editor .technical-dosage-basis label { margin:0; }
.technical-editor input:not([type="checkbox"]),.technical-editor select,.technical-editor textarea { width:100%; min-width:0; max-width:100%; min-height:40px; padding:8px 10px; border:1px solid var(--admin-border); border-radius:5px; background:var(--admin-card); color:var(--admin-sidebar); font-family:inherit; font-size:14px; line-height:1.5; }.technical-editor textarea { resize:vertical; }.technical-editor input[type="checkbox"] { width:16px; height:16px; min-height:0; flex:none; margin:0; }
.technical-editor fieldset { min-width:0; margin:0; padding:12px; border:1px solid var(--admin-border); }.technical-editor legend { float:none; width:auto; max-width:100%; margin-bottom:8px; padding:0 4px; font-size:14px; font-weight:600; overflow-wrap:anywhere; }
.technical-editor .technical-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }.technical-editor .technical-general { grid-template-columns:repeat(3,minmax(0,1fr)); }.technical-editor .technical-density-pair { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; margin:12px 0; }
.technical-editor button { display:inline-flex; align-items:center; justify-content:center; gap:6px; min-height:40px; max-width:100%; margin:8px 0 0; padding:7px 12px; border:1px solid var(--admin-border); border-radius:5px; background:var(--admin-card); color:var(--admin-sidebar); font-family:inherit; font-size:14px; font-weight:500; line-height:1.4; cursor:pointer; }.technical-editor button:hover:not(:disabled) { border-color:var(--admin-accent); background:var(--admin-bg); }.technical-editor :focus-visible { outline:2px solid var(--admin-sidebar); outline-offset:2px; }.technical-editor button:active:not(:disabled) { background:var(--admin-bg); }.technical-editor button:disabled { color:var(--admin-text); opacity:.6; cursor:not-allowed; }
.technical-editor .technical-remove { width:auto; flex:none; margin:0; color:var(--admin-danger); }.technical-editor .technical-remove:hover { border-color:var(--admin-danger); }.technical-editor .technical-row { padding:12px 0; border-bottom:1px solid var(--admin-border); }.technical-editor .technical-row-heading { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:12px; }
.technical-editor .technical-ingredient-row { display:grid; grid-template-columns:minmax(0,2fr) minmax(0,1fr) minmax(0,1fr) auto; align-items:end; gap:12px; margin-bottom:12px; }.technical-editor .technical-purpose-row { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:end; gap:8px; margin-top:12px; }
.technical-editor .technical-dosage { margin:12px 0; }.technical-editor .technical-dosage-primary { display:grid; grid-template-columns:minmax(0,1.6fr) minmax(0,1.4fr) repeat(3,minmax(0,1fr)); align-items:end; gap:12px; margin-bottom:12px; }.technical-editor .technical-dosage-basis { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); align-items:end; gap:12px; margin-bottom:12px; }.technical-editor .technical-dosage-footer { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-top:8px; }.technical-editor .technical-checkbox { display:flex; flex-direction:row; align-items:center; min-height:40px; gap:8px; }.technical-editor .technical-help { font-size:13px; }
@media(max-width:1000px) { .technical-editor .technical-density-pair { grid-template-columns:minmax(0,1fr); }.technical-editor .technical-dosage-primary { grid-template-columns:repeat(3,minmax(0,1fr)); }.technical-editor .technical-dosage-basis { grid-template-columns:repeat(2,minmax(0,1fr)); } }
@media(max-width:650px) { .technical-editor { padding:12px; }.technical-editor .technical-grid,.technical-editor .technical-general,.technical-editor .technical-dosage-primary,.technical-editor .technical-dosage-basis { grid-template-columns:minmax(0,1fr); }.technical-editor .technical-ingredient-row { grid-template-columns:repeat(2,minmax(0,1fr)); }.technical-editor .technical-ingredient-row label:first-child { grid-column:1/-1; }.technical-editor .technical-ingredient-row .technical-remove { justify-self:start; }.technical-editor button,.technical-editor input:not([type="checkbox"]),.technical-editor select { min-height:44px; } }
</style>
