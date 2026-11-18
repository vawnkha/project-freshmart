const { ObjectId } = require('mongodb');
const ApiError = require('../api-error');
const { hasPermission } = require('../config/permissions');
const { ensureChatIndexes } = require('../database/chat-indexes');
const { emitChat } = require('../utils/chat-events.util');
const ResourceDeletionService = require('./resource-deletion.service');
const OutboxService = require('./outbox.service');
const RbacService = require('./rbac.service');

const canRead = actor => hasPermission(actor,['admin:access','chat:read']);
const canReply = actor => canRead(actor) && hasPermission(actor,['chat:reply']);
const canManage = actor => canRead(actor) && hasPermission(actor,['chat:manage']);
function oid(value) { if (!/^[a-f\d]{24}$/i.test(String(value || ''))) throw new ApiError(400,'ID không hợp lệ'); return new ObjectId(String(value)); }
const publicMessage = m => ({ _id:String(m._id),conversationId:String(m.conversationId),seq:m.seq,senderId:String(m.senderId),senderKind:m.senderKind,senderName:m.senderName,content:m.content,messageType:'text',clientMessageId:m.clientMessageId,createdAt:m.createdAt });

class ChatService {
  constructor(client) {
    this.client=client; this.db=client.db(); this.Conversation=this.db.collection('chat_conversations'); this.Message=this.db.collection('chat_messages'); this.Read=this.db.collection('chat_reads');
    this.deletion=new ResourceDeletionService(client); this.outbox=new OutboxService(client);
  }
  ready() { return ensureChatIndexes(this.client); }
  async activeActor(actor, { session } = {}) {
    const user=await this.db.collection('users').findOne({_id:oid(actor.id)}, {session,projection:{status:1,name:1}});
    if (!user || user.status!=='active') throw new ApiError(403,'Tài khoản không còn được phép sử dụng chat','CHAT_ACCESS_REVOKED');
    return user;
  }
  async authorize(id,actor,{admin=false,session}={}) {
    await this.activeActor(actor,{session});
    if (admin && !canRead(actor)) throw new ApiError(403,'Bạn chưa có quyền xem chat hỗ trợ');
    const con=await this.Conversation.findOne({_id:oid(id),...(admin?{}:{customerId:oid(actor.id)})},{session});
    if (!con) throw new ApiError(404,'Không tìm thấy hội thoại');
    return con;
  }
  async socketAccess(id,actor) {
    const con=await this.Conversation.findOne({_id:oid(id)});
    if(con && String(con.customerId)!==String(actor.id) && !canRead(actor))throw new ApiError(404,'Không tìm thấy hội thoại');
    return this.authorize(id,actor,{admin:con && String(con.customerId)!==String(actor.id)});
  }
  basePipeline(actor) {
    const uid=oid(actor.id);
    const own={$eq:['$customerId',uid]};
    const total={$cond:[own,'$supportMessageCount','$customerMessageCount']};
    const seen={$cond:[own,{$ifNull:['$_read.supportCount',0]},{$ifNull:['$_read.customerCount',0]}]};
    return [
      {$lookup:{from:'chat_reads',let:{cid:'$_id'},pipeline:[{$match:{$expr:{$and:[{$eq:['$conversationId','$$cid']},{$eq:['$userId',uid]}]}}}],as:'_read'}},
      {$set:{_read:{$arrayElemAt:['$_read',0]}}},
      {$set:{unreadCount:{$max:[0,{$subtract:[total,seen]}]},readSeq:{$ifNull:['$_read.seq',0]}}},
      {$lookup:{from:'users',localField:'customerId',foreignField:'_id',pipeline:[{$project:{name:1,avatar_url:1,avatar:1,status:1}}],as:'_customer'}},
      {$lookup:{from:'users',localField:'assignedAdminId',foreignField:'_id',pipeline:[{$project:{name:1,status:1}}],as:'_agent'}},
      {$set:{customer:{$arrayElemAt:['$_customer',0]},assignedAdmin:{$arrayElemAt:['$_agent',0]}}},
      {$project:{_read:0,_customer:0,_agent:0,audit:0}},
    ];
  }
  dto(con) {
    return {_id:String(con._id),customerId:String(con.customerId),customer:{name:con.customer?.name || 'Tài khoản không còn hoạt động',avatar_url:con.customer?.avatar_url || con.customer?.avatar || '',active:con.customer?.status==='active'},assignedAdminId:con.assignedAdminId?String(con.assignedAdminId):null,assignedAdmin:con.assignedAdmin?{_id:String(con.assignedAdmin._id),name:con.assignedAdmin.name || 'Nhân viên hỗ trợ'}:null,status:con.status,lastMessage:con.lastMessage || null,lastMessageAt:con.lastMessageAt,createdAt:con.createdAt,updatedAt:con.updatedAt,closedAt:con.closedAt,nextSeq:con.nextSeq,version:con.version,unreadCount:con.unreadCount || 0,readSeq:con.readSeq || 0};
  }
  async detail(id,actor,{admin=false}={}) {
    await this.ready(); await this.authorize(id,actor,{admin});
    const [con]=await this.Conversation.aggregate([{$match:{_id:oid(id)}},...this.basePipeline(actor)]).toArray();
    const reads=await this.Read.find({conversationId:oid(id)}).sort({updatedAt:-1}).limit(30).toArray();
    return {...this.dto(con),reads:reads.map(r=>({userId:String(r.userId),seq:r.seq,kind:r.kind,name:r.name,readAt:r.updatedAt}))};
  }
  async me(actor) {
    await this.ready(); await this.activeActor(actor);
    const con=await this.Conversation.findOne({customerId:oid(actor.id)});
    return {conversation:con?await this.detail(con._id,actor):null};
  }
  async list(actor,query) {
    await this.ready(); await this.activeActor(actor);
    if(!canRead(actor)) throw new ApiError(403,'Bạn chưa có quyền xem chat hỗ trợ');
    const match={};
    if(query.filter==='waiting') Object.assign(match,{status:{$ne:'closed'},'lastMessage.senderKind':'customer'});
    else if(['active','closed'].includes(query.filter)) match.status=query.filter;
    const pipeline=[{$match:match}];
    if(query.cursor){
      let parsed;try{parsed=JSON.parse(Buffer.from(query.cursor,'base64url').toString());}catch(_){throw new ApiError(400,'Con trỏ không hợp lệ');}
      if(!parsed || !Number.isFinite(Date.parse(parsed.date)) || !ObjectId.isValid(parsed.id)) throw new ApiError(400,'Con trỏ không hợp lệ');
      const time=new Date(parsed.date),id=oid(parsed.id);
      pipeline.push({$match:{$or:[{updatedAt:{$lt:time}},{updatedAt:time,_id:{$lt:id}}]}});
    }
    pipeline.push({$sort:{updatedAt:-1,_id:-1}},...this.basePipeline(actor));
    if(query.filter==='unread') pipeline.push({$match:{unreadCount:{$gt:0}}});
    if(query.keyword) pipeline.push({$match:{'customer.name':{$regex:query.keyword.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),$options:'i'}}});
    pipeline.push({$limit:query.limit+1});
    const rows=await this.Conversation.aggregate(pipeline).toArray();
    const more=rows.length>query.limit;const data=rows.slice(0,query.limit);const last=data.at(-1);
    return {items:data.map(c=>this.dto(c)),nextCursor:more?Buffer.from(JSON.stringify({date:last.updatedAt,id:String(last._id)})).toString('base64url'):null};
  }
  async summary(actor) {
    await this.ready();await this.activeActor(actor);
    if(!canRead(actor))throw new ApiError(403,'Bạn chưa có quyền xem chat hỗ trợ');
    const [row]=await this.Conversation.aggregate([...this.basePipeline(actor),{$group:{_id:null,unreadCount:{$sum:'$unreadCount'},unreadConversations:{$sum:{$cond:[{$gt:['$unreadCount',0]},1,0]}}}}]).toArray();
    return {unreadCount:row?.unreadCount || 0,unreadConversations:row?.unreadConversations || 0};
  }
  async history(id,actor,query,{admin=false}={}) {
    await this.ready();await this.authorize(id,actor,{admin});
    const filter={conversationId:oid(id),...(query.before?{seq:{$lt:query.before}}:query.after!==undefined?{seq:{$gt:query.after}}:{})};
    const forward=query.after!==undefined;
    const rows=await this.Message.find(filter).sort({seq:forward?1:-1,_id:forward?1:-1}).limit(query.limit+1).toArray();
    const more=rows.length>query.limit;const items=rows.slice(0,query.limit);if(!forward)items.reverse();
    return {items:items.map(publicMessage),hasMore:more,nextBefore:items[0]?.seq || null,nextAfter:items.at(-1)?.seq || null};
  }
  async send(actor,input,{admin=false}={}) {
    await this.ready();const uid=oid(actor.id);
    if(admin && !canReply(actor))throw new ApiError(403,'Bạn chưa có quyền trả lời chat');
    const run=async()=>this.deletion.withReferences([{collection:'users',id:uid}],async session=>{
      const user=await this.activeActor(actor,{session});
      const old=await this.Message.findOne({senderId:uid,clientMessageId:input.clientMessageId},{session});
      if(old){
        if(old.content!==input.content || (input.conversationId && String(old.conversationId)!==input.conversationId))throw new ApiError(409,'Mã gửi đã được dùng cho nội dung khác','CHAT_SEND_CONFLICT');
        await this.authorize(old.conversationId,actor,{admin,session});return {message:old,idempotent:true};
      }
      let con;
      if(admin){if(!input.conversationId)throw new ApiError(400,'Chọn hội thoại cần trả lời');con=await this.authorize(input.conversationId,actor,{admin:true,session});}
      else {
        if(input.conversationId)con=await this.authorize(input.conversationId,actor,{session});
        else con=await this.Conversation.findOne({customerId:uid},{session});
        if(!con){const now=new Date();con={_id:new ObjectId(),customerId:uid,status:'waiting',assignedAdminId:null,nextSeq:0,customerMessageCount:0,supportMessageCount:0,version:0,createdAt:now,updatedAt:now,closedAt:null};await this.Conversation.insertOne(con,{session});}
      }
      // Serialize references with account deletion, as other modules already do.
      if(!con.customerId.equals(uid)) await this.deletion.withReferences([{collection:'users',id:con.customerId}],async()=>{}, {session});
      const customer=await this.db.collection('users').findOne({_id:con.customerId},{session,projection:{status:1}});
      if(customer?.status!=='active')throw new ApiError(409,'Tài khoản khách hàng đã bị vô hiệu hóa; chỉ có thể xem lịch sử');
      if(admin && con.status==='closed')throw new ApiError(409,'Mở lại hội thoại trước khi trả lời');
      if(admin && con.assignedAdminId && !con.assignedAdminId.equals(uid) && !canManage(actor))throw new ApiError(409,'Hội thoại đang có nhân viên khác phụ trách');
      const bucket=Math.floor(Date.now()/60000);
      const rate=await this.db.collection('chat_rate_limits').findOneAndUpdate({_id:`message:${uid}:${bucket}`},{$inc:{count:1},$setOnInsert:{expiresAt:new Date((bucket+2)*60000)}},{upsert:true,returnDocument:'after',session});
      if(rate.count>30)throw new ApiError(429,'Bạn gửi quá nhanh. Vui lòng thử lại sau một phút.','CHAT_RATE_LIMIT');
      const now=new Date(),kind=admin?'support':'customer';
      const counters={customerCount:con.customerMessageCount+(admin?0:1),supportCount:con.supportMessageCount+(admin?1:0)};
      const message={_id:new ObjectId(),conversationId:con._id,seq:con.nextSeq+1,senderId:uid,senderKind:kind,senderName:user.name || (admin?'Nhân viên hỗ trợ':'Khách hàng'),messageType:'text',content:input.content,clientMessageId:input.clientMessageId,createdAt:now,...counters};
      await this.Message.insertOne(message,{session});
      const reopened=!admin && con.status==='closed';
      await this.Conversation.updateOne({_id:con._id},{$set:{nextSeq:message.seq,customerMessageCount:counters.customerCount,supportMessageCount:counters.supportCount,lastMessage:{content:input.content.slice(0,160),senderKind:kind,seq:message.seq},lastMessageAt:now,updatedAt:now,status:reopened?'waiting':admin?'active':con.status,assignedAdminId:reopened?null:admin?(con.assignedAdminId || uid):con.assignedAdminId,closedAt:reopened?null:con.closedAt},$inc:{version:1}},{session});
      await this.outbox.enqueue('chat.event',{conversationId:String(con._id),messageId:String(message._id)}, {session,idempotencyKey:`chat-message:${message._id}`});
      return {message,idempotent:false};
    });
    let result;
    try{result=await run();}catch(error){if(error.code!==11000)throw error;result=await run();}
    if(!result.idempotent)await this.publishMessage(result.message._id).catch(()=>{});
    return {message:publicMessage(result.message),conversation:await this.detail(result.message.conversationId,actor,{admin}),idempotent:result.idempotent};
  }
  async publishMessage(messageId) {
    const message=await this.Message.findOne({_id:oid(messageId)});if(!message)return;
    const con=await this.Conversation.findOne({_id:message.conversationId});if(!con)return;
    const payload={message:publicMessage(message),conversationId:String(con._id),version:con.version};
    await emitChat('chat:message:new',payload,con.customerId);
    await emitChat('chat:conversation:update',{conversationId:String(con._id),version:con.version},con.customerId);
    await emitChat('chat:notification',{id:String(message._id),conversationId:String(con._id),senderId:String(message.senderId),senderKind:message.senderKind,seq:message.seq},con.customerId);
  }
  async read(id,actor,throughSeq,{admin=false}={}) {
    await this.ready();const con=await this.authorize(id,actor,{admin});
    const message=await this.Message.findOne({conversationId:con._id,seq:throughSeq});
    if(!message)throw new ApiError(400,'Mốc đã xem không hợp lệ');
    const kind=admin?'support':'customer';
    const update=()=>this.Read.updateOne({conversationId:con._id,userId:oid(actor.id)},{$max:{seq:message.seq,customerCount:message.customerCount,supportCount:message.supportCount},$set:{kind,name:actor.name || (admin?'Nhân viên hỗ trợ':'Khách hàng'),updatedAt:new Date()}},{upsert:true});
    try{await update();}catch(error){if(error.code!==11000)throw error;await update();}
    const current=await this.Read.findOne({conversationId:con._id,userId:oid(actor.id)});
    await emitChat('chat:message:read',{conversationId:String(con._id),userId:String(actor.id),seq:current.seq,kind,name:current.name,readAt:current.updatedAt},con.customerId);
    return this.detail(id,actor,{admin});
  }
  async agents(actor) {
    if(!canRead(actor))throw new ApiError(403,'Không có quyền xem nhân viên hỗ trợ');
    await this.activeActor(actor);
    const users=this.db.collection('users').find({status:'active'},{projection:{name:1,role:1,role_id:1}});
    const rbac=new RbacService(this.client),items=[];
    try{for await(const user of users){if(canReply(await rbac.getAuthContextForUser(user)))items.push({_id:String(user._id),name:user.name || 'Nhân viên hỗ trợ'});if(items.length===100)break;}}finally{await users.close();}
    return {items};
  }
  async mutate(id,actor,input,type) {
    await this.ready();const uid=oid(actor.id);const con=await this.authorize(id,actor,{admin:true});
    if(!canReply(actor) && !canManage(actor))throw new ApiError(403,'Không có quyền xử lý hội thoại');
    if(input.version!==con.version)throw new ApiError(409,'Hội thoại vừa thay đổi. Vui lòng tải lại trước khi thao tác.','CHAT_VERSION_CONFLICT');
    const data={updatedAt:new Date()};const references=[{collection:'users',id:uid}];
    if(type==='assign'){
      const target=input.assignedAdminId?oid(input.assignedAdminId):null;
      if(!canManage(actor) && (!target?.equals(uid) || con.assignedAdminId))throw new ApiError(403,'Chỉ được tự nhận hội thoại chưa có người phụ trách');
      if(con.status==='closed')throw new ApiError(409,'Mở lại hội thoại trước khi phân công');
      if(target){const user=await this.db.collection('users').findOne({_id:target,status:'active'});if(!user || !canReply(await new RbacService(this.client).getAuthContextForUser(user)))throw new ApiError(400,'Người nhận không có quyền hỗ trợ');references.push({collection:'users',id:target});}
      Object.assign(data,{assignedAdminId:target,status:target?'active':'waiting'});
    }else{
      if(!canManage(actor) && !con.assignedAdminId?.equals(uid))throw new ApiError(403,'Chỉ nhân viên phụ trách hoặc người quản lý được đổi trạng thái');
      Object.assign(data,{status:input.status,closedAt:input.status==='closed'?new Date():null});
      if(input.status==='waiting')data.assignedAdminId=null;
    }
    const updated=await this.deletion.withReferences(references,session=>this.Conversation.findOneAndUpdate({_id:con._id,version:con.version},{$set:data,$inc:{version:1},$push:{audit:{$each:[{type,actorId:uid,at:new Date(),...type==='status'?{status:input.status}:{assignedAdminId:data.assignedAdminId}}],$slice:-50}}},{session,returnDocument:'after'}));
    if(!updated)throw new ApiError(409,'Hội thoại vừa thay đổi. Vui lòng tải lại trước khi thao tác.','CHAT_VERSION_CONFLICT');
    await emitChat('chat:conversation:update',{conversationId:String(con._id),version:updated.version},con.customerId);
    return this.detail(id,actor,{admin:true});
  }
}
module.exports={ChatService,canRead,canReply,canManage,publicMessage};
