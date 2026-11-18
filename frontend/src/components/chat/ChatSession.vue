<script setup>
import { computed, onBeforeUnmount, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/user/auth';
import { useLiveChatStore } from '@/stores/live-chat';
import { useChatWidgetStore } from '@/stores/chat-widget';
import { hasAllPermissions } from '@/utils/permission.util';
import LiveChatWidget from '@/components/user/chat/LiveChatWidget.vue';
import '@/assets/css/live-chat.css';
const auth=useAuthStore(),chat=useLiveChatStore(),route=useRoute(),router=useRouter();
const widget=useChatWidgetStore();
const customerArea=computed(()=>route.meta.layout==='customer');
let disposed=false;
function syncSession(){
  if(disposed)return;
  const valid=auth.isLoggedIn && auth.userId && auth.accessToken && String(auth.user?._id)===String(auth.userId) && auth.accessToken===localStorage.getItem('accessToken');
  if(!valid){chat.stop({preserveOpen:customerArea.value});return;}
  if(customerArea.value){chat.start('customer');widget.resumeLogin();return;}
  if(route.meta.layout==='admin' && hasAllPermissions(auth,['admin:access','chat:read']))chat.start('admin');
  else chat.stop();
}
watch([()=>auth.userId,()=>auth.accessToken,()=>auth.isLoggedIn,()=>auth.user?._id,()=>auth.permissions.join(','),()=>route.meta.layout],syncSession,{immediate:true});
// Fence old requests immediately, including a login to the same account with
// the same JWT. Keep only presentation intent; private state always gets cleared.
const stopActions=auth.$onAction(({name,after,onError})=>{
  if(!['login','logout','$reset'].includes(name))return;
  chat.stop({preserveOpen:customerArea.value});
  if(name==='login'){after(syncSession);onError(syncSession);}
});
function changed(event){if(event.key==='accessToken' && event.newValue!==auth.accessToken)chat.stop({preserveOpen:customerArea.value});}
window.addEventListener('storage',changed);
window.addEventListener('online',chat.reconnect);window.addEventListener('offline',chat.offline);
onBeforeUnmount(()=>{disposed=true;stopActions();window.removeEventListener('storage',changed);window.removeEventListener('online',chat.reconnect);window.removeEventListener('offline',chat.offline);chat.stop();});
function openNotice(){const id=chat.notice?.conversationId;chat.notice=null;if(chat.staff)router.push({name:'admin-live-chat',query:{conversation:id}});else widget.open('support');}
</script>
<template>
  <!-- App owns this one instance, outside both layout and child router-views. -->
  <LiveChatWidget v-if="customerArea" />
  <aside v-if="chat.notice && (chat.staff ? !(route.name==='admin-live-chat' && chat.selected?._id===chat.notice.conversationId) : !widget.opened)" class="live-chat-scope lc-notification" role="status"><i class="fa-solid fa-comment-dots" aria-hidden="true"></i><button type="button" @click="openNotice">{{ chat.notice.text }} <span>Xem hội thoại →</span></button><button type="button" aria-label="Đóng thông báo chat" @click="chat.notice=null">×</button></aside>
</template>
