const { canonical } = require("../validators/technical-specs.validator");
// Warehouse metadata remains owned by inventory_items; technicalSpecs belongs to products.
const OWNED_FIELDS = ["packageMeasure", "packageSize", "storageInstruction", "expiryMonths", "brandId", "manufacturerId"];
function comparable(value) {
  if (value?.toHexString) return value.toHexString();
  return canonical(value);
}
function transferConflicts(product, inventoryItem) {
  return OWNED_FIELDS.filter(field => {
    const value = comparable(product[field]);
    return value !== undefined && JSON.stringify(value) !== JSON.stringify(comparable(inventoryItem[field]));
  });
}
function fraction(value) {
  const [whole, decimal = ""] = String(value).split(".");
  return [BigInt(whole + decimal), 10n ** BigInt(decimal.length)];
}
function normalizedPrice(price, measure) {
  if (!measure || !Number.isFinite(price) || price < 0 || price > Number.MAX_SAFE_INTEGER) return null;
  const parsed = require("../validators/technical-specs.validator").packageMeasureSchema.safeParse(measure);
  if (!parsed.success) return null;
  const [amount, scale] = fraction(parsed.data.value);
  const [money, moneyScale] = fraction(price.toFixed(2));
  const factor = ["g", "mL"].includes(measure.unit) ? 1000n : 1n;
  const numerator = money * scale * factor, denominator = amount * moneyScale;
  const rounded = (numerator + denominator / 2n) / denominator;
  if (rounded > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return { value: Number(rounded), unit: ["g", "kg"].includes(measure.unit) ? "VND/kg" : "VND/L" };
}
module.exports = { OWNED_FIELDS, transferConflicts, normalizedPrice };
