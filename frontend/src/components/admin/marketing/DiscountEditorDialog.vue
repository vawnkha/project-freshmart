<script setup>
import { computed, ref, useId } from "vue";
import { useDialogFocus } from "@/composables/useDialogFocus";

const props = defineProps({ open: Boolean, title: String, saving: Boolean });
const emit = defineEmits(["close", "submit"]);
const panel = ref(null);
const id = useId();
const titleId = `discount-editor-title-${id}`;
const formId = `discount-editor-form-${id}`;

function close() {
  if (!props.saving) emit("close");
}

useDialogFocus(computed(() => props.open), panel, close);
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="admin-modal-mask" @click.self="close">
      <section ref="panel" class="admin-modal admin-modal--wide discount-editor"
        role="dialog" aria-modal="true" :aria-labelledby="titleId" :aria-busy="saving" tabindex="-1">
        <header class="admin-modal__header">
          <h2 :id="titleId" class="admin-modal__title">{{ title }}</h2>
          <button type="button" class="admin-btn admin-btn--secondary" :disabled="saving" @click="close">Đóng</button>
        </header>
        <div class="admin-modal__body">
          <form :id="formId" class="admin-form" @submit.prevent="emit('submit')">
            <slot />
          </form>
        </div>
        <footer class="admin-modal__footer">
          <button type="button" class="admin-btn admin-btn--secondary" :disabled="saving" @click="close">Quay lại</button>
          <button type="submit" :form="formId" class="admin-btn admin-btn--primary" :disabled="saving">
            {{ saving ? 'Đang lưu…' : 'Lưu' }}
          </button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.discount-editor { box-sizing: border-box; max-height: calc(100dvh - 32px); }
.admin-modal__title { margin: 0; }
.discount-editor :deep(:is(input, select, textarea):focus-visible) {
  outline: 2px solid var(--admin-sidebar);
  outline-offset: 2px;
}
@media (max-width: 992px) {
  .discount-editor :deep(.admin-form__row > :not(.admin-form__label)) { grid-column: 1; }
}
</style>
