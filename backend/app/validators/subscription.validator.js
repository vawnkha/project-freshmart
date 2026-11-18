const { z } = require("zod");
const id = z.string().regex(/^[a-f\d]{24}$/i, "ID không hợp lệ").transform(value => value.toLowerCase());
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const subscriptionBody = z.object({
  items: z.array(z.object({ productId: id, quantity: z.number().int().min(1).max(10000) }).strict()).min(1).max(30)
    .refine(items => new Set(items.map(item => item.productId.toLowerCase())).size === items.length, "Không lặp sản phẩm"),
  frequency: z.enum(["every_14_days", "monthly"]),
  startDate: date,
  endDate: date.optional(),
  maxOccurrences: z.number().int().min(1).max(120).optional(),
  addressId: id,
  shippingMethodId: id,
  paymentMethod: z.enum(["cod", "paypal"]),
  notes: z.string().trim().max(500).default(""),
  discountCode: z.string().trim().max(50).default(""),
  maximumTotal: z.number().int().min(1).max(1000000000),
  consent: z.literal(true),
  quoteToken: z.string().min(32).max(128).optional(),
}).strict();

const listQuery = z.object({
  status: z.enum(["active", "paused", "cancelled", "completed"]).optional(),
  runStatus: z.enum(["scheduled", "processing", "order_created", "pending_payment", "pending_confirmation", "failed", "skipped"]).optional(),
  keyword: z.string().trim().max(100).optional(),
  from: date.optional(), to: date.optional(),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  sort: z.enum(["newest", "oldest", "next"]).default("newest"),
}).strict();

module.exports = { subscriptionBody, listQuery, id, date };
