const { z } = require("zod");
const {
  objectIdSchema,
  optionalObjectIdSchema,
} = require("./common.validator");

const batchStatusSchema = z.enum(["available", "expired", "locked", "sold_out"], {
  message: "Trang thai lo hang khong hop le",
});

function validateStatus(status) {
  return ["available", "expired", "locked", "sold_out"].includes(status)
    ? null
    : "Trang thai lo hang khong hop le";
}

module.exports = {
  batchQuerySchema: z.object({
    status: batchStatusSchema.optional(),
    inventoryItemId: optionalObjectIdSchema,
  }),
  inventoryBatchIdParamSchema: z.object({
    id: objectIdSchema,
  }),
  validateStatus,
};
