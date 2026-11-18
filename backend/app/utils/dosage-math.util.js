const Exact=require('./exact-decimal.util');
const UNITS={mg:{dimension:'mass',factor:'0.001'},g:{dimension:'mass',factor:'1'},kg:{dimension:'mass',factor:'1000'},mL:{dimension:'volume',factor:'1'},L:{dimension:'volume',factor:'1000'},m3:{dimension:'volume',factor:'1000000'}};
function convertUnit(value,from,to){
  if(!UNITS[from]||!UNITS[to]||UNITS[from].dimension!==UNITS[to].dimension)throw new RangeError('Không thể quy đổi đơn vị khối lượng sang thể tích hoặc đơn vị chưa hỗ trợ');
  return Exact.from(value).multiply(UNITS[from].factor).divide(UNITS[to].factor);
}
function calculatePondVolume(areaM2,averageDepthM){return Exact.from(areaM2).multiply(averageDepthM);}
function calculateWaterTreatmentDosage(volumeM3,dose){
  const environment=dose.basisUnit==='L_water'?convertUnit(volumeM3,'m3','L'):Exact.from(volumeM3);
  return environment.divide(dose.basisAmount).multiply(dose.amount);
}
function calculateFeedDosage(weightKg,dose){
  const environment=dose.basisUnit==='g_feed'?convertUnit(weightKg,'kg','g'):Exact.from(weightKg);
  return environment.divide(dose.basisAmount).multiply(dose.amount);
}
function calculatePackageQuantity(required,measure,quantityUnit){
  const perPackage=convertUnit(measure.value,measure.unit,quantityUnit);
  const count=Exact.from(required).divide(perPackage).ceil();
  const purchased=perPackage.multiply(count.toString());
  return {count,purchased,remainder:purchased.subtract(required),perPackage};
}
function calculateEstimatedCost(count,price){return Exact.from(price).multiply(String(count));}
module.exports={UNITS,convertUnit,calculatePondVolume,calculateWaterTreatmentDosage,calculateFeedDosage,calculatePackageQuantity,calculateEstimatedCost};
