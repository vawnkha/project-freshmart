<script setup>
import CatalogEntityPage from "@/components/admin/catalog/CatalogEntityPage.vue";
import brandService from "@/services/brand.service";
</script>

<template>
  <CatalogEntityPage
    :service="brandService"
    title="Thương hiệu"
    subtitle="Quản lý thương hiệu để chọn trong hồ sơ hàng kho."
    entity-label="thương hiệu"
  />
</template>
