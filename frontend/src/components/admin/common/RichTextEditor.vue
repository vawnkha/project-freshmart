<script setup>
import { nextTick, onMounted, ref, watch } from "vue";
import uploadService from "@/services/upload.service";

const props = defineProps({
  modelValue: {
    type: String,
    default: "",
  },
  placeholder: {
    type: String,
    default: "Nhập nội dung bài viết...",
  },
  minHeight: {
    type: String,
    default: "460px",
  },
});

const emit = defineEmits(["update:modelValue"]);

const editorRef = ref(null);
const imageInputRef = ref(null);
const uploadingImage = ref(false);
const lastRange = ref(null);

function syncFromModel(value = "") {
  if (!editorRef.value) return;
  if (editorRef.value.innerHTML !== value) {
    editorRef.value.innerHTML = value || "";
  }
}

function emitContent() {
  emit("update:modelValue", editorRef.value?.innerHTML || "");
}

function focusEditor() {
  editorRef.value?.focus();
}

function saveSelection() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  lastRange.value = selection.getRangeAt(0);
}

function restoreSelection() {
  if (!lastRange.value) return;
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(lastRange.value);
}

function runCommand(command, value = null) {
  focusEditor();
  restoreSelection();
  document.execCommand(command, false, value);
  emitContent();
  saveSelection();
}

function setBlock(event) {
  const value = event.target.value;
  if (!value) return;
  runCommand("formatBlock", value);
  event.target.value = "";
}

function setColor(event) {
  runCommand("foreColor", event.target.value);
}

function insertLink() {
  const url = window.prompt("Nhập URL liên kết");
  if (!url) return;
  runCommand("createLink", url.trim());
}

function insertTable() {
  const rows = Math.min(Math.max(Number(window.prompt("Số hàng", "3")) || 3, 1), 20);
  const cols = Math.min(Math.max(Number(window.prompt("Số cột", "3")) || 3, 1), 10);
  const cells = Array.from({ length: cols }, () => "<td>&nbsp;</td>").join("");
  const body = Array.from({ length: rows }, () => `<tr>${cells}</tr>`).join("");
  const html = `<table class="news-editor-table"><tbody>${body}</tbody></table><p><br></p>`;
  runCommand("insertHTML", html);
}

function triggerImageInput() {
  saveSelection();
  imageInputRef.value?.click();
}

function validateImage(file) {
  if (!file) return "";
  const ok = ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type);
  if (!ok) return "Ảnh nội dung chỉ hỗ trợ JPG, PNG, WEBP hoặc GIF";
  if (file.size > 5 * 1024 * 1024) return "Ảnh nội dung tối đa 5MB";
  return "";
}

async function handleImageChange(event) {
  const file = event.target.files?.[0] || null;
  event.target.value = "";
  const message = validateImage(file);
  if (message) {
    alert(message);
    return;
  }
  if (!file) return;

  uploadingImage.value = true;
  try {
    const res = await uploadService.uploadNewsImage(file);
    const url = res.url || res.data?.url;
    if (!url) throw new Error("Upload ảnh không trả về URL");
    runCommand("insertHTML", `<img src="${url}" alt="" />`);
  } catch (error) {
    console.error(error);
    alert(error?.response?.data?.message || "Không thể upload ảnh nội dung");
  } finally {
    uploadingImage.value = false;
  }
}

function handlePaste() {
  nextTick(emitContent);
}

watch(
  () => props.modelValue,
  (value) => {
    if (document.activeElement === editorRef.value) return;
    syncFromModel(value);
  },
);

onMounted(() => syncFromModel(props.modelValue));
</script>

