// Accept legacy strings and delimiter-containing array entries without coercing objects.
function normalizeNewsTags(value) {
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

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Match a complete tag in both normalized arrays and unmigrated delimited strings.
function newsTagPattern(value) {
  const tag = String(value).normalize("NFC").trim();
  const literal = tag.split(/\s+/u).map(escapeRegex).join("\\s+");
  return `(?:^|[,;])\\s*${literal}\\s*(?:[,;]|$)`;
}

module.exports = { normalizeNewsTags, escapeRegex, newsTagPattern };
