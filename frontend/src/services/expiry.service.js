import api from "./api.service";
const client = api("/api/admin/inventory/expiry");
export default {
  summary: async () => (await client.get("/summary")).data,
  batches: async params => (await client.get("/batches", { params })).data,
  batch: async id => (await client.get(`/batches/${id}`)).data,
  correctExpiry: async (id, data) => (await client.patch(`/batches/${id}/expiry-date`, data)).data,
  recommendation: async id => (await client.get(`/batches/${id}/recommendation`)).data,
  create: async (id, data) => (await client.post(`/batches/${id}/promotion-proposals`, data)).data,
  edit: async (id, data) => (await client.patch(`/promotion-proposals/${id}`, data)).data,
  proposals: async params => (await client.get("/promotion-proposals", { params })).data,
  approve: async (id, data = {}) => (await client.post(`/promotion-proposals/${id}/approve`, data)).data,
  reject: async (id, reason) => (await client.post(`/promotion-proposals/${id}/reject`, { reason })).data,
  cancel: async id => (await client.post(`/promotion-proposals/${id}/cancel`)).data,
};
