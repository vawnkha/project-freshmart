<script setup>
import { nextTick, ref } from 'vue';
import { useAuthStore } from '@/stores/user/auth';
import SageTextarea from '@/components/user/sage/SageTextarea.vue';
import SageButton from '@/components/user/sage/SageButton.vue';
import SageLoading from '@/components/user/sage/SageLoading.vue';
import SageErrorState from '@/components/user/sage/SageErrorState.vue';
const props = defineProps({ resource: { type: Object, required: true } });
const auth = useAuthStore(), form = ref(null);
async function submit() { await props.resource.submit(); await nextTick(); form.value?.querySelector('[aria-invalid="true"]')?.focus(); }
</script>
<template>
  <div class="pdp-reviews" :aria-busy="resource.state.loading">
    <SageLoading v-if="resource.state.loading" label="Đang tải đánh giá" />
    <SageErrorState v-else-if="resource.state.error" :title="resource.state.error" :loading="resource.state.busy" @retry="resource.load()" />
    <div v-else class="pdp-review-layout">
      <div class="pdp-review-overview">
        <h3>Đánh giá từ khách hàng</h3>
        <p v-if="resource.summary?.total" class="pdp-review-summary"><strong>{{ resource.summary.average.toFixed(1) }}/5</strong><span>từ {{ resource.summary.total }} đánh giá</span></p>
      </div>
      <div class="pdp-review-content">
      <p v-if="!resource.items.length" class="pdp-muted">Chưa có đánh giá cho sản phẩm này.</p>
      <ol v-else class="pdp-review-list">
        <li v-for="review in resource.items" :key="review.id || review._id">
          <article><header><strong>{{ review.author || review.user?.name || 'Người dùng' }}</strong><span :aria-label="`${review.rating} trên 5 sao`">{{ review.rating }}/5</span></header>
            <span class="pdp-review-stars" aria-hidden="true"><i v-for="star in 5" :key="star" :class="star <= Number(review.rating) ? 'fa-solid fa-star' : 'fa-regular fa-star'"></i></span>
            <p v-if="review.time" class="pdp-muted">{{ review.time }}</p><p class="pdp-field-text">{{ review.content || review.comment }}</p>
          </article>
        </li>
      </ol>
      </div>
    </div>
    <SageLoading v-if="resource.state.eligibilityLoading" label="Đang kiểm tra điều kiện đánh giá" />
    <div v-else-if="resource.state.eligibilityError" class="pdp-feedback" role="alert">
      <p>{{ resource.state.eligibilityError }}</p><SageButton variant="secondary" :disabled="resource.state.busy" @click="resource.load()">Kiểm tra lại</SageButton>
    </div>
    <p v-else-if="!resource.state.canReview" class="pdp-review-notice">{{ resource.state.message }} <RouterLink v-if="!auth.userId" to="/login">Đăng nhập</RouterLink></p>
    <div v-if="resource.state.sendError" class="pdp-feedback pdp-feedback--error" role="alert"><p>{{ resource.state.sendError }}</p>
      <template v-if="resource.state.uncertain"><SageButton variant="secondary" :disabled="resource.state.loading || resource.state.busy" @click="resource.load()">Tải lại đánh giá</SageButton>
        <SageButton v-if="resource.state.fresh" variant="secondary" :disabled="resource.state.busy" @click="resource.acknowledge()">Đã kiểm tra đánh giá mới nhất</SageButton></template>
    </div>
    <p v-if="resource.state.success" class="pdp-feedback" role="status">{{ resource.state.success }}</p>
    <form v-if="resource.state.canReview" ref="form" class="pdp-review-form" @submit.prevent="submit">
      <h3>Chia sẻ trải nghiệm của bạn</h3>
      <fieldset class="pdp-rating" :disabled="resource.state.busy || resource.state.uncertain">
        <legend>Đánh giá</legend>
        <div class="pdp-rating-options">
          <label v-for="star in 5" :key="star" class="pdp-rating-option">
            <input
              v-model="resource.form.rating"
              type="radio"
              name="rating"
              :value="star"
              :aria-label="`${star} sao`"
              :aria-invalid="resource.errors.rating ? true : undefined"
              :aria-describedby="resource.errors.rating ? 'pdp-review-rating-error' : undefined"
            />
            <span class="pdp-rating-star" aria-hidden="true">
              <i :class="star <= Number(resource.form.rating) ? 'fa-solid fa-star' : 'fa-regular fa-star'"></i>
            </span>
          </label>
        </div>
        <p v-if="resource.errors.rating" id="pdp-review-rating-error" class="sage-field-error" role="alert">
          {{ resource.errors.rating }}
        </p>
      </fieldset>
      <SageTextarea id="pdp-review-comment" v-model="resource.form.comment" label="Nội dung đánh giá" rows="4" maxlength="5000" :error="resource.errors.comment" :disabled="resource.state.busy || resource.state.uncertain" />
      <SageButton type="submit" :loading="resource.state.busy" :disabled="resource.state.uncertain || resource.state.eligibilityLoading">Gửi đánh giá</SageButton>
    </form>
  </div>
</template>

<style scoped>
.pdp-rating {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.pdp-rating legend {
  width: auto;
  margin: 0 0 var(--space-2);
  padding: 0;
  border: 0;
  color: var(--text-primary);
  font: var(--weight-control) var(--text-body)/var(--leading-body) var(--font-body);
}

.pdp-rating-options {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.pdp-rating-option {
  position: relative;
  margin: 0;
}

.pdp-rating-option input {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: 0;
  clip-path: inset(50%);
}

.pdp-rating-star {
  display: grid;
  width: 44px;
  height: 44px;
  place-items: center;
  border-radius: 8px;
  color: var(--text-secondary);
  font-size: 24px;
  cursor: pointer;
}

.pdp-rating-star .fa-solid {
  color: #c5c732;
}

.pdp-rating-option input:enabled + .pdp-rating-star:hover {
  background: var(--warning-soft);
}

.pdp-rating-option input:focus-visible + .pdp-rating-star {
  outline: var(--focus-width) solid var(--focus);
  outline-offset: var(--focus-offset);
}

.pdp-rating-option input:disabled + .pdp-rating-star {
  opacity: 0.6;
  cursor: default;
}
</style>
