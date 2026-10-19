const ApiError = require("../api-error");
const ProductsService = require("../services/products.service");
const CategoryService = require("../services/categories.service");
const MongoDB = require("../utils/mongodb.util");
const { deleteUnreferencedUpload } = require("../utils/local-upload.util");

async function safeDeleteLocalImage(imageUrl) {
  return deleteUnreferencedUpload(MongoDB.client, "products", imageUrl);
}

async function safeDeleteLocalImages(urls) {
  if (!Array.isArray(urls)) return;
  await Promise.all(urls.map((u) => safeDeleteLocalImage(u)));
}

function buildUrl(file) {
  return `/uploads/products/${file.filename}`;
}

function isApiError(error) {
  return error && Number.isInteger(error.statusCode);
}

exports.create = async (req, res, next) => {
  try {
    const { name, category_id, inventoryItemId } = req.body;
    if (!name) return next(new ApiError(400, "name là bắt buộc"));
    if (!category_id && !inventoryItemId) {
      return next(new ApiError(400, "category_id là bắt buộc"));
    }

    const thumbFile = req.files?.thumbnail?.[0];
    const imageFiles = req.files?.images || [];

    if (!thumbFile) {
      await cleanUploadedFiles(req);
      return next(new ApiError(400, "Vui lòng chọn thumbnail cho sản phẩm"));
    }
    if (imageFiles.length > 4) {
      await cleanUploadedFiles(req);
      return next(new ApiError(400, "Images tối đa 4 ảnh"));
    }

    const service = new ProductsService(MongoDB.client);
    const thumbnail = buildUrl(thumbFile);
    const images = imageFiles.map(buildUrl);

    const created = await service.create({
      ...req.body,
      thumbnail,
      images,
    });

    return res.status(201).send({
      message: "Tạo sản phẩm thành công",
      data: created,
    });
  } catch (error) {
    await cleanUploadedFiles(req);
    return next(isApiError(error) ? error : new ApiError(400, error.message));
  }
};

async function findAll(req, res, next, publicOnly) {
  try {
    const productService = new ProductsService(MongoDB.client);

    if (req.query.category_slug) {
      const categoryService = new CategoryService(MongoDB.client);
      const cat = await categoryService.findBySlug(req.query.category_slug);

      if (!cat) {
        return res.send({
          data: [],
        });
      }

      req.query.category_id = String(cat._id);
    }

    const result = await productService.search(req.query, { publicOnly });

    return res.send({
      data: result.data || [],
      ...(publicOnly && result.units ? { units: result.units } : {}),
    });
  } catch (error) {
    return next(
      isApiError(error)
        ? error
        : new ApiError(500, error.message || "Lỗi khi truy xuất sản phẩm"),
    );
  }
}

exports.findAll = (req, res, next) => findAll(req, res, next, true);
exports.findAllAdmin = (req, res, next) => findAll(req, res, next, false);

exports.findByCategory = async (req, res, next) => {
  try {
    const productService = new ProductsService(MongoDB.client);
    const result = await productService.findByCategoryId(
      req.params.categoryId,
      req.query,
      { publicOnly: true },
    );
    return res.send(result);
  } catch (error) {
    return next(
      isApiError(error)
        ? error
        : new ApiError(500, "Lỗi khi truy xuất sản phẩm"),
    );
  }
};

exports.findOne = async (req, res, next) => {
  try {
    const productService = new ProductsService(MongoDB.client);
    const document = await productService.findById(req.params.id, {
      publicOnly: true,
    });
    if (!document) return next(new ApiError(404, "Sản phẩm không tồn tại"));
    return res.send(document);
  } catch (error) {
    return next(
      isApiError(error)
        ? error
        : new ApiError(500, "Lỗi khi truy xuất sản phẩm"),
    );
  }
};

async function cleanUploadedFiles(req) {
  const thumb = req.files?.thumbnail?.[0];
  const images = req.files?.images || [];
  if (thumb) await safeDeleteLocalImage(buildUrl(thumb));
  if (images.length) await safeDeleteLocalImages(images.map(buildUrl));
}

exports.update = async (req, res, next) => {
  if (Object.keys(req.body).length === 0) {
    return next(new ApiError(400, "Dữ liệu để cập nhật không được để trống"));
  }

  try {
    const productService = new ProductsService(MongoDB.client);
    const existed = await productService.findById(req.params.id);
    if (!existed) {
      await cleanUploadedFiles(req);
      return next(new ApiError(404, "Sản phẩm không tồn tại"));
    }

    const payload = { ...req.body };
    const newThumbFile = req.files?.thumbnail?.[0];
    const newImageFiles = req.files?.images || [];
    if (newImageFiles.length > 4) {
      await cleanUploadedFiles(req);
      return next(new ApiError(400, "Images tối đa 4 ảnh"));
    }
    if (newThumbFile) {
      const newThumbUrl = buildUrl(newThumbFile);
      payload.thumbnail = newThumbUrl;
    }
    if (newImageFiles.length > 0) {
      const newImages = newImageFiles.map(buildUrl);
      payload.images = newImages;
    }

    const result = await productService.update(req.params.id, payload);
    if (!result) {
      await cleanUploadedFiles(req);
      return next(new ApiError(500, "Lỗi khi cập nhật sản phẩm"));
    }

    if (newThumbFile) await safeDeleteLocalImage(existed.thumbnail);
    if (newImageFiles.length > 0) await safeDeleteLocalImages(existed.images);

    return res.send({
      message: "Cập nhật sản phẩm thành công",
      data: result,
    });
  } catch (error) {
    await cleanUploadedFiles(req);
    return next(
      isApiError(error)
        ? error
        : new ApiError(500, error.message || "Lỗi khi cập nhật sản phẩm"),
    );
  }
};

exports.delete = async (req, res, next) => {
  try {
    const productService = new ProductsService(MongoDB.client);
    const deleted = await productService.delete(req.params.id);
    if (!deleted) {
      return next(new ApiError(404, "Sản phẩm không tồn tại"));
    }
    await safeDeleteLocalImage(deleted.thumbnail);
    await safeDeleteLocalImages(deleted.images);

    return res.send({ message: "Xóa sản phẩm thành công" });
  } catch (error) {
    return next(
      isApiError(error) ? error : new ApiError(500, "Lỗi khi xóa sản phẩm"),
    );
  }
};

exports.search = async (req, res, next) => {
  try {
    const productService = new ProductsService(MongoDB.client);

    if (req.query.category_slug) {
      const categoryService = new CategoryService(MongoDB.client);
      const cat = await categoryService.findBySlug(req.query.category_slug);

      if (!cat) {
        return res.send({
          message: "Tìm kiếm sản phẩm thành công",
          data: [],
        });
      }

      req.query.category_id = String(cat._id);
    }

    const result = await productService.search(req.query, { publicOnly: true });
    return res.send({
      message: "Tìm kiếm sản phẩm thành công",
      data: result.data || [],
    });
  } catch (error) {
    return next(
      isApiError(error)
        ? error
        : new ApiError(500, error.message || "Lỗi khi tìm kiếm sản phẩm"),
    );
  }
};

exports.createFromInventory = async (req, res, next) => {
  try {
    const productService = new ProductsService(MongoDB.client);
    const document = await productService.createFromInventory(
      req.params.inventoryItemId,
      req.body || {},
    );

    return res.status(201).send({
      message: "Tạo sản phẩm từ hàng kho thành công",
      data: document,
    });
  } catch (error) {
    return next(error);
  }
};
