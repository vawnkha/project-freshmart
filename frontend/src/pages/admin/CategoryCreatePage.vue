<script setup>
import { reactive, ref, watch } from "vue";
import { useRouter } from "vue-router";
import categoryService from "@/services/category.service";
import { categoryFormSchema } from "@/validators/category.validator";

const router = useRouter();
const preview = ref("");
const validationError = ref("");

const form = reactive({
  name: "",
  slug: "",
  description: "",
  image: null,
});

watch(form, () => { validationError.value = ""; });

function onImageChange(event) {
  const file = event.target.files?.[0];
  form.image = file || null;
  preview.value = file ? URL.createObjectURL(file) : "";
}

async function submitForm() {
  const parsed = categoryFormSchema.safeParse({ ...form });
  if (!parsed.success) {
    validationError.value = parsed.error.issues[0]?.message || "Dữ liệu không hợp lệ";
    return;
  }
  const data = new FormData();
  data.append("name", parsed.data.name);
  data.append("slug", parsed.data.slug);
  data.append("description", parsed.data.description || "");
  if (form.image) data.append("image", form.image);

  try {
    await categoryService.create(data);
    router.push({ name: "admin-categories" });
  } catch (error) {
    validationError.value = error?.response?.data?.message || "Không thể tạo danh mục";
  }
}
</script>

<template>
  <div>
    <div class="admin-page-title">Tạo Danh Mục</div>

    <section class="admin-panel">
      <div class="admin-panel__header">Thêm Danh Mục Mới</div>
      <div class="admin-panel__body">
        <form class="admin-form" @submit.prevent="submitForm">
          <div v-if="validationError" class="admin-form__error">{{ validationError }}</div>
          <div class="admin-form__row">
            <label class="admin-form__label">Tên Danh Mục *</label>
            <input v-model="form.name" class="admin-form__control" />
          </div>

          <div class="admin-form__row">
            <label class="admin-form__label">Slug *</label>
            <input v-model="form.slug" class="admin-form__control" />
          </div>

          <div class="admin-form__row">
            <label class="admin-form__label">Mô tả *</label>
            <input v-model="form.description" class="admin-form__control" />
          </div>

          <div class="admin-form__row">
            <label class="admin-form__label">Hình ảnh</label>
            <div>
              <input type="file" @change="onImageChange" />
              <img
                v-if="preview"
                :src="preview"
                style="
                  width: 120px;
                  height: 120px;
                  object-fit: cover;
                  margin-top: 10px;
                  border: 1px solid #ddd;
                "
              />
            </div>
          </div>

          <div class="admin-form__actions">
            <button type="submit" class="admin-btn admin-btn--success">
              Thêm Danh Mục
            </button>
          </div>
        </form>
      </div>
    </section>
  </div>
</template>
