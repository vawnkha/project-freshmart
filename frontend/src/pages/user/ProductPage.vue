<script setup>
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import ProductCard from "@/components/user/product/ProductCard.vue";
import ProductListItem from "@/components/user/product/ProductListItem.vue";
import productService from "@/services/product.service";

const route = useRoute();
const router = useRouter();

const viewMode = ref("grid");
const sortBy = ref(route.query.sort || "");
const currentPage = ref(Number(route.query.page || 1));
const perPage = 12;

const products = ref([]);
const loading = ref(false);

const sortedProducts = computed(() => {
  const items = [...products.value];

  switch (sortBy.value) {
    case "price-asc":
      return items.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    case "price-desc":
      return items.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    case "name-asc":
      return items.sort((a, b) => a.name.localeCompare(b.name));
    case "name-desc":
      return items.sort((a, b) => b.name.localeCompare(a.name));
    default:
      return items;
  }
});

const totalProducts = computed(() => sortedProducts.value.length);
const totalPages = computed(() =>
  Math.max(1, Math.ceil(totalProducts.value / perPage)),
);
const paginatedProducts = computed(() => {
  const start = (currentPage.value - 1) * perPage;
  return sortedProducts.value.slice(start, start + perPage);
});

const startItem = computed(() => {
  if (!totalProducts.value) return 0;
  return (currentPage.value - 1) * perPage + 1;
});

const endItem = computed(() => {
  return Math.min(currentPage.value * perPage, totalProducts.value);
});

async function fetchProducts() {
  loading.value = true;
  try {
    const params = {
      q: route.query.q || "",
      category_id: route.query.category_id || "",
    };

    const result = await productService.getAll(params);
    products.value = result.data || [];
    if (currentPage.value > totalPages.value) currentPage.value = totalPages.value;
  } catch (error) {
    alert(error.message);
  } finally {
    loading.value = false;
  }
}

function goToPage(page) {
  if (page < 1 || page > totalPages.value) return;
  router.push({
    query: {
      ...route.query,
      page,
      sort: sortBy.value || undefined,
    },
  });
}

watch(
  () => route.query,
  () => {
    currentPage.value = Number(route.query.page || 1);
    sortBy.value = route.query.sort || "";
    fetchProducts();
  },
  { immediate: true },
);

watch(sortBy, (value) => {
  const query = {
    ...route.query,
    sort: value || undefined,
  };
  delete query.page;
  currentPage.value = 1;
  router.push({
    query,
  });
});

watch(totalPages, (value) => {
  if (currentPage.value > value) currentPage.value = value;
});
</script>

<template>
  <div id="content" class="site-content">
    <div id="breadcrumb">
      <div class="container">
        <h2 class="title">Sản phẩm</h2>

        <ul class="breadcrumb">
          <li><router-link to="/">Trang Chủ</router-link></li>
          <li><router-link to="/products">Sản Phẩm</router-link></li>
        </ul>
      </div>
    </div>

    <div class="container">
      <div class="row">
        <div id="center-column" class="col-lg-12 col-md-12">
          <div class="product-category-page">
            <div class="products-bar">
              <div class="row">
                <div class="col-md-6 col-xs-6">
                  <div class="gridlist-toggle" role="tablist">
                    <ul class="nav nav-tabs">
                      <li :class="{ active: viewMode === 'grid' }">
                        <a href="#" @click.prevent="viewMode = 'grid'">
                          <i class="fa fa-th-large"></i>
                        </a>
                      </li>
                      <li :class="{ active: viewMode === 'list' }">
                        <a href="#" @click.prevent="viewMode = 'list'">
                          <i class="fa fa-bars"></i>
                        </a>
                      </li>
                    </ul>
                  </div>

                  <div class="total-products">
                    Hiện có {{ totalProducts }} sản phẩm
                  </div>
                </div>

                <div class="col-md-6 col-xs-6">
                  <div class="filter-bar">
                    <form action="#" class="pull-right" @submit.prevent>
                      <div class="select">
                        <select v-model="sortBy" class="form-control">
                          <option value="">Sắp xếp</option>
                          <option value="price-asc">Giá: Thấp đến cao</option>
                          <option value="price-desc">Giá: Cao đến thấp</option>
                          <option value="name-asc">Tên sản phẩm: A-Z</option>
                          <option value="name-desc">Tên sản phẩm: Z-A</option>
                        </select>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="route.query.q" class="mb-20">
              <h5>
                Kết quả tìm kiếm cho: "<strong>{{ route.query.q }}</strong
                >"
              </h5>
            </div>

            <div v-if="loading">Đang tải sản phẩm...</div>
            <div v-else-if="!paginatedProducts.length">
              Không tìm thấy sản phẩm phù hợp.
            </div>

            <div v-else class="tab-content">
              <div
                v-if="viewMode === 'grid'"
                class="tab-pane active"
                id="products-grid"
              >
                <div class="products-block">
                  <div class="row">
                    <div
                      v-for="product in paginatedProducts"
                      :key="product._id"
                      class="col-md-3 col-sm-4 col-xs-12"
                    >
                      <ProductCard :product="product" />
                    </div>
                  </div>
                </div>
              </div>

              <div v-else class="tab-pane active" id="products-list">
                <div class="products-block layout-5">
                  <ProductListItem
                    v-for="product in paginatedProducts"
                    :key="product._id"
                    :product="product"
                  />
                </div>
              </div>
            </div>

            <div v-if="totalProducts" class="pagination-bar">
              <div class="row">
                <div class="col-md-4 col-sm-4 col-xs-12">
                  <div class="text">
                    Hiển thị {{ startItem }}-{{ endItem }} trên tổng số
                    {{ totalProducts }} sản phẩm
                  </div>
                </div>

                <div class="col-md-8 col-sm-8 col-xs-12">
                  <div class="pagination">
                    <ul class="page-list">
                      <li>
                        <a
                          href="#"
                          class="prev"
                          @click.prevent="goToPage(currentPage - 1)"
                        >
                          Previous
                        </a>
                      </li>

                      <li v-for="page in totalPages" :key="page">
                        <a
                          href="#"
                          :class="{ current: page === currentPage }"
                          @click.prevent="goToPage(page)"
                        >
                          {{ page }}
                        </a>
                      </li>

                      <li>
                        <a
                          href="#"
                          class="next"
                          @click.prevent="goToPage(currentPage + 1)"
                        >
                          Next
                        </a>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
