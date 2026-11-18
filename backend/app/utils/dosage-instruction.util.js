const { createHash, randomUUID } = require('node:crypto');
const Exact = require('./exact-decimal.util');
const DECIMAL_PATTERN = /^(?:0|[1-9]\d{0,23})(?:\.\d{1,24})?$/;
const DOSE_UNITS = ['mg','g','kg','mL','L'];
const BASIS_UNITS = ['m3_water','L_water','kg_feed','g_feed'];
const basisOf = unit => ['m3_water','L_water'].includes(unit)?'water_volume':['kg_feed','g_feed'].includes(unit)?'feed_mass':null;
function positive(value){return typeof value==='string'&&value.length<=32&&DECIMAL_PATTERN.test(value)&&/[1-9]/.test(value);}
function instructionProblem(row, { requireActive=true }={}) {
  if(!row||typeof row!=='object'||Array.isArray(row))return 'Hướng dẫn chưa có dữ liệu có cấu trúc.';
  if(requireActive&&row.isActive!==true)return 'Hướng dẫn chưa được quản trị viên bật tính tự động.';
  if(typeof row.purpose!=='string'||!row.purpose.trim()||row.purpose.length>300)return 'Chưa có mục đích sử dụng hợp lệ.';
  if(!positive(row.amount)||!positive(row.basisAmount))return 'Liều lượng và lượng môi trường áp dụng phải là số dương có cấu trúc.';
  if(row.maxAmount!=null&&(!positive(row.maxAmount)||Exact.from(row.maxAmount).compare(row.amount)<0))return 'Liều tối đa phải lớn hơn hoặc bằng liều tối thiểu.';
  if(!DOSE_UNITS.includes(row.unit))return 'Đơn vị chế phẩm chưa hỗ trợ tính tự động (mg, g, kg, mL, L).';
  if(!basisOf(row.basisUnit))return 'Hướng dẫn này không áp dụng theo thể tích nước hoặc khối lượng thức ăn.';
  return null;
}
function instructionId(row) {
  if(typeof row?.id==='string'&&/^[a-zA-Z0-9_-]{1,64}$/.test(row.id))return row.id;
  return 'legacy-'+createHash('sha256').update(JSON.stringify(row)).digest('hex').slice(0,24);
}
function withDosageIds(specs) {
  if(!Array.isArray(specs?.dosages))return specs;
  return {...specs,dosages:specs.dosages.map(row=>row.isActive===true&&!row.id?{...row,id:randomUUID()}:row)};
}
function instructionViews(specs) {
  if(!Array.isArray(specs?.dosages))return [];
  return specs.dosages.map(row=>{
    const problem=instructionProblem(row);
    if(!row||typeof row!=='object')return {id:instructionId(row),purpose:'Hướng dẫn chưa chuẩn hóa',instructions:typeof row==='string'?row:'',canCalculate:false,unavailableReason:problem};
    const keys=['purpose','amount','maxAmount','unit','basisAmount','basisUnit','basisLabel','frequency','instructions','sourceNote','isActive'];
    return {...Object.fromEntries(keys.filter(key=>row[key]!==undefined).map(key=>[key,row[key]])),id:instructionId(row),calculationBasis:basisOf(row.basisUnit),canCalculate:!problem,unavailableReason:problem};
  });
}
// Mirrors the calculation gate using Decimal128; only 32-character decimal strings are accepted.
function calculableInstructionExpression(variable='$$dose') {
  const value=field=>`${variable}.${field}`;
  const decimal=field=>({$convert:{input:value(field),to:'decimal',onError:null,onNull:null}});
  const validNumber=field=>({$and:[
    {$eq:[{$type:value(field)},'string']},
    {$lte:[{$strLenCP:{$convert:{input:value(field),to:'string',onError:'',onNull:''}}},32]},
    {$regexMatch:{input:{$convert:{input:value(field),to:'string',onError:'',onNull:''}},regex:DECIMAL_PATTERN.source}},
    {$gt:[decimal(field),0]},
  ]});
  return {$and:[
    {$eq:[value('isActive'),true]},{$in:[value('unit'),DOSE_UNITS]},{$in:[value('basisUnit'),BASIS_UNITS]},
    {$eq:[{$type:value('purpose')},'string']},
    {$gt:[{$strLenCP:{$trim:{input:{$convert:{input:value('purpose'),to:'string',onError:'',onNull:''}}}}},0]},
    {$lte:[{$strLenCP:{$convert:{input:value('purpose'),to:'string',onError:'',onNull:''}}},300]},
    validNumber('amount'),validNumber('basisAmount'),
    {$or:[{$eq:[{$ifNull:[value('maxAmount'),null]},null]},{$and:[validNumber('maxAmount'),{$gte:[decimal('maxAmount'),decimal('amount')]}]}]},
  ]};
}
function availableDosagesExpression(path='$technicalSpecs.dosages') {
  return {$filter:{input:{$cond:[{$isArray:path},path,[]]},as:'dose',cond:calculableInstructionExpression()}};
}
module.exports={DECIMAL_PATTERN,DOSE_UNITS,BASIS_UNITS,basisOf,positive,instructionProblem,instructionId,instructionViews,withDosageIds,availableDosagesExpression};
