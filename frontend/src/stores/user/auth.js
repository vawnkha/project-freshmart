import { defineStore } from "pinia";
import authService from "@/services/auth.service";
import userService from "@/services/user.service";
import { decodeJwtPayload } from "@/utils/jwt.util";

export const useAuthStore = defineStore("auth", {
  state: () => ({
    user: null,
    userId: null,
    role: null,
    permissions: [],
    accessToken: localStorage.getItem("accessToken") || null,
    isLoggedIn: !!localStorage.getItem("accessToken"),
  }),

  actions: {
    hydrateFromToken(token = this.accessToken) {
      const decoded = decodeJwtPayload(token);
      if (!decoded) return null;

      this.accessToken = token;
      this.userId = decoded.id || null;
      this.role = decoded.role || null;
      this.permissions = Array.isArray(decoded.permissions)
        ? decoded.permissions
        : [];
      this.isLoggedIn = true;

      return decoded;
    },

    async login(payload) {
      const res = await authService.login(payload);

      this.accessToken = res.accessToken;
      localStorage.setItem("accessToken", res.accessToken);

      this.hydrateFromToken(res.accessToken);

      await this.fetchProfile();
      return res;
    },

    async fetchProfile() {
      if (!this.accessToken) return null;

      this.hydrateFromToken(this.accessToken);
      const res = await userService.getProfile();
      this.user = res;
      this.userId = res?._id || this.userId;
      this.role = res?.role || this.role;
      this.permissions = Array.isArray(res?.permissions)
        ? res.permissions
        : this.permissions;
      return res;
    },

    logout() {
      this.user = null;
      this.userId = null;
      this.role = null;
      this.permissions = [];
      this.accessToken = null;
      this.isLoggedIn = false;

      localStorage.removeItem("accessToken");
      localStorage.removeItem("userId");
      localStorage.removeItem("role");
    },
  },
});
