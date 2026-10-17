import { reactive, ref, unref, watch } from "vue";

// The caller's reactive form is the only source of values. Typed schemas keep
// their Zod parsing behavior without creating a second form state.
export function useSchemaForm({ validationSchema, values }) {
  const errors = reactive({});
  const submitted = ref(false);
  let pendingValues;
  let validationRun = 0;

  function replaceErrors(next) {
    for (const field of Object.keys(errors)) delete errors[field];
    for (const [field, message] of Object.entries(next)) {
      if (message) errors[field] = message;
    }
  }

  async function validateSnapshot(snapshot) {
    const run = ++validationRun;
    const result = await unref(validationSchema).parse(snapshot);
    const next = {};
    for (const issue of result.errors || []) {
      if (issue.path && !next[issue.path]) next[issue.path] = issue.errors?.[0] || "";
    }
    if (run === validationRun) replaceErrors(next);
    return { valid: (result.errors || []).length === 0, errors: next };
  }

  function setValues(snapshot) {
    pendingValues = snapshot;
  }

  async function validate() {
    submitted.value = true;
    const snapshot = pendingValues ?? values();
    pendingValues = undefined;
    return validateSnapshot(snapshot);
  }

  function setErrors(next) {
    for (const [field, message] of Object.entries(next || {})) {
      if (message) errors[field] = message;
      else delete errors[field];
    }
  }

  function resetForm() {
    ++validationRun;
    pendingValues = undefined;
    submitted.value = false;
    replaceErrors({});
  }

  watch(
    values,
    (snapshot) => {
      if (submitted.value) void validateSnapshot(snapshot);
    },
    { deep: true },
  );

  return { errors, resetForm, setErrors, setValues, submitted, validate };
}
