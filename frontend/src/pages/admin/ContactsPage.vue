<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import contactService from "@/services/contact.service";
import { useAuthStore } from "@/stores/user/auth";
import { hasPermission } from "@/utils/permission.util";

const authStore = useAuthStore();
const contacts = ref([]);
const loading = ref(false);
const sending = ref(false);
const selectedContact = ref(null);
const showReplyBox = ref(false);

const filters = reactive({
  keyword: "",
  status: "",
});

const reply = reactive({
  body: "",
});
const canReplyContacts = computed(() =>
  hasPermission(authStore, "contact:reply"),
);

function formatDateTime(value) {
  if (!value) return "---";
  return new Date(value).toLocaleString("vi-VN");
}

function getStatusText(item) {
  return item.status === "replied" ? "Đã phản hồi" : "Chờ phản hồi";
}

function getStatusClass(item) {
  return item.status === "replied"
    ? "contact-status contact-status--success"
    : "contact-status contact-status--warning";
}

async function fetchContacts() {
  try {
    loading.value = true;

    const res = await contactService.getAll();

    contacts.value = (res || []).map((item) => ({
      ...item,
      unread: item.status === "pending",
    }));

    if (contacts.value.length > 0) {
      if (selectedContact.value?._id) {
        const found = contacts.value.find(
          (item) => item._id === selectedContact.value._id,
        );
        selectedContact.value = found || contacts.value[0];
      } else {
        selectedContact.value = contacts.value[0];
      }
    } else {
      selectedContact.value = null;
    }
  } catch (error) {
    alert(error?.response?.data?.message || "Không thể tải danh sách liên hệ");
  } finally {
    loading.value = false;
  }
}

const filteredContacts = computed(() => {
  const keyword = filters.keyword.trim().toLowerCase();

  return contacts.value.filter((item) => {
    const matchKeyword =
      !keyword ||
      String(item.name || "")
        .toLowerCase()
        .includes(keyword) ||
      String(item.email || "")
        .toLowerCase()
        .includes(keyword) ||
      String(item.subject || "")
        .toLowerCase()
        .includes(keyword) ||
      String(item.content || "")
        .toLowerCase()
        .includes(keyword);

    const matchStatus = !filters.status || item.status === filters.status;

    return matchKeyword && matchStatus;
  });
});

const totalContacts = computed(() => contacts.value.length);
const pendingContacts = computed(
  () => contacts.value.filter((item) => item.status === "pending").length,
);
const repliedContacts = computed(
  () => contacts.value.filter((item) => item.status === "replied").length,
);

const hasSelectedContact = computed(() => !!selectedContact.value);

function selectContact(item) {
  selectedContact.value = item;
  showReplyBox.value = false;
  reply.body = item.admin_reply || "";
}

function openReplyBox() {
  if (!canReplyContacts.value) {
    alert("Ban khong co quyen phan hoi lien he");
    return;
  }

  if (!selectedContact.value) return;
  reply.body = selectedContact.value.admin_reply || "";
  showReplyBox.value = true;
}

function closeReplyBox() {
  showReplyBox.value = false;
  reply.body = "";
}

async function sendReply() {
  if (!canReplyContacts.value) {
    alert("Ban khong co quyen phan hoi lien he");
    return;
  }

  if (!selectedContact.value) return;

  if (!reply.body.trim()) {
    alert("Vui lòng nhập nội dung phản hồi");
    return;
  }

  try {
    sending.value = true;

    const res = await contactService.reply(selectedContact.value._id, {
      admin_reply: reply.body,
    });

    alert(res?.message || "Đã gửi phản hồi");

    await fetchContacts();

    const updated = contacts.value.find(
      (item) => item._id === selectedContact.value?._id,
    );
    if (updated) {
      selectedContact.value = updated;
    }

    showReplyBox.value = false;
    reply.body = "";
  } catch (error) {
    alert(error?.response?.data?.message || "Không thể gửi phản hồi");
  } finally {
    sending.value = false;
  }
}

onMounted(fetchContacts);
</script>

