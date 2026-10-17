import { onMounted, onBeforeUnmount, readonly, ref } from 'vue';
export function useSageReducedMotion() {
  const reduced = ref(typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches));
  let media;
  const update = event => { reduced.value = event.matches; };
  onMounted(() => { media = window.matchMedia?.('(prefers-reduced-motion: reduce)'); reduced.value = Boolean(media?.matches); media?.addEventListener?.('change', update); });
  onBeforeUnmount(() => media?.removeEventListener?.('change', update));
  return readonly(reduced);
}
