const { ObjectId } = require("mongodb");

class WishlistService {
  constructor(client) {
    this.Wishlist = client.db().collection("wishlists");
    this.Product = client.db().collection("products");
  }

  async findByUserId(userId) {
    return await this.Wishlist.findOne({
      user_id: ObjectId.isValid(userId) ? new ObjectId(userId) : null,
    });
  }

  async getWishlistWithProducts(userId) {
    const uid = ObjectId.isValid(userId) ? new ObjectId(userId) : null;

    const result = await this.Wishlist.aggregate([
      { $match: { user_id: uid } },
      {
        $lookup: {
          from: "products",
          localField: "items",
          foreignField: "_id",
          as: "products",
        },
      },
    ]).toArray();
    if (result.length === 0) {
      return {
        user_id: uid,
        items: [],
        products: [],
      };
    }
    return result[0];
  }

  async addItem(userId, productId) {
    const uid = ObjectId.isValid(userId) ? new ObjectId(userId) : null;
    const pid = ObjectId.isValid(productId) ? new ObjectId(productId) : null;

    const existedProduct = await this.Product.findOne({ _id: pid });
    if (!existedProduct) return null;

    await this.Wishlist.updateOne(
      { user_id: uid },
      {
        $setOnInsert: { user_id: uid },
        $addToSet: { items: pid },
      },
      { upsert: true },
    );
    return await this.getWishlistWithProducts(userId);
  }

  async removeItem(userId, productId) {
    const uid = ObjectId.isValid(userId) ? new ObjectId(userId) : null;
    const pid = ObjectId.isValid(productId) ? new ObjectId(productId) : null;

    const result = await this.Wishlist.findOneAndUpdate(
      { user_id: uid },
      {
        $pull: { items: pid },
      },
      { returnDocument: "after" },
    );
    return result;
  }

  async toggleItem(userId, productId) {
    const uid = ObjectId.isValid(userId) ? new ObjectId(userId) : null;
    const pid = ObjectId.isValid(productId) ? new ObjectId(productId) : null;

    const existedProduct = await this.Product.findOne({ _id: pid });
    if (!existedProduct) return { error: "Sản phẩm không tồn tại" };

    const wishlist = await this.findByUserId(userId);

    if (!wishlist) {
      await this.Wishlist.insertOne({
        user_id: uid,
        items: [pid],
      });
      return {
        action: "added",
        wishlist: await this.getWishlistWithProducts(userId),
      };
    }
    const hasItem = (wishlist.items || []).some((item) => item.equals(pid));
    if (hasItem) {
      await this.Wishlist.updateOne(
        { user_id: uid },
        { $pull: { items: pid } },
      );
      return {
        action: "removed",
        wishlist: await this.getWishlistWithProducts(userId),
      };
    }
    await this.Wishlist.updateOne(
      { user_id: uid },
      { $addToSet: { items: pid } },
    );
    return {
      action: "added",
      wishlist: await this.getWishlistWithProducts(userId),
    };
  }

  async clear(userId) {
    const uid = ObjectId.isValid(userId) ? new ObjectId(userId) : null;
    return await this.Wishlist.findOneAndUpdate(
      { user_id: uid },
      { $set: { items: [] } },
      { returnDocument: "after" },
    );
  }
}

module.exports = WishlistService;
