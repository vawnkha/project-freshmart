function productImageUrl(file) {
  return `/uploads/products/${file.filename}`;
}

function bannerImageUrl(file) {
  return `/uploads/banners/${file.filename}`;
}

function newsImageUrl(file) {
  return `/uploads/news/${file.filename}`;
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

exports.uploadBannerImage = (req, res) => {
  const file = req.file || null;

  if (!file) {
    return res.status(400).send({
      success: false,
      message: "Vui long chon anh banner",
    });
  }

  return res.status(201).send({
    success: true,
    url: bannerImageUrl(file),
    filename: file.filename,
  });
};

exports.uploadNewsImage = (req, res) => {
  const file = req.file || null;

  if (!file) {
    return res.status(400).send({
      success: false,
      message: "Vui long chon anh tin tuc",
    });
  }

  return res.status(201).send({
    success: true,
    url: newsImageUrl(file),
    filename: file.filename,
  });
};
