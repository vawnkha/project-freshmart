import { normalizeId } from './id.util.js';
import { normalizeBlogPost } from './blog.util.js';

// Display adapter only: public scheduling/eligibility belongs to the backend.
export function homeBanner(item = {}, index = 0) {
  const raw = String(item.link || '').trim();
  let link = '';
  if (raw.startsWith('/') && !raw.startsWith('//')) link = raw;
  else {
    try { const url = new URL(raw); if (['https:', 'http:'].includes(url.protocol)) link = url.href; } catch { /* no actionable link */ }
  }
  return {
    id: normalizeId(item._id || item.id) || `home-banner-${index}`,
    imageUrl: item.imageUrl || '', mobileImageUrl: item.mobileImageUrl || item.imageUrl || '',
    title: item.title || '', subtitle: item.subtitle || '', description: item.description || '',
    buttonText: item.buttonText || '', link,
  };
}

export function homePosts(rows, categories = new Map()) {
  // The public detail endpoint resolves a slug, never an ObjectId fallback.
  return [...rows].filter(item => typeof item.slug === 'string' && item.slug.trim())
    .sort((a, b) => (Date.parse(b.publishedAt || b.createdAt) || 0) - (Date.parse(a.publishedAt || a.createdAt) || 0))
    .slice(0, 3).map(item => normalizeBlogPost(item, categories));
}
