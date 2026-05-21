<script setup>
import CatalogEntityPage from "@/components/admin/catalog/CatalogEntityPage.vue";
import categoryService from "@/services/category.service";
</script>

<template>
  <CatalogEntityPage
    :service="categoryService"
    title="Danh mục sản phẩm"
    subtitle="Quản lý danh mục dùng cho sản phẩm website và hàng kho."
    entity-label="danh mục"
    mode="category"
    show-image-field
  />
</template>
