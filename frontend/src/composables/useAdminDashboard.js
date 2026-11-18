import { onBeforeUnmount, ref, watch } from "vue";
import dashboard from "@/services/dashboard.service";
import { captureAuthRequestContext, useAuthStore } from "@/stores/user/auth";

export function useAdminDashboard() {
  const auth = useAuthStore(),
    data = ref(null),
    loading = ref(false),
    error = ref("");
  let version = 0,
    controller,
    lastParams = { preset: "month" };
  async function load(params) {
    lastParams = { ...params };
    const current = ++version,
      context = captureAuthRequestContext();
    controller?.abort();
    controller = new AbortController();
    data.value = null;
    loading.value = true;
    error.value = "";
    try {
      const result = await dashboard.overview(params, controller.signal);
      if (current === version && context?.isCurrent()) data.value = result;
    } catch (cause) {
      if (
        current === version &&
        context?.isCurrent() &&
        cause.code !== "ERR_CANCELED"
      ) {
        error.value =
          cause.response?.status === 400
            ? "Khoảng ngày không hợp lệ. Chọn từ 1 đến 366 ngày."
            : "Không thể tải dashboard. Vui lòng thử lại.";
      }
    } finally {
      if (current === version) loading.value = false;
    }
  }
  watch(
    [
      () => auth.userId,
      () => auth.accessToken,
      () => auth.permissions.join(","),
    ],
    () => {
      version++;
      controller?.abort();
      data.value = null;
      loading.value = false;
      error.value = "";
      if (auth.userId && auth.accessToken && auth.isLoggedIn)
        void load(lastParams);
    },
  );
  onBeforeUnmount(() => {
    version++;
    controller?.abort();
  });
  return { data, loading, error, load };
}
