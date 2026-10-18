<script setup>
import CatalogEntityPage from "@/components/admin/catalog/CatalogEntityPage.vue";
import manufacturerService from "@/services/manufacturer.service";
</script>

<template>
  <CatalogEntityPage
    :service="manufacturerService"
    title="Nhà sản xuất"
    subtitle="Quản lý nhà sản xuất để liên kết với hàng kho."
    entity-label="nhà sản xuất"
  />
</template>
