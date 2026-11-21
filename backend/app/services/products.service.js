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
const { normalizedPrice } = require("../utils/product-comparison.util");
const { availableDosagesExpression, withDosageIds } = require('../utils/dosage-instruction.util');
const { publicTechnicalSpecs, publicProductDetail } = require('../utils/public-product.util');
const { insertWithSlug } = require("../utils/slug.util");

function normalizeUnit(value) {
  return typeof value === "string" ? value.trim().normalize("NFC") : "";
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
    this.client = client;
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
      "note",
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

  resolvePrice(payload = {}, fallback = null) {
    const raw =
      payload.sellingPrice !== undefined ? payload.sellingPrice : payload.price;
    if (raw === undefined) return fallback;
    if (raw === null || raw === "") return null;
    if (typeof raw !== 'string' && typeof raw !== 'number') throw new ApiError(400, 'Giá bán không hợp lệ');
    const price = Number(raw);
    if (!Number.isFinite(price) || price < 0) throw new ApiError(400, 'Giá bán không hợp lệ');
    return price;
  }

  normalizeCategoryId(value) {
    if (value instanceof ObjectId) return value;
    if (value === null) return null;
    return ObjectId.isValid(value) ? new ObjectId(value) : null;
  }

  extractCreateData(payload, context = {}) {
    const inventoryItem = context.inventoryItem || null;
    const hasInventoryLink = Boolean(inventoryItem);
    const sellingPrice = this.resolvePrice(payload, null);

    const product = {
      ...this.extractMetadata(payload),
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
      status: "draft",
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
      ...this.extractMetadata(payload),
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

    return deleteUndefined(product);
  }

  async create(payload) {
    const message = validator.validateProductCreateData(payload);
    if (message) throw new ApiError(400, message);
    if (payload.inventoryItemId) throw new ApiError(400, 'Hồ sơ kho được tạo tự động cùng sản phẩm');
    const productId = new ObjectId();
    const inventoryItemId = new ObjectId();
    const product = this.extractCreateData(payload);
    product._id = productId;
    product.inventoryItemId = inventoryItemId;
    product.productCode = String(payload.productCode || `SP-${productId.toHexString().toUpperCase()}`).trim();
    this.assertProductCode(product.productCode);
    product.search_text = this.buildSerchText(product);
    try {
      await insertWithSlug({
        requested: product.slug, name: product.name, fallback: 'san-pham',
        find: slug => this.Product.findOne({ slug }, { projection: { _id: 1 } }),
        insert: slug => this.inventoryStockService.withTransaction({}, async session => {
          if (await this.Product.findOne({ productCode: product.productCode }, { session }))
            throw new ApiError(409, 'Mã sản phẩm đã tồn tại');
          await this.client.db().collection('inventory_items').insertOne({
            _id: inventoryItemId, productId, createdAt: new Date(), updatedAt: new Date(),
          }, { session });
          const document = { ...product, slug };
          return this.deletion.withReferences(this.deletion.referencesFor('products', document),
            () => this.Product.insertOne(document, { session }), { session });
        }),
      });
    } catch (error) {
      if (error.code === 11000) throw new ApiError(409, 'Mã hoặc slug sản phẩm đã tồn tại');
      throw error;
    }
    return { insertedId: productId, ...(await this.findById(productId)) };
  }

  assertProductCode(code) {
    if (typeof code !== 'string' || !code.trim() || code.length > 100)
      throw new ApiError(400, 'Mã sản phẩm phải có từ 1 đến 100 ký tự');
  }

  async createFromInventory() {
    throw new ApiError(409, 'Tạo sản phẩm tại Quản lý sản phẩm. Hồ sơ kho được tạo tự động.');
  }

  async insertProduct(product) {
    try {
      return await insertWithSlug({
        requested: product.slug,
        name: product.name,
        fallback: "san-pham",
        find: (slug) => this.Product.findOne({ slug }, { projection: { _id: 1 } }),
        insert: (slug) => {
          const document = { ...product, slug };
          return this.deletion.withReferences(this.deletion.referencesFor("products", document),
            (session) => this.Product.insertOne(document, { session }));
        },
      });
    } catch (error) {
      if (error.code === 11000 && error.keyPattern?.slug) throw new ApiError(409, "Slug sản phẩm đã tồn tại");
      throw error;
    }
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
          pipeline: [{ $project: { technicalSpecs: 0 } }],
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
          technicalSpecs: { $ifNull: ["$technicalSpecs", {}] },
          technicalSpecsSource: "product",
          category_id: {
            $ifNull: ["$category_id", "$inventoryItem.categoryId"],
          },
          price: {
            $ifNull: ["$sellingPrice", { $ifNull: ["$price", null] }],
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
              { $ifNull: ["$unit", "$inventoryItem.unit"] },
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
      { $addFields: { outOfStock: { $not: ["$inStock"] }, dosageCalculatorAvailable: { $gt: [{ $size: availableDosagesExpression() },0] } } },
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

    const pipeline = this.buildPopulatePipeline({ match });
    if (!publicOnly) pipeline.push(...require('../utils/warehouse-product.util').latestImportPriceStages());
    const requests = [this.Product.aggregate(pipeline).toArray()];
    if (publicOnly && query.include_units === "1") {
      // Options span the public catalog, independently of the selected units.
      // Resolve linked inventory units with the same precedence as product rows.
      requests.push(this.Product.aggregate([
        { $match: PUBLIC_PRODUCT_FILTER },
        { $lookup: { from: "inventory_items", localField: "inventoryItemId", foreignField: "_id", as: "unitInventory" } },
        { $unwind: { path: "$unitInventory", preserveNullAndEmptyArrays: true } },
        { $group: { _id: { $cond: [
          { $ne: [{ $ifNull: ["$inventoryItemId", null] }, null] },
          { $ifNull: ["$unit", "$unitInventory.unit"] },
          "$unit",
        ] } } },
      ]).toArray());
    }
    const [rows, unitRows] = await Promise.all(requests);
    const selected = publicOnly ? [...new Set((Array.isArray(query.unit) ? query.unit : [query.unit]).map(normalizeUnit).filter(Boolean))] : [];
    const data = selected.length ? rows.filter(product => selected.includes(normalizeUnit(product.unit))) : rows;
    if (publicOnly) await this.attachBatchOffers(data);
    return { data: publicOnly ? data.map(publicProductDetail) : data, ...(unitRows ? { units: [...new Set(unitRows.map(row => normalizeUnit(row._id)).filter(Boolean))].sort((a, b) => a.localeCompare(b, "vi")) } : {}) };
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
    return this.findDetail({ _id }, { publicOnly });
  }

  async findPublicBySlug(slug) {
    return this.findDetail({ slug }, { publicOnly: true });
  }

  async findDetail(filter, { publicOnly }) {
    const result = await this.Product.aggregate([
      {
        $match: publicOnly
          ? { $and: [filter, PUBLIC_PRODUCT_FILTER] }
          : filter,
      },

      ...this.buildInventoryLookupStages(),

      ...(publicOnly ? [["brands", "brandId", "brand"], ["manufacturers", "manufacturerId", "manufacturer"]].flatMap(([from,localField,as])=>[
        {$lookup:{from,localField,foreignField:'_id',pipeline:[{$project:{name:1}}],as}},
        {$set:{[as]:{$arrayElemAt:[`$${as}`,0]}}},
      ]) : []),

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

    if (publicOnly) await this.attachBatchOffers(result);
    return result[0] ? (publicOnly ? publicProductDetail(result[0]) : result[0]) : null;
  }

  async attachBatchOffers(products, { scoped = false } = {}) {
    const offers = await new (require("./discount.service"))(this.client).publicBatchOffers(new Date(), scoped ? { productIds: products.map(product => product._id) } : {});
    for (const product of products) product.batchPromotions = offers.filter(offer => String(offer.productId) === String(product._id));
    return products;
  }

  async update(id, payload) {
    const message = validator.validateProductUpdateData(payload);
    if (message) throw new ApiError(400, message);
    const filter = { _id: toObjectId(id) };
    const result = await this.inventoryStockService.withTransaction({}, async session => {
      const current = await this.Product.findOne(filter, { session });
      if (!current) return null;
      if (payload.inventoryItemId !== undefined && String(payload.inventoryItemId) !== String(current.inventoryItemId))
        throw new ApiError(400, 'Không thể thay đổi liên kết kho của sản phẩm');
      if (payload.stock !== undefined) throw new ApiError(400, 'Tồn kho được cập nhật qua nghiệp vụ kho');
      const update = this.extractUpdateData(payload, { current });
      const next = { ...current, ...update };
      if (payload.productCode !== undefined) {
        update.productCode = String(payload.productCode).trim();
        this.assertProductCode(update.productCode);
        if (await this.Product.findOne({ productCode: update.productCode, _id: { $ne: current._id } }, { session }))
          throw new ApiError(409, 'Mã sản phẩm đã tồn tại');
      }
      const effectivePrice = next.sellingPrice === undefined ? next.price : next.sellingPrice;
      if (['active', 'in_stock', 'out_stock', 'out_of_stock'].includes(next.status) && !(Number.isFinite(effectivePrice) && effectivePrice > 0))
        throw new ApiError(400, 'Vui lòng nhập giá bán hợp lệ lớn hơn 0 trước khi hiển thị', 'SELLING_PRICE_REQUIRED');
      update.search_text = this.buildSerchText({ ...next, ...update });
      return this.deletion.withReferences(this.deletion.referencesFor('products', update), () =>
        this.Product.findOneAndUpdate(filter, { $set: update }, { returnDocument: 'after', session }), { session });
    }).catch(error => {
      if (error.code === 11000) throw new ApiError(409, 'Mã hoặc slug sản phẩm đã tồn tại');
      throw error;
    });
    return result ? this.findById(id) : null;
  }

  async delete(id) {
    return this.inventoryStockService.withTransaction({}, async session => {
      const product = await this.Product.findOne({ _id: toObjectId(id) }, { session });
      if (!product) return null;
      const items = this.client.db().collection('inventory_items');
      const item = await items.findOne({ _id: product.inventoryItemId, productId: product._id }, { session });
      if (!item) return this.deletion.remove('products', id, { session });
      await items.updateOne({ _id: item._id }, { $unset: { productId: '' } }, { session });
      const deleted = await this.deletion.remove('products', id, { session });
      await this.deletion.remove('inventory_items', item._id, { session });
      return deleted;
    });
  }

  extractMetadata(payload) {
    const parsed = validator.productMetadataSchema.safeParse(payload);
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message);
    if (parsed.data.technicalSpecs) parsed.data.technicalSpecs = withDosageIds(parsed.data.technicalSpecs);
    return deleteUndefined({ ...parsed.data,
      brandId: payload.brandId !== undefined ? toObjectId(payload.brandId) : undefined,
      manufacturerId: payload.manufacturerId !== undefined ? toObjectId(payload.manufacturerId) : undefined,
    });
  }

  async compare(ids) {
    // Validate here as well as at the HTTP boundary for internal callers.
    const parsed = validator.compareQuerySchema.safeParse({ ids: Array.isArray(ids) ? ids.join(",") : ids });
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message);
    ids = parsed.data.ids;
    const rows = await this.repository.aggregate([
      { $match: { _id: { $in: ids.map(id => new ObjectId(id)) }, status: "active", ...PUBLIC_PRODUCT_FILTER } },
      { $set: { comparisonPrice: { $ifNull: ["$sellingPrice", { $ifNull: ["$price", null] }] } } },
      ...this.buildInventoryLookupStages(),
      ...[["brands", "brandId", "brand"], ["manufacturers", "manufacturerId", "manufacturer"], ["categories", "category_id", "category"]]
        .flatMap(([from, localField, as]) => [
          { $lookup: { from, localField, foreignField: "_id", pipeline: [{ $project: { name: 1 } }], as } },
          { $set: { [as]: { $arrayElemAt: [`$${as}`, 0] } } },
        ]),
    ]);
    if (rows.length !== ids.length) throw new ApiError(404, "Một hoặc nhiều sản phẩm không tồn tại hoặc chưa được xuất bản", "COMPARISON_PRODUCT_UNAVAILABLE");
    // Reuse public offers, never spread internal batch or receipt documents.
    await this.attachBatchOffers(rows, { scoped: true });
    const byId = new Map(rows.map(row => [String(row._id), row]));
    return ids.map(id => {
      const row = byId.get(id), rawPrice = row.comparisonPrice;
      const price = rawPrice !== null && rawPrice !== undefined && Number.isFinite(Number(rawPrice)) && Number(rawPrice) >= 0 ? Number(rawPrice) : null;
      const stock = Number(row.availableStock || 0);
      return {
        _id: row._id, name: row.name, slug: row.slug, thumbnail: row.thumbnail || row.images?.[0] || "", status: row.status,
        inventoryItemId: row.inventoryItemId || null, technicalSpecsSource: row.technicalSpecsSource,
        dosageCalculatorAvailable: Boolean(row.dosageCalculatorAvailable),
        brand: row.brand || null, manufacturer: row.manufacturer || null, category: row.category || null,
        technicalSpecs: publicTechnicalSpecs(row.technicalSpecs), unit: row.unit || null, packageSize: row.packageSize || null,
        packageMeasure: row.packageMeasure || null, price, sellingPrice: price,
        normalizedPrice: price === null ? null : normalizedPrice(price, row.packageMeasure),
        stock, availableStock: stock, inStock: Boolean(row.inStock),
        expiryMonths: row.expiryMonths ?? null, storageInstruction: row.storageInstruction || null,
        batchPromotions: row.batchPromotions || [],
      };
    });
  }
}

module.exports = ProductsService;
