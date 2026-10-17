import { onBeforeUnmount, onMounted } from "vue";

// Presentation only: react to the validators' existing aria-invalid output.
// Scope observation to the submitted form, never to Admin or unrelated fields.
export function attachFormAccessibility(root) {
  let pendingForm = null;
  let observer = null;
  const clear = () => {
    observer?.disconnect();
    observer = null;
    pendingForm = null;
  };
  const focusInvalid = () => {
    if (!pendingForm?.isConnected || !root.contains(pendingForm)) return clear();
    const field = [...pendingForm.querySelectorAll(
      'input[aria-invalid="true"], select[aria-invalid="true"], textarea[aria-invalid="true"]',
    )].find((element) => !element.disabled && !element.closest('[hidden], [inert]') && element.getClientRects().length);
    if (!field) return;
    // Consume the submission before focusing: focus handlers cannot steal it back.
    clear();
    field.focus();
  };
  const arm = (scope) => {
    clear();
    pendingForm = scope;
    observer = new root.ownerDocument.defaultView.MutationObserver(focusInvalid);
    observer.observe(pendingForm, { subtree: true, attributes: true, attributeFilter: ["aria-invalid", "disabled"], childList: true });
    // Release a submission when route/dialog removal detaches its scope.
    observer.observe(root, { subtree: true, childList: true });
    // Async validators may patch after the submit listener has returned.
    queueMicrotask(() => { if (pendingForm === scope) focusInvalid(); });
  };
  const submit = (event) => { if (event.target.tagName === "FORM") arm(event.target); };
  // Existing dialog/COD actions use click handlers rather than native forms.
  const click = (event) => {
    const action = event.target.closest?.("[data-validation-submit]");
    const scope = action?.closest("[data-validation-scope]");
    if (scope && root.contains(scope) && !action.disabled) arm(scope);
  };
  const edit = () => clear();
  root.addEventListener("submit", submit, true);
  root.addEventListener("click", click, true);
  root.addEventListener("input", edit, true);
  root.addEventListener("change", edit, true);
  return () => {
    clear();
    root.removeEventListener("submit", submit, true);
    root.removeEventListener("click", click, true);
    root.removeEventListener("input", edit, true);
    root.removeEventListener("change", edit, true);
  };
}

export function useFormAccessibility(root) {
  let detach;
  onMounted(() => { detach = attachFormAccessibility(root.value); });
  onBeforeUnmount(() => detach?.());
}
