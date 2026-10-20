const BaseRepository = require("./base.repository");

class ArticleCommentRepository extends BaseRepository {
  constructor(client) { super(client, "article_comments"); }

  populateStages(includeArticle = false) {
    return [
      { $lookup: { from: "users", localField: "user_id", foreignField: "_id", pipeline: [{ $project: { name: 1, avatar: 1, avatar_url: 1 } }], as: "author" } },
      { $unwind: { path: "$author", preserveNullAndEmptyArrays: true } },
      ...(includeArticle ? [
        { $lookup: { from: "news", localField: "article_id", foreignField: "_id", pipeline: [{ $project: { title: 1, slug: 1, status: 1 } }], as: "article" } },
        { $unwind: { path: "$article", preserveNullAndEmptyArrays: true } },
      ] : []),
      { $project: { _id: 1, article_id: 1, user_id: 1, content: 1, created_at: 1, updated_at: 1, author: 1, ...(includeArticle ? { article: 1 } : {}) } },
    ];
  }

  async populated(id) {
    const rows = await this.collection().aggregate([{ $match: { _id: this.toObjectId(id) } }, ...this.populateStages()]).toArray();
    return rows[0] || null;
  }

  async paginate(filter, { page, limit, keyword = "", admin = false }) {
    const search = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const [result] = await this.collection().aggregate([
      { $match: filter },
      { $sort: { created_at: -1, _id: -1 } },
      ...(search ? [...this.populateStages(admin), { $match: { $or: ["content", "author.name", "article.title"].map(field => ({ [field]: { $regex: search, $options: "i" } })) } }] : []),
      // Without keyword search, populate just the requested page, not every
      // author's record in a large article, while count covers all comments.
      { $facet: { data: [{ $skip: (page - 1) * limit }, { $limit: limit }, ...(!search ? this.populateStages(admin) : [])], count: [{ $count: "total" }] } },
    ]).toArray();
    const total = result?.count[0]?.total || 0;
    return { data: result?.data || [], meta: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)), hasMore: page * limit < total } };
  }
}

module.exports = ArticleCommentRepository;
