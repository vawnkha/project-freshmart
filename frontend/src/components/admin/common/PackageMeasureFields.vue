<script setup>
import {ref} from 'vue';
import {packageMeasureSchema} from '@/validators/technical-specs.validator';
const props=defineProps({modelValue:Object});
const emit=defineEmits(['update:modelValue']);
const error=ref('');
function change(key,value){error.value='';emit('update:modelValue',{value:'',unit:'g',...props.modelValue,[key]:value});}
function validate(){const result=props.modelValue?.value?packageMeasureSchema.safeParse(props.modelValue):{success:true};error.value=result.success?'':result.error.issues[0].message;return result.success;}
defineExpose({validate});
</script>
<template>
  <fieldset class="package-measure-fields"><legend>Khối lượng hoặc thể tích trong một đơn vị bán</legend><div class="package-measure-grid">
    <label>Giá trị<input :value="modelValue?.value" aria-label="Lượng đóng gói" inputmode="decimal" maxlength="32" @input="change('value',$event.target.value)" /></label>
    <label>Đơn vị đo<select :value="modelValue?.unit||'g'" aria-label="Đơn vị đóng gói" @change="change('unit',$event.target.value)"><option v-for="unit in ['g','kg','mL','L']" :key="unit">{{unit}}</option></select></label>
  </div><p>Dùng để tính giá/kg, giá/L và số đơn vị cần mua. Không quy đổi khối lượng sang thể tích.</p><p v-if="error" class="admin-form__error" role="alert">{{error}}</p></fieldset>
</template>
<style scoped>
.package-measure-fields { min-width:0; margin:12px 0; padding:12px; border:1px solid var(--admin-border); }.package-measure-fields legend { float:none; width:auto; font-size:14px; }.package-measure-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:12px; }.package-measure-fields label { display:flex; flex-direction:column; gap:6px; }.package-measure-fields input,.package-measure-fields select { width:100%; min-width:0; min-height:40px; padding:8px 10px; font-size:14px; border:1px solid var(--admin-border); border-radius:5px; background:var(--admin-card); color:var(--admin-sidebar); }
</style>
