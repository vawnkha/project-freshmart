<script setup>
import "@/assets/css/admin/news-editor.css";
import { normalizeId } from "@/utils/id.util";
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRouter } from "vue-router";
import RichTextEditor from "@/components/admin/common/RichTextEditor.vue";
import TagInput from "@/components/admin/common/TagInput.vue";
import { normalizeNewsTags } from "@/utils/news-tags.util";
import newsService from "@/services/news.service";
import newsCategoryService from "@/services/news-category.service";
import uploadService from "@/services/upload.service";

const router = useRouter();
const categories = ref([]);
const loading = ref(false);
const saving = ref(false);
const uploadingThumbnail = ref(false);
const slugTouched = ref(false);
const tags = ref([]);
const tagInputRef = ref(null);
const thumbnailInputRef = ref(null);
const thumbnailFile = ref(null);
const thumbnailPreview = ref("");

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

const form = reactive({
  categoryId: "",
  title: "",
  slug: "",
  summary: "",
  content: "",
  thumbnail: "",
  status: "draft",
  publishedAt: "",
  seoTitle: "",
  seoDescription: "",
});

const activeCategories = computed(() =>
  categories.value.filter((item) => item.status !== "inactive"),
);

function normalizeList(res) {
  return Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
}

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function validateImage(file) {
  if (!file) return "";
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return "Thumbnail chỉ hỗ trợ JPG, PNG, WEBP hoặc GIF";
  }
  if (file.size > MAX_IMAGE_SIZE) {
    return "Thumbnail tối đa 5MB";
  }
  return "";
}

function handleThumbnailChange(event) {
  const file = event.target.files?.[0] || null;
  const message = validateImage(file);
  if (message) {
    alert(message);
    event.target.value = "";
    return;
  }

  thumbnailFile.value = file;
  thumbnailPreview.value = file ? URL.createObjectURL(file) : form.thumbnail;
}

function removeThumbnail() {
  thumbnailFile.value = null;
  thumbnailPreview.value = "";
  form.thumbnail = "";
  if (thumbnailInputRef.value) thumbnailInputRef.value.value = "";
}

async function uploadThumbnailIfNeeded() {
  if (!thumbnailFile.value) return form.thumbnail;

  uploadingThumbnail.value = true;
  try {
    const res = await uploadService.uploadNewsImage(thumbnailFile.value);
    const url = res.url || res.data?.url || "";
    if (!url) throw new Error("Upload thumbnail không trả về URL");
    form.thumbnail = url;
    thumbnailPreview.value = url;
    thumbnailFile.value = null;
    return url;
  } finally {
    uploadingThumbnail.value = false;
  }
}

function handleSlugInput() {
  slugTouched.value = true;
  form.slug = slugify(form.slug);
}

function buildPayload() {
  const payload = {
    categoryId: form.categoryId,
    title: form.title.trim(),
    slug: form.slug.trim(),
    summary: form.summary.trim(),
    content: form.content,
    thumbnail: form.thumbnail.trim(),
    images: [],
    tags: normalizeNewsTags(tags.value),
    status: form.status,
    publishedAt: form.publishedAt || undefined,
    seoTitle: form.seoTitle.trim(),
    seoDescription: form.seoDescription.trim(),
  };

  Object.keys(payload).forEach((key) => {
    if (payload[key] === undefined) delete payload[key];
  });

  return payload;
}

function validateForm() {
  if (!form.categoryId) return "Vui lòng chọn danh mục tin tức";
  if (!form.title.trim()) return "Tiêu đề là bắt buộc";
  if (!form.slug.trim()) return "Slug là bắt buộc";
  return "";
}

async function fetchCategories() {
  loading.value = true;
  try {
    const res = await newsCategoryService.getAll();
    categories.value = normalizeList(res);
  } catch (error) {
    console.error(error);
    alert(error?.response?.data?.message || "Không thể tải danh mục tin tức");
  } finally {
    loading.value = false;
  }
}

async function submitForm() {
  if (saving.value) return;
  tags.value = tagInputRef.value?.commit() || tags.value;
  const message = validateForm();
  if (message) {
    alert(message);
    return;
  }

  saving.value = true;
  try {
    await uploadThumbnailIfNeeded();
    await newsService.create(buildPayload());
    alert("Tạo bài viết thành công");
    router.push({ name: "admin-news" });
  } catch (error) {
    console.error(error);
    alert(error?.response?.data?.message || "Không thể tạo bài viết");
  } finally {
    saving.value = false;
  }
}

watch(
  () => form.title,
  (value) => {
    if (!slugTouched.value) form.slug = slugify(value);
  },
);

