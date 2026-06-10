export function mapBackendValidationErrors(errorOrErrors) {
  const errors = Array.isArray(errorOrErrors)
    ? errorOrErrors
    : errorOrErrors?.response?.data?.errors;

  if (!Array.isArray(errors)) return {};

  return errors.reduce((mapped, item) => {
    if (!item?.field) return mapped;
    mapped[item.field] = item.message || "Du lieu khong hop le";
    return mapped;
  }, {});
}

export function getFieldError(errors, field) {
  return errors?.[field] || "";
}
