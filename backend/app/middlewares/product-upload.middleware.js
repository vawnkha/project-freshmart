const { createSafeImageUpload } = require("../utils/safe-image-upload.util");

module.exports = createSafeImageUpload({
  folder: "products",
  prefix: "pro",
  maxFileSize: 10 * 1024 * 1024,
});
