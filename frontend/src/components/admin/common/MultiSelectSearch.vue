<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";

const props = defineProps({
  items: {
    type: Array,
    default: () => [],
  },
  selectedIds: {
    type: Array,
    default: () => [],
  },
  labelKey: {
    type: String,
    default: "name",
  },
  valueKey: {
    type: String,
    default: "_id",
  },
  searchKeys: {
    type: Array,
    default: () => ["name"],
  },
  placeholder: {
    type: String,
    default: "Tìm kiếm...",
  },
  multiple: {
    type: Boolean,
    default: true,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  codeKey: {
    type: String,
    default: "",
  },
  groupKey: {
    type: String,
    default: "",
  },
  groupLabelKey: {
    type: String,
    default: "",
  },
  helperText: {
    type: String,
    default: "",
  },
  emptyText: {
    type: String,
    default: "Không có dữ liệu phù hợp",
  },
  maxVisible: {
    type: Number,
    default: 80,
  },
  largeThreshold: {
    type: Number,
    default: 100,
  },
});

const emit = defineEmits(["update:selectedIds", "change"]);

const rootRef = ref(null);
const searchInputRef = ref(null);
const search = ref("");
const debouncedSearch = ref("");
const isOpen = ref(false);
const highlightedIndex = ref(-1);
let debounceTimer = null;

function normalizeId(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value.$oid) return value.$oid;
  return String(value);
}

function readValue(item, key) {
  if (!item || !key) return "";
  return key.split(".").reduce((result, part) => result?.[part], item) ?? "";
}

function selectedSetFrom(ids = props.selectedIds) {
  return new Set((ids || []).map(normalizeId).filter(Boolean));
}

function updateSelection(ids) {
  const nextIds = [...new Set(ids.map(normalizeId).filter(Boolean))];
  emit("update:selectedIds", nextIds);
  emit("change", nextIds);
}

