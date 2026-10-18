import { defineStore } from "pinia";
import socketService from "@/services/socket.service";
import notificationService from "@/services/notification.service";
import { captureAuthRequestContext, useAuthStore } from "@/stores/user/auth";
import { hasAllPermissions } from "@/utils/permission.util";

// $state is stable across Pinia's per-action devtools proxies.
const sessions = new WeakMap();
function session(store) {
  if (!sessions.has(store.$state)) sessions.set(store.$state, { generation: 0, initial: null, list: 0, unread: 0, seen: new Set() });
  return sessions.get(store.$state);
}
function authorized() {
  const auth = useAuthStore();
  return auth.isLoggedIn && !!auth.accessToken && !!auth.userId &&
    String(auth.user?._id || "") === String(auth.userId) &&
    auth.accessToken === localStorage.getItem("accessToken") &&
    hasAllPermissions(auth, ["admin:access", "notification:manage"]);
}
function context(store) {
  const current = session(store), generation = current.generation;
  const auth = captureAuthRequestContext();
  return { isCurrent: () => current.generation === generation && !!auth?.isCurrent() && authorized() };
}

export const useAdminNotificationStore = defineStore("adminNotification", {
  state: () => ({
    items: [],
    unreadCount: 0,
    loading: false,
    initialized: false,
    socketHandler: null,
    currentPage: 1,
    pageSize: 12,
    filters: {
      keyword: "",
      type: "",
      is_read: "",
    },
    selectedIds: [],
    toastQueue: [],
  }),

  actions: {
    async fetchNotifications(custom = {}) {
      if (!authorized()) return;
      const request = context(this), current = session(this), sequence = ++current.list;
      const isCurrent = () => request.isCurrent() && sequence === current.list;
      try {
        this.loading = true;

        const keyword = custom.keyword ?? this.filters.keyword;
        const type = custom.type ?? this.filters.type;
        const is_read = custom.is_read ?? this.filters.is_read;

        const res = await notificationService.getAll({
          keyword,
          type,
          is_read,
        });
        if (!isCurrent()) return;

        const list = res?.items || res?.data || (Array.isArray(res) ? res : []);
        this.items = list.map((item) => ({
          ...item,
          id: item._id,
        }));
        this.currentPage = custom.keepPage ? this.currentPage : 1;

        this.filters = {
          keyword,
          type,
          is_read,
        };

        this.selectedIds = [];
      } finally {
        if (isCurrent()) this.loading = false;
      }
    },

    async fetchUnreadCount() {
      if (!authorized()) return;
      const request = context(this), current = session(this), sequence = ++current.unread;
      const res = await notificationService.getUnreadCount();
      if (!request.isCurrent() || sequence !== current.unread) return;
      this.unreadCount = res?.unread || 0;
    },

    pushToast(notification) {
      const toast = {
        id: `${notification._id || notification.id}-${Date.now()}`,
        type: notification.type || "system",
        title: notification.title || "Thông báo mới",
        content: notification.content || "",
        created_at: notification.created_at || new Date().toISOString(),
        data: notification.data || {},
      };

      this.toastQueue.push(toast);
    },

    removeToast(id) {
      this.toastQueue = this.toastQueue.filter((item) => item.id !== id);
    },

    initSocket() {
      if (this.initialized || !authorized()) return;
      const request = context(this), seen = session(this).seen;

      socketService.connect();
      socketService.joinAdminRoom();

      this.socketHandler = (payload) => {
        if (!request.isCurrent()) return;
        const id = payload?._id || payload?.id;
        if (!id || seen.has(String(id)) || this.items.some(item => String(item._id || item.id) === String(id))) return;
        seen.add(String(id));
        const item = {
          ...payload,
          id: payload._id || payload.id,
          is_read: false,
        };

        const stillMatchesType =
          !this.filters.type || item.type === this.filters.type;

        const stillMatchesRead =
          !this.filters.is_read ||
          (this.filters.is_read === "false" && item.is_read === false) ||
          (this.filters.is_read === "true" && item.is_read === true);

        const keyword = String(this.filters.keyword || "")
          .trim()
          .toLowerCase();
        const stillMatchesKeyword =
          !keyword ||
          String(item.title || "")
            .toLowerCase()
            .includes(keyword) ||
          String(item.content || "")
            .toLowerCase()
            .includes(keyword);

        if (stillMatchesType && stillMatchesRead && stillMatchesKeyword) {
          this.items.unshift(item);
        }

        this.unreadCount += 1;

        this.pushToast(item);
      };

      socketService.onAdminNotification(this.socketHandler);
      this.initialized = true;
    },

    loadInitialData() {
      if (!authorized() || this.initialized) return Promise.resolve();
      const current = session(this);
      if (current.initial) return current.initial;
      const request = context(this);
      const pending = Promise.all([this.fetchNotifications(), this.fetchUnreadCount()])
        .then(() => { if (request.isCurrent()) this.initSocket(); })
        .finally(() => { if (current.initial === pending) current.initial = null; });
      current.initial = pending;
      return pending;
    },

    resetSession() {
      const current = session(this);
      current.generation++;
      current.initial = null;
      current.seen.clear();
      if (this.socketHandler) socketService.offAdminNotification(this.socketHandler);
      socketService.disconnect();
      this.$reset();
    },

    setSelectedIds(ids = []) {
      this.selectedIds = ids;
    },

    toggleSelectedId(id) {
      if (this.selectedIds.includes(id)) {
        this.selectedIds = this.selectedIds.filter((x) => x !== id);
      } else {
        this.selectedIds.push(id);
      }
    },

    toggleSelectAllCurrentPage(currentIds = null) {
      const ids = Array.isArray(currentIds)
        ? currentIds
        : this.items.map((item) => item._id || item.id);
      const allSelected = ids.every((id) =>
        this.selectedIds.includes(id),
      );

      if (allSelected) {
        this.selectedIds = this.selectedIds.filter(
          (id) => !ids.includes(id),
        );
      } else {
        this.selectedIds = [...new Set([...this.selectedIds, ...ids])];
      }
    },

    async markOneAsRead(id) {
      if (!authorized()) return;
      const request = context(this);
      const target = this.items.find(
        (item) => item._id === id || item.id === id,
      );
      if (!target || target.is_read) return;

      await notificationService.markAsRead(id);
      if (!request.isCurrent()) return;
      target.is_read = true;
      this.unreadCount = Math.max(0, this.unreadCount - 1);
    },

    async markAllAsRead() {
      if (!authorized()) return;
      const request = context(this);
      await notificationService.markAllAsRead({
        keyword: this.filters.keyword,
        type: this.filters.type,
        is_read: this.filters.is_read,
      });
      if (!request.isCurrent()) return;

      this.items = this.items.map((item) => ({
        ...item,
        is_read: true,
      }));
      this.unreadCount = 0;
    },

    async removeOne(id) {
      if (!authorized()) return;
      const request = context(this);
      const removed = this.items.find(
        (item) => item._id === id || item.id === id,
      );

      await notificationService.remove(id);
      if (!request.isCurrent()) return;

      this.items = this.items.filter(
        (item) => item._id !== id && item.id !== id,
      );
      this.selectedIds = this.selectedIds.filter((x) => x !== id);

      if (removed && !removed.is_read) {
        this.unreadCount = Math.max(0, this.unreadCount - 1);
      }

    },

    async removeSelected() {
      if (!authorized()) return;
      const request = context(this);
      if (!this.selectedIds.length) return;

      const removedUnreadCount = this.items.filter(
        (item) =>
          this.selectedIds.includes(item._id || item.id) &&
          item.is_read === false,
      ).length;

      await notificationService.removeMany(this.selectedIds);
      if (!request.isCurrent()) return;

      this.items = this.items.filter(
        (item) => !this.selectedIds.includes(item._id || item.id),
      );

      this.unreadCount = Math.max(0, this.unreadCount - removedUnreadCount);
      this.selectedIds = [];
    },

    async removeAllFiltered() {
      if (!authorized()) return;
      const request = context(this);
      await notificationService.removeAll({
        keyword: this.filters.keyword,
        type: this.filters.type,
        is_read: this.filters.is_read,
      });
      if (!request.isCurrent()) return;

      await this.fetchNotifications();
      if (!request.isCurrent()) return;
      await this.fetchUnreadCount();
    },
  },
});
