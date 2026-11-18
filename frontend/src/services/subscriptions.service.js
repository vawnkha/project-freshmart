import api from './api.service';
const customer = api('/api/subscriptions');
const admin = api('/api/admin/subscriptions');
const data = promise => promise.then(response => response.data);
export default {
  policy: productId => data(customer.get('/policy', { params: productId ? { productId } : {} })),
  catalog: keyword => data(customer.get('/catalog', { params: keyword ? { keyword } : {} })),
  preview: (body, editing = false, subscriptionId) => data(customer.post('/preview', body, { params: editing ? { editing: 'true', subscriptionId } : {} })),
  create: body => data(customer.post('/', body)),
  list: params => data(customer.get('/', { params })),
  detail: id => data(customer.get(`/${id}`)),
  edit: (id, body) => data(customer.patch(`/${id}`, body)),
  lifecycle: (id, action) => data(customer.post(`/${id}/${action}`, {})),
  runQuote: (id, maximumTotal) => data(customer.post(`/runs/${id}/quote`, { maximumTotal })),
  confirmRun: (id, body) => data(customer.post(`/runs/${id}/confirm`, body)),
  rejectRun: id => data(customer.post(`/runs/${id}/reject`, {})),
  createPaypal: id => data(customer.post(`/runs/${id}/paypal/create-order`, {})),
  adminList: params => data(admin.get('/', { params })),
  adminDetail: id => data(admin.get(`/${id}`)),
  adminSummary: () => data(admin.get('/summary')),
  adminRuns: params => data(admin.get('/runs', { params })),
  adminRunAction: (id, action, reason) => data(admin.post(`/runs/${id}/${action}`, { reason })),
};
