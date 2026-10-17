import { onBeforeUnmount, ref } from 'vue';
import { useDialogFocus } from './useDialogFocus';
// A document-owned lock shared only by Client overlays. The last owner restores
// the exact inline value/priority that existed before the first overlay opened.
const locks = new WeakMap();
const activeDocuments = new Set();
function restoreScroll(doc, lock) {
  if (lock.value) doc.body.style.setProperty('overflow', lock.value, lock.priority);
  else doc.body.style.removeProperty('overflow');
}
// Development HMR can replace this module before old component instances are
// disposed. Release its owned style first; never leave the next Admin route locked.
if (import.meta.hot) import.meta.hot.dispose(() => {
  for (const doc of activeDocuments) {
    const lock = locks.get(doc);
    if (lock) restoreScroll(doc, lock);
    locks.delete(doc);
  }
  activeDocuments.clear();
});
export function useSageOverlay(close) {
  const panel = ref(null);
  const fallbackOpen = ref(false);
  useDialogFocus(fallbackOpen, panel, close);
  let dialog;
  let previous;
  let ownsLock = false;
  let native = false;
  function trap(event) {
    // Native dialog blocks the page but can send Tab to browser chrome at the
    // boundary. Explicitly wrap there; the legacy helper is fallback-only.
    if (!native || event.key !== 'Tab' || !panel.value) return;
    const controls = [...panel.value.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]')]
      .filter(element => element.tabIndex >= 0 && element.getClientRects().length && !element.closest('[inert],[hidden]'));
    const first = controls[0] || panel.value;
    const last = controls.at(-1) || panel.value;
    const active = panel.value.ownerDocument.activeElement;
    if (!panel.value.contains(active) || (event.shiftKey && active === first) || (!event.shiftKey && active === last)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    }
  }
  function enter(element) {
    if (ownsLock && dialog === element) return;
    dialog = element; previous = element.ownerDocument.activeElement;
    native = typeof element.showModal === 'function';
    if (native) element.showModal();
    else { element.setAttribute('open', ''); fallbackOpen.value = true; }
    const doc = element.ownerDocument;
    const existing = locks.get(doc);
    const lock = existing || { count: 0, value: doc.body.style.getPropertyValue('overflow'), priority: doc.body.style.getPropertyPriority('overflow') };
    ++lock.count; locks.set(doc, lock); activeDocuments.add(doc); ownsLock = true;
    doc.body.style.setProperty('overflow', 'hidden');
    (panel.value?.querySelector('[autofocus]') || panel.value?.querySelector('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]') || panel.value)?.focus({ preventScroll: true });
  }
  function release() {
    fallbackOpen.value = false;
    const doc = dialog?.ownerDocument;
    if (native && dialog?.open) dialog.close();
    else dialog?.removeAttribute('open');
    if (ownsLock && doc) {
      const lock = locks.get(doc);
      if (lock && --lock.count === 0) { restoreScroll(doc, lock); locks.delete(doc); activeDocuments.delete(doc); }
    }
    ownsLock = false;
    // Do not steal focus from another modal when a lower overlay is removed.
    const activeModal = doc?.querySelector('dialog[open]');
    if (!activeModal && previous?.isConnected) previous.focus({ preventScroll: true });
    dialog = undefined; previous = undefined;
  }
  onBeforeUnmount(release);
  return { panel, enter, release, trap };
}
