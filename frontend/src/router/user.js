const userRoutes = [
  {
    path: "/",
    component: () => import("@/layouts/UserLayout.vue"),
    children: [
      {
        path: "",
        name: "home",
        component: () => import("@/pages/user/HomePage.vue"),
      },
      {
        path: "about",
        name: "about",
        component: () => import("@/pages/user/AboutPage.vue"),
      },
      {
        path: "contact",
        name: "contact",
        component: () => import("@/pages/user/ContactPage.vue"),
      },
      {
        path: "chan-doan",
        name: "shrimp-diagnosis",
        component: () => import("@/pages/user/ShrimpDiagnosisPage.vue"),
        meta: { title: "Chẩn đoán" },
      },
      {
        path: "products",
        name: "products",
        component: () => import("@/pages/user/ProductPage.vue"),
      },
      {
        path: "products/:id",
        name: "product-detail",
        component: () => import("@/pages/user/ProductDetailPage.vue"),
      },
      {
        path: "blog",
        name: "blog",
        component: () => import("@/pages/user/BlogPage.vue"),
      },
      {
        path: "blog/:id",
        name: "blog-detail",
        component: () => import("@/pages/user/BlogDetailPage.vue"),
      },
      {
        path: "cart",
        name: "cart",
        component: () => import("@/pages/user/CartPage.vue"),
        meta: { requiresAuth: true },
      },
      {
        path: "checkout",
        name: "checkout",
        component: () => import("@/pages/user/CheckoutPage.vue"),
        meta: { requiresAuth: true },
      },
      {
        path: "profile",
        name: "profile",
        component: () => import("@/pages/user/UserProfilePage.vue"),
        meta: { requiresAuth: true },
      },
      {
        path: "wishlist",
        name: "wishlist",
        component: () => import("@/pages/user/WishListPage.vue"),
        meta: { requiresAuth: true },
      },
      {
        path: "login",
        name: "login",
        component: () => import("@/pages/user/LoginPage.vue"),
      },
      {
        path: "register",
        name: "register",
        component: () => import("@/pages/user/RegisterPage.vue"),
      },
      {
        path: "forgot-password",
        name: "forgot-password",
        component: () => import("@/pages/user/ForgotPasswordPage.vue"),
      },
      {
        path: "reset-password/:userId/:token",
        name: "reset-password",
        component: () => import("@/pages/user/ResetPasswordPage.vue"),
      },
    ],
  },
];

export default userRoutes;
