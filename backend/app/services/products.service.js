const ResourceDeletionService = require("./resource-deletion.service");
const { ObjectId } = require("mongodb");
const ApiError = require("../api-error");
const ProductRepository = require("../repositories/product.repository");
const InventoryItemRepository = require("../repositories/inventory-item.repository");
const InventoryStockService = require("./inventory-stock.service");
const {
  buildBatchStockLookup,
  PUBLIC_PRODUCT_FILTER,
} = require("../utils/inventory-query.util");
const validator = require("../validators/product.validator");

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function toObjectId(id) {
  if (id instanceof ObjectId) return id;
  return ObjectId.isValid(id) ? new ObjectId(id) : null;
}

function deleteUndefined(document) {
  Object.keys(document).forEach((key) => {
    if (document[key] === undefined) delete document[key];
  });
  return document;
}

class ProductsService {
  constructor(client) {
    this.deletion = new ResourceDeletionService(client);
    this.repository = new ProductRepository(client);
    this.inventoryItemRepository = new InventoryItemRepository(client);
    this.inventoryStockService = new InventoryStockService(client);
    this.Product = this.repository.collection();
  }

  normalizeImages(images) {
    if (!images) return [];
    if (Array.isArray(images)) return images.filter(Boolean);
    if (typeof images === "string" && images.trim() !== "") {
      return [images.trim()];
    }
    return [];
  }

