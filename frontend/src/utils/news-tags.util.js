// Keep the same normalization contract as backend/app/utils/news-tags.util.js.
export function normalizeNewsTags(value) {
  const entries = typeof value === "string" ? [value] : Array.isArray(value) ? value : [];
  const seen = new Set();
  const tags = [];
  for (const entry of entries) {
    if (typeof entry !== "string") continue;
    for (const part of entry.split(/[,;]/u)) {
      const tag = part.normalize("NFC").replace(/\s+/gu, " ").trim();
      const key = tag.toLocaleLowerCase("vi-VN");
      if (!tag || seen.has(key)) continue;
      seen.add(key);
      tags.push(tag);
    }
  }
  return tags;
}
