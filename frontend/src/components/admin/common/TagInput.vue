<script setup>
import { computed, ref } from "vue";
import { normalizeNewsTags } from "@/utils/news-tags.util";

const props = defineProps({
  modelValue: { type: [Array, String], default: () => [] },
  id: { type: String, required: true },
  disabled: Boolean,
});
const emit = defineEmits(["update:modelValue"]);
const tags = computed(() => normalizeNewsTags(props.modelValue));
const draft = ref("");
const inputRef = ref(null);
const composing = ref(false);

function commit() {
  if (props.disabled || composing.value) return tags.value;
  const next = normalizeNewsTags([...tags.value, draft.value]);
  emit("update:modelValue", next);
  draft.value = "";
  return next;
}

function handleInput(event) {
  draft.value = event.target.value;
  if (!composing.value && !event.isComposing && /[,;]/u.test(draft.value)) commit();
}

function handleKeydown(event) {
  if (composing.value || event.isComposing || event.keyCode === 229) return;
  if (["Enter", ",", ";"].includes(event.key)) {
    event.preventDefault();
    commit();
  }
}

function remove(index) {
  if (props.disabled) return;
  emit("update:modelValue", tags.value.filter((_, itemIndex) => itemIndex !== index));
  inputRef.value?.focus();
}

defineExpose({ commit });
</script>

<template>
  <div class="tag-input">
    <div class="admin-form__control tag-input__control" :class="{ 'tag-input__control--disabled': disabled }">
      <ul v-if="tags.length" class="tag-input__chips" aria-label="Các tag đã thêm">
        <li v-for="(tag, index) in tags" :key="tag" class="tag-input__chip">
          <span>{{ tag }}</span>
          <button type="button" :disabled="disabled" :aria-label="`Xóa tag ${tag}`" @click="remove(index)">
            <i class="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </li>
      </ul>
      <input
        :id="id" ref="inputRef" :value="draft" type="text" :disabled="disabled"
        :aria-describedby="`${id}-help`" placeholder="Nhập tag rồi nhấn Enter"
        autocomplete="off" @input="handleInput" @keydown="handleKeydown" @blur="commit"
        @compositionstart="composing = true"
        @compositionend="composing = false; handleInput($event)"
      />
    </div>
    <p :id="`${id}-help`" class="tag-input__help">Nhấn Enter, dấu phẩy hoặc dấu chấm phẩy để thêm tag.</p>
  </div>
</template>

<style scoped>
.tag-input { min-width: 0; }
.tag-input__control { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.tag-input__control:focus-within { border-color: #80bdff; }
.tag-input__chips { display: contents; list-style: none; padding: 0; margin: 0; }
.tag-input__chip { display: inline-flex; align-items: center; gap: 4px; max-width: 100%; padding: 2px 4px 2px 8px; border-radius: 999px; background: #eef2ff; color: #3730a3; font-size: 12px; }
.tag-input__chip > span { min-width: 0; overflow-wrap: anywhere; }
.tag-input__chip button { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; width: 28px; height: 28px; padding: 0; color: inherit; background: transparent; border: 0; border-radius: 50%; cursor: pointer; }
.tag-input__chip button:hover { background: #e0e7ff; }
.tag-input__chip button:focus-visible { outline: 2px solid currentColor; outline-offset: 1px; }
.tag-input__control input { flex: 1 1 160px; min-width: 0; max-width: 100%; padding: 4px 0; color: inherit; font: inherit; border: 0; background: transparent; outline: none; }
.tag-input__help { margin: 6px 0 0; color: #7b8ea5; font-size: 12px; }
.tag-input__control--disabled { opacity: .65; }
.tag-input__chip button:disabled { cursor: default; }
</style>
