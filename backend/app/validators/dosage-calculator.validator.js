const { z }=require('zod');
const config=require('../config/dosage-calculator');
const { objectIdSchema }=require('./common.validator');
function inputDecimal(label,maximum){
  return z.union([z.string(),z.number().finite()]).transform(value=>{
    if(typeof value==='number'&&String(value).includes('e'))return value.toFixed(18).replace(/0+$/,'').replace(/\.$/,'');
    return String(value).trim().replace(',','.');
  }).pipe(z.string().max(48).regex(/^\d+(?:\.\d{1,18})?$/,`${label}: nhập số dương, không dùng dấu phân cách hàng nghìn`)
    .refine(value=>Number(value)>0&&Number(value)<=maximum,`${label} phải lớn hơn 0 và không vượt ${maximum}`));
}
const calculationSchema=z.object({
  productId:objectIdSchema,dosageInstructionId:z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/,'ID hướng dẫn không hợp lệ'),
  inputs:z.object({areaM2:inputDecimal('Diện tích ao',config.maxAreaM2).optional(),averageDepthM:inputDecimal('Độ sâu trung bình',config.maxDepthM).optional(),feedWeightKg:inputDecimal('Lượng thức ăn',config.maxFeedWeightKg).optional()}).strict(),
}).strict();
const eligibleQuerySchema=z.object({
  q:z.string().trim().max(120).optional(),categoryId:objectIdSchema.optional(),calculationBasis:z.enum(['water_volume','feed_mass']).optional(),
  page:z.coerce.number().int().min(1).max(100000).default(1),limit:z.coerce.number().int().min(1).max(24).default(6),
}).strict();
module.exports={calculationSchema,eligibleQuerySchema};
