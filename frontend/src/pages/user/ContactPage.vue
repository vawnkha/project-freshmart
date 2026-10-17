<script setup>
import { getCurrentInstance, reactive, ref, watch, onBeforeUnmount } from "vue";
import { emailSchema } from "@/validators/common.validator";
import contactService from "@/services/contact.service";
import PageHeading from "@/components/user/common/PageHeading.vue";
import { userError, userFieldErrors } from "@/utils/user-error.util";
import { useAuthStore, captureAuthRequestContext } from "@/stores/user/auth";
import SageButton from "@/components/user/sage/SageButton.vue";
// Contact is public and can also render independently (e.g. SSR). In the real
// Client app, use the existing Pinia authority for owner/session fences.
const pinia = getCurrentInstance()?.appContext.config.globalProperties.$pinia;
const auth = pinia ? useAuthStore(pinia) : null;
const contactForm = reactive({ name: "", email: "", subject: "", content: "" });
const submitting = ref(false);
const submitted = ref(false);
const errors = ref({});
const message = ref("");
const success = ref(false);
const uncertain = ref(false);
let activeRequest = null;
let disposed = false;
function resetSession() {
  activeRequest = null;
  submitting.value = false;
  submitted.value = false;
  success.value = false;
  uncertain.value = false;
  errors.value = {};
  message.value = "";
  for (const key in contactForm) contactForm[key] = "";
}
const stopActions = auth?.$onAction(({ name }) => {
  if (["login", "logout", "$reset"].includes(name)) resetSession();
});
watch(() => [auth?.userId, auth?.accessToken, auth?.isLoggedIn], resetSession, { flush: "sync" });
onBeforeUnmount(() => { disposed = true; activeRequest = null; stopActions?.(); });
function validate() {
  errors.value = {};
  for (const key of Object.keys(contactForm))
    if (!contactForm[key].trim())
      errors.value[key] = "Vui lòng nhập thông tin này.";
  if (
    contactForm.email.trim() &&
    !emailSchema.safeParse(contactForm.email).success
  )
    errors.value.email = "Email không hợp lệ.";
  return !Object.keys(errors.value).length;
}
async function handleSubmit() {
  if (disposed || submitting.value) return;
  submitted.value = true;
  message.value = "";
  if (!validate()) return;
  const context = auth ? captureAuthRequestContext() : null;
  const request = {};
  activeRequest = request;
  const isCurrent = () => !disposed && activeRequest === request && (!context || context.isCurrent());
  submitting.value = true;
  uncertain.value = false;
  try {
    const response = await contactService.create({ ...contactForm });
    if (!isCurrent()) return;
    if (!response?.data?._id) throw new Error("Chưa thể xác nhận yêu cầu đã được tiếp nhận.");
    success.value = true;
    message.value = "Đã tiếp nhận yêu cầu liên hệ của bạn.";
    for (const key in contactForm) contactForm[key] = "";
    submitted.value = false;
  } catch (error) {
    if (!isCurrent()) return;
    success.value = false;
    const status = error?.response?.status;
    uncertain.value = !status || status === 408 || status >= 500;
    errors.value = userFieldErrors(error);
    message.value = uncertain.value
      ? "Chưa thể xác nhận yêu cầu đã được tiếp nhận. Không tự động gửi lại; gửi một yêu cầu mới có thể tạo bản trùng."
      : userError(error, "Không thể gửi liên hệ. Vui lòng kiểm tra thông tin.");
  } finally {
    if (isCurrent()) { submitting.value = false; activeRequest = null; }
  }
}
</script>
<template>
  <div class="site-content sage-contact">
    <PageHeading
      title="Cùng trao đổi."
      description="Chia sẻ nhu cầu sản phẩm hoặc gửi yêu cầu hỗ trợ của bạn."
    />
    <div class="container contact-page">
      <div class="contact-info">
        <span class="eyebrow">Liên hệ FreshMart</span>
        <h2>Một câu hỏi rõ ràng là điểm bắt đầu.</h2>
        <p>Gửi câu hỏi về sản phẩm hoặc yêu cầu hỗ trợ. Bạn có thể tìm tên, giá và tình trạng sản phẩm qua trợ lý ở góc màn hình.</p>
        <div class="row">
          <div class="col-md-6">
            <div class="item">
              <div class="icon">
                <i class="fa-regular fa-envelope" aria-hidden="true"></i>
              </div>
              <div class="item-right">
                <div class="title">Email</div>
                <a href="mailto:nvkha@gmail.com">nvkha@gmail.com</a>
              </div>
            </div>
          </div>
          <div class="col-md-6">
            <div class="item">
              <div class="icon">
                <i class="fa-solid fa-location-dot" aria-hidden="true"></i>
              </div>
              <div class="item-right">
                <div class="title">Địa chỉ</div>
                <p>Khu 2, Đ. 3/2, P. Ninh Kiều, TP. Cần Thơ</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="contact-form">
        <h2>Gửi lời nhắn</h2>
        <form @submit.prevent="handleSubmit" novalidate :aria-busy="submitting">
          <div
            v-for="field in [
              { key: 'name', label: 'Họ và tên', type: 'text' },
              { key: 'email', label: 'Email', type: 'email' },
              { key: 'subject', label: 'Chủ đề', type: 'text' },
              { key: 'content', label: 'Nội dung' },
            ]"
            :key="field.key"
            class="form-group"
          >
            <label :for="'contact-' + field.key">{{ field.label }}</label
            ><textarea
              v-if="field.key === 'content'"
              :id="'contact-' + field.key"
              v-model="contactForm[field.key]"
              rows="5"
              required
              :disabled="submitting"
              :aria-invalid="!!errors[field.key]"
              :aria-describedby="'contact-error-' + field.key"
              @input="submitted && validate()"
            ></textarea
            ><input
              v-else
              :id="'contact-' + field.key"
              v-model="contactForm[field.key]"
              :type="field.type"
              required
              :disabled="submitting"
              :autocomplete="
                field.key === 'name'
                  ? 'name'
                  : field.key === 'email'
                    ? 'email'
                    : undefined
              "
              :aria-invalid="!!errors[field.key]"
              :aria-describedby="'contact-error-' + field.key"
              @input="submitted && validate()"
            />
            <p :id="'contact-error-' + field.key" class="form-error form-error--field" aria-live="polite">
              {{ errors[field.key] }}
            </p>
          </div>
          <div
            v-if="message"
            class="alert"
            :class="success ? 'alert-success' : 'alert-danger'"
            role="status"
          >
            {{ message }}
          </div>
          <SageButton type="submit" :loading="submitting" :disabled="submitting">{{ uncertain ? "Gửi yêu cầu mới" : "Gửi liên hệ" }}</SageButton>
          <p class="contact-acceptance-note">Thông báo tiếp nhận xác nhận yêu cầu đã được lưu, không xác nhận email đã được gửi.</p>
        </form>
      </div>
    </div>
  </div>
</template>
