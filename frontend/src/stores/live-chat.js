import { socketOrigin } from "../config/environment";
import { computed, reactive, ref } from 'vue';
import { defineStore } from 'pinia';
import { io } from 'socket.io-client';
import api from '@/services/live-chat.service';
import { useAuthStore, captureAuthRequestContext } from '@/stores/user/auth';
import { hasAllPermissions } from '@/utils/permission.util';

export const useLiveChatStore=defineStore('liveChat',()=>{
  const auth=useAuthStore();
  const owner=ref(''),staff=ref(false),opened=ref(false),connection=ref('disconnected'),error=ref(''),notice=ref(null);
  const selected=ref(null),own=ref(null),messages=ref([]),pending=ref([]),conversations=ref([]),agents=ref([]),typing=ref([]);
  const unread=ref(0),loading=ref(false),loadingOlder=ref(false),hasOlder=ref(false),nextBefore=ref(null),nextCursor=ref(null),listLoading=ref(false);
  const filters=reactive({filter:'all',keyword:''});
  const canReply=computed(()=>staff.value && hasAllPermissions(auth,['admin:access','chat:read','chat:reply']));
  const canManage=computed(()=>staff.value && hasAllPermissions(auth,['admin:access','chat:read','chat:manage']));
  let socket=null,generation=0,key='',detailRequest=0,listRequest=0,syncRequest=0,syncTimer,typingTimer,noticeTimer,typingExpiry;
  const seen=new Map();
  function context(){const gen=generation,request=captureAuthRequestContext();return()=>gen===generation && !!request?.isCurrent() && owner.value===auth.userId;}
  function fail(cause,fallback){const status=cause.response?.status;return status===403?'Bạn không có quyền thực hiện thao tác chat này.':status>=500?fallback:cause.response?.data?.message || fallback;}
  function merge(items){const map=new Map(messages.value.map(m=>[m._id,m]));for(const m of items)map.set(m._id,m);messages.value=[...map.values()].sort((a,b)=>a.seq-b.seq);}
  function announce(payload){
    if(payload.seq<=(seen.get(payload.conversationId) || 0))return;
    seen.set(payload.conversationId,payload.seq);if(seen.size>500)seen.delete(seen.keys().next().value);
    if(payload.senderId===owner.value)return;
    if(staff.value ? payload.senderKind!=='customer' : payload.senderKind!=='support')return;
    notice.value={id:payload.id || payload.message?._id,conversationId:payload.conversationId,text:staff.value?'Có tin nhắn hỗ trợ mới từ khách hàng.':'Nhân viên Fresh Mart vừa phản hồi.'};
    clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>notice.value=null,6000);
  }
  async function loadList(append=false){
    if(!staff.value)return;const current=context(),request=++listRequest;listLoading.value=true;
    try{const result=await api.list({...filters,...append && nextCursor.value?{cursor:nextCursor.value}:{}});if(!current() || request!==listRequest)return;
      const map=new Map((append?conversations.value:[]).map(c=>[c._id,c]));for(const con of result.items){map.set(con._id,con);seen.set(con._id,Math.max(seen.get(con._id)||0,con.nextSeq));}conversations.value=[...map.values()];nextCursor.value=result.nextCursor;
    }catch(cause){if(current())error.value=fail(cause,'Không thể tải danh sách hội thoại.');}finally{if(current() && request===listRequest)listLoading.value=false;}
  }
  async function refreshSelected(){
    if(!selected.value)return;const id=selected.value._id,current=context(),request=++detailRequest;
    try{const con=await api.detail(id,staff.value);if(current() && request===detailRequest && selected.value?._id===id)selected.value=con;}catch(cause){if(current() && selected.value?._id===id)error.value=fail(cause,'Không thể cập nhật hội thoại.');}
  }
  async function sync(){
    const base=context(),request=++syncRequest,current=()=>base() && request===syncRequest;if(!owner.value)return;
    try{
      if(staff.value){const sum=await api.summary();if(!current())return;unread.value=sum.unreadCount;await loadList();}
      else {const result=await api.me();if(!current())return;own.value=result.conversation;unread.value=result.conversation?.unreadCount || 0;if(result.conversation)seen.set(result.conversation._id,Math.max(seen.get(result.conversation._id)||0,result.conversation.nextSeq));if(opened.value && result.conversation && !selected.value)await view(result.conversation._id);}
      if(selected.value){await refreshSelected();if(!current() || !selected.value)return;const id=selected.value._id;let after=messages.value.at(-1)?.seq || 0;let more=true;while(more && current() && selected.value?._id===id){const result=await api.history(id,staff.value,{after,limit:100});if(!current() || selected.value?._id!==id)return;merge(result.items);more=result.hasMore;after=result.nextAfter || after;if(!result.items.length)break;}}
      if(current() && !pending.value.some(item=>item.status==='failed'))error.value='';
    }catch(cause){if(current())error.value=fail(cause,'Không thể đồng bộ chat. Dùng Tải lại để thử lại.');}
  }
  function scheduleSync(){clearTimeout(syncTimer);syncTimer=setTimeout(()=>{void sync();},80);}
  async function view(id){
    const current=context(),request=++detailRequest;
    if(selected.value && selected.value._id!==id)socket?.emit('chat:leave',{conversationId:selected.value._id});
    selected.value=null;messages.value=[];typing.value=[];loading.value=true;error.value='';
    try{const [con,history]=await Promise.all([api.detail(id,staff.value),api.history(id,staff.value)]);if(!current() || request!==detailRequest)return;
      selected.value=con;messages.value=history.items;hasOlder.value=history.hasMore;nextBefore.value=history.nextBefore;socket?.emit('chat:join',{conversationId:id});
    }catch(cause){if(current() && request===detailRequest)error.value=fail(cause,'Không thể tải lịch sử trò chuyện.');}finally{if(current() && request===detailRequest)loading.value=false;}
  }
  async function older(){if(!selected.value || !hasOlder.value || loadingOlder.value)return;const current=context(),id=selected.value._id;loadingOlder.value=true;
    try{const result=await api.history(id,staff.value,{before:nextBefore.value});if(current() && selected.value?._id===id){merge(result.items);hasOlder.value=result.hasMore;nextBefore.value=result.nextBefore;}}
    catch(cause){if(current())error.value=fail(cause,'Không thể tải tin cũ.');}finally{if(current())loadingOlder.value=false;}
  }
  async function send(content,retry=null){
    if(!owner.value)return;const current=context();error.value='';
    const item=retry || {clientMessageId:crypto.randomUUID(),content,conversationId:selected.value?._id,status:'sending'};
    if(!retry)pending.value.push(item);item.status='sending';
    try{const result=await api.send({content:item.content,clientMessageId:item.clientMessageId,...item.conversationId?{conversationId:item.conversationId}:{}},staff.value);if(!current())return;
      pending.value=pending.value.filter(p=>p.clientMessageId!==item.clientMessageId);
      if(!selected.value){selected.value=result.conversation;messages.value=[];socket?.emit('chat:join',{conversationId:selected.value._id});}
      if(selected.value._id===result.conversation._id){selected.value=result.conversation;merge([result.message]);}
      if(!staff.value)own.value=result.conversation;
      scheduleSync();return true;
    }catch(cause){if(current() && messages.value.some(m=>m.clientMessageId===item.clientMessageId))return true;if(current()){item.status='failed';pending.value=[...pending.value];error.value=fail(cause,'Chưa xác định được kết quả gửi. Thử lại sẽ dùng cùng mã gửi, không tạo tin trùng.');}return false;}
  }
  async function markRead(seq){if(!selected.value || seq<=selected.value.readSeq)return;const id=selected.value._id,current=context();try{const con=await api.read(id,staff.value,seq);if(!current() || selected.value?._id!==id)return;selected.value=con;scheduleSync();}catch(cause){if(current())error.value=fail(cause,'Chưa cập nhật được trạng thái đã xem.');}}
  function typingState(active){if(!selected.value || !socket?.connected)return;const id=selected.value._id;socket.emit(`chat:typing:${active?'start':'stop'}`,{conversationId:id});clearTimeout(typingTimer);if(active)typingTimer=setTimeout(()=>socket?.emit('chat:typing:stop',{conversationId:id}),1500);}
  async function mutate(type,value){if(!selected.value)return;const id=selected.value._id,current=context();error.value='';try{const body={version:selected.value.version,...type==='assign'?{assignedAdminId:value}:{status:value}};const result=await api[type](id,body);if(current() && selected.value?._id===id)selected.value=result;scheduleSync();}catch(cause){if(current()){error.value=fail(cause,'Không thể cập nhật hội thoại.');await refreshSelected();}}}
  async function loadAgents(){const current=context();try{const result=await api.agents();if(current())agents.value=result.items;}catch(cause){if(current())error.value=fail(cause,'Không thể tải người phụ trách.');}}
  function stop({preserveOpen=false}={}){
    const wasOpen=opened.value;
    ++generation;++detailRequest;++listRequest;key='';clearTimeout(syncTimer);clearTimeout(typingTimer);clearTimeout(typingExpiry);clearTimeout(noticeTimer);
    socket?.removeAllListeners();socket?.disconnect();socket=null;owner.value='';connection.value='disconnected';selected.value=null;own.value=null;messages.value=[];pending.value=[];conversations.value=[];agents.value=[];typing.value=[];unread.value=0;notice.value=null;loading.value=false;loadingOlder.value=false;listLoading.value=false;hasOlder.value=false;nextCursor.value=null;opened.value=preserveOpen && wasOpen;error.value='';seen.clear();
  }
  function start(mode){
    const next=`${auth.userId}:${auth.accessToken}:${mode}:${mode==='admin'?auth.permissions.join(','):''}`;if(key===next)return;
    const wasOpen=mode==='customer' && opened.value;
    stop();key=next;owner.value=auth.userId;staff.value=mode==='admin';opened.value=wasOpen;const current=context();
    const origin=socketOrigin;
    socket=io(origin.replace(/\/$/,'')+'/chat',{transports:['websocket'],withCredentials:true,auth:callback=>callback({token:localStorage.getItem('accessToken') || '',audience:staff.value?'support':'customer'})});
    connection.value='connecting';
    socket.on('connect',()=>{if(!current())return;connection.value='connected';if(selected.value)socket.emit('chat:join',{conversationId:selected.value._id});void sync();});
    socket.on('disconnect',()=>{if(current()){connection.value='disconnected';typing.value=[];}});
    socket.on('connect_error',()=>{if(current()){connection.value='disconnected';error.value='Chưa kết nối được chat. Kiểm tra mạng hoặc tải lại.';}});
    socket.on('chat:access:changed',()=>{if(!current())return;stop();connection.value='unauthorized';error.value='Phiên chat đã hết hạn hoặc quyền truy cập đã thay đổi. Đăng nhập lại để tiếp tục.';});
    socket.on('chat:message:new',payload=>{if(!current())return;if(payload.conversationId===selected.value?._id){if(!messages.value.length || payload.message.seq>=messages.value[0].seq)merge([payload.message]);pending.value=pending.value.filter(p=>p.clientMessageId!==payload.message.clientMessageId);}announce({...payload,id:payload.message._id,senderId:payload.message.senderId,senderKind:payload.message.senderKind,seq:payload.message.seq});scheduleSync();});
    socket.on('chat:notification',payload=>{if(current())announce(payload);});
    socket.on('chat:conversation:update',()=>{if(current())scheduleSync();});
    socket.on('chat:message:read',payload=>{if(!current())return;if(payload.conversationId===selected.value?._id){const reads=selected.value.reads || [];const previous=reads.find(r=>r.userId===payload.userId);selected.value={...selected.value,reads:[...reads.filter(r=>r.userId!==payload.userId),{...payload,seq:Math.max(previous?.seq || 0,payload.seq)}]};}scheduleSync();});
    for(const state of ['start','stop'])socket.on(`chat:typing:${state}`,payload=>{if(!current() || payload.conversationId!==selected.value?._id || payload.userId===owner.value)return;typing.value=typing.value.filter(t=>t.userId!==payload.userId);if(state==='start')typing.value.push(payload);clearTimeout(typingExpiry);typingExpiry=setTimeout(()=>{typing.value=typing.value.filter(t=>t.expiresAt>Date.now());},4200);});
    void sync();
  }
  async function open(){opened.value=true;notice.value=null;if(own.value && selected.value?._id!==own.value._id)await view(own.value._id);else await sync();}
  function offline(){socket?.disconnect();connection.value='disconnected';typing.value=[];}
  function reconnect(){if(socket && connection.value!=='unauthorized'){socket.connect();void sync();}}
  return {owner,staff,opened,connection,error,notice,selected,own,messages,pending,conversations,agents,typing,unread,loading,loadingOlder,hasOlder,nextCursor,listLoading,filters,canReply,canManage,start,stop,open,view,older,send,markRead,typingState,mutate,loadAgents,loadList,sync,reconnect,offline};
});
