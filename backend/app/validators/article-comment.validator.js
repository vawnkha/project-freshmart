const { z } = require("zod");
const { objectIdSchema, optionalObjectIdSchema } = require("./common.validator");

const commentContentSchema = z.string().trim().min(1, "Vui lòng nhập nội dung bình luận.").max(1000, "Bình luận có tối đa 1.000 ký tự.");
const pagination = {
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
};

module.exports = {
  commentContentSchema,
  articleCommentBodySchema: z.object({ content: commentContentSchema }),
  articleCommentParamsSchema: z.object({ articleId: objectIdSchema }),
  commentParamsSchema: z.object({ commentId: objectIdSchema }),
  commentPageSchema: z.object(pagination),
  adminCommentQuerySchema: z.object({ ...pagination, article_id: optionalObjectIdSchema, keyword: z.string().trim().max(100).optional() }),
};
