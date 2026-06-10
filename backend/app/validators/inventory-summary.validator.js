const { z } = require("zod");
const { objectIdSchema } = require("./common.validator");

function hasInventoryItemId(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

module.exports = {
  inventorySummaryIdParamSchema: z.object({
    id: objectIdSchema,
  }),
  inventorySummaryByItemParamSchema: z.object({
    inventoryItemId: objectIdSchema,
  }),
  hasInventoryItemId,
};
