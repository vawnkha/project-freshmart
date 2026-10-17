const sanitizeHtml = require("sanitize-html");

const NEWS_HTML_OPTIONS = {
  allowedTags: [
    "p",
    "br",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "strong",
    "em",
    "u",
    "s",
    "blockquote",
    "ul",
    "ol",
    "li",
    "a",
    "img",
    "figure",
    "figcaption",
    "code",
    "pre",
    "table",
    "caption",
    "thead",
    "tbody",
    "tfoot",
    "tr",
    "th",
    "td",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    img: ["src", "alt", "title", "width", "height", "loading"],
    th: ["scope", "colspan", "rowspan"],
    td: ["colspan", "rowspan"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: { img: ["http", "https"] },
  allowProtocolRelative: false,
  transformTags: {
    h1: sanitizeHtml.simpleTransform("h2"),
    a: sanitizeHtml.simpleTransform("a", {
      rel: "noopener noreferrer",
    }),
  },
};

function sanitizeNewsHtml(value) {
  return sanitizeHtml(String(value || ""), NEWS_HTML_OPTIONS);
}

function sanitizePublicLink(value) {
  const link = String(value || "").trim();
  if (!link) return "";
  if (link.startsWith("/") && !link.startsWith("//")) return link;
  try {
    const parsed = new URL(link);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : "";
  } catch (_) {
    return "";
  }
}

module.exports = { sanitizeNewsHtml, sanitizePublicLink };
