import { createRouter, createWebHistory } from "vue-router";
import { useAppLoading } from "@/stores/user/appLoading";
import { useAuthStore } from "@/stores/user/auth";
import { isJwtExpired } from "@/utils/jwt.util";
import userRoutes from "./user";
import adminRoutes from "./admin";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    ...userRoutes,
    ...adminRoutes,
    {
      path: "/:pathMatch(.*)*",
      name: "not-found",
      component: () => import("@/pages/user/NotFoundPage.vue"),
    },
  ],
});

function hasStorePermission(authStore, permission) {
  const permissions = Array.isArray(authStore.permissions)
    ? authStore.permissions
    : [];

  return (
    authStore.role === "admin" ||
    permissions.includes("*") ||
    permissions.includes(permission)
  );
}

function hasAllStorePermissions(authStore, permissions = []) {
  return permissions.every((permission) =>
    hasStorePermission(authStore, permission),
  );
}

router.beforeEach(async (to, from, next) => {
  const { showLoading } = useAppLoading();
  const authStore = useAuthStore();

  showLoading();

  try {
    const token = authStore.accessToken || localStorage.getItem("accessToken");

    if (token && !authStore.accessToken) {
      authStore.hydrateFromToken(token);
    }

    const requiredPermissions = to.matched.flatMap((record) => {
      const value =
        record.meta.requiredPermissions || record.meta.requiredPermission || [];
      return Array.isArray(value) ? value : [value];
    });
    const isAdminArea =
      to.path.startsWith("/admin") ||
      requiredPermissions.includes("admin:access") ||
      to.matched.some((record) => record.meta.requiresAdmin);

    if (to.meta.requiresAuth && !token) {
      return next(isAdminArea ? "/admin-login" : "/login");
    }

    let decoded = null;

    if (token) {
      decoded = authStore.hydrateFromToken(token);

      if (!decoded) {
        authStore.logout();
        return next("/login");
      }

      if (isJwtExpired(decoded)) {
        authStore.logout();
        return to.meta.requiresAuth ? next("/login") : next();
      }

      if (!authStore.user) {
        await authStore.fetchProfile();
      }

      if (["login", "register", "admin-login"].includes(to.name)) {
        return next(
          hasStorePermission(authStore, "admin:access") ? "/admin" : "/",
        );
      }

      if (
        requiredPermissions.length &&
        !hasAllStorePermissions(authStore, requiredPermissions)
      ) {
        return next("/");
      }

      if (
        to.matched.some((r) => r.meta.requiresAdmin) &&
        !hasStorePermission(authStore, "admin:access")
      ) {
        return next("/");
      }
    }

    next();
  } catch (err) {
    console.error(err);
    authStore.logout();
    return next("/login");
  }
});

router.afterEach(() => {
  const { hideLoading } = useAppLoading();
  setTimeout(() => {
    hideLoading();
  }, 500);
});

export default router;
