// Development-only QA entry. Never imported by main/App/router or production.
if (!import.meta.env.DEV) throw new Error('Sage shell QA is development-only');
if (localStorage.getItem('accessToken')) throw new Error('Open this QA entry at a separate localhost origin without a signed-in account.');
const { default: axios } = await import('axios');
const id = '000000000000000000000001';
let lines = [{ product_id: id, name: 'Sản phẩm kiểm thử có tên dài — Dữ liệu minh họa cho kiểm tra responsive', quantity: 1, price: 120000, availableStock: 3, stock: 99, line_total: 120000, unit: 'gói' }];
let fail = false;
// Replacement is transport-only. The actual Pinia cart, services and components
// execute normally. No fixture request can reach a database or provider.
axios.defaults.adapter = async config => {
  if (fail) throw new Error('Network Error');
  const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
  let data = { data: [] };
  if (config.baseURL === '/api/cart') {
    if (config.method === 'put') lines = lines.map(item => ({ ...item, quantity: body.quantity, line_total: body.quantity * item.price }));
    if (config.method === 'delete') lines = [];
    data = { items: lines.map(item => ({ ...item })), subtotal: lines.reduce((total, item) => total + item.line_total, 0) };
  }
  if (config.baseURL === '/api/categories') data = { data: [{ _id: id, name: 'Danh mục kiểm thử', status: 'active' }] };
  if (config.baseURL === '/api/products') data = { data: config.params?.q === 'none' ? [] : [{ _id: id, name: lines[0]?.name || 'Sản phẩm kiểm thử', price: 120000, unit: 'gói', status: 'active', availableStock: 3 }] };
  return { config, data, status: 200, statusText: 'OK', headers: {} };
};
await import('@fortawesome/fontawesome-free/css/all.min.css');
await import('@/assets/css/user/storefront.css');
const { createApp } = await import('vue');
const { createPinia } = await import('pinia');
const { createRouter, createMemoryHistory } = await import('vue-router');
const { default: Harness } = await import('./SageShellHarness.vue');
const { useAuthStore } = await import('@/stores/user/auth');
const { useWishlistStore } = await import('@/stores/user/wishlist');
const pinia = createPinia();
const auth = useAuthStore(pinia);
auth.$patch({ userId: '000000000000000000000002', user: { name: 'Khách kiểm thử' }, accessToken: null, isLoggedIn: true, permissions: [], role: null });
useWishlistStore(pinia).items = [{ _id: id }];
// Memory router is confined to this QA entry; production definitions/guards
// are neither replaced nor imported. Auth guard verification uses the real app.
const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:pathMatch(.*)*', component: Harness }] });
await router.push('/products?q=vi&category_id=' + id); await router.isReady();
createApp(Harness, { toggleFailure: () => { fail = !fail; return fail; } }).use(pinia).use(router).mount('#app');
