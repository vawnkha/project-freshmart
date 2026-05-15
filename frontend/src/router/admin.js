const adminRoutes = [
  {
    path: "/admin-login",
    component: () => import("@/layouts/AdminLayout.vue"),
    children: [
      {
        path: "",
        name: "admin-login",
        component: () => import("@/pages/admin/AdminLoginPage.vue"),
      },
    ],
  },
  {
    path: "/admin",
    component: () => import("@/layouts/AdminLayout.vue"),
    meta: { requiresAuth: true, requiredPermission: "admin:access" },
    children: [
      {
        path: "",
        name: "admin-dashboard",
        component: () => import("@/pages/admin/DashboardPage.vue"),
      },
      {
        path: "products",
        name: "admin-products",
        component: () => import("@/pages/admin/ProductListPage.vue"),
        meta: { requiredPermission: "product:manage" },
      },
      {
        path: "products/create",
        name: "admin-product-create",
        component: () => import("@/pages/admin/ProductCreatePage.vue"),
        meta: { requiredPermission: "product:manage" },
      },

      {
        path: "categories",
        name: "admin-categories",
        component: () => import("@/pages/admin/CategoryListPage.vue"),
        meta: { requiredPermission: "category:manage" },
      },
      {
        path: "categories/create",
        name: "admin-category-create",
        component: () => import("@/pages/admin/CategoryCreatePage.vue"),
        meta: { requiredPermission: "category:manage" },
      },

      {
        path: "orders",
        name: "admin-orders",
        component: () => import("@/pages/admin/OrderListPage.vue"),
        meta: { requiredPermission: "order:read:any" },
      },
      {
        path: "orders/:id",
        name: "admin-order-detail",
        component: () => import("@/pages/admin/OrderDetailPage.vue"),
        meta: { requiredPermission: "order:read:any" },
      },
      {
        path: "users",
        name: "admin-users",
        component: () => import("@/pages/admin/UserListPage.vue"),
        meta: { requiredPermission: "user:read" },
      },
      {
        path: "roles",
        name: "admin-roles",
        component: () => import("@/pages/admin/RoleManagementPage.vue"),
        meta: { requiredPermission: "role:manage" },
      },
      {
        path: "contacts",
        name: "admin-contacts",
        component: () => import("@/pages/admin/ContactsPage.vue"),
        meta: { requiredPermission: "contact:read" },
      },
      {
        path: "notifications",
        name: "admin-notifications",
        component: () => import("@/pages/admin/NotificationsPage.vue"),
        meta: { requiredPermission: "notification:manage" },
      },
    ],
  },
];

export default adminRoutes;
