<script setup>
import { onBeforeUnmount, ref, watch } from 'vue';
import { useAuthStore } from '@/stores/user/auth';
import subscriptions from '@/services/subscriptions.service';
const props = defineProps({ productId: { type: String, required: true }, quantity: { type: Number, default: 1 } });
const auth = useAuthStore();
const eligible = ref(false);
let version = 0;
watch(() => props.productId, async id => {
  const request = ++version; eligible.value = false;
  try { const policy = await subscriptions.policy(id); if (request === version) eligible.value = policy.eligible; }
  catch (_) { /* One-time purchase remains available when subscription policy is unavailable. */ }
}, { immediate: true });
onBeforeUnmount(() => { version++; });
function destination() {
  const path = `/account/subscriptions/new?productId=${encodeURIComponent(props.productId)}&quantity=${Math.min(10000, Math.max(1, Math.trunc(props.quantity) || 1))}`;
  return auth.isLoggedIn ? path : { path: '/login', query: { redirect: path } };
}
</script>
<template><RouterLink v-if="eligible" :to="destination()" class="sage-button sage-button--secondary subscription-purchase-link"><i class="fa-solid fa-calendar-days" aria-hidden="true"></i> Mua định kỳ</RouterLink></template>
