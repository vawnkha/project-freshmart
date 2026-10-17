import { onMounted, onUpdated, onBeforeUnmount } from 'vue';
import { createStorefrontMotion } from '@/utils/storefront-motion.util';
export function useStorefrontMotion(root) {
  let runtime;
  onMounted(() => { runtime = createStorefrontMotion(root.value); });
  onUpdated(() => runtime?.refresh());
  onBeforeUnmount(() => runtime?.dispose());
  return { refresh: () => runtime?.refresh(), enterPage: element => runtime?.enterPage(element), feedback: (element, kind) => runtime?.feedback(element, kind) };
}
