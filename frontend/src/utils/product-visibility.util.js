export function isProductVisible(product) {
  return ['active', 'in_stock', 'out_stock', 'out_of_stock'].includes(product.status);
}

export function hasSellingPrice(product) {
  const value = product.sellingPrice === undefined ? product.price : product.sellingPrice;
  return (typeof value === 'number' || typeof value === 'string') && value !== '' && Number.isFinite(Number(value)) && Number(value) > 0;
}
