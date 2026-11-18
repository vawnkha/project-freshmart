import {densityParts} from './product-comparison.util';
export const publicText=value=>typeof value==='string'?value.trim():'';
const record=value=>value&&typeof value==='object'&&!Array.isArray(value);
export function productTechnical(product){
  const specs=record(product?.technicalSpecs)?product.technicalSpecs:{};
  const microorganisms=Array.isArray(specs.microorganisms)?specs.microorganisms.filter(row=>record(row)&&(publicText(row.name)||publicText(row.strainCode)||densityParts(row.density)||densityParts(row.sporeDensity))):[];
  const activeIngredients=Array.isArray(specs.activeIngredients)?specs.activeIngredients.filter(row=>record(row)&&publicText(row.name)):[];
  const purposes=Array.isArray(specs.purposes)?specs.purposes.map(publicText).filter(Boolean):[];
  const dosages=(typeof specs.dosages==='string'?[specs.dosages]:Array.isArray(specs.dosages)?specs.dosages:[]).filter(row=>typeof row==='string'?publicText(row):record(row)&&['purpose','amount','instructions','frequency','sourceNote'].some(key=>publicText(row[key])));
  const applicationPurpose=publicText(specs.applicationPurpose),usageInstruction=publicText(specs.usageInstruction),notes=publicText(specs.notes);
  return {microorganisms,activeIngredients,purposes,dosages,applicationPurpose,usageInstruction,notes,totalDensity:densityParts(specs.totalDensity)?specs.totalDensity:null,sporeDensity:densityParts(specs.sporeDensity)?specs.sporeDensity:null,
    hasComposition:Boolean(microorganisms.length||activeIngredients.length||densityParts(specs.totalDensity)||densityParts(specs.sporeDensity)||notes),hasPurposes:Boolean(purposes.length||applicationPurpose),hasUsage:Boolean(dosages.length||usageInstruction)};
}
