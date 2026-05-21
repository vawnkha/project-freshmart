const fs = require("fs");
const path = require("path");
const { ObjectId } = require("mongodb");
const ApiError = require("../api-error");
const CategoryService = require("../services/categories.service");
const MongoDB = require("../utils/mongodb.util");

async function safeDeleteLocalImage(imageUrl) {
  if (!imageUrl || typeof imageUrl !== "string") return;
  if (!imageUrl.startsWith("/uploads/")) return;

  const relative = imageUrl.replace(/^\/uploads\//, "");
  const filePath = path.join(process.cwd(), "public/uploads", relative);
  try {
    await fs.promises.unlink(filePath);
  } catch (_) {}
}

exports.create = async (req, res, next) => {
  try {
    const { name, slug, description } = req.body;

    if (!name || !slug) {
      return next(new ApiError(400, "name và slug là bắt buộc"));
    }

    if (!req.file) {
      return next(
        new ApiError(400, "Vui lòng chọn 1 ảnh đại diện (field: image)"),
      );
    }

    const service = new CategoryService(MongoDB.client);

    const existedSlug = await service.findBySlug(slug);
    if (existedSlug) return next(new ApiError(400, "Slug đã tồn tại"));

    const image_url = `/uploads/categories/${req.file.filename}`;

    const created = await service.create({
      name,
      slug,
      description,
      image_url,
    });

    return res.status(201).send({
      message: "Tạo danh mục thành công",
      data: created,
    });
  } catch (error) {
    return next(new ApiError(400, error.message || "Lỗi tạo danh mục"));
  }
};

exports.findAll = async (req, res, next) => {
  let documents = [];
  try {
    const categoryService = new CategoryService(MongoDB.client);
    const { name } = req.query;
    if (name) {
      documents = await categoryService.findByName(name);
    } else {
      documents = await categoryService.find({});
    }
  } catch (error) {
    return next(new ApiError(500, "Lỗi khi truy xuất danh mục"));
  }
  return res.send(documents);
};

exports.findOne = async (req, res, next) => {
  try {
    const categoryService = new CategoryService(MongoDB.client);
    const document = ObjectId.isValid(req.params.slug)
      ? await categoryService.findById(req.params.slug)
      : await categoryService.findBySlug(req.params.slug);
    if (!document) {
      return next(new ApiError(404, "Danh mục không tồn tại"));
    }
    return res.send(document);
  } catch (error) {
    return next(new ApiError(500, "Lỗi khi truy xuất danh mục"));
  }
};
exports.update = async (req, res, next) => {
  if (Object.keys(req.body).length === 0) {
    return next(new ApiError(400, "Dữ liệu để cập nhật không được để trống"));
  }
  try {
    const categoryService = new CategoryService(MongoDB.client);
    const existed = await categoryService.findById(req.params.id);
    if (!existed) {
      return next(new ApiError(404, "Danh mục không tồn tại"));
    }
    const payload = {
      name: req.body.name,
      slug: req.body.slug,
      description: req.body.description,
    };

    if (payload.slug && payload.slug !== existed.slug) {
      const check = await categoryService.findBySlug(payload.slug);
      if (check) {
        return next(new ApiError(400, "Slug đã tồn tại"));
      }
    }
    if (req.file) {
      await safeDeleteLocalImage(existed.image_url);
      payload.image_url = `/uploads/categories/${req.file.filename}`;
    }

    const result = await categoryService.update(req.params.id, payload);
    if (!result) {
      return next(new ApiError(500, "Lỗi khi cập nhật danh mục"));
    }
    return res.send({
      message: "Cập nhật danh mục thành công",
      data: result,
    });
  } catch (error) {
    return next(new ApiError(400, error.message || "Lỗi cập nhật danh mục"));
  }
};

exports.delete = async (req, res, next) => {
  try {
    const categoryService = new CategoryService(MongoDB.client);
    const existed = await categoryService.findById(req.params.id);
    if (!existed) {
      return next(new ApiError(404, "Danh mục không tồn tại"));
    }
    await safeDeleteLocalImage(existed.image_url);
    await categoryService.delete(req.params.id);
    return res.send({ message: "Xóa danh mục thành công" });
  } catch (error) {
    return next(new ApiError(500, "Lỗi khi xóa danh mục"));
  }
};
