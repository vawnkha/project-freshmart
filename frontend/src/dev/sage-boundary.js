// QA entry uses the existing app/router unchanged. Never imported in production.
if (import.meta.env.DEV) {
  const [{ createApp }, { createPinia }, { default: router }, { default: Harness }] = await Promise.all([import('vue'), import('pinia'), import('../router/index.js'), import('./SageBoundaryHarness.vue')]);
  await import('@fortawesome/fontawesome-free/css/all.min.css');
  createApp(Harness).use(createPinia()).use(router).mount('#sage-boundary');
}
