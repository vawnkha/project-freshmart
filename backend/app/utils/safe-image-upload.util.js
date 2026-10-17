const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { pipeline } = require("stream/promises");
const multer = require("multer");
const sharp = require("sharp");
const ApiError = require("../api-error");

const CLAIMED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

class SafeImageStorage {
  constructor({ destination, prefix }) {
    this.destination = destination;
    this.prefix = prefix;
  }

  _handleFile(req, file, callback) {
    const filename = `${this.prefix}_${crypto.randomUUID()}.webp`;
    const filePath = path.join(this.destination, filename);

    (async () => {
      await fs.promises.mkdir(this.destination, { recursive: true });
      await pipeline(
        file.stream,
        sharp({ failOn: "warning", limitInputPixels: 25_000_000 })
          .rotate()
          .resize({
            width: 2400,
            height: 2400,
            fit: "inside",
            withoutEnlargement: true,
          })
          .webp({ quality: 86 }),
        fs.createWriteStream(filePath, { flags: "wx" }),
      );
      const stat = await fs.promises.stat(filePath);
      callback(null, {
        destination: this.destination,
        filename,
        path: filePath,
        size: stat.size,
        mimetype: "image/webp",
      });
    })().catch(async (error) => {
      await fs.promises.unlink(filePath).catch(() => {});
      callback(new ApiError(400, `Invalid image content: ${error.message}`));
    });
  }

  _removeFile(req, file, callback) {
    fs.promises
      .unlink(file.path)
      .then(() => callback(null))
      .catch((error) => callback(error.code === "ENOENT" ? null : error));
  }
}

function createSafeImageUpload({ folder, prefix, maxFileSize }) {
  const destination = path.resolve(__dirname, `../../public/uploads/${folder}`);
  return multer({
    storage: new SafeImageStorage({ destination, prefix }),
    fileFilter(req, file, callback) {
      if (!CLAIMED_IMAGE_TYPES.has(file.mimetype)) {
        return callback(new ApiError(400, "Invalid image file type"));
      }
      return callback(null, true);
    },
    limits: { fileSize: maxFileSize },
  });
}

module.exports = { createSafeImageUpload };
