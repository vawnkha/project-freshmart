import api from "./api.service";

class CartService {
  constructor(baseUrl = "/api/cart") {
    this.api = api(baseUrl);
  }

  async getCart(userId) {
    const res = await this.api.get(`/${userId}/detailed`);
    return res.data;
  }

  async addItem(userId, productId, quantity = 1, selection = {}) {
    const res = await this.api.post(`/${userId}/items`, {
      productId,
      quantity,
      ...selection,
    });
    return res.data;
  }

  async updateItem(userId, productId, quantity, selection = {}) {
    const res = await this.api.put(`/${userId}/items/${productId}`, {
      quantity,
      ...selection,
    });
    return res.data;
  }

  async removeItem(userId, productId, lineKey) {
    const res = await this.api.delete(`/${userId}/items/${productId}`, ...(lineKey ? [{ params: { lineKey } }] : []));
    return res.data;
  }

  async clearCart(userId) {
    const res = await this.api.delete(`/${userId}/clear`);
    return res.data;
  }
}

export default new CartService();
