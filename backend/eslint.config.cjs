const js = require("@eslint/js");
const globals = require("globals");
module.exports = [{ ignores: ["node_modules/**", "public/**"] }, js.configs.recommended, {
  languageOptions: { sourceType: "commonjs", globals: { ...globals.node, fetch: "readonly" } },
  rules: { "no-unused-vars": ["warn", { args: "none", caughtErrors: "none", varsIgnorePattern: "^_" }] },
}];
