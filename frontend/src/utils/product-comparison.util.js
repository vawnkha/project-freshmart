const missing = 'Chưa công bố';
import { dosageText } from './dosage-calculator.util';
export function densityText(density) {
  const parts=densityParts(density);
  return parts ? `${parts.coefficient} × 10^${parts.exponent} ${parts.unit}` : missing;
}
export function densityParts(density){
  if(!density||typeof density.coefficient!=='string'||!density.coefficient.trim()||!Number.isInteger(density.exponent)||typeof density.unit!=='string'||!density.unit.trim())return null;
  return {coefficient:density.coefficient,exponent:String(density.exponent),unit:density.unit};
}
export function technicalRows(specs = {}) {
  const list = (items, format = value => value) => items?.length ? items.map(format).join('\n') : missing;
  return [
    ['microorganisms', 'Chủng vi sinh và mật độ từng chủng', list(specs.microorganisms, row => `${row.name}${row.strainCode ? ' (' + row.strainCode + ')' : ''}\nMật độ: ${densityText(row.density)}\nBào tử: ${densityText(row.sporeDensity)}`)],
    ['totalDensity', 'Mật độ vi sinh tổng', densityText(specs.totalDensity)],
    ['sporeDensity', 'Mật độ bào tử tổng', densityText(specs.sporeDensity)],
    ['activeIngredients', 'Hoạt chất bổ sung', list(specs.activeIngredients, row => `${row.name}${row.amount ? ': ' + row.amount + (row.unit ? ' ' + row.unit : '') : ' — chưa công bố hàm lượng'}`)],
    ['applicationPurpose', 'Mục đích sử dụng', specs.applicationPurpose || missing],
    ['purposes', 'Công dụng chính', list(specs.purposes)],
    ['dosages', 'Liều lượng', typeof specs.dosages==='string'?specs.dosages:list(specs.dosages,dosageText)],
    ['usageInstruction', 'Hướng dẫn sử dụng', specs.usageInstruction || missing],
    ['notes', 'Ghi chú kỹ thuật', specs.notes || missing],
  ];
}
export function comparisonRows(products) {
  const money = value => value == null ? 'Chưa có giá' : Number(value).toLocaleString('vi-VN') + ' đ';
  const rows = [
    ['brand','Thương hiệu', p => p.brand?.name || missing], ['manufacturer','Nhà sản xuất', p => p.manufacturer?.name || missing],
    ['category','Danh mục', p => p.category?.name || missing], ['unit','Đơn vị bán', p => p.unit || missing],
    ['packageSize','Quy cách đóng gói', p => p.packageSize || missing],
    ['packageMeasure','Lượng đóng gói', p => p.packageMeasure ? `${p.packageMeasure.value} ${p.packageMeasure.unit}` : missing],
    ...technicalRows().map(([key,label], index) => [key,label,p => technicalRows(p.technicalSpecs)[index][2]]),
    ['price','Giá bán', p => money(p.price)],
    ['normalizedPrice','Giá quy đổi', p => p.normalizedPrice ? `${money(p.normalizedPrice.value)}/${p.normalizedPrice.unit === 'VND/kg' ? 'kg' : 'L'}` : 'Chưa đủ thông tin để quy đổi'],
    ['availableStock','Tồn kho khả dụng', p => String(p.availableStock ?? 0) + (p.unit ? ' ' + p.unit : '')],
    ['inStock','Tình trạng', p => p.inStock ? 'Còn hàng' : 'Hết hàng'],
    ['expiryMonths','Thời hạn sử dụng tham khảo', p => p.expiryMonths == null ? missing : p.expiryMonths + ' tháng'],
    ['storageInstruction','Điều kiện bảo quản', p => p.storageInstruction || missing],
  ];
  return rows.map(([key,label,value]) => ({key,label,values:products.map(value)}));
}
