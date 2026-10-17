import api from "./api.service";

class AIService {
  constructor(baseUrl = "/api/ai") {
    this.api = api(baseUrl);
  }

  async chat(message, { signal } = {}) {
    const res = await this.api.post("/chat", { message }, { signal, timeout: 20000 });
    return res.data;
  }
}

export default new AIService();
