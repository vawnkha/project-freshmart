// Sage contract: bs-sage-sneaker-store/references/motion-system.md.
export const SAGE_MOTION = Object.freeze({ press: 140, fast: 180, base: 260, reveal: 640, drawer: 420, route: 380, heroLine: 620, heroFade: 500, heroImage: 900, proof: 480, tab: 360, grid: 320, popover: 240, bump: 420, shake: 360, success: 420, confirm: 480, gallery: 360, galleryOpacity: 260, gallerySwap: 160, price: 600, delivery: 500, toastEnter: 360, toastExit: 220, toastVisible: 2800, toastCleanup: 240 });
export const SAGE_EASING = Object.freeze({ out: 'cubic-bezier(.23, 1, .32, 1)', inOut: 'cubic-bezier(.77, 0, .175, 1)', drawer: 'cubic-bezier(.32, .72, 0, 1)' });

// Operates only on its owned root; never modifies documentElement/body/router.
export function createStorefrontMotion(root, environment = {}) {
  const view = environment.window || root?.ownerDocument?.defaultView;
  if (!root || !view) return { refresh() {}, enterPage() {}, feedback() {}, dispose() {} };
  const IO = environment.IntersectionObserver ?? view.IntersectionObserver;
  const media = view.matchMedia?.('(prefers-reduced-motion: reduce)');
  let reduced = Boolean(media?.matches);
  let observer;
  let mutationObserver;
  let disposed = false;
  const seen = new WeakSet();
  const pending = new Set();
  const animated = new Map();
  function visible(element) { element.classList.remove('sage-reveal-pending'); element.classList.add('is-in'); pending.delete(element); observer?.unobserve(element); }
  function clearAnimation(element) { const entry = animated.get(element); if (!entry) return; view.clearTimeout(entry.timer); element.classList.remove(entry.className); animated.delete(element); }
  function animate(element, className, duration) {
    if (disposed || reduced || !element || !root.contains(element)) return;
    clearAnimation(element); element.classList.add(className);
    const timer = view.setTimeout(() => clearAnimation(element), duration);
    animated.set(element, { className, timer });
  }
  function revealAll() { for (const element of [...pending]) visible(element); observer?.disconnect(); observer = undefined; root.classList.remove('sage-motion-observer'); }
  function initializeObserver() {
    if (reduced || !IO || observer || disposed) return;
    try {
      observer = new IO(entries => { if (disposed) return; for (const entry of entries) if (entry.isIntersecting) visible(entry.target); }, { threshold: .08 });
      root.classList.add('sage-motion-observer');
    } catch { revealAll(); }
  }
  function refresh() {
    if (disposed) return;
    initializeObserver();
    for (const element of [...pending]) if (!root.contains(element)) { observer?.unobserve(element); pending.delete(element); }
    for (const element of root.querySelectorAll('.reveal, .sage-reveal')) {
      if (seen.has(element)) continue; seen.add(element);
      const rect = element.getBoundingClientRect();
      if (!observer || reduced || (rect.top < view.innerHeight && rect.bottom > 0)) { visible(element); continue; }
      try { observer.observe(element); pending.add(element); element.classList.add('sage-reveal-pending'); }
      catch { visible(element); revealAll(); }
    }
    for (const element of root.querySelectorAll('.hero-line, .hero-fade, .aquaculture-hero-media, .storefront-proof')) {
      if (seen.has(element)) continue; seen.add(element);
      const index = Number(element.style.getPropertyValue('--i')) || 0;
      const duration = element.matches('.hero-line') ? SAGE_MOTION.heroLine + 60 + index * 70 : element.matches('.hero-fade') ? SAGE_MOTION.heroFade + 180 + index * 50 : element.matches('.storefront-proof') ? SAGE_MOTION.proof + 380 : SAGE_MOTION.heroImage;
      animate(element, 'sage-hero-running', duration);
    }
  }
  function preference(event) {
    reduced = event.matches;
    if (reduced) { revealAll(); for (const element of [...animated.keys()]) clearAnimation(element); }
    else refresh();
  }
  function animationEnd(event) { const element = animated.has(event.target) ? event.target : event.target.parentElement; if (animated.has(element)) clearAnimation(element); }
  media?.addEventListener?.('change', preference);
  root.addEventListener('animationend', animationEnd);
  refresh();
  // Child route/async slot updates need not re-render the owning UserLayout.
  // Observe only node changes, never our own class/style animation writes.
  try {
    if (view.MutationObserver) {
      mutationObserver = new view.MutationObserver(() => { if (!disposed) refresh(); });
      mutationObserver.observe(root, { childList: true, subtree: true });
    }
  } catch { mutationObserver?.disconnect(); mutationObserver = undefined; }
  return {
    refresh,
    enterPage(element) { animate(element, 'sage-route-in', SAGE_MOTION.route); },
    feedback(element, kind = 'success') { const recipes = { success: ['sage-success-in', SAGE_MOTION.success], confirm: ['sage-confirm-in', SAGE_MOTION.confirm], error: ['sage-shake', SAGE_MOTION.shake], bump: ['sage-bump', SAGE_MOTION.bump], price: ['sage-price-flash', SAGE_MOTION.price] }; const recipe = recipes[kind]; if (recipe) animate(element, ...recipe); },
    dispose() { if (disposed) return; disposed = true; mutationObserver?.disconnect(); revealAll(); for (const element of [...animated.keys()]) clearAnimation(element); media?.removeEventListener?.('change', preference); root.removeEventListener('animationend', animationEnd); }
  };
}
