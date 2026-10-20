<script setup>
import { computed, nextTick, ref, toRef, watch } from "vue";
import { useRoute } from "vue-router";
import { useArticleComments } from "@/composables/useArticleComments";
import { hasAllPermissions } from "@/utils/permission.util";
import ResponsiveImage from "@/components/user/common/ResponsiveImage.vue";
import SageButton from "@/components/user/sage/SageButton.vue";
import SageTextarea from "@/components/user/sage/SageTextarea.vue";
import SageLoading from "@/components/user/sage/SageLoading.vue";
import SageDialog from "@/components/user/sage/SageDialog.vue";

const props = defineProps({ articleId: { type: String, required: true } });
const route = useRoute(), root = ref(null), deleting = ref(null);
const resource = useArticleComments(toRef(props, "articleId"));
const { auth, items, total, hasMore, form, state, canWrite, locked } = resource;
const moderator = computed(() => canWrite.value && hasAllPermissions(auth, ["admin:access", "news:manage"]));
const mine = comment => canWrite.value && String(comment.user_id) === String(auth.userId);
const avatar = person => person?.avatar || person?.avatar_url || "";
function date(value) { const parsed = new Date(value);return Number.isNaN(parsed.getTime()) ? "" : parsed.toLocaleString("vi-VN"); }
async function submit(editing = false) {
  await (editing ? resource.save() : resource.submit());await nextTick();
  root.value?.querySelector('[aria-invalid="true"]')?.focus();
}
async function remove() { const id = deleting.value?._id;deleting.value = null;if (id) await resource.remove(id); }
watch([() => props.articleId, () => auth.userId, () => auth.accessToken], () => { deleting.value = null; }, { flush: "sync" });
</script>
<template>
  <section ref="root" id="article-comments" class="knowledge-reading article-comments" aria-labelledby="article-comments-title">
    <header class="article-comments-heading"><h2 id="article-comments-title">Bình luận <span v-if="!state.error && (!state.loading || items.length)">({{ total }})</span></h2><p>Trao đổi và chia sẻ ý kiến về bài viết.</p></header>
    <form v-if="canWrite" class="article-comment-form" @submit.prevent="submit()" novalidate>
      <div class="article-comment-person"><ResponsiveImage class="article-comment-avatar" :src="avatar(auth.user)" :alt="auth.user?.name || 'Tài khoản của bạn'" /><strong>{{ auth.user?.name || 'Tài khoản của bạn' }}</strong></div>
      <SageTextarea id="article-comment-content" v-model="form.content" label="Nội dung bình luận" hint="Văn bản thuần, tối đa 1.000 ký tự." maxlength="1000" :disabled="locked || !!form.editId" :error="!form.editId ? state.fieldError : ''" required />
      <div class="article-comment-form-actions"><span>{{ form.content.length }}/1.000</span><SageButton type="submit" :loading="state.busy && !form.editId" :disabled="locked || !!form.editId">Gửi bình luận</SageButton></div>
    </form>
    <div v-else class="article-comment-login"><p>Vui lòng đăng nhập để tham gia bình luận.</p><RouterLink class="text-link" :to="{ path: '/login', query: { redirect: route.fullPath } }">Đăng nhập <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></RouterLink></div>
    <p v-if="state.success" role="status" class="article-comment-feedback">{{ state.success }}</p>
    <div v-if="state.sendError" role="alert" class="article-comment-feedback">
      <p>{{ state.sendError }}</p>
      <template v-if="state.uncertain"><SageButton variant="secondary" :disabled="state.loading || state.busy" @click="resource.load()">Tải lại bình luận</SageButton><SageButton v-if="state.fresh" variant="ghost" :disabled="state.loading || state.busy" @click="resource.acknowledge()">Đã kiểm tra, tiếp tục</SageButton></template>
    </div>
    <SageLoading v-if="state.loading" label="Đang tải bình luận" />
    <div v-if="state.error" class="article-comment-feedback" role="alert"><p>{{ state.error }}</p><SageButton variant="secondary" :disabled="locked" @click="resource.load()">Thử lại bình luận</SageButton></div>
    <p v-if="!items.length && !state.loading && !state.error" class="article-comment-empty">Chưa có bình luận. Hãy là người đầu tiên chia sẻ ý kiến.</p>
    <ol v-if="items.length" class="article-comment-list" :aria-busy="state.loading">
      <li v-for="comment in items" :key="comment._id">
        <article class="article-comment">
          <ResponsiveImage class="article-comment-avatar" :src="avatar(comment.author)" :alt="comment.author?.name || 'Người dùng'" />
          <div class="article-comment-body">
            <header><strong>{{ comment.author?.name || 'Người dùng' }}</strong><time :datetime="comment.created_at">{{ date(comment.created_at) }}</time><span v-if="comment.updated_at !== comment.created_at">Đã chỉnh sửa</span></header>
            <form v-if="form.editId === comment._id && mine(comment)" @submit.prevent="submit(true)" novalidate>
              <SageTextarea :id="'edit-comment-' + comment._id" v-model="form.editContent" label="Chỉnh sửa bình luận" maxlength="1000" :error="state.fieldError" :disabled="locked" required />
              <div class="article-comment-actions"><SageButton type="submit" :loading="state.busy" :disabled="locked">Lưu</SageButton><SageButton variant="ghost" :disabled="locked" @click="resource.cancelEdit()">Hủy</SageButton></div>
            </form>
            <p v-else class="article-comment-text">{{ comment.content }}</p>
            <div class="article-comment-actions" v-if="canWrite && !form.editId && (mine(comment) || moderator)">
              <SageButton v-if="mine(comment)" variant="ghost" :disabled="locked" :aria-label="'Sửa bình luận của ' + (comment.author?.name || 'bạn')" @click="resource.edit(comment)">Sửa</SageButton>
              <SageButton variant="ghost" :disabled="locked" :aria-label="'Xóa bình luận của ' + (comment.author?.name || 'người dùng')" @click="deleting = comment">Xóa</SageButton>
            </div>
          </div>
        </article>
      </li>
    </ol>
    <SageButton v-if="hasMore && !state.error" variant="secondary" :loading="state.loading" :disabled="locked" @click="resource.load(true)">Xem thêm bình luận</SageButton>
    <SageDialog :model-value="!!deleting" title="Xóa bình luận?" @update:model-value="value => { if (!value) deleting = null; }">
      <p>Bình luận sẽ được xóa. Bạn có muốn tiếp tục?</p>
      <template #footer><SageButton variant="secondary" @click="deleting = null">Hủy</SageButton><SageButton @click="remove">Xóa bình luận</SageButton></template>
    </SageDialog>
  </section>
