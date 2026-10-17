import { nextTick, onBeforeUnmount, watch } from "vue";

const selector = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function useDialogFocus(open, dialog, close, { modal = true } = {}) {
  let previous;
  let background = [];
  let active = false;
  let version = 0;
  function restore() {
    if (!active) return;
    active = false;
    document.removeEventListener("keydown", onKeydown, true);
    for (const [element, inert] of background) element.inert = inert;
    background = [];
    if (previous?.isConnected) previous.focus({ preventScroll: true });
  }
  function onKeydown(event) {
    const panel = dialog.value;
    if (!panel) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    if (!modal || event.key !== "Tab") return;
    const elements = [...panel.querySelectorAll(selector)].filter((el) => el.getClientRects().length && !el.closest('[inert]'));
    const first = elements[0] || panel;
    const last = elements.at(-1) || panel;
    if (!panel.contains(document.activeElement) || (event.shiftKey && document.activeElement === first)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
  watch(open, async (value) => {
    const current = ++version;
    if (!value) { restore(); return; }
    previous = document.activeElement;
    await nextTick();
    const panel = dialog.value;
    if (current !== version || !open.value || !panel) return;
    active = true;
    if (modal) {
      let child = panel;
      while (child.parentElement && child.parentElement !== document.body) {
        for (const sibling of child.parentElement.children) {
          if (sibling !== child) { background.push([sibling, sibling.inert]); sibling.inert = true; }
        }
        child = child.parentElement;
      }
    }
    document.addEventListener("keydown", onKeydown, true);
    (panel.querySelector('input:not([disabled]),textarea:not([disabled])') || panel.querySelector(selector) || panel).focus({ preventScroll: true });
  }, { flush: "post" });
  onBeforeUnmount(() => { ++version; restore(); });
}
