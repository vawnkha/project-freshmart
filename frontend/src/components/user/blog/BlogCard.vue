<script setup>
import { computed } from "vue";
import ResponsiveImage from "@/components/user/common/ResponsiveImage.vue";
const props = defineProps({
  post: { type: Object, required: true },
  // Listing reuses Home styles; editorial/compact retain the reading-page cards.
  variant: { type: String, default: "home" },
});
const link = computed(() => `/blog/${props.post.slug || props.post.id}`);
const listing = computed(() => props.variant === "listing");
const editorial = computed(() => props.variant !== "home" && !listing.value);
</script>
<template>
  <article :class="editorial ? ['knowledge-card', { 'knowledge-card-compact': variant === 'compact', 'home-knowledge-card': variant === 'approved-home' }] : 'news-card'">
    <router-link :to="link" :class="editorial ? 'knowledge-card-image' : 'news-image'" :tabindex="editorial ? -1 : undefined" :aria-hidden="editorial ? true : undefined"
      ><ResponsiveImage :src="post.image" :alt="post.title"
    /></router-link>
    <div :class="editorial ? 'knowledge-card-content' : 'news-card-content'">
      <div :class="editorial ? 'knowledge-meta' : 'news-meta'">
        <span v-if="!listing && post.category">{{ post.category }}</span
        ><time v-if="post.date" :datetime="post.datetime">{{ post.date }}</time>
      </div>
      <h3>
        <router-link :to="link">{{ post.title }}</router-link>
      </h3>
      <p v-if="!listing && (post.excerpt || post.summary)">
        {{ post.excerpt || post.summary }}
      </p>
      <router-link :to="link" :class="editorial ? 'text-link knowledge-card-more' : 'text-link'" :aria-label="editorial || listing ? `Đọc bài viết: ${post.title}` : undefined"
        >{{ editorial ? 'Đọc tiếp' : 'Đọc bài viết' }} <i class="fa-solid fa-arrow-right" aria-hidden="true"></i
      ></router-link>
    </div>
  </article>
</template>
