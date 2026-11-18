import DOMPurify from 'dompurify';

const allowedTags = ['p','br','h1','h2','h3','h4','strong','b','em','i','u','s','ul','ol','li','blockquote','pre','code','a','img','figure','figcaption','table','thead','tbody','tfoot','tr','th','td','hr','div','span','sup','sub'];
const markup = /<\/?(?:p|br|h[1-4]|strong|b|em|i|u|s|ul|ol|li|blockquote|pre|code|a|img|figure|figcaption|table|thead|tbody|tfoot|tr|th|td|hr|div|span|sup|sub)(?:\s|\/?>)/i;
const escapeText = value => value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

// A single allowlist is shared by the product editor and the storefront reader.
// Plain-text descriptions keep literal characters and line breaks on first edit.
export function sanitizeProductHtml(value, { readable = false } = {}) {
  const fragment = DOMPurify.sanitize(typeof value === 'string' ? value : '', {
    ALLOWED_TAGS: allowedTags,
    ALLOWED_ATTR: ['href','src','alt','title','colspan','rowspan','scope','start'],
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
    RETURN_DOM_FRAGMENT: true,
  });
  for (const node of fragment.querySelectorAll('[href],[src]')) {
    for (const attr of ['href','src']) {
      const url = node.getAttribute(attr);
      if (url !== null && !/^(?:https?:\/\/|\/(?!\/)|#)/i.test(url.trim())) node.removeAttribute(attr);
    }
  }
  for (const image of fragment.querySelectorAll('img')) {
    if (!image.hasAttribute('src')) image.remove();
    else if (readable) { image.setAttribute('loading','lazy'); image.setAttribute('decoding','async'); }
  }
  if (readable) for (const table of fragment.querySelectorAll('table')) {
    table.setAttribute('tabindex','0');
    table.setAttribute('aria-label','Bảng trong mô tả sản phẩm');
  }
  const container = document.createElement('div');
  container.append(fragment);
  return container.innerHTML;
}

export function productDescriptionHtml(value, options) {
  if (typeof value !== 'string' || !value.trim()) return '';
  return sanitizeProductHtml(markup.test(value) ? value : escapeText(value).replace(/\r?\n/g,'<br>'), options);
}
