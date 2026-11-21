<script setup>
import { computed, nextTick, ref } from "vue";
import { slugFromName } from "@/utils/slug.util";

const props = defineProps({
  id: { type: String, required: true },
  modelValue: { type: String, default: "" },
  options: { type: Array, required: true },
  error: { type: String, default: "" },
});
const emit = defineEmits(["update:modelValue"]);

const input = ref(null);
const query = ref("");
const open = ref(false);
const activeIndex = ref(-1);
const selected = computed(() => props.options.find((option) => option.id === props.modelValue));
const matches = computed(() => {
  const term = slugFromName(query.value).replaceAll("-", "");
  return props.options.filter((option) => !option.disabled && option.searchText.includes(term));
});
const activeOption = computed(() => matches.value[activeIndex.value]);
const inputValue = computed({
  get: () => open.value ? query.value : selected.value?.label || "",
  set(value) {
    query.value = value;
    open.value = true;
    activeIndex.value = -1;
  },
});

function closePicker() {
  open.value = false;
  query.value = "";
  activeIndex.value = -1;
}

function selectOption(option) {
  emit("update:modelValue", option.id);
  closePicker();
}

function clearSelection() {
  emit("update:modelValue", "");
  closePicker();
  input.value?.focus();
}

async function handleKeydown(event) {
  if (event.isComposing) return;
  switch (event.key) {
    case "Escape":
      if (!open.value) return;
      event.preventDefault();
      event.stopPropagation();
      closePicker();
      return;
    case "Enter":
      event.preventDefault();
      if (open.value && activeOption.value) selectOption(activeOption.value);
      else open.value = true;
      return;
    case "ArrowDown":
    case "ArrowUp": {
      event.preventDefault();
      open.value = true;
      const last = matches.value.length - 1;
      if (last < 0) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      activeIndex.value = activeIndex.value === -1 && step === -1
        ? last : Math.max(0, Math.min(last, activeIndex.value + step));
      await nextTick();
      if (open.value && activeOption.value) {
        document.getElementById(`${props.id}-option-${activeOption.value.id}`)
          ?.scrollIntoView?.({ block: "nearest" });
      }
      return;
    }
  }
}
</script>

<template>
  <div class="inventory-picker">
    <div class="inventory-picker__control">
      <input
        :id="id"
        ref="input"
        v-model="inputValue"
        type="text"
        class="admin-form__control inventory-picker__input"
        :class="{ 'is-invalid': error }"
        placeholder="Tìm theo mã hoặc tên hàng kho"
        autocomplete="off"
        role="combobox"
        aria-autocomplete="list"
        :aria-expanded="open"
        :aria-controls="open ? id + '-options' : undefined"
        :aria-activedescendant="open && activeOption ? id + '-option-' + activeOption.id : undefined"
        :aria-invalid="error ? true : undefined"
        :aria-describedby="error ? id + '-error' : undefined"
        @focus="open = true"
        @click="open = true"
        @blur="closePicker"
        @keydown="handleKeydown"
      />
      <button
        v-if="modelValue"
        type="button"
        class="inventory-picker__clear"
        aria-label="Bỏ chọn hàng kho"
        @click="clearSelection"
      ><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
      <div v-if="open" class="inventory-picker__results">
        <ul :id="id + '-options'" role="listbox" aria-label="Hàng kho có thể chọn">
          <li
            v-for="(option, index) in matches"
            :id="id + '-option-' + option.id"
            :key="option.id"
            role="option"
            :aria-selected="option.id === modelValue"
            :class="{ 'is-highlighted': index === activeIndex }"
            @mousedown.prevent
            @click="selectOption(option)"
          >{{ option.label }}</li>
        </ul>
        <p v-if="!matches.length" role="status">Không tìm thấy hàng kho phù hợp.</p>
      </div>
    </div>
    <div v-if="error" :id="id + '-error'" class="admin-form__error">{{ error }}</div>
  </div>
</template>

<style scoped>
.inventory-picker,
.inventory-picker__control {
  min-width: 0;
}

.inventory-picker__control {
  position: relative;
}

.inventory-picker__input {
  padding-inline-end: 38px;
}

.inventory-picker__input:focus {
  outline: 2px solid var(--admin-primary, #2563eb);
  outline-offset: 1px;
}

.inventory-picker__clear {
  position: absolute;
  inset-block: 1px;
  inset-inline-end: 1px;
  width: 36px;
  border: 0;
  background: transparent;
  color: var(--admin-text);
}

.inventory-picker__results {
  position: absolute;
  z-index: 2;
  inset-inline: 0;
  inset-block-start: calc(100% + 4px);
  max-height: min(264px, 45vh);
  overflow: auto;
  border: 1px solid var(--admin-border);
  background: #fff;
  box-shadow: 0 8px 20px rgb(15 23 42 / 14%);
}

.inventory-picker__results ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

.inventory-picker__results li,
.inventory-picker__results p {
  margin: 0;
  padding: 10px 12px;
  overflow-wrap: anywhere;
}

.inventory-picker__results li {
  cursor: pointer;
}

.inventory-picker__results li:hover,
.inventory-picker__results li.is-highlighted {
  color: var(--admin-title);
  background: #eaf2ff;
}
</style>