<template>
  <div class="admin-page">
    <div class="admin-page-title admin-page-title--stack">
      <h1>Liên hệ khách hàng</h1>
      <p>
        Quản lý liên hệ, theo dõi phản hồi và gửi email trực tiếp cho khách.
      </p>
    </div>

    <div class="admin-stat-row contact-stat-row">
      <div class="admin-stat-card">
        <div class="admin-stat-card__label">Tổng liên hệ</div>
        <div class="admin-stat-card__value">{{ totalContacts }}</div>
      </div>

      <div class="admin-stat-card">
        <div class="admin-stat-card__label">Chờ phản hồi</div>
        <div class="admin-stat-card__value">{{ pendingContacts }}</div>
      </div>

      <div class="admin-stat-card">
        <div class="admin-stat-card__label">Đã phản hồi</div>
        <div class="admin-stat-card__value">{{ repliedContacts }}</div>
      </div>
    </div>

    <section class="admin-panel contact-page">
      <div class="admin-panel__header contact-page__intro">
        Tại đây, bạn có thể xem và quản lý các thông tin liên lạc từ khách hàng,
        trả lời câu hỏi và gửi phản hồi trực tiếp qua email.
      </div>

      <div class="admin-panel__body">
        <div class="contact-toolbar">
          <input
            v-model="filters.keyword"
            type="text"
            class="contact-toolbar__input"
            placeholder="Tìm kiếm"
          />

          <select v-model="filters.status" class="contact-toolbar__select">
            <option value="">Tất cả trạng thái</option>
            <option value="pending">Chờ phản hồi</option>
            <option value="replied">Đã phản hồi</option>
          </select>

          <button class="admin-btn admin-btn--secondary" @click="fetchContacts">
            Làm mới
          </button>
        </div>

        <div class="contact-layout">
          <aside class="contact-sidebar">
            <div class="contact-sidebar__title">Hộp thư liên hệ</div>

            <div v-if="loading" class="contact-empty">
              Đang tải danh sách liên hệ...
            </div>

            <div
              v-else-if="!filteredContacts.length"
              class="contact-empty contact-empty--sidebar"
            >
              Không có liên hệ phù hợp
            </div>

            <div v-else class="contact-list">
              <button
                v-for="item in filteredContacts"
                :key="item._id"
                type="button"
                class="contact-item"
                :class="{ 'is-active': selectedContact?._id === item._id }"
                @click="selectContact(item)"
              >
                <span v-if="item.unread" class="contact-item__dot"></span>

                <div class="contact-item__content">
                  <div class="contact-item__top">
                    <div class="contact-item__name">{{ item.name }}</div>
                    <div class="contact-item__time">
                      {{ formatDateTime(item.created_at) }}
                    </div>
                  </div>

                  <div class="contact-item__subject">
                    {{ item.subject }}
                  </div>

                  <div class="contact-item__preview">
                    {{ item.content }}
                  </div>

                  <div class="contact-item__footer">
                    <span :class="getStatusClass(item)">
                      {{ getStatusText(item) }}
                    </span>
                  </div>
                </div>
              </button>
            </div>
          </aside>

          <section class="contact-detail">
            <template v-if="hasSelectedContact">
              <div class="contact-detail__header">
                <div class="contact-detail__topbar">
                  <div>
                    <div class="contact-detail__name">
                      {{ selectedContact.name }}
                    </div>
                    <div class="contact-detail__email">
                      {{ selectedContact.email }}
                    </div>
                  </div>

                  <span :class="getStatusClass(selectedContact)">
                    {{ getStatusText(selectedContact) }}
                  </span>
                </div>

                <div class="contact-detail__meta-row">
                  <div class="contact-detail__subject">
                    {{ selectedContact.subject }}
                  </div>
                  <div class="contact-detail__time">
                    {{ formatDateTime(selectedContact.created_at) }}
                  </div>
                </div>
              </div>

              <div class="contact-message-card">
                <div class="contact-message-card__label">
                  Nội dung khách hàng
                </div>
                <div class="contact-message-card__body">
                  {{ selectedContact.content }}
                </div>
              </div>

              <div
                v-if="selectedContact.admin_reply"
                class="contact-message-card contact-message-card--reply"
              >
                <div class="contact-message-card__label">Phản hồi gần nhất</div>
                <div class="contact-message-card__body">
                  {{ selectedContact.admin_reply }}
                </div>
                <div class="contact-message-card__time">
                  {{ formatDateTime(selectedContact.replied_at) }}
                </div>
              </div>

              <div class="contact-detail__actions">
                <button
                  v-if="canReplyContacts"
                  class="admin-btn admin-btn--primary"
                  @click="openReplyBox"
                >
                  <i class="fa-solid fa-reply me-1"></i>
                  {{ selectedContact.admin_reply ? "Sửa phản hồi" : "Trả lời" }}
                </button>
              </div>

              <transition name="contact-reply">
                <div v-if="showReplyBox" class="contact-reply-box">
                  <div class="contact-reply-box__header">
                    <span>Soạn phản hồi</span>
                    <button
                      type="button"
                      class="contact-reply-box__close"
                      @click="closeReplyBox"
                    >
                      ×
                    </button>
                  </div>

                  <div class="contact-reply-box__meta">
                    Gửi tới:
                    <strong>{{ selectedContact.email }}</strong>
                  </div>

                  <div class="contact-reply-box__body">
                    <textarea
                      v-model="reply.body"
                      class="admin-form__textarea contact-reply-box__textarea"
                      rows="10"
                      placeholder="Nhập nội dung phản hồi gửi tới khách hàng..."
                    ></textarea>
                  </div>

                  <div class="contact-reply-box__footer">
                    <button
                      class="admin-btn admin-btn--secondary"
                      @click="closeReplyBox"
                    >
                      Hủy
                    </button>

                    <button
                      class="admin-btn admin-btn--success"
                      :disabled="sending"
                      @click="sendReply"
                    >
                      {{ sending ? "Đang gửi..." : "Gửi phản hồi" }}
                    </button>
                  </div>
                </div>
              </transition>
            </template>

            <div v-else class="contact-empty">
              Chọn một liên hệ để xem chi tiết
            </div>
          </section>
        </div>
      </div>
    </section>
  </div>
</template>
