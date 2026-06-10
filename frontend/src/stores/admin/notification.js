import { defineStore } from "pinia";
import socketService from "@/services/socket.service";
import notificationService from "@/services/notification.service";

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
        this.loading = false;
      }
    },

    async fetchUnreadCount() {
      const res = await notificationService.getUnreadCount();
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
      if (this.initialized) return;

      socketService.connect();
      socketService.joinAdminRoom();

      this.socketHandler = (payload) => {
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

    async loadInitialData() {
      await Promise.all([this.fetchNotifications(), this.fetchUnreadCount()]);
      this.initSocket();
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
      const target = this.items.find(
        (item) => item._id === id || item.id === id,
      );
      if (!target || target.is_read) return;

      await notificationService.markAsRead(id);
      target.is_read = true;
      this.unreadCount = Math.max(0, this.unreadCount - 1);
    },

    async markAllAsRead() {
      await notificationService.markAllAsRead({
        keyword: this.filters.keyword,
        type: this.filters.type,
        is_read: this.filters.is_read,
      });

      this.items = this.items.map((item) => ({
        ...item,
        is_read: true,
      }));
      this.unreadCount = 0;
    },

    async removeOne(id) {
      const removed = this.items.find(
        (item) => item._id === id || item.id === id,
      );

      await notificationService.remove(id);

      this.items = this.items.filter(
        (item) => item._id !== id && item.id !== id,
      );
      this.selectedIds = this.selectedIds.filter((x) => x !== id);

      if (removed && !removed.is_read) {
        this.unreadCount = Math.max(0, this.unreadCount - 1);
      }

    },

    async removeSelected() {
      if (!this.selectedIds.length) return;

      const removedUnreadCount = this.items.filter(
        (item) =>
          this.selectedIds.includes(item._id || item.id) &&
          item.is_read === false,
      ).length;

      await notificationService.removeMany(this.selectedIds);

      this.items = this.items.filter(
        (item) => !this.selectedIds.includes(item._id || item.id),
      );

      this.unreadCount = Math.max(0, this.unreadCount - removedUnreadCount);
      this.selectedIds = [];
    },

    async removeAllFiltered() {
      await notificationService.removeAll({
        keyword: this.filters.keyword,
        type: this.filters.type,
        is_read: this.filters.is_read,
      });

      await this.fetchNotifications();
      await this.fetchUnreadCount();
    },
  },
});
