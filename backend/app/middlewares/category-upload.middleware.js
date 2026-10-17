const { createSafeImageUpload } = require("../utils/safe-image-upload.util");

module.exports = createSafeImageUpload({
  folder: "categories",
  prefix: "cat",
  maxFileSize: 10 * 1024 * 1024,
});
