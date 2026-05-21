const { ObjectId } = require("mongodb");

class ReviewsService {
  constructor(client) {
    this.Review = client.db().collection("reviews");
    this.Product = client.db().collection("products");
    this.User = client.db().collection("users");
    this.Order = client.db().collection("orders");
  }

  extractData(payload) {
    const review = {
      user_id: payload.user_id
        ? ObjectId.isValid(payload.user_id)
          ? new ObjectId(payload.user_id)
          : null
        : undefined,
      product_id: payload.product_id
        ? ObjectId.isValid(payload.product_id)
          ? new ObjectId(payload.product_id)
          : null
        : undefined,
      rating: payload.rating !== undefined ? Number(payload.rating) : undefined,
      comment:
        typeof payload.comment === "string" ? payload.comment.trim() : "",
      created_at: new Date(),
    };

    Object.keys(review).forEach(
      (key) => review[key] === undefined && delete review[key],
    );

    return review;
  }

  async find(filter = {}, options = {}) {
    const cursor = await this.Review.find(filter, options);
    return await cursor.toArray();
  }

  async findById(id) {
    return await this.Review.findOne({
      _id: ObjectId.isValid(id) ? new ObjectId(id) : null,
    });
  }

  async findByUserAndProduct(userId, productId) {
    return await this.Review.findOne({
      user_id: ObjectId.isValid(userId) ? new ObjectId(userId) : null,
      product_id: ObjectId.isValid(productId) ? new ObjectId(productId) : null,
    });
  }

  async hasPurchasedProduct(userId, productId) {
    const uid = ObjectId.isValid(userId) ? new ObjectId(userId) : null;
    const pid = ObjectId.isValid(productId) ? new ObjectId(productId) : null;

    if (!uid || !pid) return false;

    const order = await this.Order.findOne({
      user_id: uid,
      status: { $in: ["delivered", "completed"] },
      "items.product_id": pid,
    });

    return !!order;
  }

  async canReview(userId, productId) {
    const uid = ObjectId.isValid(userId) ? new ObjectId(userId) : null;
    const pid = ObjectId.isValid(productId) ? new ObjectId(productId) : null;

    if (!uid || !pid) {
      return {
        canReview: false,
        message: "user và product không hợp lệ",
      };
    }

    const product = await this.Product.findOne({ _id: pid });
    if (!product) {
      return {
        canReview: false,
        message: "Sản phẩm không tồn tại",
      };
    }

    const user = await this.User.findOne({ _id: uid });
    if (!user) {
      return {
        canReview: false,
        message: "Người dùng không tồn tại",
      };
    }

    const hasPurchased = await this.hasPurchasedProduct(userId, productId);
    if (!hasPurchased) {
      return {
        canReview: false,
        message: "Bạn chỉ có thể đánh giá sản phẩm đã mua",
      };
    }

    const existedReview = await this.findByUserAndProduct(userId, productId);
    if (existedReview) {
      return {
        canReview: false,
        message: "Bạn đã đánh giá sản phẩm này rồi",
      };
    }

    return { canReview: true };
  }

  async create(payload) {
    const review = this.extractData(payload);

    if (!review.user_id) return { error: "user không hợp lệ" };
    if (!review.product_id) return { error: "product không hợp lệ" };
    if (
      !Number.isInteger(review.rating) ||
      review.rating < 1 ||
      review.rating > 5
    ) {
      return { error: "rating phải là số nguyên từ 1 đến 5" };
    }
    if (!review.comment)
      return { error: "Nội dung đánh giá không được để trống" };

    const existedUser = await this.User.findOne({ _id: review.user_id });
    if (!existedUser) return { error: "Người dùng không tồn tại" };

    const existedProduct = await this.Product.findOne({
      _id: review.product_id,
    });
    if (!existedProduct) return { error: "Sản phẩm không tồn tại" };

    const permission = await this.canReview(
      payload.user_id,
      payload.product_id,
    );
    if (!permission.canReview) {
      return { error: permission.message };
    }

    const result = await this.Review.insertOne(review);
    return await this.findById(result.insertedId);
  }

  async findByProductId(productId) {
    const pid = ObjectId.isValid(productId) ? new ObjectId(productId) : null;

    if (!pid) return [];

    return await this.Review.aggregate([
      { $match: { product_id: pid } },
      { $sort: { created_at: -1 } },
      {
        $lookup: {
          from: "users",
          localField: "user_id",
          foreignField: "_id",
          as: "user",
        },
      },
      {
        $unwind: {
          path: "$user",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 0,
          id: { $toString: "$_id" },
          user_id: { $toString: "$user_id" },
          product_id: { $toString: "$product_id" },
          rating: 1,
          content: { $ifNull: ["$comment", ""] },
          time: {
            $dateToString: {
              format: "%d/%m/%Y %H:%M",
              date: "$created_at",
              timezone: "Asia/Ho_Chi_Minh",
            },
          },
          author: { $ifNull: ["$user.name", "Người dùng"] },
          avatar: { $ifNull: ["$user.avatar_url", "/img/avatar.jpg"] },
        },
      },
    ]).toArray();
  }

  async getReviewStars(productId) {
    const pid = ObjectId.isValid(productId) ? new ObjectId(productId) : null;

    if (!pid) {
      return {
        total_reviews: 0,
        average_rating: 0,
      };
    }

    const stars = await this.Review.aggregate([
      { $match: { product_id: pid } },
      {
        $group: {
          _id: "$product_id",
          total_reviews: { $sum: 1 },
          average_rating: { $avg: "$rating" },
        },
      },
    ]).toArray();

    if (stars.length === 0) {
      return {
        total_reviews: 0,
        average_rating: 0,
      };
    }

    return {
      total_reviews: stars[0].total_reviews,
      average_rating: Number(stars[0].average_rating.toFixed(1)),
    };
  }
}

module.exports = ReviewsService;