onMounted(fetchCategories);
</script>

<template>
  <div class="admin-page news-editor-page">
    <div class="admin-page-title admin-page-title--stack">
      <h1>Thêm bài viết</h1>
      <p>Tạo bài viết tin tức/blog mới với thumbnail upload và nội dung rich text.</p>
    </div>

    <section class="admin-panel">
      <div class="admin-panel__header admin-panel__header--flex">
        <div>
          <div class="admin-panel__header-title">Thông tin bài viết</div>
          <div class="admin-panel__header-subtitle">
            Nội dung được lưu dạng HTML và hiển thị ở public blog detail.
          </div>
        </div>
        <RouterLink class="admin-btn admin-btn--secondary" :to="{ name: 'admin-news' }">
          Quay lại
        </RouterLink>
      </div>

      <div class="admin-panel__body">
        <div v-if="loading" class="admin-empty-state">Đang tải danh mục...</div>
        <form v-else class="admin-form news-form" @submit.prevent="submitForm">
          <div class="admin-form__row">
            <label class="admin-form__label">Danh mục *</label>
            <select v-model="form.categoryId" class="admin-form__select">
              <option value="">-- Chọn danh mục tin tức --</option>
              <option
                v-for="category in activeCategories"
                :key="normalizeId(category._id)"
                :value="normalizeId(category._id)"
              >
                {{ category.name }}
              </option>
            </select>
          </div>

          <div class="admin-form__row">
            <label class="admin-form__label">Tiêu đề *</label>
            <input v-model="form.title" class="admin-form__control" />
          </div>

          <div class="admin-form__row">
            <label class="admin-form__label">Slug *</label>
            <input v-model="form.slug" class="admin-form__control" @input="handleSlugInput" />
          </div>

          <div class="admin-form__row">
            <label class="admin-form__label">Tóm tắt</label>
            <textarea v-model="form.summary" class="admin-form__textarea" rows="3" />
          </div>

          <div class="admin-form__row">
            <label class="admin-form__label">Nội dung</label>
            <RichTextEditor v-model="form.content" />
          </div>

          <div class="admin-form__row">
            <label class="admin-form__label">Thumbnail</label>
            <input
              ref="thumbnailInputRef"
              type="file"
              class="admin-form__control"
              accept="image/jpeg,image/png,image/webp,image/gif"
              @change="handleThumbnailChange"
            />
            <div class="news-thumbnail-preview" v-if="thumbnailPreview || form.thumbnail">
              <img :src="thumbnailPreview || form.thumbnail" alt="Thumbnail preview" />
              <button type="button" class="admin-btn admin-btn--secondary" @click="removeThumbnail">
                Xóa ảnh
              </button>
            </div>
          </div>

          <div class="admin-form__row">
            <label class="admin-form__label" for="news-tags">Tags</label>
            <TagInput id="news-tags" ref="tagInputRef" v-model="tags" :disabled="saving" />
          </div>

          <div class="admin-form__row">
            <label class="admin-form__label">Trạng thái</label>
            <select v-model="form.status" class="admin-form__select">
              <option value="draft">Bản nháp</option>
              <option value="published">Đã xuất bản</option>
              <option value="archived">Đã lưu trữ</option>
            </select>
          </div>

          <div class="admin-form__row">
            <label class="admin-form__label">Ngày xuất bản</label>
            <input v-model="form.publishedAt" type="datetime-local" class="admin-form__control" />
          </div>

          <div class="admin-form__row">
            <label class="admin-form__label">SEO title</label>
            <input v-model="form.seoTitle" class="admin-form__control" />
          </div>

          <div class="admin-form__row">
            <label class="admin-form__label">SEO description</label>
            <textarea v-model="form.seoDescription" class="admin-form__textarea" rows="3" />
          </div>

          <div class="admin-form__actions">
            <RouterLink class="admin-btn admin-btn--secondary" :to="{ name: 'admin-news' }">
              Hủy
            </RouterLink>
            <button
              type="submit"
              class="admin-btn admin-btn--primary"
              :disabled="saving || uploadingThumbnail"
            >
              {{ saving || uploadingThumbnail ? "Đang lưu..." : "Tạo bài viết" }}
            </button>
          </div>
        </form>
      </div>
    </section>
  </div>
</template>

<style scoped>
.news-thumbnail-preview {
  align-items: flex-start;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 10px;
}

.news-thumbnail-preview img {
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  display: block;
  height: 130px;
  max-width: 100%;
  object-fit: cover;
  width: 220px;
}
</style>
