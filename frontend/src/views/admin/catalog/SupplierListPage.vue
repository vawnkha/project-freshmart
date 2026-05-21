<script setup>
import CatalogEntityPage from "@/components/admin/catalog/CatalogEntityPage.vue";
import supplierService from "@/services/supplier.service";
</script>

<template>
  <CatalogEntityPage
    :service="supplierService"
    title="Nhà cung cấp"
    subtitle="Quản lý nhà cung cấp để dùng cho phiếu nhập hàng."
    entity-label="nhà cung cấp"
    show-contact-fields
  />
</template>
