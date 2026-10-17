<script setup>
import { computed } from 'vue';
import SageButton from '@/components/user/sage/SageButton.vue';
import SageInput from '@/components/user/sage/SageInput.vue';
const props = defineProps({ modelValue: [Number, String], maximum: { type: Number, default: null }, disabled: Boolean, error: String, hint: String });
const emit = defineEmits(['update:modelValue']);
const valid = computed(() => Number.isSafeInteger(Number(props.modelValue)) && Number(props.modelValue) >= 1);
</script>
<template>
  <div class="pdp-quantity">
    <SageButton variant="secondary" class="sage-icon-button" aria-label="Giảm số lượng"
      :disabled="disabled || !valid || Number(modelValue) <= 1" @click="emit('update:modelValue', Number(modelValue) - 1)">−</SageButton>
    <SageInput id="pdp-quantity" label="Số lượng" type="number" inputmode="numeric" min="1" step="1" :max="maximum ?? undefined"
      :model-value="modelValue" :error="error" :hint="hint" :disabled="disabled" required @update:model-value="emit('update:modelValue', $event)" />
    <SageButton variant="secondary" class="sage-icon-button" aria-label="Tăng số lượng"
      :disabled="disabled || !valid || maximum === null || Number(modelValue) >= maximum" @click="emit('update:modelValue', Number(modelValue) + 1)">+</SageButton>
  </div>
</template>
