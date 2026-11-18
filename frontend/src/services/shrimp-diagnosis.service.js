import createApiClient from './api.service';
const api = createApiClient('/api/shrimp-diagnoses');
export default {
  async create(file, signal) {
    const data = new FormData(); data.append('image', file);
    return (await api.post('/', data, { headers: { 'Content-Type': undefined }, signal, timeout: 135000 })).data;
  },
  async list(params, signal) { return (await api.get('/', { params, signal, timeout: 15000 })).data; },
  async detail(id, signal) { return (await api.get(`/${id}`, { signal, timeout: 15000 })).data; },
  async remove(id, signal) { return (await api.delete(`/${id}`, { signal, timeout: 15000 })).data; },
  async image(id, signal) { return (await api.get(`/${id}/image`, { responseType: 'blob', signal, timeout: 15000 })).data; },
};
