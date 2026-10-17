<script setup>
defineProps({ tone: { type: String, default: 'neutral' } });
</script>
<template><span class="sage-badge" :class="'sage-badge--' + tone"><slot /></span></template>
