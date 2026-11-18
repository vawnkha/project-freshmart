// Defaults and validation metadata live in one catalog; never log raw values.
const catalog = require("./environment.schema.json");

function invalid(name) { throw new Error(`Invalid environment variable: ${name}`); }

function read(name, env = process.env) {
  const rule = catalog[name];
  if (!rule) throw new Error(`Unknown environment variable: ${name}`);
  const supplied = env[name] !== undefined;
  const raw = supplied ? String(env[name]).trim() : rule.default;
  if (raw === undefined || raw === null) {
    if (rule.required) invalid(name);
    return undefined;
  }
  if (raw === "" && rule.allowEmpty) return "";
  if (String(raw).trim() === "") invalid(name);
  let value = raw;
  if (rule.type === "number" || rule.type === "integer") {
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(String(raw))) invalid(name);
    value = Number(raw);
    if (!Number.isFinite(value) || (rule.type === "integer" && !Number.isSafeInteger(value))
      || value < rule.min || (rule.exclusiveMin && value === rule.min) || value > rule.max) invalid(name);
  } else if (rule.type === "boolean") {
    if (![true, false, "true", "false"].includes(raw)) invalid(name);
    value = raw === true || raw === "true";
  } else if (rule.type === "url" || rule.type === "origins") {
    const urls = rule.type === "origins" ? String(raw).split(",").map(s => s.trim()) : [String(raw)];
    for (const item of urls) {
      try {
        const url = new URL(item);
        if (!["http:", "https:"].includes(url.protocol) || url.username || url.password
          || (rule.type === "origins" && item !== url.origin)) invalid(name);
      } catch { invalid(name); }
    }
    value = rule.type === "origins" ? urls.join(",") : String(raw);
  } else if (rule.type === "mongo") {
    if (!/^mongodb(?:\+srv)?:\/\/\S+$/.test(raw)) invalid(name);
  } else if (rule.type === "duration") {
    if (!/^\d+(?:\.\d+)?\s*(?:ms|milliseconds?|s|seconds?|m|minutes?|h|hours?|d|days?|w|weeks?|y|years?)?$/i.test(raw) || !Number.isFinite(parseFloat(raw)) || parseFloat(raw) <= 0) invalid(name);
  } else if (rule.type === "ids") {
    if (!String(raw).split(",").every(id => /^[a-f\d]{24}$/i.test(id.trim()))) invalid(name);
  } else if (rule.type === "email") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) invalid(name);
  }
  if (rule.pattern && !new RegExp(rule.pattern).test(String(value))) invalid(name);
  if (rule.values && !rule.values.includes(value)) invalid(name);
  if (rule.minLength && String(value).length < rule.minLength) throw new Error(`Invalid environment variable: ${name}; minimum ${rule.minLength} characters`);
  return value;
}

function validateEnvironment(env = process.env) {
  for (const name of Object.keys(catalog)) read(name, env);
  if (read("NODE_ENV", env) === "production") {
    for (const name of ["MONGODB_URI", "CORS_ORIGINS", "SHRIMP_AI_API_KEY"]) {
      if (!env[name] || !String(env[name]).trim()) invalid(name);
    }
  }
  if (read("EXPIRY_URGENT_DAYS", env) >= read("EXPIRY_WARNING_DAYS", env)) invalid("EXPIRY_URGENT_DAYS");
  if (read("EXCHANGE_RATE_PROVIDER", env) !== "exchangerate-api" && !read("EXCHANGE_RATE_API_URL", env)) invalid("EXCHANGE_RATE_API_URL");
}

module.exports = { read, validateEnvironment, catalog };
