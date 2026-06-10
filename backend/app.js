const express = require("express");
const cors = require("cors");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const userRoute = require("./app/routes/user.route");
const wishlistRoute = require("./app/routes/wishlist.route");
const categoryRoute = require("./app/routes/categories.route");
const productRoute = require("./app/routes/products.route");
const adminProductRoute = require("./app/routes/admin-product.route");
const brandRoute = require("./app/routes/brands.route");
const manufacturerRoute = require("./app/routes/manufacturers.route");
const supplierRoute = require("./app/routes/suppliers.route");
const shippingMethodRoute = require("./app/routes/shipping-methods.route");
const discountRoute = require("./app/routes/discounts.route");
const newsCategoryRoute = require("./app/routes/news-categories.route");
const newsRoute = require("./app/routes/news.route");
const bannerRoute = require("./app/routes/banners.route");
const reviewRoute = require("./app/routes/reviews.route");
const addressRoute = require("./app/routes/addresses.route");
const cartRoute = require("./app/routes/carts.route");
const orderRoute = require("./app/routes/orders.route");
const paymentRoute = require("./app/routes/payments.route");
const contactRoute = require("./app/routes/contacts.route");
const loginRoute = require("./app/routes/auth.route");
const notificationRoute = require("./app/routes/notifications.route");
const aiRoute = require("./app/routes/ai.route");
const rbacRoute = require("./app/routes/rbac.route");
const uploadsRoute = require("./app/routes/uploads.route");
const inventoryItemRoute = require("./app/routes/inventory-items.route");
const purchaseOrderRoute = require("./app/routes/purchase-orders.route");
const inventoryBatchRoute = require("./app/routes/inventory-batches.route");
const inventorySummaryRoute = require("./app/routes/inventory-summaries.route");
const inventoryTransactionRoute = require("./app/routes/inventory-transactions.route");
const ApiError = require("./app/api-error");

const { initSocket } = require("./app/utils/socket.util");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: true,
    credentials: true,
  },
});

initSocket(io);

io.on("connection", (socket) => {
  console.log("Socket connected");
  socket.on("admin:join", () => {
    socket.join("admin-room");
  });
  socket.on("disconnect", () => {
    console.log("Socket disconnected");
  });
});

app.use(cors());
app.use(express.json());

app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));

app.use("/api/users", userRoute);
app.use("/api/wishlists", wishlistRoute);
app.use("/api/categories", categoryRoute);
app.use("/api/brands", brandRoute);
app.use("/api/manufacturers", manufacturerRoute);
app.use("/api/suppliers", supplierRoute);
app.use("/api/shipping-methods", shippingMethodRoute);
app.use("/api/discounts", discountRoute);
app.use("/api/news-categories", newsCategoryRoute);
app.use("/api/news", newsRoute);
app.use("/api/banners", bannerRoute);
app.use("/api/products", productRoute);
app.use("/api/admin/products", adminProductRoute);
app.use("/api/reviews", reviewRoute);
app.use("/api/addresses", addressRoute);
app.use("/api/cart", cartRoute);
app.use("/api/order", orderRoute);
app.use("/api/payment", paymentRoute);
app.use("/api/contacts", contactRoute);
app.use("/api/notifications", notificationRoute);
app.use("/api/auth", loginRoute);
app.use("/api/ai", aiRoute);
app.use("/api/rbac", rbacRoute);
app.use("/api/uploads", uploadsRoute);
app.use("/api/inventory-items", inventoryItemRoute);
app.use("/api/purchase-orders", purchaseOrderRoute);
app.use("/api/inventory-batches", inventoryBatchRoute);
app.use("/api/inventory-summaries", inventorySummaryRoute);
app.use("/api/inventory-transactions", inventoryTransactionRoute);

app.get("/", (req, res) => {
  res.json({ message: "Welcome to the backend!" });
});

app.use((req, res, next) => {
  next(new ApiError(404, "Resource not found"));
});

app.use((err, req, res, next) => {
  return res.status(err.statusCode || 500).json({
    message: err.message || "Internal Server Error",
  });
});

module.exports = { app, server };
