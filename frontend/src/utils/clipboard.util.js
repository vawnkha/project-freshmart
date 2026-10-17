export async function copyText(text, environment = globalThis) {
  try {
    if (environment.navigator?.clipboard?.writeText) {
      await environment.navigator.clipboard.writeText(String(text));
      return true;
    }
  } catch {
    /* Permission denial can still use the user-triggered legacy copy. */
  }
  const document = environment.document;
  if (!document?.execCommand) return false;
  const previousFocus = document.activeElement;
  const field = document.createElement("textarea");
  field.value = String(text);
  field.readOnly = true;
  field.className = "home-clipboard-fallback";
  field.setAttribute("aria-hidden", "true");
  field.setAttribute("tabindex", "-1");
  (document.querySelector(".user-app") || document.body).appendChild(field);
  try {
    field.select();
    return Boolean(document.execCommand("copy"));
  } catch {
    return false;
  } finally {
    field.remove();
    previousFocus?.focus?.({ preventScroll: true });
  }
}
