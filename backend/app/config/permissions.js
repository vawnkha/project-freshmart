const DEFAULT_ROLE_CODE = "user";

const PERMISSION_CATALOG = [
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
    label: "Cap nhat nguoi dung",
    group: "users",
    description: "Cap nhat trang thai va gan role cho nguoi dung",
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
    key: "order:manage",
    label: "Quan ly don hang",
    group: "orders",
    description: "Tao hoac thao tac voi don hang thay nguoi dung",
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
    key: "profile:read",
    label: "Xem ho so ca nhan",
    group: "account",
    description: "Xem thong tin tai khoan cua chinh minh",
  },
  {
    key: "profile:update",
    label: "Cap nhat ho so ca nhan",
    group: "account",
    description: "Cap nhat thong tin tai khoan cua chinh minh",
  },
  {
    key: "password:update",
    label: "Doi mat khau",
    group: "account",
    description: "Doi mat khau tai khoan cua chinh minh",
  },
  {
    key: "cart:manage:own",
    label: "Quan ly gio hang ca nhan",
    group: "shopping",
    description: "Them, sua, xoa san pham trong gio hang cua chinh minh",
  },
  {
    key: "cart:manage:any",
    label: "Quan ly moi gio hang",
    group: "shopping",
    description: "Them, sua, xoa san pham trong gio hang cua bat ky nguoi dung",
  },
  {
    key: "wishlist:manage:own",
    label: "Quan ly yeu thich ca nhan",
    group: "shopping",
    description: "Them, xoa san pham yeu thich cua chinh minh",
  },
  {
    key: "wishlist:manage:any",
    label: "Quan ly moi danh sach yeu thich",
    group: "shopping",
    description: "Them, xoa san pham yeu thich cua bat ky nguoi dung",
  },
  {
    key: "address:manage:own",
    label: "Quan ly dia chi ca nhan",
    group: "shopping",
    description: "Them, sua, xoa dia chi giao hang cua chinh minh",
  },
  {
    key: "address:manage:any",
    label: "Quan ly moi dia chi",
    group: "shopping",
    description: "Them, sua, xoa dia chi giao hang cua bat ky nguoi dung",
  },
  {
    key: "order:create:own",
    label: "Dat hang",
    group: "shopping",
    description: "Tao don hang cho chinh minh",
  },
  {
    key: "order:read:own",
    label: "Xem don hang ca nhan",
    group: "shopping",
    description: "Xem don hang cua chinh minh",
  },
  {
    key: "order:cancel:own",
    label: "Huy don hang ca nhan",
    group: "shopping",
    description: "Huy don hang cua chinh minh khi du dieu kien",
  },
  {
    key: "order:complete:own",
    label: "Hoan tat don hang ca nhan",
    group: "shopping",
    description: "Xac nhan hoan tat don hang cua chinh minh",
  },
  {
    key: "payment:create:own",
    label: "Thanh toan ca nhan",
    group: "shopping",
    description: "Tao giao dich thanh toan cho don hang cua chinh minh",
  },
  {
    key: "payment:create:any",
    label: "Tao thanh toan thay nguoi dung",
    group: "shopping",
    description: "Tao giao dich thanh toan cho don hang cua bat ky nguoi dung",
  },
  {
    key: "review:create:own",
    label: "Viet danh gia",
    group: "reviews",
    description: "Viet danh gia san pham",
  },
  {
    key: "review:create:any",
    label: "Tao danh gia thay nguoi dung",
    group: "reviews",
    description: "Tao danh gia san pham cho bat ky nguoi dung",
  },
  {
    key: "review:check:own",
    label: "Kiem tra quyen danh gia",
    group: "reviews",
    description: "Kiem tra nguoi dung co the danh gia san pham hay khong",
  },
  {
    key: "review:check:any",
    label: "Kiem tra quyen danh gia bat ky",
    group: "reviews",
    description: "Kiem tra bat ky nguoi dung co the danh gia san pham hay khong",
  },
];

const USER_PERMISSION_KEYS = [
  "profile:read",
  "profile:update",
  "password:update",
  "cart:manage:own",
  "wishlist:manage:own",
  "address:manage:own",
  "order:create:own",
  "order:read:own",
  "order:cancel:own",
  "order:complete:own",
  "payment:create:own",
  "review:create:own",
  "review:check:own",
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
  normalizeRoleCode,
  normalizePermissions,
  hasPermission,
};