</template>
<style scoped>
section.article-comments { margin-block: var(--space-8); padding-top: var(--space-8); border-top: 1px solid var(--line-2); scroll-margin-top: 128px; }
.article-comments-heading { margin-bottom: var(--space-6); }
.article-comments-heading h2 { font-family: var(--font-display); margin: 0 0 var(--space-2); }
.article-comments-heading p, .article-comment-empty, .article-comment-login p { color: var(--metadata-ink); }
.article-comment-form, .article-comment-login { padding: var(--space-6); border: 1px solid var(--line-2); border-radius: var(--radius-card); background: var(--paper); margin-bottom: var(--space-6); }
.article-comment-form :deep(.sage-field) { margin-block: var(--space-4); }
.article-comment-person { display: flex; align-items: center; gap: var(--space-3); }
.article-comments .article-comment-avatar { width: 44px; height: 44px; min-width: 44px; min-height: 44px; max-width: 44px; max-height: 44px; border-radius: 50%; object-fit: cover; overflow: hidden; background: var(--mist); }
.article-comment-avatar:deep(.image-placeholder), .article-comment-avatar.image-placeholder { display: grid; place-items: center; font-size: 18px; }
.article-comment-avatar :deep(span) { display: none; }
.article-comment-form-actions { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); }
.article-comment-form-actions > span, .article-comment-body time, .article-comment-body header > span { color: var(--metadata-ink); font-size: var(--text-meta); }
.article-comment-list { list-style: none; margin: 0 0 var(--space-6); padding: 0; }
.article-comment-list > li { border-bottom: 1px solid var(--line-2); padding-block: var(--space-6); }
.article-comment { display: flex; align-items: flex-start; gap: var(--space-3); }
.article-comment-body { min-width: 0; flex: 1; }
.article-comment-body header { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--space-2) var(--space-3); }
.article-comment-text { white-space: pre-wrap; overflow-wrap: anywhere; margin-block: var(--space-3); }
.article-comment-actions { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-top: var(--space-2); }
.article-comment-feedback { margin-block: var(--space-4); padding: var(--space-3); border-left: 3px solid var(--sage); background: var(--mist); overflow-wrap: anywhere; }
.article-comment-feedback .sage-button { margin: var(--space-1); }
@media (max-width: 600px) { .article-comment-form, .article-comment-login { padding: var(--space-4); } .article-comment-form-actions { flex-wrap: wrap; } }
</style>
