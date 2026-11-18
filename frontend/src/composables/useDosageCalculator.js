import {computed,onBeforeUnmount,reactive,ref,shallowRef,watch} from 'vue';
import service from '@/services/dosage-calculator.service';
import {calculatorInputErrors} from '@/utils/dosage-calculator.util';
import {useProductPurchase} from './useProductPurchase';
export function useDosageCalculator(){
  const purchase=useProductPurchase();
  const filters=reactive({q:'',categoryId:'',calculationBasis:'',page:1}),catalog=shallowRef([]),pagination=ref({page:1,limit:6,total:0}),limits=ref({});
  const catalogLoading=ref(false),catalogError=ref(''),selectedId=ref(''),product=shallowRef(null),detailLoading=ref(false),detailError=ref(''),instructionId=ref('');
  const inputs=reactive({areaM2:'',averageDepthM:'',feedWeightKg:''}),errors=ref({}),calculating=ref(false),calculationError=ref(''),result=shallowRef(null);
  const level=ref(''),purchaseQuantity=ref(''),partialConfirmed=ref(false);
  const instruction=computed(()=>product.value?.dosageInstructions?.find(row=>row.id===instructionId.value));
  const targetQuantity=computed(()=>result.value?.packagesRequired?.[level.value]??null);
  const partialPurchase=computed(()=>targetQuantity.value!==null&&Number(purchaseQuantity.value)>0&&Number(purchaseQuantity.value)<targetQuantity.value);
  const canAdd=computed(()=>!!result.value&&!calculating.value&&!!level.value&&Number.isSafeInteger(Number(purchaseQuantity.value))&&Number(purchaseQuantity.value)>0&&(!partialPurchase.value||partialConfirmed.value)&&purchase.canAdd(result.value.product,Number(purchaseQuantity.value)));
  let alive=true,catalogRun=0,detailRun=0,calculationRun=0,timer,catalogAbort,detailAbort,calculationAbort;
  const message=(error,fallback)=>error.response?.data?.message||fallback;
  function invalidate(){++calculationRun;calculationAbort?.abort();result.value=null;calculating.value=false;level.value='';purchaseQuantity.value='';partialConfirmed.value=false;errors.value={};calculationError.value='';}
  async function loadCatalog(){
    clearTimeout(timer);const run=++catalogRun;catalogAbort?.abort();catalogAbort=new AbortController();catalogLoading.value=true;catalogError.value='';
    try{
      const params={page:filters.page,limit:6,...Object.fromEntries(['q','categoryId','calculationBasis'].filter(key=>filters[key]).map(key=>[key,filters[key]]))};
      const response=await service.eligible(params,catalogAbort.signal);if(!alive||run!==catalogRun)return;
      catalog.value=response.data||[];pagination.value=response.pagination;limits.value=response.limits||{};
    }catch(error){if(alive&&run===catalogRun&&error.code!=='ERR_CANCELED'){catalog.value=[];catalogError.value=message(error,'Không tải được sản phẩm có hướng dẫn tính liều. Vui lòng thử lại.');}}
    finally{if(alive&&run===catalogRun)catalogLoading.value=false;}
  }
  watch(()=>[filters.q,filters.categoryId,filters.calculationBasis,filters.page],(current,previous)=>{
    clearTimeout(timer);++catalogRun;catalogAbort?.abort();
    if(previous&&current.slice(0,3).some((value,index)=>value!==previous[index])&&filters.page!==1){filters.page=1;return;}
    timer=setTimeout(loadCatalog,previous&&current[0]!==previous[0]?300:0);
  },{immediate:true});
  watch(selectedId,async id=>{
    invalidate();const run=++detailRun;detailAbort?.abort();product.value=null;instructionId.value='';detailError.value='';detailLoading.value=false;
    if(!id)return;
    if(!/^[a-f\d]{24}$/i.test(id)){detailError.value='Product ID không hợp lệ.';return;}
    detailAbort=new AbortController();detailLoading.value=true;
    try{const response=await service.product(id,detailAbort.signal);if(!alive||run!==detailRun)return;product.value=response.data;
      const available=product.value.dosageInstructions.filter(row=>row.canCalculate);if(available.length===1)instructionId.value=available[0].id;
    }catch(error){if(alive&&run===detailRun&&error.code!=='ERR_CANCELED')detailError.value=message(error,'Không tải được hướng dẫn của sản phẩm. Vui lòng chọn lại hoặc thử lại.');}
    finally{if(alive&&run===detailRun)detailLoading.value=false;}
  },{flush:'sync'});
  watch(()=>[instructionId.value,inputs.areaM2,inputs.averageDepthM,inputs.feedWeightKg],invalidate,{flush:'sync'});
  watch(level,value=>{purchaseQuantity.value=result.value?.packagesRequired?.[value]?.toString()||'';partialConfirmed.value=false;},{flush:'sync'});
  watch(purchaseQuantity,()=>{partialConfirmed.value=false;},{flush:'sync'});
  async function calculate(){
    if(!instruction.value?.canCalculate){calculationError.value=product.value?.unavailableReason||'Vui lòng chọn sản phẩm và hướng dẫn có thể tính tự động.';return;}
    errors.value=calculatorInputErrors(instruction.value,inputs,limits.value);if(Object.keys(errors.value).length)return;
    invalidate();const run=++calculationRun;calculating.value=true;calculationAbort=new AbortController();
    const fields=instruction.value.calculationBasis==='water_volume'?['areaM2','averageDepthM']:['feedWeightKg'];
    const payload={productId:selectedId.value,dosageInstructionId:instructionId.value,inputs:Object.fromEntries(fields.map(key=>[key,String(inputs[key]).trim().replace(',','.')] ))};
    try{const response=await service.calculate(payload,calculationAbort.signal);if(!alive||run!==calculationRun)return;result.value=response.data;
      if(!result.value.isRange&&result.value.packagesRequired)level.value='min';
    }catch(error){if(alive&&run===calculationRun&&error.code!=='ERR_CANCELED')calculationError.value=message(error,'Không tính được liều lượng. Vui lòng kiểm tra kết nối và thử lại.');}
    finally{if(alive&&run===calculationRun)calculating.value=false;}
  }
  async function addToCart(){if(canAdd.value)await purchase.add(result.value.product,Number(purchaseQuantity.value));}
  onBeforeUnmount(()=>{alive=false;clearTimeout(timer);++catalogRun;++detailRun;++calculationRun;catalogAbort?.abort();detailAbort?.abort();calculationAbort?.abort();});
  return {filters,catalog,pagination,limits,catalogLoading,catalogError,loadCatalog,selectedId,product,detailLoading,detailError,instructionId,instruction,inputs,errors,calculating,calculationError,result,calculate,level,purchaseQuantity,partialConfirmed,partialPurchase,targetQuantity,canAdd,addToCart,purchase};
}
