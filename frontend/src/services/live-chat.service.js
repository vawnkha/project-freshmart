import api from './api.service';
const customer=api('/api/chat'),admin=api('/api/admin/chat');
export default {
  me: async()=> (await customer.get('/conversations/me')).data,
  summary: async()=> (await admin.get('/summary')).data,
  list: async params=> (await admin.get('/conversations',{params})).data,
  agents: async()=> (await admin.get('/agents')).data,
  detail: async(id,staff)=> (await (staff?admin:customer).get(`/conversations/${id}`)).data,
  history: async(id,staff,params={})=> (await (staff?admin:customer).get(`/conversations/${id}/messages`,{params})).data,
  send: async(body,staff)=> (await (staff?admin:customer).post('/messages',body)).data,
  read: async(id,staff,throughSeq)=> (await (staff?admin:customer).patch(`/conversations/${id}/read`,{throughSeq})).data,
  status: async(id,body)=> (await admin.patch(`/conversations/${id}/status`,body)).data,
  assign: async(id,body)=> (await admin.patch(`/conversations/${id}/assign`,body)).data,
};
