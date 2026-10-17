import { ref } from "vue";
import { userMessage } from "@/utils/user-error.util";
export const storefrontNotice = ref(null);
let timer;
export function notify(message, type = "info") {
  clearTimeout(timer);
  storefrontNotice.value = {
    message: userMessage(message, { fallback: "Không thể thực hiện thao tác. Vui lòng thử lại." }),
    type,
  };
  timer = setTimeout(() => {
    storefrontNotice.value = null;
  }, 5500);
}
