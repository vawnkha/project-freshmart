<script setup>
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "@/stores/user/auth";
import { hasPermission as hasUserPermission } from "@/utils/permission.util";

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const avatar = computed(() => {
  return (
    authStore.user?.avatar ||
    authStore.user?.avatar_url ||
    "https://via.placeholder.com/120"
  );
});

const openGroups = ref({
  catalog: false,
  inventory: false,
  products: false,
});

const menus = [
  {
    key: "dashboard",
    label: "Dashboard",
    icon: "fa-solid fa-house",
    to: { name: "admin-dashboard" },
    names: ["admin-dashboard"],
  },
  {
    key: "users",
    label: "Quản lý người dùng",
    icon: "fa-solid fa-users",
    to: { name: "admin-users" },
    names: ["admin-users"],
    permission: "user:read",
  },
  {
    key: "roles",
    label: "Phân quyền",
    icon: "fa-solid fa-user-shield",
    to: { name: "admin-roles" },
    names: ["admin-roles"],
    permission: "role:manage",
  },
  {
    key: "catalog",
    label: "Quản lý danh mục",
    icon: "fa-solid fa-layer-group",
    to: null,
    names: [
      "admin-categories",
      "admin-category-create",
      "admin-category-edit",
      "admin-brands",
      "admin-manufacturers",
      "admin-suppliers",
    ],
    children: [
      {
        label: "Danh mục",
        to: { name: "admin-categories" },
        names: ["admin-categories", "admin-category-create", "admin-category-edit"],
        permission: "category:manage",
      },
      {
        label: "Thương hiệu",
        to: { name: "admin-brands" },
        names: ["admin-brands"],
        permission: "brand:manage",
      },
      {
        label: "Nhà sản xuất",
        to: { name: "admin-manufacturers" },
        names: ["admin-manufacturers"],
        permission: "manufacturer:manage",
      },
      {
        label: "Nhà cung cấp",
        to: { name: "admin-suppliers" },
        names: ["admin-suppliers"],
        permission: "supplier:manage",
      },
    ],
  },
  {
    key: "products",
    label: "Quản lý sản phẩm",
    icon: "fa-solid fa-desktop",
    to: null,
    names: ["admin-products", "admin-product-create", "admin-product-edit"],
    permission: "product:manage",
    children: [
      // {
      //   label: "Thêm sản phẩm",
      //   to: { name: "admin-product-create" },
      //   names: ["admin-product-create"],
      // },
      {
        label: "Danh sách sản phẩm",
        to: { name: "admin-products" },
        names: ["admin-products", "admin-product-edit"],
      },
    ],
  },
  {
    key: "inventory",
    label: "Kho hàng",
    icon: "fa-solid fa-boxes-stacked",
    to: null,
    names: [
      "admin-inventory-items",
      "admin-inventory-batches",
      "admin-inventory-summaries",
      "admin-inventory-transactions",
      "admin-purchase-orders",
      "admin-purchase-order-create",
      "admin-purchase-order-detail",
    ],
    children: [
      {
        label: "Hàng kho",
        to: { name: "admin-inventory-items" },
        names: ["admin-inventory-items"],
        permission: "inventory:manage",
      },
      {
        label: "Lo hang",
        to: { name: "admin-inventory-batches" },
        names: ["admin-inventory-batches"],
        permission: "inventory:manage",
      },
      {
        label: "Ton kho tong",
        to: { name: "admin-inventory-summaries" },
        names: ["admin-inventory-summaries"],
        permission: "inventory:manage",
      },
      {
        label: "Giao dich kho",
        to: { name: "admin-inventory-transactions" },
        names: ["admin-inventory-transactions"],
        permission: "inventory:manage",
      },
      {
        label: "Phiếu nhập kho",
        to: { name: "admin-purchase-orders" },
        names: [
          "admin-purchase-orders",
          "admin-purchase-order-create",
          "admin-purchase-order-detail",
        ],
        permission: "purchase-order:manage",
      },
    ],
  },
  {
    key: "orders",
    label: "Quản lý đơn hàng",
    icon: "fa-solid fa-pen-to-square",
    to: { name: "admin-orders" },
    names: ["admin-orders", "admin-order-detail"],
    permission: "order:read:any",
  },
  {
    key: "contacts",
    label: "Quản lý liên hệ",
    icon: "fa-solid fa-envelope",
    to: { name: "admin-contacts" },
    names: ["admin-contacts"],
    permission: "contact:read",
  },
  {
    key: "notifications",
    label: "Thông báo",
    icon: "fa-solid fa-bell",
    to: { name: "admin-notifications" },
    names: ["admin-notifications"],
    permission: "notification:manage",
  },
];

