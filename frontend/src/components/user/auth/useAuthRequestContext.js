import { computed } from "vue";
import { useAuthStore } from "@/stores/user/auth";
import { useCartStore } from "@/stores/user/cart";
import { normalizeId } from "@/utils/id.util";

// Presentation fence only. Authentication and session generation stay in the
// existing Stores; this helper cannot authorize, commit credentials or cancel login.
export function useAuthRequestContext() {
  const auth = useAuthStore();
  const cart = useCartStore();
  const capture = () => [normalizeId(auth.userId), cart.ownerVersion, auth.isLoggedIn];
  const current = snapshot => snapshot.every((value, index) => value === capture()[index]);
  return { capture, current, key: computed(() => JSON.stringify(capture())) };
}
