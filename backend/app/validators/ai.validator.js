const { z } = require("zod");

const aiChatBodySchema = z.object({
  message: z.string().trim().min(1, "Thiếu nội dung câu hỏi").max(1000),
});

module.exports = { aiChatBodySchema };
