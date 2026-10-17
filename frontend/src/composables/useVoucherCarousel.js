import { onBeforeUnmount, watch, ref } from 'vue';

// Homepage only: touch and pen retain native scroll. No autoplay or wheel interception.
export function createVoucherCarousel(rail, { previous, next, onEdges = () => {} } = {}) {
  const win = rail.ownerDocument.defaultView, removers = [];
  let intent = null, suppressClick = false, disposed = false;
  const listen = (target, event, handler, options) => {
    target.addEventListener(event, handler, options);
    removers.push(() => target.removeEventListener(event, handler, options));
  };
  function update() {
    if (disposed) return;
    const left = Math.max(0, rail.scrollLeft), end = rail.scrollWidth - rail.clientWidth;
    const edges = { canPrevious: left > 1, canNext: left < end - 1 };
    if ((!edges.canPrevious && rail.ownerDocument.activeElement === previous) ||
        (!edges.canNext && rail.ownerDocument.activeElement === next)) rail.focus({ preventScroll: true });
    onEdges(edges);
  }
  function nativeSnap() { rail.classList.remove('is-mouse-scrolled'); }
  function finish() {
    if (!intent) return;
    const old = intent;
    intent = null; // release can synchronously dispatch lostpointercapture.
    if (old.dragging) suppressClick = true;
    rail.classList.remove('is-dragging');
    if (rail.hasPointerCapture?.(old.id)) rail.releasePointerCapture(old.id);
    update();
  }
  function down(event) {
    finish(); suppressClick = false;
    if (event.pointerType !== 'mouse') { nativeSnap(); return; }
    if (!event.isPrimary || event.button !== 0 || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
    if (event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    intent = { id: event.pointerId, x: event.clientX, y: event.clientY, left: rail.scrollLeft, dragging: false };
  }
  function movePointer(event) {
    if (!intent || event.pointerId !== intent.id) return;
    const dx = event.clientX - intent.x, dy = event.clientY - intent.y;
    if (!intent.dragging) {
      if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) { finish(); return; }
      if (Math.abs(dx) < 8) return;
      intent.dragging = true; intent.left = rail.scrollLeft;
      rail.classList.add('is-dragging', 'is-mouse-scrolled');
      rail.scrollTo?.({ left: rail.scrollLeft, behavior: 'instant' });
      rail.setPointerCapture?.(intent.id);
      win.getSelection?.()?.removeAllRanges();
    }
    event.preventDefault(); rail.scrollLeft = intent.left - dx; update();
  }
  function click(event) {
    if (suppressClick && event.detail > 0) {
      event.preventDefault(); event.stopImmediatePropagation(); suppressClick = false;
    }
  }
  function move(direction) {
    finish(); nativeSnap();
    const card = rail.querySelector('.voucher-card');
    const gap = Number.parseFloat(win.getComputedStyle(rail).columnGap) || 16;
    const step = card ? card.getBoundingClientRect().width + gap : rail.clientWidth;
    rail.scrollTo({ left: rail.scrollLeft + direction * step,
      behavior: win.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    update();
  }
  function keyboard(event) {
    if (event.target !== rail || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault(); move(event.key === 'ArrowLeft' ? -1 : 1);
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault(); finish(); nativeSnap();
      rail.scrollTo({ left: event.key === 'Home' ? 0 : rail.scrollWidth, behavior: 'instant' }); update();
    }
  }
  function focus(event) {
    const card = event.target.closest('.voucher-card');
    if (!card || intent?.dragging) return;
    const box = card.getBoundingClientRect(), view = rail.getBoundingClientRect();
    if (box.left < view.left || box.right > view.right) {
      nativeSnap();
      const offset = box.left < view.left ? box.left - view.left : box.right - view.right;
      rail.scrollTo({ left: rail.scrollLeft + offset, behavior: 'instant' }); update();
    }
  }
  listen(rail, 'pointerdown', down);
  listen(win, 'pointermove', movePointer, { passive: false });
  listen(win, 'pointerup', event => { if (event.pointerId === intent?.id) finish(); });
  listen(win, 'pointercancel', event => { if (event.pointerId === intent?.id) finish(); });
  listen(win, 'blur', finish); listen(rail, 'lostpointercapture', finish);
  listen(rail, 'click', click, true); listen(rail, 'dragstart', event => event.preventDefault());
  listen(rail, 'scroll', update, { passive: true }); listen(rail, 'keydown', keyboard); listen(rail, 'focusin', focus);
  const observer = win.ResizeObserver ? new win.ResizeObserver(update) : null;
  if (observer) observer.observe(rail); else listen(win, 'resize', update);
  update();
  return { move, update, destroy() {
    if (disposed) return;
    finish(); disposed = true; observer?.disconnect(); removers.forEach(remove => remove());
    rail.classList.remove('is-dragging', 'is-mouse-scrolled');
  } };
}

const active = new Set();
if (import.meta.hot) import.meta.hot.dispose(() => { active.forEach(controller => controller.destroy()); active.clear(); });
export function useVoucherCarousel(rail, previous, next, count) {
  const canPrevious = ref(false), canNext = ref(false);
  let controller;
  function dispose() { if (controller) { controller.destroy(); active.delete(controller); controller = null; } }
  watch([rail, count], ([element]) => {
    dispose(); canPrevious.value = false; canNext.value = false;
    if (element) {
      controller = createVoucherCarousel(element, { previous: previous.value, next: next.value,
        onEdges: edges => { canPrevious.value = edges.canPrevious; canNext.value = edges.canNext; } });
      active.add(controller);
    }
  }, { flush: 'post' });
  onBeforeUnmount(dispose);
  return { canPrevious, canNext, move: direction => controller?.move(direction) };
}
