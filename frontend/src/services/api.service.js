import axios from "axios";

// AuthStore supplies the lifecycle authority. Keeping this callback injection
// avoids a service -> store -> service import cycle and stores no session here.
let authRequestContextProvider = () => null;
export function setAuthRequestContextProvider(provider) {
  authRequestContextProvider = provider;
}

const commonConfig = {
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
};

export default (baseURL) => {
  const instance = axios.create({
    baseURL,
    ...commonConfig,
  });

  instance.interceptors.request.use((config) => {
    const kind = baseURL === "/api/auth" && config.url === "/login" ? "login"
      : baseURL === "/api/users" && config.url === "/me" ? "profile" : undefined;
    config.authRequestContext = authRequestContextProvider(kind);
    const token = localStorage.getItem("accessToken");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  }, undefined, { synchronous: true });

  instance.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401 && error.response?.data?.code !== "INVALID_CURRENT_PASSWORD") {
        if (error.config?.authRequestContext && !error.config.authRequestContext.isCurrent()) {
          return Promise.reject(error.config.authRequestContext.invalidated());
        }
        localStorage.removeItem("accessToken");

        const isAdminPath = window.location.pathname.startsWith("/admin");
        const loginPath = isAdminPath ? "/admin-login" : "/login";

        if (window.location.pathname !== loginPath) {
          window.location.href = loginPath;
        }
      }
      return Promise.reject(error);
    }
  );

  return instance;
};
