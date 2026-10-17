import { defineStore, getActivePinia } from "pinia";
import authService from "@/services/auth.service";
import userService from "@/services/user.service";
import { decodeJwtPayload } from "@/utils/jwt.util";
import { setAuthRequestContextProvider } from "@/services/api.service";

// Per-store lifecycle metadata stays in memory; credentials and public state keep
// their existing persistence contract. No watchers, timers or second session store.
const lifecycles = import.meta.hot?.data.authLifecycles || new WeakMap();
if (import.meta.hot) import.meta.hot.data.authLifecycles = lifecycles;
function lifecycle(store) {
  // Pinia devtools wraps each options-store action in a different proxy. $state
  // is the stable per-Pinia identity shared by those proxies and the real store.
  const identity = store.$state;
  if (!lifecycles.has(identity)) {
    lifecycles.set(identity, { generation: 0, login: null, profile: null });
  }
  return lifecycles.get(identity);
}
function invalidate(store) {
  const current = lifecycle(store);
  current.generation++;
  current.profile = null;
}
function capture(store, kind) {
  const current = lifecycle(store);
  const generation = current.generation;
  const token = store.accessToken, owner = store.userId;
  const authenticated = store.isLoggedIn;
  const persistedToken = localStorage.getItem("accessToken");
  const request = kind === "login" ? current.login : kind === "profile" ? current.profile : null;
  return {
    invalidated: invalidatedAuthRequest,
    isCurrent: (checkStorage = true) => current.generation === generation &&
      store.accessToken === token && store.userId === owner &&
      store.isLoggedIn === authenticated &&
      (!checkStorage || localStorage.getItem("accessToken") === persistedToken) &&
      (kind !== "login" || current.login === request) &&
      (kind !== "profile" || current.profile === request),
  };
}
export function invalidatedAuthRequest() {
  return Object.assign(new Error("Yêu cầu xác thực đã mất hiệu lực"), {
    code: "AUTH_REQUEST_INVALIDATED",
  });
}
export function isAuthRequestInvalidated(error) {
  return error?.code === "AUTH_REQUEST_INVALIDATED";
}
// The transport captures this synchronously before dispatch, including requests
// made outside AuthStore. A late 401 must not revoke a different lifecycle.
export function captureAuthRequestContext(kind) {
  const pinia = getActivePinia();
  return pinia ? capture(useAuthStore(pinia), kind) : null;
}
export function captureLoginRequestContext(store) {
  const current = lifecycle(store), request = current.login;
  return { isCurrent: (checkStorage = true) => !!request && current.login === request && request.context.isCurrent(checkStorage) };
}

const initialState = () => ({
  user: null,
  userId: null,
  role: null,
  permissions: [],
  accessToken: localStorage.getItem("accessToken") || null,
  isLoggedIn: !!localStorage.getItem("accessToken"),
});

export const useAuthStore = defineStore("auth", {
  state: initialState,

  actions: {
    hydrateFromToken(token = this.accessToken) {
      const decoded = decodeJwtPayload(token);
      if (!decoded) return null;

      if (token !== this.accessToken || String(decoded.id || "") !== String(this.userId || "")) {
        invalidate(this);
      }

      // The server profile reflects role changes made after this token was issued.
      const profile =
        token === this.accessToken &&
        this.user &&
        String(this.user._id) === String(decoded.id)
          ? this.user
          : null;

      this.user = profile;
      this.accessToken = token;
      this.userId = decoded.id || null;
      this.role = profile?.role ?? decoded.role ?? null;
      this.permissions = Array.isArray(profile?.permissions)
        ? profile.permissions
        : Array.isArray(decoded.permissions)
          ? decoded.permissions
          : [];
      this.isLoggedIn = true;

      return decoded;
    },

    async login(payload) {
      invalidate(this);
      const current = lifecycle(this);
      const request = {};
      current.login = request;
      request.context = capture(this, "login");
      const ownsRequest = (checkStorage = true) => current.login === request && request.context.isCurrent(checkStorage);
      try {
        const res = await authService.login(payload);
        if (!ownsRequest()) throw invalidatedAuthRequest();
        if (!decodeJwtPayload(res?.accessToken)?.id) {
          throw new Error("Phản hồi đăng nhập không hợp lệ");
        }

        localStorage.setItem("accessToken", res.accessToken);
        this.hydrateFromToken(res.accessToken);
        if (current.login !== request) throw invalidatedAuthRequest();
        request.context = capture(this, "login");

        await this.fetchProfile();
        if (!ownsRequest()) throw invalidatedAuthRequest();
        return res;
      } catch (error) {
        if (!ownsRequest(false)) throw invalidatedAuthRequest();
        throw error;
      }
    },

    async fetchProfile() {
      if (!this.accessToken) return null;

      this.hydrateFromToken(this.accessToken);
      const current = lifecycle(this), request = {};
      current.profile = request;
      const context = capture(this, "profile"), owner = this.userId;
      try {
        const res = await userService.getProfile();
        if (!context.isCurrent()) return null;
        if (!res?._id || String(res._id) !== String(owner)) {
          throw new Error("Không thể xác minh thông tin tài khoản");
        }
        this.user = res;
        this.userId = res._id;
        this.role = res.role || this.role;
        this.permissions = Array.isArray(res.permissions) ? res.permissions : this.permissions;
        return res;
      } catch (error) {
        // Current 401 removes storage in the interceptor. It must still reject;
        // stale lifecycle/read errors must never reach Router catch/logout.
        if (!context.isCurrent(false)) return null;
        throw error;
      }
    },

    logout() {
      invalidate(this);
      lifecycle(this).login = null;
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

    $reset() {
      invalidate(this);
      lifecycle(this).login = null;
      this.$patch(initialState());
    },
  },
});

setAuthRequestContextProvider(captureAuthRequestContext);
