const { ObjectId } = require("mongodb");
const ApiError = require("../api-error");
const { hasPermission } = require("../config/permissions");
const ArticleCommentRepository = require("../repositories/article-comment.repository");
const NewsService = require("./news.service");
const ResourceDeletionService = require("./resource-deletion.service");
const { commentContentSchema } = require("../validators/article-comment.validator");

class ArticleCommentService {
  constructor(client) {
    this.repository = new ArticleCommentRepository(client);
    this.news = new NewsService(client);
    this.deletion = new ResourceDeletionService(client);
  }

  id(value) {
    if (!ObjectId.isValid(value)) throw new ApiError(400, "ID không hợp lệ.");
    return new ObjectId(value);
  }

  content(value) {
    const parsed = commentContentSchema.safeParse(value);
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message);
    return parsed.data;
  }

  async publicArticle(id, session) {
    const filter = await this.news.buildPublicFilter();
    const article = await this.news.repository.findOne({ ...filter, _id: this.id(id) }, { session, projection: { _id: 1 } });
    if (!article) throw new ApiError(404, "Bài viết không tồn tại hoặc chưa được công bố.");
    return article;
  }

  async list(articleId, query) {
    await this.publicArticle(articleId);
    return this.repository.paginate({ article_id: this.id(articleId) }, query);
  }

  listAdmin(query) {
    return this.repository.paginate(query.article_id ? { article_id: this.id(query.article_id) } : {}, { ...query, admin: true });
  }

  async create(articleId, payload, user) {
    await this.publicArticle(articleId);
    const now = new Date();
    const data = { _id: new ObjectId(), article_id: this.id(articleId), user_id: this.id(user.id), content: this.content(payload.content), created_at: now, updated_at: now };
    await this.deletion.withReferences(this.deletion.referencesFor("article_comments", data), async session => {
      await this.publicArticle(articleId, session);
      return this.repository.create(data, { session });
    });
    return this.repository.populated(data._id);
  }

  async owned(commentId, user, allowModerator = false) {
    const comment = await this.repository.findById(this.id(commentId));
    if (!comment) throw new ApiError(404, "Bình luận không tồn tại.");
    const owner = String(comment.user_id) === String(user.id);
    const moderator = allowModerator && hasPermission(user, ["admin:access", "news:manage"]);
    if (!owner && !moderator) throw new ApiError(403, "Bạn không có quyền thao tác bình luận này.");
    return { comment, owner };
  }

  async update(commentId, payload, user) {
    const { comment } = await this.owned(commentId, user);
    const content = this.content(payload.content);
    const result = await this.deletion.withReferences(this.deletion.referencesFor("article_comments", comment), async session => {
      await this.publicArticle(comment.article_id, session);
      return this.repository.collection().findOneAndUpdate({ _id: comment._id, user_id: this.id(user.id) }, { $set: { content, updated_at: new Date() } }, { session, returnDocument: "after" });
    });
    if (!result) throw new ApiError(404, "Bình luận không còn tồn tại.");
    return this.repository.populated(comment._id);
  }

  async remove(commentId, user) {
    const { comment, owner } = await this.owned(commentId, user, true);
    const result = await this.repository.collection().findOneAndDelete({ _id: comment._id, ...(owner ? { user_id: this.id(user.id) } : {}) });
    if (!result) throw new ApiError(404, "Bình luận không còn tồn tại.");
    return { _id: result._id, article_id: result.article_id };
  }
}

module.exports = ArticleCommentService;
