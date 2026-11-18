function slugify(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replaceAll("đ", "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function insertWithSlug({ requested, name, fallback, find, insert }) {
  if (requested) return insert(requested);
  const normalized = slugify(name);
  const base = /^[a-f\d]{24}$/.test(normalized)
    ? `${fallback}-${normalized}`
    : normalized || fallback;
  for (let suffix = 1; ; suffix++) {
    const slug = suffix === 1 ? base : `${base}-${suffix}`;
    if (await find(slug)) continue;
    try {
      return await insert(slug);
    } catch (error) {
      if (error.code !== 11000 || !error.keyPattern?.slug) throw error;
    }
  }
}

module.exports = { slugify, insertWithSlug };
