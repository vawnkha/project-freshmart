<script setup>
import { computed } from "vue";
import { productPrice, productComparePrice, formatMoney } from "@/utils/storefront.util";
const props = defineProps({ product: { type: Object, required: true } });
const price = computed(() => productPrice(props.product));
const compare = computed(() => productComparePrice(props.product));
</script>
<template>
  <div class="store-price">
    <span class="store-price-amounts"><strong>{{ price === null ? "Chưa có giá" : formatMoney(price) }}</strong
    ><del v-if="price !== null && compare > price">{{
      formatMoney(compare)
    }}</del></span>
    <small v-if="product.packageSize || product.unit"><span v-if="product.packageSize">{{ product.packageSize }}</span><span v-if="product.unit">{{ product.packageSize ? ' · ' : '/ ' }}{{ product.unit }}</span></small>
  </div>
</template>
