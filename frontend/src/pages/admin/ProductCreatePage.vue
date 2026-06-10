<script setup>
import { onMounted, reactive, ref } from "vue";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import { useRouter } from "vue-router";
import categoryService from "@/services/category.service";
import productService from "@/services/product.service";
import {
  imageFileSchema,
  nonNegativeNumberSchema,
  objectIdSchema,
  optionalString,
  requiredString,
  z,
} from "@/validators/common.validator";
import { mapBackendValidationErrors } from "@/utils/validation-error.util";

const router = useRouter();
const categories = ref([]);
const thumbnailPreview = ref("");
const imagePreviews = ref([]);
const loading = ref(false);

const form = reactive({
  name: "",
  category_id: "",
  description: "",
  price: "",
  stock: "",
  unit: "",
  thumbnail: null,
  images: [],
});

const productCreateSchema = toTypedSchema(
  z.object({
    name: requiredString("Ten san pham la bat buoc"),
    category_id: objectIdSchema,
    description: optionalString,
    price: nonNegativeNumberSchema,
    stock: nonNegativeNumberSchema,
    unit: optionalString,
    thumbnail: imageFileSchema.refine((file) => Boolean(file), {
      message: "Anh dai dien la bat buoc",
    }),
    images: z.array(imageFileSchema).max(4, "Anh chi tiet toi da 4 file"),
  }),
);

const {
  errors,
  setErrors,
  setValues,
  validate: validateVee,
} = useForm({
  validationSchema: productCreateSchema,
});

async function fetchCategories() {
  const res = await categoryService.getAll();
  categories.value = res?.data || res || [];
}

function onThumbnailChange(event) {
  const file = event.target.files?.[0] || null;
  form.thumbnail = file;
  thumbnailPreview.value = file ? URL.createObjectURL(file) : "";
}

function onImagesChange(event) {
  const files = Array.from(event.target.files || []).slice(0, 4);
  form.images = files;
  imagePreviews.value = files.map((file) => URL.createObjectURL(file));
}

async function validateForm() {
  setValues({
    ...form,
    images: [...form.images],
  });
  const result = await validateVee();
  return result.valid;
}

async function submitForm() {
  const valid = await validateForm();
  if (!valid) return;

  loading.value = true;
  try {
    const data = new FormData();
    data.append("name", form.name);
    data.append("category_id", form.category_id);
    data.append("description", form.description);
    data.append("price", String(form.price));
    data.append("stock", String(form.stock));
    data.append("unit", form.unit);

    if (form.thumbnail) {
      data.append("thumbnail", form.thumbnail);
    }

    form.images.forEach((file) => {
      data.append("images", file);
    });

    await productService.create(data);
    router.push({ name: "admin-products" });
  } catch (error) {
    console.error("Lỗi thêm sản phẩm:", error);
    setErrors(mapBackendValidationErrors(error));
    alert(error?.response?.data?.message || "Thêm sản phẩm thất bại");
  } finally {
    loading.value = false;
  }
}

onMounted(fetchCategories);
</script>

<template>
  <div>
    <div class="admin-page-title">Thêm sản phẩm</div>

    <section class="admin-panel">
      <div class="admin-panel__header">Thêm Sản Phẩm Mới</div>

      <div class="admin-panel__body">
        <form class="admin-form" @submit.prevent="submitForm">
          <div class="admin-form__row">
            <label class="admin-form__label">Tên sản phẩm *</label>
            <div>
              <input
                v-model="form.name"
                class="admin-form__control"
                :class="{ 'is-invalid': errors.name }"
              />
              <div v-if="errors.name" class="admin-form__error">
                {{ errors.name }}
              </div>
            </div>
          </div>

          <div class="admin-form__row">
            <label class="admin-form__label">Danh mục *</label>
            <div>
            <select
              v-model="form.category_id"
              class="admin-form__select"
              :class="{ 'is-invalid': errors.category_id }"
            >
              <option value="">Chọn danh mục</option>
              <option
                v-for="item in categories"
                :key="item._id || item.id"
                :value="item._id || item.id"
              >
                {{ item.name }}
              </option>
            </select>
              <div v-if="errors.category_id" class="admin-form__error">
                {{ errors.category_id }}
              </div>
            </div>
          </div>

          <div class="admin-form__row">
            <label class="admin-form__label">Mô tả</label>
            <textarea
              v-model="form.description"
              class="admin-form__textarea"
            ></textarea>
          </div>

          <div class="admin-form__row">
            <label class="admin-form__label">Giá *</label>
            <input
              v-model="form.price"
              type="number"
              min="0"
              class="admin-form__control"
              :class="{ 'is-invalid': errors.price }"
            />
            <div v-if="errors.price" class="admin-form__error">
              {{ errors.price }}
            </div>
          </div>

          <div class="admin-form__row">
            <label class="admin-form__label">Số lượng *</label>
            <input
              v-model="form.stock"
              type="number"
              min="0"
              class="admin-form__control"
              :class="{ 'is-invalid': errors.stock }"
            />
            <div v-if="errors.stock" class="admin-form__error">
              {{ errors.stock }}
            </div>
          </div>

          <div class="admin-form__row">
            <label class="admin-form__label">Đơn vị</label>
            <input v-model="form.unit" class="admin-form__control" />
          </div>

          <div class="admin-form__row">
            <label class="admin-form__label">Ảnh đại diện</label>
            <div>
              <input type="file" accept="image/*" @change="onThumbnailChange" />
              <div v-if="errors.thumbnail" class="admin-form__error">
                {{ errors.thumbnail }}
              </div>
              <div v-if="thumbnailPreview" style="margin-top: 10px">
                <img
                  :src="thumbnailPreview"
                  style="
                    width: 110px;
                    height: 110px;
                    object-fit: cover;
                    border: 1px solid #ddd;
                  "
                />
              </div>
            </div>
          </div>

          <div class="admin-form__row">
            <label class="admin-form__label">Ảnh chi tiết</label>
            <div>
              <input
                type="file"
                multiple
                accept="image/*"
                @change="onImagesChange"
              />
              <div v-if="errors.images" class="admin-form__error">
                {{ errors.images }}
              </div>
              <div
                style="
                  display: flex;
                  gap: 10px;
                  flex-wrap: wrap;
                  margin-top: 10px;
                "
              >
                <img
                  v-for="(img, index) in imagePreviews"
                  :key="index"
                  :src="img"
                  style="
                    width: 110px;
                    height: 110px;
                    object-fit: cover;
                    border: 1px solid #ddd;
                  "
                />
              </div>
            </div>
          </div>

          <div class="admin-form__actions">
            <!-- <button type="reset" class="admin-btn admin-btn--secondary">
              Reset
            </button> -->
            <button
              type="submit"
              class="admin-btn admin-btn--success"
              :disabled="loading"
            >
              {{ loading ? "Đang thêm..." : "Thêm sản phẩm" }}
            </button>
          </div>
        </form>
      </div>
    </section>
  </div>
</template>
