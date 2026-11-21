<script setup>
defineProps({ title: String, description: String });
</script>
<template>
  <div class="site-content sage-auth">
    <div class="container">
      <section class="approved-auth-wrap" aria-labelledby="auth-page-title">
        
        <div class="login-form form">
          <div class="block-title">
            <h1 id="auth-page-title">{{ title }}</h1>
            <p v-if="description" class="auth-description">{{ description }}</p>
          </div>
          <slot />
        </div>
      </section>
    </div>
  </div>
</template>
