import { normalizeId } from "./id.util.js";
import { validSlug } from "./slug.util.js";

export function productPath(product) {
  const slug = product?.slug;
  const key = validSlug(slug) && !normalizeId(slug)
    ? slug
    : normalizeId(product?.product_id || product?.productId || product?._id || product?.id);
  return `/products/${key}`;
}
