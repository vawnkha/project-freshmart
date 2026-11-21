// The response aliases keep warehouse and document consumers compatible.
function warehouseProductStages(localField = '_id') {
  return [
    { $lookup: { from: 'products', localField, foreignField: 'inventoryItemId', as: 'linkedProduct' } },
    { $set: { linkedProduct: { $arrayElemAt: ['$linkedProduct', 0] } } },
    { $set: {
      productId: { $ifNull: ['$linkedProduct._id', '$productId'] },
      itemCode: { $ifNull: ['$linkedProduct.productCode', '$itemCode'] },
      itemName: { $ifNull: ['$linkedProduct.name', '$itemName'] },
      ...Object.fromEntries(['unit', 'packageSize', 'packageMeasure', 'brandId', 'manufacturerId', 'storageInstruction', 'expiryMonths'].map(field =>
        [field, { $ifNull: [`$linkedProduct.${field}`, `$${field}`] }])),
      categoryId: { $ifNull: ['$linkedProduct.category_id', '$categoryId'] },
    } },
    { $unset: 'linkedProduct' },
  ];
}

async function productForItem(client, item, options = {}) {
  if (!item) return null;
  const product = await client.db().collection('products').findOne({ inventoryItemId: item._id }, options);
  if (!product) return item;
  return { ...item, productId: product._id, itemCode: product.productCode, itemName: product.name,
    unit: product.unit, packageSize: product.packageSize, categoryId: product.category_id };
}

function latestImportPriceStages(localField = 'inventoryItemId') {
  return [
    { $lookup: {
      from: 'purchase_orders', let: { itemId: `$${localField}` },
      pipeline: [
        { $match: { status: 'imported' } },
        { $unwind: '$items' },
        { $match: { $expr: { $and: [
          { $ne: [{ $ifNull: ['$$itemId', null] }, null] },
          { $eq: ['$items.inventoryItemId', '$$itemId'] },
        ] } } },
        { $sort: { importedAt: -1, _id: -1, 'items._id': -1 } },
        { $limit: 1 },
        { $project: { importPrice: '$items.importPrice' } },
      ], as: 'latestImport',
    } },
    { $set: { lastImportPrice: { $ifNull: [{ $arrayElemAt: ['$latestImport.importPrice', 0] }, null] } } },
    { $unset: 'latestImport' },
  ];
}

module.exports = { warehouseProductStages, productForItem, latestImportPriceStages };
