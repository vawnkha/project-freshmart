function productImageUrl(file) {
  return `/uploads/products/${file.filename}`;
}

exports.uploadProductImages = (req, res) => {
  const thumbnailFile = req.files?.thumbnail?.[0] || null;
  const imageFiles = req.files?.images || [];

  return res.status(201).send({
    message: "Upload anh san pham thanh cong",
    data: {
      thumbnail: thumbnailFile ? productImageUrl(thumbnailFile) : "",
      images: imageFiles.map(productImageUrl),
    },
  });
};
