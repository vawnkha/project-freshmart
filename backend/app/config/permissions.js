const DEFAULT_ROLE_CODE = "user";
const NEWS_COMMENT_PERMISSIONS = [
  { key: "news-comment:read", label: "Xem bình luận bài viết", group: "content", description: "Xem và lọc danh sách bình luận trong khu vực quản trị" },
  { key: "news-comment:moderate", label: "Kiểm duyệt bình luận bài viết", group: "content", description: "Xóa bình luận của người khác. Cấp thêm quyền xem để sử dụng trang quản lý bình luận." },
];

const PERMISSION_CATALOG = [
  { key: "chat:read", label: "Xem chat hỗ trợ", group: "chat", description: "Xem hội thoại hỗ trợ và số tin chưa đọc của chính mình" },
  { key: "chat:reply", label: "Trả lời chat hỗ trợ", group: "chat", description: "Nhận hội thoại chưa phân công và trả lời khách hàng" },
  { key: "chat:manage", label: "Quản lý chat hỗ trợ", group: "chat", description: "Chuyển người phụ trách, đóng hoặc mở lại hội thoại" },
  {
    key: "admin:access",
    label: "Truy cap trang quan tri",
    group: "system",
    description: "Cho phep truy cap khu vuc admin",
  },
  {
    key: "role:manage",
    label: "Quan ly vai tro",
    group: "system",
    description: "Them, sua, xoa role va gan permission",
  },
  {
    key: "user:read",
    label: "Xem nguoi dung",
    group: "users",
    description: "Xem danh sach va chi tiet nguoi dung",
  },
  {
    key: "user:update",
    label: "Cập nhật người dùng",
    group: "users",
    description: "Cập nhật thông tin và trạng thái tài khoản người dùng",
  },
  {
    key: "user:delete",
    label: "Xoa nguoi dung",
    group: "users",
    description: "Xoa tai khoan nguoi dung",
  },
  {
    key: "product:manage",
    label: "Quan ly san pham",
    group: "catalog",
    description: "Them, sua, xoa san pham",
  },
  {
    key: "brand:manage",
    label: "Quan ly thuong hieu",
    group: "catalog",
    description: "Them, sua, xoa thuong hieu",
  },
  {
    key: "manufacturer:manage",
    label: "Quan ly nha san xuat",
    group: "catalog",
    description: "Them, sua, xoa nha san xuat",
  },
  {
    key: "supplier:manage",
    label: "Quan ly nha cung cap",
    group: "catalog",
    description: "Them, sua, xoa nha cung cap",
  },
  {
    key: "category:manage",
    label: "Quan ly danh muc",
    group: "catalog",
    description: "Them, sua, xoa danh muc",
  },
  {
    key: "inventory:manage",
    label: "Quan ly kho hang",
    group: "inventory",
    description: "Quan ly hang kho, lo hang, ton kho va giao dich kho",
  },
  {
    key: "purchase-order:manage",
    label: "Quan ly phieu nhap",
    group: "inventory",
    description: "Tao, cap nhat va xac nhan nhap kho",
  },
  {
    key: "discount:manage",
    label: "Quan ly khuyen mai",
    group: "marketing",
    description: "Them, sua, xoa khuyen mai",
  },
  {
    key: "shipping-method:manage",
    label: "Quan ly phuong thuc van chuyen",
    group: "shipping",
    description: "Them, sua, xoa phuong thuc van chuyen",
  },
  {
    key: "news:manage",
    label: "Quan ly tin tuc",
    group: "content",
    description: "Them, sua, xoa tin tuc",
  },
  {
    key: "banner:manage",
    label: "Quan ly banner",
    group: "content",
    description: "Them, sua, xoa banner",
  },
  {
    key: "order:read:any",
    label: "Xem tat ca don hang",
    group: "orders",
    description: "Xem don hang cua moi nguoi dung",
  },
  {
    key: "order:update",
    label: "Cap nhat don hang",
    group: "orders",
    description: "Cap nhat trang thai don hang va gui hoa don",
  },
  {
    key: "contact:read",
    label: "Xem lien he",
    group: "contacts",
    description: "Xem danh sach lien he cua khach hang",
  },
  {
    key: "contact:reply",
    label: "Phan hoi lien he",
    group: "contacts",
    description: "Tra loi yeu cau lien he",
  },
  {
    key: "contact:delete",
    label: "Xoa lien he",
    group: "contacts",
    description: "Xoa yeu cau lien he",
  },
  {
    key: "notification:manage",
    label: "Quan ly thong bao",
    group: "notifications",
    description: "Tao va quan ly thong bao",
  },
  {
    key: "order:create:own",
    label: "Tạo đăng ký mua định kỳ cá nhân",
    group: "shopping",
    description: "Tạo đăng ký mua định kỳ cho chính mình",
  },
  {
    key: "payment:create:own",
    label: "Khởi tạo PayPal cho kỳ mua định kỳ cá nhân",
    group: "shopping",
    description: "Khởi tạo thanh toán PayPal cho một kỳ thuộc đăng ký mua định kỳ của chính mình",
  },
];

PERMISSION_CATALOG.push(...NEWS_COMMENT_PERMISSIONS);

const USER_PERMISSION_KEYS = [
  "order:create:own",
  "payment:create:own",
];

const MANAGER_PERMISSION_KEYS = [
  "admin:access",
  "user:read",
  "product:manage",
  "brand:manage",
  "manufacturer:manage",
  "supplier:manage",
  "category:manage",
  "inventory:manage",
  "purchase-order:manage",
  "shipping-method:manage",
  "order:read:any",
  "order:update",
  "contact:read",
  "contact:reply",
  "notification:manage",
];

const DEFAULT_ROLES = [
  {
    code: "admin",
    name: "Admin",
    description: "Quan tri he thong",
    is_system: true,
    permissions: PERMISSION_CATALOG.map((permission) => permission.key),
  },
  {
    code: "manager",
    name: "Manager",
    description: "Quan ly van hanh cua hang",
    is_system: true,
    permissions: MANAGER_PERMISSION_KEYS,
  },
  {
    code: DEFAULT_ROLE_CODE,
    name: "User",
    description: "Khach hang",
    is_system: true,
    permissions: USER_PERMISSION_KEYS,
  },
];

function normalizeRoleCode(role) {
  return String(role || DEFAULT_ROLE_CODE)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function normalizePermissions(permissions = []) {
  if (!Array.isArray(permissions)) return [];

  return [
    ...new Set(
      permissions
        .filter(Boolean)
        .map((permission) => String(permission).trim())
        .filter(Boolean),
    ),
  ];
}

function hasPermission(user = {}, requiredPermissions = []) {
  const required = Array.isArray(requiredPermissions)
    ? requiredPermissions
    : [requiredPermissions];
  const permissions = normalizePermissions(user.permissions);

  if (!required.length) return true;
  if (permissions.includes("*")) return true;

  return required.every((permission) => permissions.includes(permission));
}

module.exports = {
  DEFAULT_ROLE_CODE,
  DEFAULT_ROLES,
  PERMISSION_CATALOG,
  NEWS_COMMENT_PERMISSIONS,
  normalizeRoleCode,
  normalizePermissions,
  hasPermission,
};
