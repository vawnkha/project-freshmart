const { createSafeImageUpload } = require("../utils/safe-image-upload.util");

module.exports = createSafeImageUpload({
  folder: "news",
  prefix: "news",
  maxFileSize: 5 * 1024 * 1024,
});
