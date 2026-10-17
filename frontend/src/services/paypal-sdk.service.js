import paymentService from "./payments.service";

let pending;
export function loadPaypalSdk() {
  if (window.paypal) return Promise.resolve(window.paypal);
  if (pending) return pending;
  pending = paymentService.getConfig().then(({ clientId, currency }) => {
    if (!clientId) throw new Error("Thanh toán PayPal chưa được cấu hình.");
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      const params = new URLSearchParams({ "client-id": clientId, currency, components: "buttons" });
      script.src = `https://www.paypal.com/sdk/js?${params}`;
      script.async = true;
      const timer = setTimeout(() => finish(new Error("Kết nối PayPal bị gián đoạn. Vui lòng thử lại.")), 15000);
      function finish(error) {
        clearTimeout(timer);
        script.onload = null;
        script.onerror = null;
        if (error) { script.remove(); reject(error); }
        else resolve(window.paypal);
      }
      script.onload = () => finish(window.paypal ? null : new Error("Không thể tải thanh toán PayPal."));
      script.onerror = () => finish(new Error("Không thể kết nối PayPal. Vui lòng thử lại."));
      document.head.appendChild(script);
    });
  }).catch((error) => { pending = undefined; throw error; });
  return pending;
}
