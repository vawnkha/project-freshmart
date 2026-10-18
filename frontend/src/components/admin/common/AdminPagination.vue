<script setup>
import { computed } from "vue";

const props = defineProps({
  modelValue: {
    type: Number,
    default: 1,
  },
  totalItems: {
    type: Number,
    default: 0,
  },
  pageSize: {
    type: Number,
    default: 12,
  },
  maxVisible: {
    type: Number,
    default: 5,
  },
});

const emit = defineEmits(["update:modelValue", "change"]);

const totalPages = computed(() => {
  const total = Math.ceil(props.totalItems / props.pageSize);
  return total > 0 ? total : 1;
});

const currentPage = computed(() => {
  if (props.modelValue < 1) return 1;
  if (props.modelValue > totalPages.value) return totalPages.value;
  return props.modelValue;
});

const pageNumbers = computed(() => {
  const total = totalPages.value;
  const current = currentPage.value;
  const max = props.maxVisible;

  if (total <= max) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  let start = Math.max(1, current - Math.floor(max / 2));
  let end = start + max - 1;

  if (end > total) {
    end = total;
    start = end - max + 1;
  }

  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
});

const startItem = computed(() => {
  if (props.totalItems === 0) return 0;
  return (currentPage.value - 1) * props.pageSize + 1;
});

const endItem = computed(() => {
  if (props.totalItems === 0) return 0;
  return Math.min(currentPage.value * props.pageSize, props.totalItems);
});

function goToPage(page) {
  const nextPage = Math.min(Math.max(1, page), totalPages.value);
  if (nextPage === currentPage.value) return;

  emit("update:modelValue", nextPage);
  emit("change", nextPage);
}
</script>

<template>
  <div v-if="totalItems > 0" class="admin-pagination">
    <div class="admin-pagination__info">
      Hiển thị {{ startItem }} - {{ endItem }} / {{ totalItems }} mục
    </div>

    <div class="admin-pagination__controls">
      <button
        type="button"
        class="admin-pagination__btn"
        :disabled="currentPage === 1"
        @click="goToPage(1)"
      >
        «
      </button>

      <button
        type="button"
        class="admin-pagination__btn"
        :disabled="currentPage === 1"
        @click="goToPage(currentPage - 1)"
      >
        ‹
      </button>

      <button
        v-for="page in pageNumbers"
        :key="page"
        type="button"
        class="admin-pagination__btn"
        :class="{ 'is-active': page === currentPage }"
        @click="goToPage(page)"
      >
        {{ page }}
      </button>

      <button
        type="button"
        class="admin-pagination__btn"
        :disabled="currentPage === totalPages"
        @click="goToPage(currentPage + 1)"
      >
        ›
      </button>

      <button
        type="button"
        class="admin-pagination__btn"
        :disabled="currentPage === totalPages"
        @click="goToPage(totalPages)"
      >
        »
      </button>
    </div>
  </div>
</template>
