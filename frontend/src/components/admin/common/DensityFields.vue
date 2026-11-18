<script setup>
const props = defineProps({ modelValue: Object, label: { type: String, required: true } });
const emit = defineEmits(['update:modelValue']);
function update(key, value) { emit('update:modelValue', { coefficient: '', exponent: '', unit: 'CFU/g', ...props.modelValue, [key]: value }); }
</script>
<template>
  <fieldset class="density-fields"><legend>{{ label }}</legend>
    <div class="density-inputs">
    <label>Hệ số<input :aria-label="label + ' — hệ số'" :value="modelValue?.coefficient" inputmode="decimal" maxlength="32" placeholder="Ví dụ: 1.25" @input="update('coefficient', $event.target.value)" /></label>
    <label>Số mũ của 10<input :aria-label="label + ' — số mũ'" :value="modelValue?.exponent" type="number" min="-30" max="30" step="1" placeholder="Ví dụ: 9" @input="update('exponent', $event.target.value)" /></label>
    <label>Đơn vị<select :aria-label="label + ' — đơn vị'" :value="modelValue?.unit || 'CFU/g'" @change="update('unit', $event.target.value)"><option v-for="unit in ['CFU/g','CFU/mL','CFU/kg','CFU/L','CFU/unit']" :key="unit">{{ unit }}</option></select></label>
    <button v-if="modelValue" type="button" class="density-clear technical-remove" :aria-label="'Xóa ' + label" :title="'Xóa ' + label" @click="emit('update:modelValue', undefined)"><i class="fa-regular fa-trash-can" aria-hidden="true"></i></button>
    </div>
  </fieldset>
</template>
<style scoped>
.density-fields { min-width:0; }
.density-inputs { display:grid; grid-template-columns:minmax(0,1.7fr) minmax(0,.8fr) minmax(0,1fr) auto; align-items:end; gap:8px; }
.density-inputs > label { min-width:0; }.density-inputs .density-clear { width:40px; min-height:40px; padding:8px; }
@media(max-width:650px) { .density-inputs { grid-template-columns:repeat(2,minmax(0,1fr)); }.density-inputs .density-clear { width:44px; min-height:44px; justify-self:end; } }
</style>