<template>
  <div class="rich-editor">
    <div class="rich-editor__toolbar">
      <select class="rich-editor__select" @change="setBlock">
        <option value="">Định dạng</option>
        <option value="p">Đoạn văn</option>
        <option value="h1">Heading 1</option>
        <option value="h2">Heading 2</option>
        <option value="h3">Heading 3</option>
      </select>

      <button type="button" title="Bold" @click="runCommand('bold')"><strong>B</strong></button>
      <button type="button" title="Italic" @click="runCommand('italic')"><em>I</em></button>
      <button type="button" title="Underline" @click="runCommand('underline')"><u>U</u></button>
      <button type="button" title="Strike" @click="runCommand('strikeThrough')"><s>S</s></button>
      <input class="rich-editor__color" type="color" title="Màu chữ" @input="setColor" />
      <button type="button" title="Căn trái" @click="runCommand('justifyLeft')">Trái</button>
      <button type="button" title="Căn giữa" @click="runCommand('justifyCenter')">Giữa</button>
      <button type="button" title="Căn phải" @click="runCommand('justifyRight')">Phải</button>
      <button type="button" title="Bullet list" @click="runCommand('insertUnorderedList')">• List</button>
      <button type="button" title="Ordered list" @click="runCommand('insertOrderedList')">1. List</button>
      <button type="button" title="Quote" @click="runCommand('formatBlock', 'blockquote')">Quote</button>
      <button type="button" title="Code block" @click="runCommand('formatBlock', 'pre')">Code</button>
      <button type="button" title="Link" @click="insertLink">Link</button>
      <button type="button" title="Table" @click="insertTable">Bảng</button>
      <button type="button" title="Image" :disabled="uploadingImage" @click="triggerImageInput">
        {{ uploadingImage ? "Đang upload..." : "Ảnh" }}
      </button>
      <button type="button" title="Undo" @click="runCommand('undo')">Undo</button>
      <button type="button" title="Redo" @click="runCommand('redo')">Redo</button>
    </div>

    <div
      ref="editorRef"
      class="rich-editor__body"
      contenteditable="true"
      :data-placeholder="placeholder"
      :style="{ minHeight }"
      @input="emitContent"
      @keyup="saveSelection"
      @mouseup="saveSelection"
      @paste="handlePaste"
      @blur="emitContent"
    ></div>

    <input
      ref="imageInputRef"
      class="rich-editor__file"
      type="file"
      accept="image/jpeg,image/png,image/webp,image/gif"
      @change="handleImageChange"
    />
  </div>
</template>

<style scoped>
.rich-editor {
  border: 1px solid #d8dee9;
  border-radius: 8px;
  background: #fff;
  overflow: hidden;
}

.rich-editor__toolbar {
  align-items: center;
  background: #f8fafc;
  border-bottom: 1px solid #d8dee9;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 10px;
}

.rich-editor__toolbar button,
.rich-editor__select {
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  color: #111827;
  min-height: 34px;
  padding: 6px 10px;
}

.rich-editor__toolbar button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.rich-editor__color {
  border: 1px solid #d1d5db;
  border-radius: 6px;
  height: 34px;
  width: 42px;
}

.rich-editor__body {
  color: #111827;
  font-size: 15px;
  line-height: 1.7;
  max-height: 70vh;
  overflow-y: auto;
  padding: 18px;
  outline: none;
}

.rich-editor__body:empty::before {
  color: #9ca3af;
  content: attr(data-placeholder);
}

.rich-editor__body :deep(img) {
  display: block;
  height: auto;
  max-width: 100%;
  margin: 12px 0;
}

.rich-editor__body :deep(table),
.rich-editor__body :deep(.news-editor-table) {
  border-collapse: collapse;
  margin: 12px 0;
  width: 100%;
}

.rich-editor__body :deep(td),
.rich-editor__body :deep(th) {
  border: 1px solid #d1d5db;
  min-width: 80px;
  padding: 8px;
}

.rich-editor__body :deep(blockquote) {
  border-left: 4px solid #78b144;
  color: #4b5563;
  margin: 12px 0;
  padding: 8px 14px;
}

.rich-editor__body :deep(pre) {
  background: #111827;
  border-radius: 6px;
  color: #f9fafb;
  overflow-x: auto;
  padding: 12px;
}

.rich-editor__file {
  display: none;
}
</style>
