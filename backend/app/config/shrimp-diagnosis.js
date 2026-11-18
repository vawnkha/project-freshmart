const { read } = require("./environment");
const path = require("node:path");
const CLASS_NAMES = ["black_gill", "black_spot", "healthy", "white_spot"];
const VIETNAMESE_LABELS = {
  black_gill: "Bệnh đen mang", black_spot: "Bệnh đốm đen", healthy: "Tôm khỏe mạnh", white_spot: "Bệnh đốm trắng",
};
// Read/filter legacy snapshots without accepting these labels for new inference.
const LEGACY_LABELS = {
  "Black Gill Disease": "Bệnh đen mang", "Black Spot Disease": "Bệnh đốm đen",
  "Healthy Shrimp": "Tôm khỏe mạnh", "White Spot Disease": "Bệnh đốm trắng",
  "Black Gill Disease Black Spot Disease": "Bệnh đen mang và đốm đen",
  "Black Gill Disease White Spot Disease": "Bệnh đen mang và đốm trắng",
  "Black Spot Disease White Spot Disease": "Bệnh đốm đen và đốm trắng",
};
const ALL_CLASS_NAMES = [...CLASS_NAMES, ...Object.keys(LEGACY_LABELS)];
function diagnosisConfig() {
  const configuredDir = read("SHRIMP_DIAGNOSIS_STORAGE_DIR");
  const storageDir = process.env.SHRIMP_DIAGNOSIS_STORAGE_DIR === undefined
    ? path.resolve(__dirname, "../../..", configuredDir)
    : path.resolve(configuredDir);
  const publicDir = path.resolve(__dirname, "../../public");
  const relative = path.relative(publicDir, storageDir);
  if (!relative || (!relative.startsWith(".." + path.sep) && relative !== ".." && !path.isAbsolute(relative))) {
    throw new Error("SHRIMP_DIAGNOSIS_STORAGE_DIR must stay outside backend/public");
  }
  return {
    aiUrl: read("SHRIMP_AI_URL"),
    apiKey: read("SHRIMP_AI_API_KEY"),
    timeout: read("SHRIMP_AI_TIMEOUT_MS"),
    storageDir,
  };
}
module.exports = { diagnosisConfig, CLASS_NAMES, ALL_CLASS_NAMES, VIETNAMESE_LABELS, MAX_BYTES: 5 * 1024 * 1024, MAX_PIXELS: 20_000_000 };
