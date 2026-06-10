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
        path: "inventory-items",
        name: "admin-inventory-items",
        component: () =>
          import("@/views/admin/inventory/InventoryItemListPage.vue"),
        meta: { requiredPermission: "inventory:manage" },
      },
      {
        path: "inventory-batches",
        name: "admin-inventory-batches",
        component: () =>
          import("@/views/admin/inventory/InventoryBatchListPage.vue"),
        meta: { requiredPermission: "inventory:manage" },
      },
      {
        path: "inventory-summaries",
        name: "admin-inventory-summaries",
        component: () =>
          import("@/views/admin/inventory/InventorySummaryListPage.vue"),
        meta: { requiredPermission: "inventory:manage" },
      },
      {
        path: "inventory-transactions",
        name: "admin-inventory-transactions",
        component: () =>
          import("@/views/admin/inventory/InventoryTransactionListPage.vue"),
        meta: { requiredPermission: "inventory:manage" },
      },
      {
        path: "purchase-orders",
        name: "admin-purchase-orders",
        component: () =>
          import("@/views/admin/inventory/PurchaseOrderListPage.vue"),
        meta: { requiredPermission: "purchase-order:manage" },
      },
      {
        path: "purchase-orders/create",
        name: "admin-purchase-order-create",
        component: () =>
          import("@/views/admin/inventory/PurchaseOrderCreatePage.vue"),
        meta: { requiredPermission: "purchase-order:manage" },
      },
      {
        path: "purchase-orders/:id",
        name: "admin-purchase-order-detail",
        component: () =>
          import("@/views/admin/inventory/PurchaseOrderDetailPage.vue"),
        meta: { requiredPermission: "purchase-order:manage" },
      },

      {
        path: "categories",
        name: "admin-categories",
        component: () => import("@/views/admin/catalog/CategoryListPage.vue"),
        meta: { requiredPermission: "category:manage" },
      },
      {
        path: "categories/create",
        name: "admin-category-create",
        component: () => import("@/pages/admin/CategoryCreatePage.vue"),
        meta: { requiredPermission: "category:manage" },
      },
      {
        path: "brands",
        name: "admin-brands",
        component: () => import("@/views/admin/catalog/BrandListPage.vue"),
        meta: { requiredPermission: "brand:manage" },
      },
      {
        path: "manufacturers",
        name: "admin-manufacturers",
        component: () =>
          import("@/views/admin/catalog/ManufacturerListPage.vue"),
        meta: { requiredPermission: "manufacturer:manage" },
      },
      {
        path: "suppliers",
        name: "admin-suppliers",
        component: () => import("@/views/admin/catalog/SupplierListPage.vue"),
        meta: { requiredPermission: "supplier:manage" },
      },
      {
        path: "shipping-methods",
        name: "admin-shipping-methods",
        component: () =>
          import("@/views/admin/shipping/ShippingMethodListPage.vue"),
        meta: { requiredPermission: "shipping-method:manage" },
      },
      {
        path: "discounts",
        name: "admin-discounts",
        component: () => import("@/views/admin/marketing/DiscountListPage.vue"),
        meta: { requiredPermission: "discount:manage" },
      },
      {
        path: "news-categories",
        name: "admin-news-categories",
        component: () =>
          import("@/views/admin/content/NewsCategoryListPage.vue"),
        meta: { requiredPermission: "news:manage" },
      },
      {
        path: "news",
        name: "admin-news",
        component: () => import("@/views/admin/content/NewsListPage.vue"),
        meta: { requiredPermission: "news:manage" },
      },
      {
        path: "news/create",
        name: "admin-news-create",
        component: () => import("@/views/admin/content/NewsCreatePage.vue"),
        meta: { requiredPermission: "news:manage" },
      },
      {
        path: "news/:id/edit",
        name: "admin-news-edit",
        component: () => import("@/views/admin/content/NewsEditPage.vue"),
        meta: { requiredPermission: "news:manage" },
      },
      {
        path: "banners",
        name: "admin-banners",
        component: () => import("@/views/admin/content/BannerListPage.vue"),
        meta: { requiredPermission: "banner:manage" },
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
