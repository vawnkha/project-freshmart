import api from "./api.service";
const client = api("/api/admin/dashboard");
export default {
  overview: async (params, signal) =>
    (await client.get("/", { params, signal })).data,
};
