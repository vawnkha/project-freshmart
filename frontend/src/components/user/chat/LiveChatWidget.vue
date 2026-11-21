<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useLiveChatStore } from '@/stores/live-chat';
import { useChatWidgetStore } from '@/stores/chat-widget';
import ChatThread from '@/components/chat/ChatThread.vue';
import AiChatBox from './AiChatBox.vue';
const route=useRoute(),chat=useLiveChatStore(),ui=useChatWidgetStore();
const trigger=ref(null),thread=ref(null),ai=ref(null),aiTab=ref(null),supportTab=ref(null);
const dock=ref(22),height=ref(window.innerHeight),offset=ref(0),showTop=ref(false);
const supportActive=computed(()=>ui.opened && ui.mode==='support');
const style=computed(()=>({'--lc-dock':dock.value+'px','--lc-viewport-height':height.value+'px','--lc-viewport-top':offset.value+'px'}));
let observer,resize,frame,bar,disposed=false;
function measure(){cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{
  height.value=window.visualViewport?.height || window.innerHeight;offset.value=window.visualViewport?.offsetTop || 0;showTop.value=window.scrollY>500;
  const next=document.querySelector('.comparison-bar');if(next!==bar){if(bar)resize?.unobserve(bar);bar=next;if(bar)resize?.observe(bar);}
  const rect=bar?.getBoundingClientRect();dock.value=rect && rect.top<window.innerHeight && rect.bottom>0?Math.max(22,window.innerHeight-rect.top+12):22;
});}
watch([supportActive,()=>chat.owner],async([active,owner])=>{
  chat.opened=active;
  if(active && owner)await chat.open();
  else chat.typingState(false);
},{immediate:true});
async function toggle(){if(ui.opened){close();return;}ui.open();await nextTick();if(!disposed)(ui.mode==='ai'?ai.value:thread.value)?.focus();}
function close(){ui.close();chat.typingState(false);void nextTick(()=>trigger.value?.focus({preventScroll:true}));}
function select(mode,event){ui.select(mode);if(event)(mode==='ai'?aiTab.value:supportTab.value)?.focus({preventScroll:true});}
function tabKey(event){let mode;if(['ArrowLeft','ArrowRight'].includes(event.key))mode=ui.mode==='ai'?'support':'ai';else if(event.key==='Home')mode='ai';else if(event.key==='End')mode='support';if(mode){event.preventDefault();select(mode,event);}}
function login(){ui.requestLogin();}
function toTop(){window.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
onMounted(()=>{resize=new ResizeObserver(measure);observer=new MutationObserver(measure);observer.observe(document.body,{childList:true,subtree:true});window.addEventListener('scroll',measure,{passive:true});window.visualViewport?.addEventListener('resize',measure);window.visualViewport?.addEventListener('scroll',measure);measure();});
onBeforeUnmount(()=>{disposed=true;chat.opened=false;chat.typingState(false);observer?.disconnect();resize?.disconnect();cancelAnimationFrame(frame);window.removeEventListener('scroll',measure);window.visualViewport?.removeEventListener('resize',measure);window.visualViewport?.removeEventListener('scroll',measure);});
</script>
<template>
  <div class="live-chat-scope live-chat-widget" :class="{'lc-widget--open':ui.opened,'lc-widget--compact':height<480}" :style="style">
    <button v-show="showTop && !ui.opened" type="button" class="lc-back-top" aria-label="Về đầu trang" title="Về đầu trang" @click="toTop"><i class="fa-solid fa-arrow-up" aria-hidden="true"></i></button>
    <button ref="trigger" type="button" class="lc-launcher" :aria-expanded="ui.opened" aria-controls="fresh-mart-chat" aria-label="Chat Fresh Mart" title="Fresh Mart Chat · Trợ lý AI và hỗ trợ trực tiếp" @click="toggle"><i class="fa-solid fa-comments" aria-hidden="true"></i><b v-if="chat.unread" class="lc-unread" :aria-label="chat.unread+' tin hỗ trợ chưa đọc'">{{ chat.unread>99?'99+':chat.unread }}</b></button>
    <section v-show="ui.opened" id="fresh-mart-chat" class="lc-widget-panel" role="dialog" aria-label="Fresh Mart Chat" :inert="!ui.opened" @keydown.esc.stop.prevent="close">
      <header class="lc-thread-header"><span class="lc-brand-icon" aria-hidden="true"><i class="fa-solid fa-comments"></i></span><div><h2>Fresh Mart Chat</h2><p>Trợ lý AI &amp; nhân viên hỗ trợ</p></div><button type="button" aria-label="Thu nhỏ Fresh Mart Chat" @click="close"><i class="fa-solid fa-minus" aria-hidden="true"></i></button><button type="button" aria-label="Đóng Fresh Mart Chat" @click="close">×</button></header>
      <div class="lc-mode-tabs" role="tablist" aria-label="Chế độ trò chuyện" @keydown="tabKey">
        <button id="fresh-chat-ai-tab" ref="aiTab" type="button" role="tab" :aria-selected="ui.mode==='ai'" aria-controls="fresh-chat-ai" :tabindex="ui.mode==='ai'?0:-1" @click="select('ai')"><i class="fa-solid fa-robot" aria-hidden="true"></i>Trợ lý AI</button>
        <button id="fresh-chat-support-tab" ref="supportTab" type="button" role="tab" :aria-selected="ui.mode==='support'" aria-controls="fresh-chat-support" :tabindex="ui.mode==='support'?0:-1" @click="select('support')"><i class="fa-solid fa-headset" aria-hidden="true"></i>Hỗ trợ trực tuyến<b v-if="chat.unread" class="lc-unread">{{ chat.unread>99?'99+':chat.unread }}</b></button>
      </div>
      <div v-show="ui.mode==='ai'" id="fresh-chat-ai" class="lc-mode-panel" role="tabpanel" aria-labelledby="fresh-chat-ai-tab" :inert="ui.mode!=='ai'"><AiChatBox ref="ai" embedded :active="ui.opened && ui.mode==='ai'" /></div>
      <div v-show="ui.mode==='support'" id="fresh-chat-support" class="lc-mode-panel" role="tabpanel" aria-labelledby="fresh-chat-support-tab" :inert="ui.mode!=='support'">
        <p class="lc-support-connection" :data-connection="chat.connection">{{ !chat.owner?'Chat trực tiếp với nhân viên Fresh Mart':chat.connection==='connected'?'Đã kết nối · Chat với nhân viên':chat.connection==='connecting'?'Đang kết nối…':'Chưa kết nối · Kiểm tra mạng hoặc tải lại' }}</p>
        <ChatThread v-if="chat.owner" ref="thread" :active="supportActive" />
        <div v-else class="lc-empty lc-login"><i class="fa-solid fa-user-lock lc-empty-icon" aria-hidden="true"></i><strong>Đăng nhập để chat với nhân viên</strong><p>Lịch sử trò chuyện sẽ được lưu trong tài khoản của bạn.</p><RouterLink class="lc-primary" :to="{name:'login',query:{redirect:route.fullPath,chat:'open'}}" @click="login">Đăng nhập để trò chuyện</RouterLink></div>
      </div>
    </section>
  </div>
</template>
