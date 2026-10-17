<script setup>
import { nextTick, ref } from 'vue';
import { useAuthStore } from '@/stores/user/auth';
import SageSelect from '@/components/user/sage/SageSelect.vue';
import SageTextarea from '@/components/user/sage/SageTextarea.vue';
import SageButton from '@/components/user/sage/SageButton.vue';
import SageLoading from '@/components/user/sage/SageLoading.vue';
import SageErrorState from '@/components/user/sage/SageErrorState.vue';
const props = defineProps({ resource: { type: Object, required: true } });
const auth = useAuthStore(), form = ref(null);
async function submit() { await props.resource.submit(); await nextTick(); form.value?.querySelector('[aria-invalid="true"]')?.focus(); }
const ratings = [1, 2, 3, 4, 5].map(value => ({ value, label: value + ' sao' }));
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
      <SageSelect id="pdp-review-rating" v-model="resource.form.rating" label="Đánh giá" :options="ratings" :error="resource.errors.rating" :disabled="resource.state.busy || resource.state.uncertain" />
      <SageTextarea id="pdp-review-comment" v-model="resource.form.comment" label="Nội dung đánh giá" rows="4" maxlength="5000" :error="resource.errors.comment" :disabled="resource.state.busy || resource.state.uncertain" />
      <SageButton type="submit" :loading="resource.state.busy" :disabled="resource.state.uncertain || resource.state.eligibilityLoading">Gửi đánh giá</SageButton>
    </form>
  </div>
</template>
