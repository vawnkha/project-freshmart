const { z } = require("zod");
const Exact = require('../utils/exact-decimal.util');
const { instructionProblem, positive } = require('../utils/dosage-instruction.util');

// Decimal strings retain the manufacturer's significant digits; never coerce CFU to Number.
const decimal = z.string().trim().max(32).regex(/^(?:0|[1-9]\d{0,23})(?:\.\d{1,24})?$/, "Giá trị phải là số thập phân dương")
  .refine(value => /[1-9]/.test(value), "Giá trị phải lớn hơn 0");
const text = (max = 500) => z.string().trim().min(1).max(max);
const optionalText = (max = 500) => z.string().trim().max(max).optional();
const densitySchema = z.object({
  coefficient: decimal,
  exponent: z.number().int().min(-30).max(30),
  unit: z.enum(["CFU/g", "CFU/mL", "CFU/kg", "CFU/L", "CFU/unit"]),
}).strict();
const dosageInstructionSchema=z.object({
  id:z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/).optional(),
  purpose:text(300),amount:decimal.optional(),maxAmount:decimal.optional(),unit:text(40).optional(),basisAmount:decimal.optional(),
  basisUnit:z.enum(['m3_water','kg_feed','g_feed','m2_pond','L_water','other']).optional(),
  basisLabel:optionalText(80),instructions:optionalText(2000),frequency:optionalText(500),sourceNote:optionalText(2000),isActive:z.boolean().optional(),
}).strict().superRefine((row,context)=>{
  if(positive(row.maxAmount)&&positive(row.amount)&&Exact.from(row.maxAmount).compare(row.amount)<0)context.addIssue({code:'custom',path:['maxAmount'],message:'Liều tối đa phải lớn hơn hoặc bằng liều tối thiểu'});
  if(row.basisUnit==='other'&&!row.basisLabel)context.addIssue({code:'custom',path:['basisLabel'],message:'Cần ghi rõ đơn vị áp dụng'});
  if(row.isActive===true){const message=instructionProblem(row);if(message)context.addIssue({code:'custom',path:['isActive'],message});}
});
const technicalSpecsSchema = z.object({
  microorganisms: z.array(z.object({
    name: text(160), strainCode: optionalText(80),
    density: densitySchema.optional(), sporeDensity: densitySchema.optional(),
  }).strict()).max(30).optional(),
  totalDensity: densitySchema.optional(),
  sporeDensity: densitySchema.optional(),
  activeIngredients: z.array(z.object({ name: text(160), amount: decimal.optional(), unit: optionalText(40) }).strict()).max(30).optional(),
  purposes: z.array(text(300)).max(20).optional(),
  applicationPurpose: optionalText(1000),
  dosages: z.union([z.array(dosageInstructionSchema).max(30),z.string().max(8000)]).optional(),
  usageInstruction: optionalText(4000), notes: optionalText(4000),
}).strict().superRefine((specs,context)=>{
  const ids=new Set();
  if(Array.isArray(specs.dosages))specs.dosages.forEach((row,index)=>{if(row.id&&ids.has(row.id))context.addIssue({code:'custom',path:['dosages',index,'id'],message:'ID hướng dẫn phải duy nhất trong sản phẩm'});if(row.id)ids.add(row.id);});
});
const packageMeasureSchema = z.object({ value: decimal, unit: z.enum(["g", "kg", "mL", "L"]) }).strict();
function jsonField(schema) {
  return z.preprocess(value => {
    if (typeof value !== "string") return value;
    try { return JSON.parse(value); } catch { return value; }
  }, schema);
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical).filter(v => v !== undefined);
  if (value && typeof value === "object") {
    const entries = Object.keys(value).sort().map(key => [key, canonical(value[key])])
      .filter(([, v]) => v !== undefined && !(Array.isArray(v) && !v.length));
    return entries.length ? Object.fromEntries(entries) : undefined;
  }
  return value === "" || value === null ? undefined : value;
}
module.exports = { technicalSpecsSchema, dosageInstructionSchema, packageMeasureSchema, jsonField, canonical };
