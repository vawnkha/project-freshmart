import { ref, nextTick, onBeforeUnmount } from 'vue';

// Wait for the Sage primitive's after-leave/release before showing another
// native top-layer dialog. A route change also cancels any queued opening.
export function useStorefrontShell() {
  const rendered = ref(''), active = ref('');
  let pending = '', trigger, disposed = false, version = 0;
  const waiters = new Set();
  function activate(panel, element) {
    element?.isConnected && element.focus({ preventScroll: true });
    rendered.value = panel; active.value = panel;
  }
  function open(panel, element) {
    if (disposed || active.value === panel) return;
    ++version;
    pending = panel; trigger = element;
    if (rendered.value) active.value = '';
    else { pending = ''; activate(panel, element); }
  }
  function close() {
    ++version;
    pending = ''; active.value = '';
    return rendered.value ? new Promise(resolve => waiters.add(resolve)) : Promise.resolve();
  }
  async function closed(panel) {
    if (rendered.value !== panel) return;
    rendered.value = ''; active.value = '';
    for (const resolve of waiters) resolve(); waiters.clear();
    const next = pending, element = trigger, request = version; pending = ''; trigger = undefined;
    await nextTick();
    if (!disposed && request === version && next && !rendered.value) activate(next, element);
  }
  onBeforeUnmount(() => { disposed = true; ++version; pending = ''; for (const resolve of waiters) resolve(); waiters.clear(); });
  return { rendered, active, open, close, closed };
}
