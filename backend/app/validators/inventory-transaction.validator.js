const { z } = require("zod");
const { objectIdSchema } = require("./common.validator");

const transactionTypeSchema = z.enum(["import", "export", "cancel", "restore"], {
  message: "Loai giao dich kho khong hop le",
});

function hasInventoryItemId(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

module.exports = {
  inventoryTransactionQuerySchema: z.object({
    type: transactionTypeSchema.optional(),
  }),
  inventoryTransactionIdParamSchema: z.object({
    id: objectIdSchema,
  }),
  inventoryTransactionByItemParamSchema: z.object({
    inventoryItemId: objectIdSchema,
  }),
  hasInventoryItemId,
};
