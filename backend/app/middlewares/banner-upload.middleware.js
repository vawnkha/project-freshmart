const fs = require("fs");
const path = require("path");
const multer = require("multer");
const ApiError = require("../api-error");

const uploadDir = path.join(__dirname, "../../public/uploads/banners");

try {
  fs.mkdirSync(uploadDir, { recursive: true });
} catch (_) {}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    cb(null, `ban_${Date.now()}_${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

function fileFilter(req, file, cb) {
  const ok = ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype);
  if (!ok) return cb(new ApiError(400, "Invalid banner file type"));
  cb(null, true);
}

const uploadBannerImage = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

module.exports = uploadBannerImage;
