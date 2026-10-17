import { ref } from "vue";
import categoryService from "@/services/category.service";
import { normalizeList } from "@/utils/storefront.util";

const categories = ref([]);
const loading = ref(false);
const error = ref("");
let pending;
let loaded = false;

export function useCatalog() {
  async function loadCategories(force = false) {
    if (pending) return pending;
    if (loaded && !force) return;
    loading.value = true;
    error.value = "";
    pending = categoryService
      .getAll()
      .then((result) => {
        categories.value = normalizeList(result).filter(
          (item) => !item.status || item.status === "active",
        );
        loaded = true;
      })
      .catch(() => {
        error.value = "Không thể tải danh mục. Vui lòng thử lại.";
      })
      .finally(() => {
        loading.value = false;
        pending = undefined;
      });
    return pending;
  }
  return { categories, loading, error, loadCategories };
}
