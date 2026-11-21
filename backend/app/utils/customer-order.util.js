function customerOrder(value) {
  if (Array.isArray(value)) return value.map(customerOrder);
  if (!value || value.constructor !== Object) return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'importPrice').map(([key, entry]) => [key, customerOrder(entry)]));
}
module.exports = customerOrder;
