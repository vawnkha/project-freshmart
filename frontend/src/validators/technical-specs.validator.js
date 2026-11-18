import { z } from 'zod';
import { compareDecimalStrings, dosageBasis } from '@/utils/dosage-calculator.util';
const decimal = z.string().trim().max(32).regex(/^(?:0|[1-9]\d{0,23})(?:\.\d{1,24})?$/, 'Nhập số thập phân dương, không dùng dấu phẩy').refine(v => /[1-9]/.test(v), 'Giá trị phải lớn hơn 0');
const text = (max = 500) => z.string().trim().min(1, 'Không được để trống').max(max);
const optionalText = (max = 500) => z.string().trim().max(max).optional();
export const densitySchema = z.object({ coefficient: decimal, exponent: z.number().int().min(-30).max(30), unit: z.enum(['CFU/g','CFU/mL','CFU/kg','CFU/L','CFU/unit']) }).strict();
const dosageInstructionSchema=z.object({
  id:z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/).optional(),purpose:text(300),amount:decimal.optional(),maxAmount:decimal.optional(),unit:text(40).optional(),basisAmount:decimal.optional(),
  basisUnit:z.enum(['m3_water','kg_feed','g_feed','m2_pond','L_water','other']).optional(),basisLabel:optionalText(80),instructions:optionalText(2000),
  frequency:optionalText(500),sourceNote:optionalText(2000),isActive:z.boolean().optional(),
}).strict().superRefine((row,context)=>{
  if(row.maxAmount&&row.amount&&compareDecimalStrings(row.maxAmount,row.amount)<0)context.addIssue({code:'custom',path:['maxAmount'],message:'Liều tối đa phải lớn hơn hoặc bằng liều tối thiểu'});
  if(row.basisUnit==='other'&&!row.basisLabel)context.addIssue({code:'custom',path:['basisLabel'],message:'Cần ghi rõ đơn vị áp dụng'});
  if(row.isActive===true&&(!row.amount||!row.basisAmount||!['mg','g','kg','mL','L'].includes(row.unit)||!dosageBasis(row.basisUnit)))context.addIssue({code:'custom',path:['isActive'],message:'Cần đủ liều lượng dương, đơn vị chế phẩm và môi trường nước/thức ăn để bật tính tự động'});
});
export const technicalSpecsSchema = z.object({
  microorganisms: z.array(z.object({ name: text(160), strainCode: optionalText(80), density: densitySchema.optional(), sporeDensity: densitySchema.optional() }).strict()).max(30).optional(),
  totalDensity: densitySchema.optional(), sporeDensity: densitySchema.optional(),
  activeIngredients: z.array(z.object({ name: text(160), amount: decimal.optional(), unit: optionalText(40) }).strict()).max(30).optional(),
  purposes: z.array(text(300)).max(20).optional(), applicationPurpose: optionalText(1000),
  dosages:z.union([z.array(dosageInstructionSchema).max(30),z.string().max(8000)]).optional(),
  usageInstruction: optionalText(4000), notes: optionalText(4000),
}).strict().superRefine((specs,context)=>{const ids=new Set();if(Array.isArray(specs.dosages))specs.dosages.forEach((row,index)=>{if(row.id&&ids.has(row.id))context.addIssue({code:'custom',path:['dosages',index,'id'],message:'ID hướng dẫn phải duy nhất trong sản phẩm'});if(row.id)ids.add(row.id);});});
export const packageMeasureSchema = z.object({ value: decimal, unit: z.enum(['g','kg','mL','L']) }).strict();
export function cleanSpecs(input = {}) {
  const value = JSON.parse(JSON.stringify(input));
  function cleanDensity(row) {
    if (!row || (!row.coefficient && row.exponent === '')) return undefined;
    return { coefficient: String(row.coefficient ?? ''), exponent: row.exponent === '' ? '' : Number(row.exponent), unit: row.unit };
  }
  for (const key of ['totalDensity','sporeDensity']) { const density = cleanDensity(value[key]); if (density) value[key] = density; else delete value[key]; }
  value.microorganisms = (value.microorganisms || []).map(row => {
    for (const key of ['density','sporeDensity']) { const d = cleanDensity(row[key]); if (d) row[key] = d; else delete row[key]; }
    return row;
  });
  value.activeIngredients = (value.activeIngredients || []).map(row => { if (row.amount === '') delete row.amount; return row; });
  if(Array.isArray(value.dosages))value.dosages=value.dosages.map(row=>{for(const key of ['amount','maxAmount','unit','basisAmount','basisUnit'])if(row[key]==='')delete row[key];return row;});
  return value;
}
