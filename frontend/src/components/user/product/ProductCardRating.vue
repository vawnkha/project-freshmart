<script setup>
import { computed } from 'vue';

const props = defineProps({ product: { type: Object, required: true } });
const reviewCount = computed(() => Number(props.product.total_reviews) || 0);
const score = computed(() => {
  if (reviewCount.value <= 0) return 5;
  const average = Number(props.product.average_rating);
  return average >= 1 && average <= 5 ? average : null;
});
const ratingLabel = computed(() => {
  if (score.value === null) return '';
  if (reviewCount.value <= 0) return '5 sao mặc định. Chưa có đánh giá.';
  const average = score.value.toLocaleString('vi-VN', { maximumFractionDigits: 1 });
  return `Trung bình ${average} trên 5 sao từ ${reviewCount.value} lượt đánh giá`;
});
</script>

<template>
  <span v-if="score !== null" class="card-rating" role="img" :aria-label="ratingLabel">
    <span v-for="star in 5" :key="star" class="card-rating-star" aria-hidden="true">
      <i :class="star <= score ? 'fa-solid fa-star' : 'fa-regular fa-star'"></i>
      <i
        v-if="star - 1 < score && score < star"
        class="fa-solid fa-star card-rating-fill"
        :style="{ clipPath: `inset(0 ${Math.round((star - score) * 100)}% 0 0)` }"
      ></i>
    </span>
  </span>
</template>

<style scoped>
.card-rating {
  display: flex;
  gap: 2px;
  color: var(--text-secondary);
  font-size: 16px;
  line-height: 1;
}

.card-rating-star {
  position: relative;
}

.card-rating-star .fa-solid {
  color: #c5c732;
}

.card-rating-fill {
  position: absolute;
  inset: 0;
}
</style>
