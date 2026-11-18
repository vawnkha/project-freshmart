const { ObjectId } = require('mongodb');
const { verifyAccessToken } = require('../utils/jwt.util');
const RbacService = require('../services/rbac.service');
const { canRead, ChatService } = require('../services/chat.service');
const schemas = require('../validators/chat.validator');
const { setChatPublisher, emitChat } = require('../utils/chat-events.util');
const { getAllowedOrigins } = require('../config/security');

function installChat(io, getClient) {
  const space=io.of('/chat'), allowed=new Set(getAllowedOrigins());
  async function authenticate(socket,{initial=false}={}) {
    const decoded=verifyAccessToken(socket.data.chatToken);
    if(!Number.isFinite(decoded.exp))throw new Error('unauthorized');
    if(!ObjectId.isValid(decoded.id))throw new Error('unauthorized');
    const client=getClient();const user=await client.db().collection('users').findOne({_id:new ObjectId(decoded.id)});
    if(!user || user.status!=='active')throw new Error('unauthorized');
    const actor=await new RbacService(client).getAuthContextForUser(user);
    const support=canRead(actor) && socket.handshake.auth?.audience!=='customer';
    if(!initial && socket.data.chatSupport && !support)throw new Error('forbidden');
    socket.data.chatActor=actor;socket.data.chatSupport=support;socket.data.exp=decoded.exp;
    return actor;
  }
  function revoke(socket) { socket.emit('chat:access:changed',{code:'CHAT_ACCESS_REVOKED'});socket.disconnect(); }
  space.use(async(socket,next)=>{
    try{
      const origin=socket.handshake.headers.origin;
      if(origin && !allowed.has(origin))throw new Error('forbidden');
      if(socket.handshake.query.token || socket.handshake.query.access_token)throw new Error('unauthorized');
      socket.data.chatToken=socket.handshake.auth?.token;
      await authenticate(socket,{initial:true}); next();
    }catch(_){next(new Error('unauthorized'));}
  });
  setChatPublisher(async(event,payload,customerId,except)=>{
    // Refresh recipients before delivery, so an idle revoked socket cannot keep receiving.
    const eligible=[...space.sockets.values()].filter(s=>s.data.chatSupport || s.data.chatActor?.id===customerId);
    await Promise.all(eligible.map(async socket=>{
      try{await authenticate(socket);}catch(_){revoke(socket);}
    }));
    const operator=space.to([`chat:user:${customerId}`,'chat:agents']);
    (except?operator.except(except):operator).emit(event,payload);
  });
  space.on('connection',socket=>{
    socket.join(`chat:user:${socket.data.chatActor.id}`);
    if(socket.data.chatSupport)socket.join('chat:agents');
    const expires=setTimeout(()=>revoke(socket),Math.max(0,socket.data.exp*1000-Date.now()));expires.unref?.();
    let packetCount=0,windowStart=Date.now(),typingAt=0;
    function action(name,schema,work){socket.on(name,async(payload,ack)=>{
      const reply=typeof ack==='function'?ack:()=>{};
      if(Date.now()-windowStart>10000){packetCount=0;windowStart=Date.now();}
      if(++packetCount>80)return reply({ok:false,status:429,message:'Thao tác quá nhanh, vui lòng thử lại.'});
      let actor;
      try{actor=await authenticate(socket);}catch(_){reply({ok:false,status:401,message:'Phiên chat không còn hợp lệ'});return revoke(socket);}
      try{
        const parsed=schema.safeParse(payload);
        if(!parsed.success)return reply({ok:false,status:400,message:'Dữ liệu chat không hợp lệ'});
        const data=await work(parsed.data,actor,new ChatService(getClient()));
        reply({ok:true,data});
      }catch(error){reply({ok:false,status:error.statusCode || 500,message:error.statusCode?error.message:'Không thể xử lý chat lúc này.'});}
    });}
    action('chat:join',schemas.join,async({conversationId},actor,service)=>{await service.socketAccess(conversationId,actor);await socket.join(`chat:conversation:${conversationId}`);return {conversationId};});
    action('chat:leave',schemas.join,async({conversationId})=>{await socket.leave(`chat:conversation:${conversationId}`);});
    action('chat:message:send',schemas.message,async(body,actor,service)=>{
      const con=body.conversationId?await service.socketAccess(body.conversationId,actor):null;
      return service.send(actor,body,{admin:!!con && String(con.customerId)!==actor.id});
    });
    action('chat:message:read',schemas.join.extend({throughSeq:schemas.read.shape.throughSeq}),async(body,actor,service)=>{const con=await service.socketAccess(body.conversationId,actor);return service.read(body.conversationId,actor,body.throughSeq,{admin:String(con.customerId)!==actor.id});});
    for(const state of ['start','stop'])action(`chat:typing:${state}`,schemas.join,async({conversationId},actor,service)=>{
      const con=await service.socketAccess(conversationId,actor);
      if(state==='start' && Date.now()-typingAt<1200)return;
      if(state==='start')typingAt=Date.now();
      // Read-only staff cannot advertise that they are composing a reply.
      const kind=String(con.customerId)===actor.id?'customer':'support';
      if(kind==='support' && !require('../services/chat.service').canReply(actor))return;
      await emitChat(`chat:typing:${state}`,{conversationId,userId:actor.id,name:actor.name || (kind==='support'?'Nhân viên hỗ trợ':'Khách hàng'),kind,expiresAt:Date.now()+4000},con.customerId,socket.id);
    });
    socket.on('disconnect',()=>clearTimeout(expires));
  });
  let auditing=false;
  const audit=setInterval(async()=>{
    if(auditing)return;auditing=true;
    try{await Promise.all([...space.sockets.values()].map(async socket=>{try{await authenticate(socket);}catch(_){revoke(socket);}}));}finally{auditing=false;}
  },15000);audit.unref?.();
  io.httpServer?.on('close',()=>{clearInterval(audit);});
  return space;
}
module.exports={installChat};
