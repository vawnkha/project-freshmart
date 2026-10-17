import { reactive, ref, shallowRef, watch, onBeforeUnmount } from 'vue';
import { useAuthStore } from '@/stores/user/auth';
import reviewService from '@/services/review.service';
import { validDetailId, reviewResponse, reviewErrors, detailId } from '@/utils/product-detail.util';
import { userError } from '@/utils/user-error.util';
import { notify } from '@/composables/useStorefrontNotice';

export function useProductReviews(productId) {
  const auth = useAuthStore(), items = shallowRef([]), summary = shallowRef(null);
  const form = reactive({ rating: 5, comment: '' }), errors = ref({});
  const state = reactive({ loading: false, error: '', eligibilityLoading: false, eligibilityError: '', canReview: false, message: '', busy: false, sendError: '', success: '', uncertain: false, fresh: false });
  let version = 0, disposed = false;
  const live = (run, id, owner) => !disposed && run === version && id === productId.value && owner === auth.userId;
  async function load() {
    const run = ++version, id = productId.value, owner = auth.userId;
    state.error = ''; state.eligibilityError = ''; state.canReview = false; state.fresh = false;
    if (!validDetailId(id)) { items.value = []; summary.value = null; state.loading = false; state.eligibilityLoading = false; return; }
    state.loading = true; state.eligibilityLoading = !!owner;
    state.message = owner ? '' : 'Đăng nhập để xem điều kiện đánh giá sản phẩm.';
    const reads = [reviewService.getByProduct(id).then(response => {
      const data = reviewResponse(response);
      if (live(run, id, owner)) { items.value = data.items; summary.value = data.summary; }
    }).catch(cause => {
      if (live(run, id, owner)) state.error = 'Không thể tải đánh giá. Vui lòng thử lại.';
    }).finally(() => { if (live(run, id, owner)) state.loading = false; })];
    if (owner) reads.push(reviewService.canReview(owner, id).then(response => {
      if (typeof response?.canReview !== 'boolean') throw new TypeError('Unexpected review eligibility response');
      if (live(run, id, owner)) { state.canReview = response.canReview; state.message = response.message || ''; }
    }).catch(() => {
      if (live(run, id, owner)) state.eligibilityError = 'Chưa kiểm tra được điều kiện đánh giá. Vui lòng thử lại.';
    }).finally(() => { if (live(run, id, owner)) state.eligibilityLoading = false; }));
    await Promise.all(reads);
    if (live(run, id, owner)) state.fresh = !state.error && !state.eligibilityError;
  }
  async function submit() {
    if (!auth.userId || !state.canReview || state.busy || state.uncertain || state.eligibilityLoading) return;
    errors.value = reviewErrors(form); if (Object.keys(errors.value).length) return;
    const run = version, id = productId.value, owner = auth.userId;
    state.busy = true; state.sendError = ''; state.success = '';
    try {
      const response = await reviewService.create({ user_id: owner, product_id: id, rating: Number(form.rating), comment: form.comment.trim() });
      if (!live(run, id, owner)) return;
      if (!detailId(response?.data?._id)) throw new TypeError('Review creation not confirmed');
      form.comment = ''; state.success = 'Đã gửi đánh giá của bạn.'; notify(state.success, 'success');
      await load();
    } catch (cause) {
      if (!live(run, id, owner)) return;
      console.warn('[PDP] Review failed', { name: cause.name, status: cause.response?.status });
      state.uncertain = !cause.response || cause.response.status >= 500;
      state.sendError = state.uncertain ? 'Chưa xác định đánh giá đã được lưu hay chưa. Tải lại đánh giá để kiểm tra; không gửi lại tự động.' : userError(cause, 'Không thể gửi đánh giá. Vui lòng kiểm tra điều kiện đánh giá.');
      if (state.uncertain) await load();
      // Backend can revoke eligibility between GET and POST.
      else if ([400, 403, 409].includes(cause.response.status)) await load();
    } finally { if (!disposed && id === productId.value && owner === auth.userId) state.busy = false; }
  }
  watch([productId, () => auth.userId], ([id, owner], [previousId, previousOwner] = []) => {
    if (id !== previousId || owner !== previousOwner) { items.value = []; summary.value = null; form.comment = ''; form.rating = 5; }
    state.busy = false; state.sendError = ''; state.success = ''; state.uncertain = false; errors.value = {};
    void load();
  }, { immediate: true });
  onBeforeUnmount(() => { disposed = true; ++version; });
  return reactive({ state, items, summary, form, errors, load, submit,
    acknowledge() { if (state.fresh && !state.busy) { state.uncertain = false; state.sendError = ''; } } });
}
