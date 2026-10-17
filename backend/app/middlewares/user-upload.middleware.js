const { createSafeImageUpload } = require("../utils/safe-image-upload.util");

module.exports = createSafeImageUpload({
  folder: "users",
  prefix: "user",
  maxFileSize: 10 * 1024 * 1024,
});
