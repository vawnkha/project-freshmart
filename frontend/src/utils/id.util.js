const OBJECT_ID = /^[a-f\d]{24}$/i;

export function normalizeId(value) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "object") {
    const nested = value.$oid ?? value._id ?? value.id;
    if (nested !== undefined && nested !== value) return normalizeId(nested);
  }
  const id = String(value);
  return OBJECT_ID.test(id) ? id : "";
}
