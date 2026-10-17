const fieldLabels = {
  name: "Họ và tên", fullName: "Họ và tên", full_name: "Họ và tên",
  email: "Email", phone: "Số điện thoại", address: "Địa chỉ",
  address_line: "Địa chỉ", city: "Tỉnh / Thành phố",
  password: "Mật khẩu", oldPassword: "Mật khẩu hiện tại",
  currentPassword: "Mật khẩu hiện tại", newPassword: "Mật khẩu mới",
  confirmPassword: "Mật khẩu xác nhận", addressId: "Địa chỉ giao hàng",
  address_id: "Địa chỉ giao hàng", payment_method: "Phương thức thanh toán",
  paymentMethod: "Phương thức thanh toán", shippingMethodId: "Phương thức vận chuyển",
  discountCode: "Mã giảm giá", quantity: "Số lượng", message: "Tin nhắn",
};

function normalize(text) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d").toLowerCase().trim();
}

const translations = new Map(Object.entries({
  "du lieu khong hop le": "Thông tin chưa hợp lệ. Vui lòng kiểm tra lại.",
  "truong nay la bat buoc": "Vui lòng nhập thông tin này.",
  "email khong hop le": "Vui lòng nhập địa chỉ email hợp lệ.",
  "mat khau la bat buoc": "Vui lòng nhập mật khẩu.",
  "so luong khong hop le": "Số lượng không hợp lệ.",
  "san pham hoac so luong trong gio hang khong hop le": "Sản phẩm hoặc số lượng trong giỏ hàng không hợp lệ.",
  "san pham trong gio hang khong con ton tai": "Sản phẩm trong giỏ hàng không còn tồn tại.",
  "lo hang khong kha dung hoac khong du ton kho": "Sản phẩm không còn đủ số lượng để bán. Vui lòng cập nhật giỏ hàng.",
  "khong co lo hang kha dung de tru kho": "Sản phẩm hiện không còn hàng để bán.",
  "hang kho khong hoat dong": "Sản phẩm hiện không có hàng được phép bán.",
  "lien ket hang kho khong hop le": "Thông tin kho của sản phẩm chưa hợp lệ. Vui lòng liên hệ cửa hàng.",
  "phuong thuc van chuyen khong hop le hoac da ngung": "Phương thức vận chuyển không còn khả dụng. Vui lòng chọn lại.",
  "ma giam gia khong hop le": "Mã giảm giá không hợp lệ.",
  "chi chap nhan anh jpeg, png, webp hoac gif": "Chỉ chấp nhận ảnh JPEG, PNG, WebP hoặc GIF.",
  "moi file anh toi da 10mb": "Mỗi ảnh có dung lượng tối đa 10 MB.",
}));

// Presentation only: preserve business errors, field names and numeric limits.
// Never use an unrecognized technical exception as customer-facing copy.
export function userMessage(message, { field, fallback = "Thông tin chưa hợp lệ. Vui lòng kiểm tra lại." } = {}) {
  const text = typeof message === "string" ? message.trim() : "";
  if (!text) return fallback;
  const key = normalize(text);
  if (translations.has(key)) return translations.get(key);
  const label = fieldLabels[field] || "Thông tin";
  const minimum = key.match(/(?:>=|at least|min(?:imum)?\s*:?|it nhat)\s*(\d+)/i);
  const maximum = key.match(/(?:<=|at most|max(?:imum)?\s*:?|toi da)\s*(\d+)/i);
  if (/too small|too big|characters|ky tu/i.test(key) && (minimum || maximum)) {
    const bound = minimum || maximum;
    return `${label} ${minimum ? "cần ít nhất" : "có tối đa"} ${bound[1]} ký tự.`;
  }
  if (/objectid/.test(key)) return `${label} không hợp lệ. Vui lòng kiểm tra lại.`;
  if (/network error|failed to fetch|timeout|timed out|econn|aborterror/i.test(text)) return "Kết nối bị gián đoạn. Vui lòng thử lại.";
  if (/internal server error|mongodb|mongo\w*error|e11000|syntaxerror|typeerror|cast.?error|stack|groq api error/i.test(text)) return fallback;
  // Vietnamese business messages from the API remain specific (e.g. stock,
  // voucher eligibility, token expiry and payment reconciliation).
  if (/[À-ỹĐđ]/.test(text)) return text;
  if (/email/i.test(key) && /invalid|khong hop le/.test(key)) return "Vui lòng nhập địa chỉ email hợp lệ.";
  if (/required|la bat buoc|khong duoc de trong/.test(key)) return `Vui lòng nhập ${label.toLowerCase()}.`;
  if (/invalid input|invalid option|expected |khong hop le/.test(key)) return `${label} không hợp lệ. Vui lòng kiểm tra lại.`;
  return fallback;
}

export function userError(error, fallback = "Không thể thực hiện thao tác. Vui lòng thử lại.") {
  const issues = error?.response?.data?.errors || error?.issues;
  if (Array.isArray(issues) && issues.length) {
    const issue = issues[0];
    return userMessage(issue.message, { field: issue.field || issue.path?.[0], fallback });
  }
  return userMessage(error?.response?.data?.message || error?.message || error, { fallback });
}

export function userFieldErrors(error) {
  const issues = error?.response?.data?.errors || error?.issues || [];
  return issues.reduce((errors, issue) => {
    const field = issue.field || issue.path?.[0];
    if (field && !errors[field]) errors[field] = userMessage(issue.message, { field });
    return errors;
  }, {});
}
