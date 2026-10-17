const { createHash } = require("node:crypto");

function checkoutFingerprint(plan) {
  const address = plan.address || {};
  const data = {
    items: (plan.items || []).map((item) => ({
      product: String(item.product_id || item.productId),
      inventory: item.inventoryItemId ? String(item.inventoryItemId) : null,
      category: String(item.category_id || item.categoryId || ""),
      quantity: Number(item.quantity), price: Number(item.price),
    })).sort((a, b) => a.product.localeCompare(b.product)),
    address: { id: String(address._id || ""), name: address.full_name || address.fullName || address.name || "",
      phone: address.phone || "", street: address.address_line || "", city: address.city || "", email: address.email || "" },
    shipping: String(plan.shipping_method_id || ""), fee: Number(plan.shipping_fee || 0),
    discount: String(plan.discount?.discount_id || ""), discountAmount: Number(plan.discount_amount || 0),
    total: Number(plan.total_price),
  };
  return createHash("sha256").update(JSON.stringify(data)).digest("hex");
}

module.exports = { checkoutFingerprint };
