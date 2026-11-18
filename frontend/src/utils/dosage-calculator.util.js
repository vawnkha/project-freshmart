export const dosageBasis=unit=>['m3_water','L_water'].includes(unit)?'water_volume':['kg_feed','g_feed'].includes(unit)?'feed_mass':'';
export const basisLabels={m3_water:'m³ nước',L_water:'L nước',kg_feed:'kg thức ăn',g_feed:'g thức ăn',m2_pond:'m² ao'};
export function compareDecimalStrings(left,right){
  if(!/^\d+(?:\.\d+)?$/.test(left)||!/^\d+(?:\.\d+)?$/.test(right))return NaN;
  const split=value=>{const [whole,fraction='']=value.split('.');return [BigInt(whole+fraction),10n**BigInt(fraction.length)];};
  const [a,b]=split(left),[c,d]=split(right);return a*d<c*b?-1:a*d>c*b?1:0;
}
export function dosageText(row){
  if(typeof row==='string')return row;
  if(!row)return 'Chưa công bố';
  const dose=row.amount&&row.unit&&row.basisAmount&&row.basisUnit
    ? `${row.amount}${row.maxAmount&&row.maxAmount!==row.amount?'–'+row.maxAmount:''} ${row.unit}/${row.basisAmount} ${basisLabels[row.basisUnit]||row.basisLabel||'đơn vị chưa chuẩn hóa'}`
    :'Chưa đủ dữ liệu định lượng';
  return [row.purpose?row.purpose+': '+dose:dose,row.instructions,row.frequency?'Tần suất: '+row.frequency:'',row.sourceNote?'Nguồn: '+row.sourceNote:''].filter(Boolean).join('\n');
}
export function formatCalculatedNumber(value){
  if(value===null||value===undefined)return 'Chưa có dữ liệu';
  const raw=String(value),match=raw.match(/^(<?)(-?\d+)(?:\.(\d+))?$/);
  if(!match)return raw;
  return match[1]+match[2].replace(/\B(?=(\d{3})+(?!\d))/g,'.')+(match[3]?','+match[3]:'');
}
export function calculatorInputErrors(instruction,inputs,limits={}){
  const fields=instruction?.calculationBasis==='water_volume'?[['areaM2','Diện tích ao',limits.maxAreaM2],['averageDepthM','Độ sâu trung bình',limits.maxDepthM]]:[['feedWeightKg','Lượng thức ăn',limits.maxFeedWeightKg]];
  const errors={};
  for(const [key,label,maximum] of fields){
    const value=String(inputs[key]??'').trim().replace(',','.');
    if(!/^\d+(?:\.\d{1,18})?$/.test(value)||value.length>48||!Number.isFinite(Number(value))||Number(value)<=0)errors[key]=`${label} phải là số lớn hơn 0.`;
    else if(maximum&&Number(value)>maximum)errors[key]=`${label} không vượt ${formatCalculatedNumber(maximum)}.`;
  }
  return errors;
}
