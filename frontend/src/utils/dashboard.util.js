import { normalizeId } from "./id.util.js";

// This reports recorded payments, without inferring COD collection from delivery.
export function getOrderRevenue(order) {
  return order?.payment_status === "completed" && !["canceled", "cancelled"].includes(order.status)
    ? Number(order.total_price || 0) : 0;
}

export function buildDashboardLists({ products = [], categories = [], orders = [], users = [] } = {}) {
  const sold = new Map();
  for (const order of orders || []) {
    if (!["completed", "delivered"].includes(order.status)) continue;
    for (const item of order.items || []) {
      const id = normalizeId(item.product_id || item.productId);
      sold.set(id, (sold.get(id) || 0) + Number(item.quantity || 0));
    }
  }
  return {
    newestUsers: [...(users || [])].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)).slice(0, 5),
    newestOrders: [...(orders || [])].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)).slice(0, 5),
    bestSelling: (products || []).map((product) => ({ ...product, sold: sold.get(normalizeId(product)) || 0 }))
      .filter((product) => product.sold > 0)
      .sort((a, b) => b.sold - a.sold).slice(0, 5),
    categories: (categories || []).map((category) => ({ ...category,
      product_count: (products || []).filter((product) => normalizeId(product.category_id || product.categoryId) === normalizeId(category)).length,
    })).sort((a, b) => b.product_count - a.product_count).slice(0, 5),
  };
}
