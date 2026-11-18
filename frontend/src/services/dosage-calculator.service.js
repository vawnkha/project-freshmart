import api from './api.service';
const products=api('/api/products'),calculator=api('/api/dosage-calculator');
export default {
  async eligible(params={},signal){return (await products.get('/dosage-calculator/eligible',{params,signal})).data;},
  async product(id,signal){return (await products.get(`/${id}/dosage-calculator`,{signal})).data;},
  async calculate(payload,signal){return (await calculator.post('/calculate',payload,{signal})).data;},
};
