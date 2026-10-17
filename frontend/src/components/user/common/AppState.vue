<script setup>
defineProps({
  kind: { type: String, default: "empty" },
  title: String,
  headingTag: { type: String, default: "h3" },
  description: String,
  retry: Boolean,
  to: String,
  action: { type: String, default: "Khám phá sản phẩm" },
});
defineEmits(["retry"]);
</script>
<template>
  <div class="app-state" :aria-busy="kind === 'loading'" :role="kind === 'error' ? 'alert' : 'status'">
    <i
      :class="
        kind === 'loading'
          ? 'fa-solid fa-spinner fa-spin'
          : kind === 'error'
            ? 'fa-solid fa-circle-exclamation'
            : 'fa-solid fa-box-open'
      "
      aria-hidden="true"
    ></i>
    <component :is="headingTag">
      {{ title || (kind === "loading" ? "Đang tải..." : "Chưa có nội dung") }}
    </component>
    <p v-if="description">{{ description }}</p>
    <button v-if="retry" class="btn btn-primary" @click="$emit('retry')">
      Thử lại</button
    ><router-link v-if="to" :to="to" class="btn btn-primary">{{
      action
    }}</router-link>
  </div>
</template>
