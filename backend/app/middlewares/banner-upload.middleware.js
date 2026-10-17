const { createSafeImageUpload } = require("../utils/safe-image-upload.util");

module.exports = createSafeImageUpload({
  folder: "banners",
  prefix: "ban",
  maxFileSize: 10 * 1024 * 1024,
});
