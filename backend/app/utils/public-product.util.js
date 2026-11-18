const {normalizedPrice}=require('./product-comparison.util');
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
const scalar=value=>typeof value==='string'||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value);
function pick(value,keys){return object(value)?Object.fromEntries(keys.filter(key=>scalar(value[key])).map(key=>[key,value[key]])):{};}
const density=value=>object(value)?pick(value,['coefficient','exponent','unit']):undefined;
function publicTechnicalSpecs(value){
  if(!object(value))return {};
  const result=pick(value,['applicationPurpose','usageInstruction','notes']);
  for(const key of ['totalDensity','sporeDensity'])if(object(value[key]))result[key]=density(value[key]);
  if(Array.isArray(value.microorganisms))result.microorganisms=value.microorganisms.filter(object).map(row=>({...pick(row,['name','strainCode']),...(density(row.density)?{density:density(row.density)}:{}),...(density(row.sporeDensity)?{sporeDensity:density(row.sporeDensity)}:{})}));
  if(Array.isArray(value.activeIngredients))result.activeIngredients=value.activeIngredients.filter(object).map(row=>pick(row,['name','amount','unit']));
  if(Array.isArray(value.purposes))result.purposes=value.purposes.filter(row=>typeof row==='string');
  if(typeof value.dosages==='string')result.dosages=value.dosages;
  else if(Array.isArray(value.dosages))result.dosages=value.dosages.filter(row=>typeof row==='string'||object(row)).map(row=>typeof row==='string'?row:pick(row,['id','purpose','amount','maxAmount','unit','basisAmount','basisUnit','basisLabel','instructions','frequency','sourceNote','isActive']));
  return result;
}
function reference(value){return object(value)&&value._id?{_id:value._id,...pick(value,['name','slug'])}:null;}
function publicSpecifications(value){
  if(Array.isArray(value))return value.filter(object).map(row=>pick(row,['name','label','value','unit']));
  if(object(value))return Object.fromEntries(Object.entries(value).filter(([,entry])=>scalar(entry)));
  return typeof value==='string'?value:null;
}
function publicProductDetail(row){
  const result={_id:row._id,...pick(row,['name','slug','productCode','status','thumbnail','description','shortDescription','price','sellingPrice','comparePrice','unit','origin','ingredients','usagePurpose','dosage','usageInstruction','usage','storage','targetSpecies','suitableStage','certification','packageSize','storageInstruction','expiryMonths','category_name','category_slug','average_rating','total_reviews','dosageCalculatorAvailable']),
    inventoryItemId:row.inventoryItemId||null,category_id:row.category_id||null,brandId:row.brandId||null,manufacturerId:row.manufacturerId||null,
    images:(Array.isArray(row.images)?row.images:typeof row.images==='string'?[row.images]:[]).filter(value=>typeof value==='string'),category:reference(row.category),brand:reference(row.brand),manufacturer:reference(row.manufacturer),
    technicalSpecs:publicTechnicalSpecs(row.technicalSpecs),technicalSpecsSource:'product',
    packageMeasure:object(row.packageMeasure)?pick(row.packageMeasure,['value','unit']):null,
    normalizedPrice:normalizedPrice(Number(row.sellingPrice??row.price),row.packageMeasure),
    stock:row.availableStock,availableStock:row.availableStock,inStock:Boolean(row.inStock),outOfStock:Boolean(row.outOfStock),
    specifications:publicSpecifications(row.specifications),
    sections:Array.isArray(row.sections)?row.sections.filter(object).map(section=>pick(section,['title','content'])):[],
    reviews:Array.isArray(row.reviews)?row.reviews.map(review=>({_id:review._id,...pick(review,['rating','comment','user_name','user_avatar']),...(review.created_at?{created_at:review.created_at}:{})})):[],
    // Offers have already passed DiscountService's public DTO and eligibility gate.
    batchPromotions:row.batchPromotions||[],
  };
  if(object(row.seo))result.seo=pick(row.seo,['title','description','keywords']);
  return result;
}
module.exports={publicTechnicalSpecs,publicProductDetail};
