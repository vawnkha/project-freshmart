<script setup>
import { ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
const route = useRoute();
const router = useRouter();
const keyword = ref(String(route.query.q || ""));
watch(
  () => route.query.q,
  (q) => {
    keyword.value = String(q || "");
  },
);
function search() {
  router.push({
    path: "/products",
    query: keyword.value.trim() ? { q: keyword.value.trim() } : {},
  });
}
</script>
<template>
  <form class="store-search" role="search" @submit.prevent="search">
    <label for="store-search" class="sr-only">Tìm kiếm sản phẩm</label
    ><input
      id="store-search"
      v-model="keyword"
      type="search"
      placeholder="Tìm sản phẩm cho ao nuôi của bạn..."
    /><button type="submit" aria-label="Tìm kiếm">
      <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
    </button>
  </form>
</template>
