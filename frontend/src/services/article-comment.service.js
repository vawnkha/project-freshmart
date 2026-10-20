import api from "./api.service";

class ArticleCommentService {
  constructor() { this.api = api("/api/news"); }
  async list(articleId, params = {}, signal) {
    return (await this.api.get(`/${articleId}/comments`, { params, signal })).data;
  }
  async listAdmin(params = {}, signal) {
    return (await this.api.get("/comments", { params, signal })).data;
  }
  async create(articleId, content) {
    return (await this.api.post(`/${articleId}/comments`, { content })).data;
  }
  async update(commentId, content) {
    return (await this.api.patch(`/comments/${commentId}`, { content })).data;
  }
  async remove(commentId) {
    return (await this.api.delete(`/comments/${commentId}`)).data;
  }
}

export default new ArticleCommentService();
