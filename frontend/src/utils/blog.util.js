import DOMPurify from "dompurify";
import { normalizeId } from "./id.util.js";
import { normalizeNewsTags } from "./news-tags.util.js";

const articleOptions = {
  USE_PROFILES: { html: true },
  ADD_ATTR: ["target"],
  FORBID_TAGS: ["iframe", "style", "form", "input", "button", "video", "audio"],
  FORBID_ATTR: ["style", "id", "name", "class"],
};

// DOMPurify can also be supplied with a jsdom window in unit tests.
export function articleText(html, purifier = DOMPurify) {
  const fragment = purifier.sanitize(String(html || ""), {
    ...articleOptions,
    RETURN_DOM_FRAGMENT: true,
  });
  fragment.querySelectorAll("p,br,h1,h2,h3,h4,h5,h6,li,blockquote,td,th").forEach((node) => {
    node.appendChild(node.ownerDocument.createTextNode(" "));
  });
  return (fragment.textContent || "").replace(/\s+/g, " ").trim();
}

export function articleExcerpt(post, purifier = DOMPurify, limit = 170) {
  const text = [post.summary, post.excerpt, post.description, post.content]
    .filter((value) => typeof value === "string" && value.trim())
    .map((value) => articleText(value, purifier)).find(Boolean) || "";
  if (text.length <= limit) return text;
  const cut = Array.from(text).slice(0, limit - 1).join("");
  const space = cut.lastIndexOf(" ");
  return `${space > limit * 0.65 ? cut.slice(0, space) : cut}…`;
}

export function normalizeBlogPost(item, categories = new Map(), purifier = DOMPurify) {
  const id = normalizeId(item._id || item.id);
  const categoryId = normalizeId(item.categoryId || item.category?._id);
  const date = new Date(item.publishedAt || item.createdAt || NaN);
  const validDate = !Number.isNaN(date.getTime());
  return {
    id,
    slug: item.slug || id,
    title: item.title || "Bài viết chưa có tiêu đề",
    image: item.thumbnail || item.images?.[0] || "",
    date: validDate ? date.toLocaleDateString("vi-VN") : "",
    datetime: validDate ? date.toISOString() : "",
    excerpt: articleExcerpt(item, purifier),
    category: item.category?.name || item.categoryName || categories.get(categoryId)?.name || "",
    categoryId,
    tags: normalizeNewsTags(item.tags),
  };
}

export function filterBlogPosts(posts, keyword, categoryId) {
  const q = String(keyword || "").trim().toLocaleLowerCase("vi-VN");
  return posts.filter((post) =>
    (!categoryId || post.categoryId === categoryId) &&
    (!q || [post.title, post.excerpt, post.category, ...normalizeNewsTags(post.tags)]
      .some((value) => String(value || "").toLocaleLowerCase("vi-VN").includes(q))),
  );
}

export function relatedBlogPosts(posts, current, limit = 3) {
  if (!current) return [];
  const seen = new Set();
  const eligible = posts.filter((post) => {
    if ((post.id && post.id === current.id) || post.slug === current.slug) return false;
    const key = post.id || post.slug;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => (Date.parse(b.datetime) || 0) - (Date.parse(a.datetime) || 0));
  const sameCategory = (post) => Boolean(current.categoryId && post.categoryId === current.categoryId);
  return [...eligible.filter(sameCategory), ...eligible.filter((post) => !sameCategory(post))].slice(0, limit);
}

export function prepareArticleHtml(html, purifier = DOMPurify) {
  const fragment = purifier.sanitize(String(html || ""), {
    ...articleOptions,
    RETURN_DOM_FRAGMENT: true,
  });
  const document = fragment.ownerDocument;
  // Keep a single page H1 and avoid skipped levels in CMS content.
  let previousLevel = 1;
  fragment.querySelectorAll("h1,h2,h3,h4,h5,h6").forEach((heading) => {
    const level = Math.min(Math.max(2, Number(heading.tagName.slice(1))), previousLevel + 1);
    previousLevel = level;
    const replacement = document.createElement(`h${level}`);
    replacement.append(...heading.childNodes);
    heading.replaceWith(replacement);
  });
  fragment.querySelectorAll('a[target="_blank"]').forEach((link) => {
    link.setAttribute("rel", "noopener noreferrer");
  });
  fragment.querySelectorAll("img").forEach((image) => {
    image.setAttribute("loading", "lazy");
    image.setAttribute("decoding", "async");
    if (!image.hasAttribute("alt")) image.setAttribute("alt", "");
  });
  fragment.querySelectorAll("table").forEach((table) => {
    const wrapper = document.createElement("div");
    wrapper.className = "knowledge-table-scroll";
    wrapper.setAttribute("role", "region");
    wrapper.setAttribute("aria-label", table.querySelector("caption")?.textContent?.trim() || "Bảng nội dung bài viết");
    wrapper.setAttribute("tabindex", "0");
    table.replaceWith(wrapper);
    wrapper.appendChild(table);
  });
  const container = document.createElement("div");
  container.appendChild(fragment);
  return container.innerHTML;
}
