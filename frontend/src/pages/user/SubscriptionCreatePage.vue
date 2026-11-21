<script setup>
import { useRoute, useRouter } from 'vue-router';
import PageHeading from '@/components/user/common/PageHeading.vue';
import SubscriptionForm from '@/components/user/subscriptions/SubscriptionForm.vue';
const route = useRoute(), router = useRouter();
function saved(sub) { router.push('/account/subscriptions/' + sub._id); }
</script>
<template><div class="site-content subscription-page"><PageHeading title="Đăng ký giao hàng định kỳ" description="Lên lịch nhận chế phẩm trong vụ nuôi; quản lý từng kỳ tại tài khoản của bạn." parent="Đơn hàng định kỳ" parent-to="/account/subscriptions" /><div class="container subscription-workspace"><SubscriptionForm :expiry-group="route.query.expiryGroup" :product-id="typeof route.query.productId==='string' ? route.query.productId : undefined" :quantity="Number(route.query.quantity)||1" @saved="saved" /></div></div></template>