  normalizeText(str = "") {
    return String(str)
      .toLocaleLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\u0111/g, "d")
      .replace(/\u0110/g, "D")
      .replace(/\s+/g, " ")
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .trim();
  }

  buildSerchText({
    name = "",
    description = "",
    shortDescription = "",
    productCode = "",
  } = {}) {
    const base = this.normalizeText(
      `${name} ${description} ${shortDescription} ${productCode}`,
    );
    const noSpace = base.replace(/\s/g, "");
    return `${base} ${noSpace}`.trim();
  }

  slugify(value = "") {
    const slug = this.normalizeText(value).replace(/\s+/g, "-");
    return slug || `product-${Date.now()}`;
  }

  escapeRegex(s = "") {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  buildWordRegex(word = "") {
    const escaped = this.escapeRegex(this.normalizeText(word));
    return new RegExp(`(^|\\s)${escaped}(?=\\s|$)`, "i");
  }

  compluteStatus(stock) {
    const n = Number(stock);
    if (!Number.isFinite(n) || n <= 0) return "out_stock";
    return "in_stock";
  }

  getSummaryStock(summary) {
    return Number(summary?.availableQuantity || 0);
  }

  async resolveInventoryLink(inventoryItemId, currentProductId = null) {
    const itemId = toObjectId(inventoryItemId);
    if (!itemId) throw new ApiError(400, "inventoryItemId khong hop le");

    const inventoryItem = await this.inventoryItemRepository.findById(itemId);
    if (!inventoryItem)
      throw new ApiError(400, "inventoryItemId khong ton tai");
    if (inventoryItem.status && inventoryItem.status !== "active") {
      throw new ApiError(400, "Hang kho khong o trang thai active");
    }

    const duplicate = currentProductId
      ? await this.repository.findByInventoryItemIdExcept(
          itemId,
          currentProductId,
        )
      : await this.repository.findByInventoryItemId(itemId);

    if (duplicate) {
      throw new ApiError(400, "inventoryItemId da duoc lien ket san pham khac");
    }

    const inventorySummary = await this.inventoryStockService.getTotals(itemId);

    return { inventoryItem, inventorySummary };
  }

  pickExtendedFields(payload = {}) {
    const fields = [
      "slug",
      "productCode",
      "comparePrice",
      "shortDescription",
      "ingredients",
      "usagePurpose",
      "dosage",
      "usageInstruction",
      "targetSpecies",
      "suitableStage",
      "origin",
      "certification",
      "specifications",
      "sections",
      "relatedProducts",
      "seo",
      "stats",
      "status",
    ];

    return fields.reduce((result, field) => {
      if (payload[field] !== undefined) result[field] = payload[field];
      return result;
    }, {});
  }

  resolvePrice(payload = {}, fallback = 0) {
    const raw =
      payload.sellingPrice !== undefined ? payload.sellingPrice : payload.price;
    return raw !== undefined ? Number(raw || 0) : Number(fallback || 0);
  }

  normalizeCategoryId(value) {
    if (value instanceof ObjectId) return value;
    if (value === null) return null;
    return ObjectId.isValid(value) ? new ObjectId(value) : null;
  }

  extractCreateData(payload, context = {}) {
    const inventoryItem = context.inventoryItem || null;
    const inventorySummary = context.inventorySummary || null;
    const hasInventoryLink = Boolean(inventoryItem);
    const sellingPrice = this.resolvePrice(payload, 0);
    const stock = hasInventoryLink
      ? this.getSummaryStock(inventorySummary)
      : Number(payload.stock || 0);

    const product = {
      ...this.pickExtendedFields(payload),
      name: payload.name,
      inventoryItemId: hasInventoryLink
        ? inventoryItem._id
        : toObjectId(payload.inventoryItemId),
      category_id:
        payload.category_id !== undefined
          ? this.normalizeCategoryId(payload.category_id)
          : inventoryItem?.categoryId,
      price: sellingPrice,
      sellingPrice,
      ...(!hasInventoryLink ? { stock } : {}),
      status:
        payload.status ||
        context.defaultStatus ||
        (hasInventoryLink ? "draft" : this.compluteStatus(stock)),
      unit: payload.unit !== undefined ? payload.unit : inventoryItem?.unit,
      description: payload.description,
      thumbnail: payload.thumbnail,
      images: this.normalizeImages(payload.images).slice(0, 4),
      search_text: this.buildSerchText({
        name: payload.name,
        description: payload.description,
        shortDescription: payload.shortDescription,
        productCode: payload.productCode,
      }),
      created_at: new Date(),
      updated_at: new Date(),
    };

    if (payload.comparePrice !== undefined) {
      product.comparePrice = Number(payload.comparePrice || 0);
    }

    return deleteUndefined(product);
  }

  extractUpdateData(payload, context = {}) {
    const current = context.current || {};
    const inventoryItem = context.inventoryItem || null;
    const product = {
      ...this.pickExtendedFields(payload),
      name: payload.name,
      inventoryItemId:
        payload.inventoryItemId !== undefined
          ? toObjectId(payload.inventoryItemId)
          : undefined,
      category_id:
        payload.category_id !== undefined
          ? this.normalizeCategoryId(payload.category_id)
          : inventoryItem?.categoryId,
      unit: payload.unit !== undefined ? payload.unit : inventoryItem?.unit,
      description: payload.description,
      thumbnail: payload.thumbnail,
      images:
        payload.images !== undefined
          ? this.normalizeImages(payload.images).slice(0, 4)
          : undefined,
      updated_at: new Date(),
    };

    if (payload.price !== undefined || payload.sellingPrice !== undefined) {
      const sellingPrice = this.resolvePrice(
        payload,
        current.sellingPrice || current.price,
      );
      product.price = sellingPrice;
      product.sellingPrice = sellingPrice;
    }

    if (payload.comparePrice !== undefined) {
      product.comparePrice = Number(payload.comparePrice || 0);
    }

    if (!inventoryItem && payload.stock !== undefined) {
      product.stock = Number(payload.stock || 0);
    }

    if (
      payload.status === undefined &&
      payload.stock !== undefined &&
      !inventoryItem
    ) {
      product.status = this.compluteStatus(payload.stock);
    }

    return deleteUndefined(product);
  }

  async create(payload) {
    const message = validator.validateProductCreateData(payload);
    if (message) throw new ApiError(400, message);

    const inventoryContext = hasValue(payload.inventoryItemId)
      ? await this.resolveInventoryLink(payload.inventoryItemId)
      : {};

    const product = this.extractCreateData(payload, inventoryContext);
    const result = await this.deletion.withReferences(this.deletion.referencesFor("products", product),
      (session) => this.Product.insertOne(product, { session }));
    return {
      insertedId: result.insertedId,
      ...(await this.findById(result.insertedId)),
    };
  }

  async createFromInventory(inventoryItemId, payload = {}) {
    const message = validator.validateCreateFromInventory(payload);
    if (message) throw new ApiError(400, message);

    const { inventoryItem, inventorySummary } =
      await this.resolveInventoryLink(inventoryItemId);

    const name = hasValue(payload.name) ? payload.name : inventoryItem.itemName;
    const sellingPrice = this.resolvePrice(payload, 0);
    const productCode = hasValue(payload.productCode)
      ? payload.productCode
      : `SP-${inventoryItem.itemCode}`;

    const product = this.extractCreateData(
      {
        ...payload,
        inventoryItemId: inventoryItem._id,
        name,
        slug: hasValue(payload.slug) ? payload.slug : this.slugify(name),
        productCode,
        sellingPrice,
        price: sellingPrice,
        category_id: payload.category_id || inventoryItem.categoryId,
        unit: payload.unit || inventoryItem.unit,
        status: payload.status || "draft",
      },
      {
        inventoryItem,
        inventorySummary,
        defaultStatus: "draft",
      },
    );

    const result = await this.deletion.withReferences(this.deletion.referencesFor("products", product),
      (session) => this.Product.insertOne(product, { session }));
    return {
      insertedId: result.insertedId,
      ...(await this.findById(result.insertedId)),
    };
  }

  async find(filter = {}, options = {}) {
    const cursor = await this.Product.find(filter, options);
    return await cursor.toArray();
  }

  async count(filter = {}) {
    return await this.Product.countDocuments(filter);
  }

  async findByName(name) {
    return await this.find({
      name: { $regex: new RegExp(this.escapeRegex(name), "i") },
    });
  }

  buildSearchFilter(query = {}) {
    const q = (
      query.q ||
      query.name ||
      query.search ||
      query.keyword ||
      ""
    ).trim();

    const categoryId = query.category_id;
    const filter = {};

    if (q) {
      const normalizedQ = this.normalizeText(q);
      const tokens = normalizedQ.split(" ").filter(Boolean);
      const searchableFields = [
        "search_text",
        "name",
        "description",
        "shortDescription",
        "productCode",
      ];

      if (tokens.length)
        filter.$and = tokens.map((token) => {
          const wordRegex = this.buildWordRegex(token);

          return {
            $or: searchableFields.map((field) => ({
              [field]: { $regex: wordRegex },
            })),
          };
        });
    }

    if (categoryId !== undefined && categoryId !== "") {
      filter.category_id = ObjectId.isValid(categoryId)
        ? new ObjectId(categoryId)
        : null;
    }

    if (query.status !== undefined && query.status !== "") {
      filter.status = query.status;
    }

    return filter;
  }

  buildInventoryLookupStages() {
    return [
      {
        $lookup: {
          from: "inventory_items",
          localField: "inventoryItemId",
          foreignField: "_id",
          as: "inventoryItem",
        },
      },
      {
        $unwind: {
          path: "$inventoryItem",
          preserveNullAndEmptyArrays: true,
        },
      },
      buildBatchStockLookup("inventoryItemId", "inventorySummary"),
      {
        $unwind: {
          path: "$inventorySummary",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          category_id: {
            $ifNull: ["$category_id", "$inventoryItem.categoryId"],
          },
          price: {
            $ifNull: ["$price", { $ifNull: ["$sellingPrice", 0] }],
          },
          sellingPrice: {
            $ifNull: ["$sellingPrice", "$price"],
          },
          stock: {
            $cond: [
              { $ne: [{ $ifNull: ["$inventoryItemId", null] }, null] },
              {
                $cond: [
                  {
                    $and: [
                      {
                        $ne: [{ $ifNull: ["$inventoryItem._id", null] }, null],
                      },
                      {
                        $in: [
                          { $ifNull: ["$inventoryItem.status", "active"] },
                          ["active"],
                        ],
                      },
                    ],
                  },
                  { $ifNull: ["$inventorySummary.availableQuantity", 0] },
                  0,
                ],
              },
              { $max: [0, { $ifNull: ["$stock", 0] }] },
            ],
          },
          unit: {
            $cond: [
              { $ne: [{ $ifNull: ["$inventoryItemId", null] }, null] },
              { $ifNull: ["$inventoryItem.unit", "$unit"] },
              "$unit",
            ],
          },
        },
      },
      {
        $addFields: {
          availableStock: "$stock",
          inStock: {
            $and: [
              { $gt: ["$stock", 0] },
              {
                $cond: [
                  { $ne: [{ $ifNull: ["$inventoryItemId", null] }, null] },
                  { $eq: ["$status", "active"] },
                  {
                    $in: [
                      { $ifNull: ["$status", "active"] },
                      ["active", "in_stock"],
                    ],
                  },
                ],
              },
            ],
          },
        },
      },
      { $addFields: { outOfStock: { $not: ["$inStock"] } } },
    ];
  }

  buildPopulatePipeline({
    match = {},
    includeInventoryDetails = false,
    includeSearchText = false,
    limit = 0,
  } = {}) {
    const project = {
      review_stats: 0,
    };

    if (!includeSearchText) {
      project.search_text = 0;
    }

    if (!includeInventoryDetails) {
      project.inventoryItem = 0;
      project.inventorySummary = 0;
    }

    return [
      { $match: match },
      { $sort: { created_at: -1 } },
      ...(limit > 0 ? [{ $limit: limit }] : []),

      ...this.buildInventoryLookupStages(),

      {
        $lookup: {
          from: "categories",
          localField: "category_id",
          foreignField: "_id",
          as: "category",
        },
      },
      {
        $unwind: {
          path: "$category",
          preserveNullAndEmptyArrays: true,
        },
      },

      {
        $lookup: {
          from: "reviews",
          let: { productId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$product_id", "$$productId"] },
              },
            },
            {
              $group: {
                _id: "$product_id",
                total_reviews: { $sum: 1 },
                average_rating: { $avg: "$rating" },
              },
            },
          ],
          as: "review_stats",
        },
      },
      {
        $unwind: {
          path: "$review_stats",
          preserveNullAndEmptyArrays: true,
        },
      },

      {
        $addFields: {
          category_name: "$category.name",
          category_slug: "$category.slug",
          average_rating: {
            $ifNull: [{ $round: ["$review_stats.average_rating", 1] }, 0],
          },
          total_reviews: {
            $ifNull: ["$review_stats.total_reviews", 0],
          },
        },
      },

      {
        $project: project,
      },
    ];
  }

  async findByCategoryId(categoryId, query = {}, options = {}) {
    const category_id = ObjectId.isValid(categoryId)
      ? new ObjectId(categoryId)
      : null;

    return this.search({ ...query, category_id: String(category_id) }, options);
  }

  async search(query = {}, { publicOnly = false } = {}) {
    const filter = this.buildSearchFilter(query);
    const match = publicOnly
      ? { $and: [filter, PUBLIC_PRODUCT_FILTER] }
      : filter;

    const data = await this.Product.aggregate(
      this.buildPopulatePipeline({
        match,
      }),
    ).toArray();

    return { data };
  }

  async getProductsForAI(message, limit = 50) {
    const filter = this.buildSearchFilter({ q: message });
    // Chat can mention several product groups; match relevant tokens without
    // changing the stricter public catalog search contract.
    const match = filter.$and?.length ? { $or: filter.$and } : { _id: { $exists: false } };
    return this.Product.aggregate(
      this.buildPopulatePipeline({
        match: {
          $and: [match, PUBLIC_PRODUCT_FILTER],
        },
        includeSearchText: true,
        limit,
      }),
    ).toArray();
  }

  async findById(id, { publicOnly = false } = {}) {
    const _id = ObjectId.isValid(id) ? new ObjectId(id) : null;

    const result = await this.Product.aggregate([
      {
        $match: publicOnly
          ? { $and: [{ _id }, PUBLIC_PRODUCT_FILTER] }
          : { _id },
      },

      ...this.buildInventoryLookupStages(),

      {
        $lookup: {
          from: "categories",
          localField: "category_id",
          foreignField: "_id",
          as: "category",
        },
      },
      {
        $unwind: {
          path: "$category",
          preserveNullAndEmptyArrays: true,
        },
      },

      {
        $lookup: {
          from: "reviews",
          let: { productId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$product_id", "$$productId"] },
              },
            },
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
                _id: 1,
                user_id: 1,
                product_id: 1,
                rating: 1,
                comment: 1,
                created_at: 1,
                user_name: "$user.name",
                user_email: "$user.email",
                user_avatar: "$user.avatar_url",
              },
            },
          ],
          as: "reviews",
        },
      },

      {
        $addFields: {
          category_name: "$category.name",
          category_slug: "$category.slug",
          total_reviews: { $size: "$reviews" },
          average_rating: {
            $cond: [
              { $gt: [{ $size: "$reviews" }, 0] },
              {
                $round: [
                  {
                    $avg: {
                      $map: {
                        input: "$reviews",
                        as: "review",
                        in: "$$review.rating",
                      },
                    },
                  },
                  1,
                ],
              },
              0,
            ],
          },
        },
      },

      {
        $project: {
          search_text: 0,
        },
      },
    ]).toArray();

    return result[0] || null;
  }

  async update(id, payload) {
    const message = validator.validateProductUpdateData(payload);
    if (message) throw new ApiError(400, message);

    const filter = {
      _id: ObjectId.isValid(id) ? new ObjectId(id) : null,
    };

    const current = await this.Product.findOne(filter);
    if (!current) return null;

    const inventoryContext =
      payload.inventoryItemId !== undefined
        ? await this.resolveInventoryLink(payload.inventoryItemId, id)
        : current.inventoryItemId
          ? await this.resolveInventoryLink(current.inventoryItemId, id)
          : {};
    const update = this.extractUpdateData(payload, {
      ...inventoryContext,
      current,
    });

    if (
      payload.name !== undefined ||
      payload.description !== undefined ||
      payload.shortDescription !== undefined ||
      payload.productCode !== undefined
    ) {
      update.search_text = this.buildSerchText({
        name: payload.name ?? current.name ?? "",
        description: payload.description ?? current.description ?? "",
        shortDescription:
          payload.shortDescription ?? current.shortDescription ?? "",
        productCode: payload.productCode ?? current.productCode ?? "",
      });
    }

    const result = await this.deletion.withReferences(this.deletion.referencesFor("products", update),
      (session) => this.Product.findOneAndUpdate(
      filter,
      {
        $set: update,
        ...(inventoryContext.inventoryItem ? { $unset: { stock: "" } } : {}),
      },
      { returnDocument: "after", session },
    ));

    return result ? this.findById(id) : null;
  }

  async delete(id) {
    return this.deletion.remove("products", id);
  }
}

module.exports = ProductsService;