const normalizedItems = computed(() =>
  props.items
    .map((item, index) => {
      const value = normalizeId(readValue(item, props.valueKey) || item.id);
      if (!value) return null;

      const label = String(readValue(item, props.labelKey) || item.name || "Mục chưa đặt tên");
      const code = String(readValue(item, props.codeKey) || "").trim();
      const groupLabel = String(
        readValue(item, props.groupLabelKey) ||
          readValue(item, props.groupKey) ||
          "Khác",
      );
      const searchText = [
        label,
        code,
        groupLabel,
        ...props.searchKeys.map((key) => readValue(item, key)),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return {
        index,
        value,
        label,
        code,
        groupLabel,
        searchText,
        item,
      };
    })
    .filter(Boolean),
);

const selectedOptions = computed(() => {
  const optionMap = new Map(normalizedItems.value.map((item) => [item.value, item]));
  return (props.selectedIds || []).map((id) => {
    const value = normalizeId(id);
    return optionMap.get(value) || {
      value,
      label: "Mục đã chọn",
      code: "",
      groupLabel: "",
    };
  });
});

const filteredOptions = computed(() => {
  const q = debouncedSearch.value.trim().toLowerCase();
  if (!q && normalizedItems.value.length > props.largeThreshold) {
    const selected = selectedSetFrom();
    return normalizedItems.value.filter((item) => selected.has(item.value));
  }

  if (!q) return normalizedItems.value;
  return normalizedItems.value.filter((item) => item.searchText.includes(q));
});

const visibleOptions = computed(() =>
  filteredOptions.value
    .slice(0, Math.max(1, props.maxVisible))
    .map((option, visibleIndex) => ({ ...option, visibleIndex })),
);

const hiddenCount = computed(() =>
  Math.max(0, filteredOptions.value.length - visibleOptions.value.length),
);

const selectedCount = computed(() => props.selectedIds.length);

const groupedOptions = computed(() => {
  const groups = [];
  const groupMap = new Map();

  visibleOptions.value.forEach((option) => {
    const key = props.groupKey || props.groupLabelKey ? option.groupLabel : "";
    if (!groupMap.has(key)) {
      const group = { key, label: key, options: [] };
      groupMap.set(key, group);
      groups.push(group);
    }
    groupMap.get(key).options.push(option);
  });

  return groups;
});

const showLargeHint = computed(
  () => normalizedItems.value.length > props.largeThreshold && !debouncedSearch.value.trim(),
);

watch(search, (value) => {
  window.clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(() => {
    debouncedSearch.value = value;
    highlightedIndex.value = filteredOptions.value.length ? 0 : -1;
  }, 160);
});

watch(
  () => props.items,
  () => {
    highlightedIndex.value = filteredOptions.value.length ? 0 : -1;
  },
);

function openDropdown() {
  if (props.disabled) return;
  isOpen.value = true;
  nextTick(() => searchInputRef.value?.focus());
}

function closeDropdown() {
  isOpen.value = false;
  highlightedIndex.value = -1;
}

function toggleOption(option) {
  if (props.disabled || !option) return;

  if (!props.multiple) {
    updateSelection([option.value]);
    closeDropdown();
    return;
  }

  const selected = selectedSetFrom();
  if (selected.has(option.value)) selected.delete(option.value);
  else selected.add(option.value);
  updateSelection([...selected]);
}

function removeOption(value) {
  const selected = selectedSetFrom();
  selected.delete(normalizeId(value));
  updateSelection([...selected]);
}

function clearSelection() {
  updateSelection([]);
}

function selectFiltered() {
  const selected = selectedSetFrom();
  filteredOptions.value.forEach((option) => selected.add(option.value));
  updateSelection([...selected]);
}

function selectGroup(group) {
  const selected = selectedSetFrom();
  filteredOptions.value
    .filter((option) => option.groupLabel === group.label)
    .forEach((option) => selected.add(option.value));
  updateSelection([...selected]);
}

function isSelected(value) {
  return selectedSetFrom().has(normalizeId(value));
}

function displayLabel(option) {
  return [option.code, option.label].filter(Boolean).join(" - ");
}

function handleKeydown(event) {
  if (props.disabled) return;

  if (!isOpen.value && ["ArrowDown", "Enter"].includes(event.key)) {
    event.preventDefault();
    openDropdown();
    return;
  }

  if (event.key === "Escape") {
    event.preventDefault();
    closeDropdown();
    return;
  }

  if (!isOpen.value) return;

  if (event.key === "ArrowDown") {
    event.preventDefault();
    highlightedIndex.value = Math.min(
      visibleOptions.value.length - 1,
      highlightedIndex.value + 1,
    );
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    highlightedIndex.value = Math.max(0, highlightedIndex.value - 1);
  }

  if (event.key === "Enter") {
    event.preventDefault();
    toggleOption(visibleOptions.value[highlightedIndex.value]);
  }
}

function handleClickOutside(event) {
  if (!rootRef.value || rootRef.value.contains(event.target)) return;
  closeDropdown();
}

onMounted(() => {
  document.addEventListener("mousedown", handleClickOutside);
});

onBeforeUnmount(() => {
  document.removeEventListener("mousedown", handleClickOutside);
  window.clearTimeout(debounceTimer);
});
</script>

<template>
  <div ref="rootRef" class="multi-select-search" :class="{ 'is-disabled': disabled }">
    <div
      class="multi-select-search__control"
      :class="{ 'is-open': isOpen }"
      role="combobox"
      :aria-expanded="isOpen"
      tabindex="0"
      @click="openDropdown"
      @keydown="handleKeydown"
    >
      <i class="fa-solid fa-magnifying-glass multi-select-search__icon"></i>
      <input
        ref="searchInputRef"
        v-model="search"
        class="multi-select-search__input"
        type="text"
        :placeholder="placeholder"
        :disabled="disabled"
        @focus="openDropdown"
        @keydown.stop="handleKeydown"
      />
      <span class="multi-select-search__count">{{ selectedCount }} đã chọn</span>
    </div>

    <div v-if="selectedOptions.length" class="multi-select-search__chips">
      <span v-for="option in selectedOptions" :key="option.value" class="multi-select-search__chip">
        {{ displayLabel(option) }}
        <button type="button" aria-label="Bỏ chọn" @click="removeOption(option.value)">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </span>
    </div>

    <div v-if="helperText" class="multi-select-search__helper">{{ helperText }}</div>

    <div v-if="isOpen" class="multi-select-search__dropdown">
      <div class="multi-select-search__actions">
        <button type="button" @click="selectFiltered">
          Chọn tất cả kết quả ({{ filteredOptions.length }})
        </button>
        <button type="button" @click="clearSelection">Bỏ chọn tất cả</button>
      </div>

      <div v-if="loading" class="multi-select-search__empty">Đang tải dữ liệu...</div>
      <div v-else-if="showLargeHint" class="multi-select-search__empty">
        Nhập từ khóa để tìm trong {{ normalizedItems.length }} mục. Các mục đã chọn vẫn hiển thị ở trên.
      </div>
      <div v-else-if="!filteredOptions.length" class="multi-select-search__empty">
        {{ emptyText }}
      </div>
      <div v-else class="multi-select-search__list" role="listbox" aria-multiselectable="true">
        <template v-for="group in groupedOptions" :key="group.key || 'ungrouped'">
          <div v-if="group.label" class="multi-select-search__group">
            <span>{{ group.label }}</span>
            <button type="button" @click="selectGroup(group)">Chọn nhóm</button>
          </div>
          <button
            v-for="option in group.options"
            :key="option.value"
            type="button"
            class="multi-select-search__option"
            :class="{
              'is-selected': isSelected(option.value),
              'is-highlighted': visibleOptions[highlightedIndex]?.value === option.value,
            }"
            role="option"
            :aria-selected="isSelected(option.value)"
            @mouseenter="highlightedIndex = option.visibleIndex"
            @click="toggleOption(option)"
          >
            <span class="multi-select-search__check">
              <i v-if="isSelected(option.value)" class="fa-solid fa-check"></i>
            </span>
            <span class="multi-select-search__option-main">
              <strong>{{ displayLabel(option) }}</strong>
              <small v-if="option.groupLabel">{{ option.groupLabel }}</small>
            </span>
          </button>
        </template>
      </div>

      <div v-if="hiddenCount" class="multi-select-search__more">
        Còn {{ hiddenCount }} kết quả. Nhập thêm từ khóa để lọc nhanh hơn.
      </div>
    </div>
  </div>
