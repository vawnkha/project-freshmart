import { defineStore } from "pinia";
import productService from "@/services/admin-product.service";
import categoryService from "@/services/category.service";
import ordersService from "@/services/orders.service";
import userService from "@/services/user.service";
import { useAuthStore } from "@/stores/user/auth";
import { hasAnyPermission } from "@/utils/permission.util";
import { getOrderRevenue } from "@/utils/dashboard.util";

export const useAdminStore = defineStore("admin", {
  state: () => ({
    dashboard: {
      totalProducts: 0,
      totalCategories: 0,
      totalOrders: 0,
      totalUsers: 0,
      revenue: 0,
      pendingOrders: 0,
    },
    loading: false,
    resources: { products: [], categories: [], orders: [], users: [] },
    loadErrors: [],
    limitedAccess: false,
  }),

  actions: {
    async fetchDashboard() {
      this.loading = true;
      try {
        const auth = useAuthStore();
        const requests = [
          ["products", ["admin:access", "product:manage"], () => productService.getAll()],
          ["categories", [], () => categoryService.getAll()],
          ["orders", ["order:read:any"], () => ordersService.getAll()],
          ["users", ["user:read"], () => userService.getAll()],
        ];
        this.limitedAccess = requests.some(([, permissions]) => !hasAnyPermission(auth, permissions));
        this.loadErrors = [];
        const results = await Promise.allSettled(requests.map(([, permissions, load]) =>
          hasAnyPermission(auth, permissions) ? load() : Promise.resolve(null)));
        results.forEach((result, index) => {
          const key = requests[index][0];
          if (result.status === "rejected") {
            console.error(`Lỗi tải dashboard ${key}:`, result.reason);
            this.loadErrors.push(key);
            this.resources[key] = null;
          } else this.resources[key] = result.value === null ? null : result.value?.data || result.value || [];
        });
        const { products, categories, orders, users } = this.resources;

        this.dashboard = {
          totalProducts: products?.length ?? null,
          totalCategories: categories?.length ?? null,
          totalOrders: orders?.length ?? null,
          totalUsers: users?.length ?? null,
          revenue: orders?.reduce((sum, item) => sum + getOrderRevenue(item), 0) ?? null,
          pendingOrders: orders?.filter((item) => item.status === "pending").length ?? null,
        };
      } finally {
        this.loading = false;
      }
    },
  },
});
