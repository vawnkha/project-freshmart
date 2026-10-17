<script setup>
import App from '../App.vue';
import { useRouter } from 'vue-router';
const router = useRouter();
</script>
<template>
  <nav class="sage-qa-navigation" aria-label="Development boundary QA"><button type="button" @click="router.push('/login')">QA: Client login</button><button type="button" @click="router.push('/admin-login')">QA: Admin login</button><button type="button" @click="router.push('/cart')">QA: Guard cart</button><button type="button" @click="router.push('/admin')">QA: Guard admin</button></nav>
  <App />
</template>
<style scoped>
.sage-qa-navigation { display: flex; flex-wrap: wrap; gap: 8px; padding: 8px; }
.sage-qa-navigation button { min-height: 44px; padding: 8px; font-size: 16px; }
</style>
