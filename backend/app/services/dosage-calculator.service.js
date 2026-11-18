const {ObjectId}=require('mongodb');
const ApiError=require('../api-error');
const ProductRepository=require('../repositories/product.repository');
const ProductsService=require('./products.service');
const {calculationSchema,eligibleQuerySchema}=require('../validators/dosage-calculator.validator');
const {packageMeasureSchema}=require('../validators/technical-specs.validator');
const {instructionViews,availableDosagesExpression}=require('../utils/dosage-instruction.util');
const math=require('../utils/dosage-math.util');
const config=require('../config/dosage-calculator');
const {publicTechnicalSpecs}=require('../utils/public-product.util');
const DISCLAIMER='Kết quả được tính theo thể tích nước hoặc lượng thức ăn đã nhập và hướng dẫn sử dụng của sản phẩm. Liều lượng thực tế có thể phụ thuộc vào điều kiện ao nuôi, mục đích xử lý và khuyến nghị của nhà sản xuất.';
const PRICE_NOTE='Chi phí dự kiến theo giá bán thông thường, chưa gồm vận chuyển và ưu đãi theo lô. Giá, tồn kho và điều kiện ưu đãi được kiểm tra lại tại giỏ hàng hoặc thanh toán.';
class DosageCalculatorService{
  constructor(client){this.repository=new ProductRepository(client);this.products=new ProductsService(client);}
  publicStages(){return [
    {$set:{calculatorPrice:{$ifNull:['$sellingPrice',{$ifNull:['$price',null]}]}}},
    ...this.products.buildInventoryLookupStages(),
    {$lookup:{from:'categories',localField:'category_id',foreignField:'_id',pipeline:[{$project:{name:1}}],as:'calculatorCategory'}},
  ];}
  toPublic(row){
    row={...row,technicalSpecs:publicTechnicalSpecs(row.technicalSpecs)};
    const instructions=instructionViews(row.technicalSpecs),raw=row.calculatorPrice;
    const price=raw!=null&&['number','string'].includes(typeof raw)&&raw!==''&&Number.isFinite(Number(raw))&&Number(raw)>=0&&Number(raw)<=Number.MAX_SAFE_INTEGER?Number(raw):null;
    const legacy=typeof row.technicalSpecs?.dosages==='string'?row.technicalSpecs.dosages:!row.inventoryItemId&&typeof row.dosage==='string'?row.dosage:null;
    return {
      _id:row._id,name:row.name,slug:row.slug,thumbnail:row.thumbnail||row.images?.[0]||'',status:row.status,
      unit:row.unit||'đơn vị',packageSize:row.packageSize||null,packageMeasure:row.packageMeasure||null,
      category:row.calculatorCategory?.[0]||null,price,sellingPrice:price,
      availableStock:Number(row.availableStock||0),stock:Number(row.availableStock||0),inStock:Boolean(row.inStock),
      technicalSpecsSource:row.technicalSpecsSource,dosageInstructions:instructions,legacyDosageText:legacy,
      canCalculate:instructions.some(instruction=>instruction.canCalculate),
      unavailableReason:instructions.some(instruction=>instruction.canCalculate)?null:'Sản phẩm này chưa có dữ liệu liều lượng được bật và hợp lệ để tính toán tự động.',
      technicalNotes:typeof row.technicalSpecs?.notes==='string'?row.technicalSpecs.notes:null,
    };
  }
  async getProduct(id){
    if(!/^[a-f\d]{24}$/i.test(String(id)))throw new ApiError(400,'Product ID không hợp lệ','INVALID_PRODUCT_ID');
    const [row]=await this.repository.aggregate([{$match:{_id:new ObjectId(id),status:'active'}},...this.publicStages()]);
    if(!row)throw new ApiError(404,'Sản phẩm không tồn tại hoặc chưa được xuất bản','DOSAGE_PRODUCT_UNAVAILABLE');
    return this.toPublic(row);
  }
  async eligible(query={}){
    const parsed=eligibleQuerySchema.safeParse(query);if(!parsed.success)throw new ApiError(400,parsed.error.issues[0].message);
    const {q,categoryId,calculationBasis,page,limit}=parsed.data,match={status:'active'};
    if(q)match.name={$regex:new RegExp(this.products.escapeRegex(q),'i')};
    const rows=await this.repository.aggregate([
      {$match:match},
      {$lookup:{from:'inventory_items',localField:'inventoryItemId',foreignField:'_id',pipeline:[{$project:{categoryId:1}}],as:'calculatorItem'}},
      {$set:{calculatorItem:{$arrayElemAt:['$calculatorItem',0]}}},
      {$set:{calculatorCategoryId:{$ifNull:['$category_id','$calculatorItem.categoryId']}}},
      {$set:{calculatorInstructions:availableDosagesExpression('$technicalSpecs.dosages')}},
      ...(categoryId?[{$match:{calculatorCategoryId:new ObjectId(categoryId)}}]:[]),
      ...(calculationBasis?[{$set:{calculatorInstructions:{$filter:{input:'$calculatorInstructions',as:'instruction',cond:{$in:['$$instruction.basisUnit',calculationBasis==='water_volume'?['m3_water','L_water']:['kg_feed','g_feed']]}}}}}]:[]),
      {$match:{$expr:{$gt:[{$size:'$calculatorInstructions'},0]}}},
      {$facet:{data:[{$sort:{name:1,_id:1}},{$skip:(page-1)*limit},{$limit:limit},...this.publicStages()],count:[{$count:'total'}]}},
    ]);
    const result=rows[0]||{data:[],count:[]};
    return {data:result.data.map(row=>this.toPublic(row)),pagination:{page,limit,total:result.count[0]?.total||0},limits:{maxAreaM2:config.maxAreaM2,maxDepthM:config.maxDepthM,maxFeedWeightKg:config.maxFeedWeightKg}};
  }
  async calculate(payload){
    const parsed=calculationSchema.safeParse(payload);if(!parsed.success)throw new ApiError(400,parsed.error.issues[0].message,'INVALID_DOSAGE_INPUT');
    const {productId,dosageInstructionId,inputs}=parsed.data,product=await this.getProduct(productId);
    const instruction=product.dosageInstructions.find(row=>row.id===dosageInstructionId);
    if(!instruction)throw new ApiError(404,'Hướng dẫn liều lượng không thuộc sản phẩm đã chọn','DOSAGE_INSTRUCTION_NOT_FOUND');
    if(!instruction.canCalculate)throw new ApiError(422,instruction.unavailableReason,'DOSAGE_NOT_CALCULABLE');
    const water=instruction.calculationBasis==='water_volume';
    if(water&&(!inputs.areaM2||!inputs.averageDepthM||inputs.feedWeightKg!==undefined))throw new ApiError(400,'Vui lòng nhập diện tích và độ sâu nước trung bình; không dùng lượng thức ăn cho hướng dẫn xử lý nước.','WATER_INPUTS_REQUIRED');
    if(!water&&(!inputs.feedWeightKg||inputs.areaM2!==undefined||inputs.averageDepthM!==undefined))throw new ApiError(400,'Vui lòng chỉ nhập khối lượng thức ăn cho hướng dẫn trộn thức ăn.','FEED_INPUTS_REQUIRED');
    const volume=water?math.calculatePondVolume(inputs.areaM2,inputs.averageDepthM):null;
    const calculate=amount=>water?math.calculateWaterTreatmentDosage(volume,{...instruction,amount}):math.calculateFeedDosage(inputs.feedWeightKg,{...instruction,amount});
    const unit=['mg','g','kg'].includes(instruction.unit)?'g':'mL';
    const minimum=math.convertUnit(calculate(instruction.amount),instruction.unit,unit),maximum=math.convertUnit(calculate(instruction.maxAmount||instruction.amount),instruction.unit,unit);
    const result={
      productId:product._id,product,calculationBasis:instruction.calculationBasis,instruction,inputs,
      pondVolumeM3:volume?.format()??null,pondVolumeLitres:volume?math.convertUnit(volume,'m3','L').format():null,feedWeightKg:inputs.feedWeightKg||null,
      requiredDosage:{min:minimum.format(),max:maximum.format(),unit,exact:{min:minimum.exact(),max:maximum.exact()}},
      isRange:minimum.compare(maximum)!==0,packaging:null,packagingUnavailableReason:null,packagesRequired:null,purchasedQuantity:null,theoreticalRemainder:null,
      pricePerPackage:product.price,estimatedCost:null,availableStock:product.availableStock,canPurchaseFullQuantity:false,canPurchase:{min:false,max:false},
      disclaimer:DISCLAIMER,priceNote:PRICE_NOTE,remainderNote:'Lượng dư là chênh lệch số học; không xác nhận có thể bảo quản hoặc tái sử dụng phần dư.',
      calculatedAt:new Date().toISOString(),
    };
    const measure=packageMeasureSchema.safeParse(product.packageMeasure);
    if(!measure.success){result.packagingUnavailableReason='Chưa đủ dữ liệu quy cách để tính số gói/chai';return result;}
    let low,high;
    try{low=math.calculatePackageQuantity(minimum,measure.data,unit);high=math.calculatePackageQuantity(maximum,measure.data,unit);}
    catch(error){if(!(error instanceof RangeError))throw error;result.packagingUnavailableReason='Không thể quy đổi đơn vị liều lượng sang đơn vị đóng gói.';return result;}
    if(high.count>BigInt(Math.floor(config.maxPackages)))throw new ApiError(422,'Số đơn vị đóng gói tính được vượt giới hạn của công cụ. Vui lòng kiểm tra thông số và quy cách.','CALCULATION_LIMIT_EXCEEDED');
    result.packaging={quantityPerPackage:measure.data.value,unit:measure.data.unit,packageLabel:product.unit};
    result.packagesRequired={min:Number(low.count),max:Number(high.count)};
    result.purchasedQuantity={min:low.purchased.format(),max:high.purchased.format(),unit};
    result.theoreticalRemainder={min:low.remainder.format(),max:high.remainder.format(),unit};
    if(product.price!==null)result.estimatedCost={min:math.calculateEstimatedCost(low.count,product.price).format(),max:math.calculateEstimatedCost(high.count,product.price).format(),currency:'VND'};
    result.canPurchase={min:product.price!==null&&product.inStock&&low.count<=BigInt(Math.floor(product.availableStock)),max:product.price!==null&&product.inStock&&high.count<=BigInt(Math.floor(product.availableStock))};
    result.canPurchaseFullQuantity=result.canPurchase.max;
    return result;
  }
}
module.exports=DosageCalculatorService;
