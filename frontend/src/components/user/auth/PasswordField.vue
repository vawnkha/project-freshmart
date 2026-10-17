<script setup>
import { ref } from "vue";
defineOptions({ inheritAttrs: false });
defineProps({ id: { type: String, required: true }, modelValue: String, autocomplete: String, disabled: Boolean });
defineEmits(["update:modelValue"]);
const visible = ref(false);
</script>
<template>
  <div class="approved-password-field">
    <input v-bind="$attrs" :id="id" :value="modelValue" :type="visible ? 'text' : 'password'" :autocomplete="autocomplete" :disabled="disabled" @input="$emit('update:modelValue', $event.target.value)" />
    <button type="button" :disabled="disabled" :aria-label="visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'" :aria-controls="id" :aria-pressed="visible" @click="visible = !visible">
      <i :class="visible ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye'" aria-hidden="true"></i>
    </button>
  </div>
</template>
