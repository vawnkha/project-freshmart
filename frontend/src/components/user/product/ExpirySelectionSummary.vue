<script setup>
import { formatMoney } from '@/utils/storefront.util';
defineProps({ quote: Object, choice: Object });
const label = value => value?.group === 'long' ? 'Hàng có hạn sử dụng dài' : value?.group === 'promotion' ? 'Hàng giảm giá cận hạn' : 'Hàng hạn dùng khác';
const date = value => new Date(value).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' });
</script>
<template><div v-if="choice" class="expiry-selection-summary"><strong>{{ label(choice) }}</strong><p v-if="choice.group === 'long'">Còn tối thiểu {{ choice.minRemainingDays }} ngày tại lúc đặt hàng.</p><p v-if="quote?.percent">Giảm {{ quote.percent }}% · Giá gốc {{ formatMoney(quote.originalPrice) }}</p><p v-for="(row,index) in quote?.expiries || []" :key="index">{{ row.quantity }} sản phẩm · HSD {{ date(row.expiryDate) }} · {{ formatMoney(row.unitPrice) }}/sản phẩm</p><p v-if="quote">Thành tiền: <strong>{{ formatMoney(quote.total) }}</strong></p></div></template>
<style scoped>.expiry-selection-summary{font-size:.875rem;line-height:1.5;margin:.65rem 0}.expiry-selection-summary p{margin:.2rem 0}</style>
