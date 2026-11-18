// Only the chat login entry may return to another customer route. Resolve with
// the real route records; never trust an external URL or infer layout by prefix.
export function liveChatLoginReturn(query, router) {
  const path = query.redirect;
  if (query.chat !== 'open' || typeof path !== 'string' || path.length > 2048 ||
      !path.startsWith('/') || path.startsWith('//') || /[\\\u0000-\u0020]/.test(path)) return null;
  const target = router.resolve(path);
  if (target.meta.layout !== 'customer' ||
      ['login', 'register', 'forgot-password', 'reset-password', 'not-found'].includes(target.name)) return null;
  return target.fullPath;
}