</template>

<style scoped>
.multi-select-search {
  position: relative;
  width: 100%;
}

.multi-select-search.is-disabled {
  opacity: 0.65;
  pointer-events: none;
}

.multi-select-search__control {
  align-items: center;
  background: #fff;
  border: 1px solid #d7dde8;
  border-radius: 8px;
  display: flex;
  gap: 10px;
  min-height: 44px;
  padding: 8px 12px;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.multi-select-search__control.is-open,
.multi-select-search__control:focus-within {
  border-color: #4f7cff;
  box-shadow: 0 0 0 3px rgba(79, 124, 255, 0.14);
}

.multi-select-search__icon {
  color: #7d8798;
  flex: 0 0 auto;
}

.multi-select-search__input {
  border: 0;
  flex: 1;
  min-width: 120px;
  outline: 0;
}

.multi-select-search__count {
  background: #eef3ff;
  border-radius: 999px;
  color: #3357b7;
  flex: 0 0 auto;
  font-size: 12px;
  font-weight: 700;
  padding: 4px 10px;
}

.multi-select-search__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.multi-select-search__chip {
  align-items: center;
  background: #f3f6fb;
  border: 1px solid #dfe6f2;
  border-radius: 999px;
  color: #263449;
  display: inline-flex;
  font-size: 13px;
  gap: 8px;
  max-width: 100%;
  padding: 6px 10px;
}

.multi-select-search__chip button {
  align-items: center;
  background: transparent;
  border: 0;
  color: #69758a;
  display: inline-flex;
  height: 18px;
  justify-content: center;
  padding: 0;
  width: 18px;
}

.multi-select-search__chip button:hover {
  color: #d93025;
}

.multi-select-search__helper {
  color: #6d7789;
  font-size: 12px;
  margin-top: 6px;
}

.multi-select-search__dropdown {
  background: #fff;
  border: 1px solid #dfe6f2;
  border-radius: 10px;
  box-shadow: 0 18px 44px rgba(15, 23, 42, 0.18);
  left: 0;
  margin-top: 8px;
  overflow: hidden;
  position: absolute;
  right: 0;
  top: 100%;
  z-index: 1200;
}

.multi-select-search__actions {
  align-items: center;
  border-bottom: 1px solid #edf1f7;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px;
}

.multi-select-search__actions button,
.multi-select-search__group button {
  background: #f7f9fc;
  border: 1px solid #dfe6f2;
  border-radius: 6px;
  color: #2f405f;
  font-size: 12px;
  font-weight: 700;
  padding: 6px 9px;
}

.multi-select-search__actions button:hover,
.multi-select-search__group button:hover {
  background: #edf3ff;
  border-color: #b8c9ff;
}

.multi-select-search__empty {
  color: #69758a;
  line-height: 1.5;
  padding: 16px;
}

.multi-select-search__list {
  max-height: min(360px, 44vh);
  overflow-y: auto;
  overscroll-behavior: contain;
}

.multi-select-search__group {
  align-items: center;
  background: #f8fafc;
  border-bottom: 1px solid #edf1f7;
  border-top: 1px solid #edf1f7;
  color: #526078;
  display: flex;
  font-size: 12px;
  font-weight: 800;
  justify-content: space-between;
  letter-spacing: 0;
  padding: 8px 10px;
}

.multi-select-search__option {
  align-items: center;
  background: #fff;
  border: 0;
  border-bottom: 1px solid #f0f3f8;
  color: #263449;
  display: flex;
  gap: 10px;
  min-height: 46px;
  padding: 9px 12px;
  text-align: left;
  width: 100%;
}

.multi-select-search__option:hover,
.multi-select-search__option.is-highlighted {
  background: #f5f8ff;
}

.multi-select-search__option.is-selected {
  background: #eef5ff;
}

.multi-select-search__check {
  align-items: center;
  border: 1px solid #b8c4d8;
  border-radius: 5px;
  color: #2563eb;
  display: inline-flex;
  flex: 0 0 auto;
  height: 20px;
  justify-content: center;
  width: 20px;
}

.multi-select-search__option-main {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.multi-select-search__option-main strong,
.multi-select-search__option-main small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.multi-select-search__option-main small {
  color: #6d7789;
}

.multi-select-search__more {
  background: #fbfcfe;
  border-top: 1px solid #edf1f7;
  color: #69758a;
  font-size: 12px;
  padding: 9px 12px;
}

@media (max-width: 640px) {
  .multi-select-search__control {
    align-items: stretch;
    flex-wrap: wrap;
  }

  .multi-select-search__input {
    flex-basis: calc(100% - 32px);
  }

  .multi-select-search__count {
    margin-left: 28px;
  }

  .multi-select-search__dropdown {
    position: fixed;
    inset: auto 12px 12px;
    max-height: 72vh;
  }
}
</style>
