const {BSON}=require('mongodb');
const {createHash,randomUUID}=require('node:crypto');
const {canonical}=require('../validators/technical-specs.validator');
const serialized=value=>BSON.EJSON.stringify(value===undefined?{missing:true}:{value});
const fingerprint=value=>createHash('sha256').update(serialized(value)).digest('hex');
const hasData=value=>canonical(value)!==undefined;

async function planMigration(client){
  const db=client.db(),entries=[];
  for await(const item of db.collection('inventory_items').find({technicalSpecs:{$exists:true}})){
    const products=await db.collection('products').find({inventoryItemId:item._id}).toArray();
    const base={inventoryItemId:item._id,itemCode:item.itemCode,source:item.technicalSpecs,sourceHash:fingerprint(item.technicalSpecs)};
    if(!hasData(item.technicalSpecs)){entries.push({...base,status:'empty_source'});continue;}
    if(!products.length){entries.push({...base,status:'pending_product'});continue;}
    if(products.length!==1){entries.push({...base,status:'duplicate_link_conflict'});continue;}
    const product=products[0],beforeExists=Object.hasOwn(product,'technicalSpecs');
    const status=!hasData(product.technicalSpecs)?'ready':fingerprint(product.technicalSpecs)===base.sourceHash?'already_present':'conflict';
    entries.push({...base,productId:product._id,beforeExists,before:product.technicalSpecs,beforeHash:fingerprint(product.technicalSpecs),status});
  }
  return {version:1,runId:randomUUID(),database:db.databaseName,createdAt:new Date(),entries};
}
function summary(plan){const counts={};for(const row of plan.entries)counts[row.status]=(counts[row.status]||0)+1;return {database:plan.database,runId:plan.runId,counts};}
async function applyMigration(client,plan){
  if(client.db().databaseName!==plan.database||plan.version!==1)throw new Error('Migration database/version mismatch');
  const session=client.startSession(),db=client.db();
  try{
    await session.withTransaction(async()=>{
      for(const entry of plan.entries.filter(row=>row.status==='ready')){
        const source=await db.collection('inventory_items').findOne({_id:entry.inventoryItemId},{session});
        const target=await db.collection('products').findOne({_id:entry.productId},{session});
        if(!source||!target||String(target.inventoryItemId)!==String(entry.inventoryItemId)||fingerprint(source.technicalSpecs)!==entry.sourceHash||fingerprint(target.technicalSpecs)!==entry.beforeHash)throw new Error('Migration data changed after preview; create a new plan');
        const result=await db.collection('products').updateOne({_id:entry.productId},{$set:{technicalSpecs:entry.source}},{session});
        if(result.matchedCount!==1)throw new Error('Migration product disappeared');
        const verified=await db.collection('products').findOne({_id:entry.productId},{session});
        if(fingerprint(verified.technicalSpecs)!==entry.sourceHash)throw new Error('Technical data verification failed');
      }
    });
    return {...summary(plan),copied:plan.entries.filter(row=>row.status==='ready').length};
  }finally{await session.endSession();}
}
async function rollbackMigration(client,plan){
  if(client.db().databaseName!==plan.database||plan.version!==1)throw new Error('Rollback database/version mismatch');
  const session=client.startSession(),db=client.db(),result={restored:[],alreadyRestored:[],conflicts:[]};
  try{
    await session.withTransaction(async()=>{
      result.restored=[];result.alreadyRestored=[];result.conflicts=[];
      for(const entry of plan.entries.filter(row=>row.status==='ready')){
        const target=await db.collection('products').findOne({_id:entry.productId},{session});
        if(target&&fingerprint(target.technicalSpecs)===entry.beforeHash){result.alreadyRestored.push(String(entry.productId));continue;}
        if(!target||String(target.inventoryItemId)!==String(entry.inventoryItemId)||fingerprint(target.technicalSpecs)!==entry.sourceHash){result.conflicts.push(String(entry.productId));continue;}
        await db.collection('products').updateOne({_id:entry.productId},entry.beforeExists?{$set:{technicalSpecs:entry.before}}:{$unset:{technicalSpecs:''}},{session});
        result.restored.push(String(entry.productId));
      }
    });return result;
  }finally{await session.endSession();}
}
module.exports={fingerprint,hasData,planMigration,applyMigration,rollbackMigration,summary};