function hasPermission(permission) {
  return hasUserPermission(authStore, permission);
}

const visibleMenus = computed(() =>
  menus
    .filter((item) => hasPermission(item.permission))
    .map((item) => {
      if (!item.children) return item;

      return {
        ...item,
        children: item.children.filter((child) =>
          hasPermission(child.permission || item.permission),
        ),
      };
    })
    .filter((item) => !item.children || item.children.length),
);

function isActive(item) {
  return item.names?.includes(route.name);
}

function isChildActive(child) {
  return child.names?.includes(route.name);
}

function toggleGroup(key) {
  openGroups.value[key] = !openGroups.value[key];
}

function syncOpenGroupsByRoute() {
  openGroups.value.catalog = [
    "admin-categories",
    "admin-category-create",
    "admin-category-edit",
    "admin-brands",
    "admin-manufacturers",
    "admin-suppliers",
  ].includes(route.name);

  openGroups.value.products = [
    "admin-products",
    "admin-product-create",
    "admin-product-edit",
  ].includes(route.name);

  openGroups.value.inventory = [
    "admin-inventory-items",
    "admin-inventory-batches",
    "admin-inventory-summaries",
    "admin-inventory-transactions",
    "admin-purchase-orders",
    "admin-purchase-order-create",
    "admin-purchase-order-detail",
  ].includes(route.name);
}

async function handleLogout() {
  try {
    authStore.logout();
    router.push("/admin-login");
  } catch (error) {
    console.error(error.message);
  }
}

watch(
  () => route.name,
  () => {
    syncOpenGroupsByRoute();
  },
  { immediate: true },
);
</script>

<template>
  <aside class="admin-sidebar">
    <div class="admin-sidebar__brand">Fresh Mart</div>

    <div class="admin-sidebar__profile">
      <img :src="avatar" class="admin-sidebar__avatar" />
      <div>
        <div class="admin-sidebar__name">Hello, Admin</div>
      </div>
    </div>

    <div class="admin-sidebar__section">Tổng quan</div>

    <ul class="admin-menu">
      <li v-for="item in visibleMenus" :key="item.key" class="admin-menu__item">
        <template v-if="!item.children">
          <RouterLink
            :to="item.to"
            class="admin-menu__link"
            :class="{ 'is-active': isActive(item) }"
          >
            <i :class="item.icon"></i>
            <span>{{ item.label }}</span>
          </RouterLink>
        </template>

        <template v-else>
          <button
            type="button"
            class="admin-menu__link admin-menu__toggle"
            :class="{ 'is-active': isActive(item) }"
            @click="toggleGroup(item.key)"
          >
            <span class="admin-menu__left">
              <i :class="item.icon"></i>
              <span>{{ item.label }}</span>
            </span>
            <i
              class="fa-solid fa-angle-down admin-menu__arrow"
              :class="{ 'is-open': openGroups[item.key] }"
            ></i>
          </button>

          <transition name="admin-submenu">
            <ul v-if="openGroups[item.key]" class="admin-submenu">
              <li
                v-for="child in item.children"
                :key="child.label"
                class="admin-submenu__item"
              >
                <RouterLink
                  :to="child.to"
                  class="admin-submenu__link"
                  :class="{ 'is-active': isChildActive(child) }"
                >
                  {{ child.label }}
                </RouterLink>
              </li>
            </ul>
          </transition>
        </template>
      </li>
    </ul>

    <div class="admin-sidebar__logout">
      <a href="#" @click.prevent="handleLogout">
        <i class="fa fa-sign-out"></i> Đăng Xuất
      </a>
    </div>
  </aside>
</template>
