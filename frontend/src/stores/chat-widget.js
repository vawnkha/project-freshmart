import { defineStore } from 'pinia';

// Presentation only. AI messages stay in AiChatBox; support data stays in liveChat.
export const useChatWidgetStore=defineStore('chatWidget',{
  state:()=>({opened:false,mode:'ai',resumeAfterLogin:false}),
  actions:{
    open(mode=this.mode){this.select(mode);this.opened=true;},
    select(mode){if(['ai','support'].includes(mode))this.mode=mode;},
    close(){this.opened=false;},
    requestLogin(){this.resumeAfterLogin=true;this.opened=false;},
    resumeLogin(){if(this.resumeAfterLogin){this.resumeAfterLogin=false;this.open('support');}},
  },
});
