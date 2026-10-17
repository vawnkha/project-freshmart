import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';

// Homepage-owned GET lifecycle. API services and shared transport remain intact.
// A newer retry/unmount invalidates both stale success and stale failure.
export function useHomeResource(request, message, map = value => value) {
  const data = shallowRef([]);
  const loading = ref(true);
  const error = ref('');
  let version = 0, disposed = false;
  async function load() {
    if (disposed) return;
    const current = ++version;
    loading.value = true;
    error.value = '';
    try {
      const result = await request();
      const list = Array.isArray(result) ? result : result?.data;
      if (!Array.isArray(list)) throw new TypeError('Unexpected public list response');
      const rows = map(list);
      if (!disposed && current === version) data.value = rows;
    } catch (cause) {
      if (!disposed && current === version) {
        data.value = [];
        error.value = message;
        console.warn('[Homepage] Public content request failed', cause);
      }
    } finally {
      if (!disposed && current === version) loading.value = false;
    }
  }
  onMounted(load);
  onBeforeUnmount(() => { disposed = true; ++version; });
  return { data, loading, error, load };
}
