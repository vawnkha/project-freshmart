// Separate Vite HTML entry, never imported by production main/router.
if (import.meta.env.DEV) {
  const [{ createApp }, { default: Showcase }] = await Promise.all([import('vue'), import('./SageShowcase.vue')]);
  await import('../assets/css/user/storefront.css');
  createApp(Showcase).mount('#sage-showcase');
}
