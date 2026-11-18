const multer = require("multer");
const ApiError = require("../api-error");
const { MAX_BYTES } = require("../config/shrimp-diagnosis");
const types = new Set(["image/jpeg", "image/png", "image/webp"]);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1, fields: 0, parts: 1, fieldNameSize: 40 },
  fileFilter(req, file, cb) { cb(types.has(file.mimetype) ? null : new ApiError(415, "Chỉ nhận ảnh JPEG, PNG hoặc WebP."), types.has(file.mimetype)); },
}).single("image");
module.exports = (req, res, next) => upload(req, res, error => {
  if (error instanceof multer.MulterError) return next(new ApiError(error.code === "LIMIT_FILE_SIZE" ? 413 : 400,
    error.code === "LIMIT_FILE_SIZE" ? "Ảnh vượt quá 5 MB." : "Chỉ gửi một ảnh trong trường image, không kèm trường khác."));
  if (error) return next(error);
  if (!req.file?.size) return next(new ApiError(400, "Vui lòng chọn ảnh không rỗng."));
  return next();
});
