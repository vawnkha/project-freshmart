const { z } = require("zod");
const { objectIdSchema } = require("./common.validator");
const page = z.coerce.number().int().min(1).default(1);
const limit = z.coerce.number().int().min(1).max(100).default(12);
const proposalFields = {
  percent: z.coerce.number().positive().max(100), quantity: z.coerce.number().int().positive(),
  startDate: z.string().max(40), endDate: z.string().max(40), note: z.string().max(2000).optional(),
};
module.exports = {
  id: z.object({ id: objectIdSchema }),
  list: z.object({ page, limit, status: z.enum(["normal", "warning", "urgent", "expired", "unknown"]).optional(),
    keyword: z.string().trim().max(150).optional(), inventoryItemId: objectIdSchema.optional(), product_id: objectIdSchema.optional(),
    sort_by: z.enum(["expiryDate", "quantity", "createdAt"]).optional(), sort_order: z.enum(["asc", "desc"]).optional() }),
  proposals: z.object({ page, limit, status: z.enum(["draft", "pending", "approved", "rejected", "active", "expired", "cancelled"]).optional() }),
  create: z.object({ ...proposalFields, status: z.enum(["draft", "pending"]).optional() }).strict(),
  edit: z.object({ ...proposalFields, status: z.enum(["draft", "pending"]).optional() }).partial().strict(),
  approve: z.object(proposalFields).partial().strict(),
  reject: z.object({ reason: z.string().trim().min(1).max(2000) }).strict(),
  correction: z.object({ expiryDate: z.string().max(40), reason: z.string().trim().min(1).max(2000) }).strict(),
};
