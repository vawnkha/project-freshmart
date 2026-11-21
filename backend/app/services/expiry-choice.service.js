const { createHash } = require('node:crypto');
const ApiError = require('../api-error');
const { normalizeChoice, choiceKey, choiceLabel } = require('../utils/expiry-choice.util');
const { toObjectId, buildAvailableBatchFefoFilter } = require('../utils/inventory-query.util');
const { classifyExpiry } = require('../utils/expiry.util');
const { read } = require('../config/environment');

class ExpiryChoiceService {
  constructor(client) {
    this.db = client.db();
    this.discounts = new (require('./discount.service'))(client);
  }
  async groups(product, { session, now = new Date() } = {}) {
    if (!product || product.status !== 'active' || !toObjectId(product.inventoryItemId)) return [];
    const item = await this.db.collection('inventory_items').findOne({ _id: toObjectId(product.inventoryItemId) }, { session });
    if (!item || (item.status && item.status !== 'active') || !(Number(product.sellingPrice ?? product.price) > 0)) return [];
    const batches = await this.db.collection('inventory_batches').find(buildAvailableBatchFefoFilter(product.inventoryItemId, now), { session }).sort({ expiryDate: 1, createdAt: 1, _id: 1 }).toArray();
    const offers = [];
    const candidates = await this.db.collection('discounts').find({ scope: 'batch', isPublic: true, status: 'active', 'applicable.productIds': product._id }, { session }).toArray();
    for (const candidate of candidates) {
      if (!(candidate.applicable?.batchIds || []).some(id => String(id) === String(candidate.batchId))) continue;
      const offer = await this.discounts.getBatchOffer(candidate, { session, now });
      if (offer && String(offer.productId) === String(product._id)) offers.push({ discount: candidate, offer });
    }
    const min = read('EXPIRY_LONG_MIN_DAYS');
    const groups = [
      { choice: { group: 'long', minRemainingDays: min }, lots: [] },
      { choice: { group: 'other' }, lots: [] },
    ];
    for (const batch of batches) {
      const promotion = offers.find(row => String(row.offer.batchId) === String(batch._id));
      const promoted = promotion ? Math.min(batch.quantity, promotion.offer.availableQuantity) : 0;
      const regular = batch.quantity - promoted;
      if (regular > 0) groups[classifyExpiry(batch.expiryDate, now).daysRemaining >= min ? 0 : 1].lots.push({ batch, capacity: regular });
      if (promoted > 0) groups.push({ choice: { group: 'promotion', discountId: String(promotion.discount._id) }, discount: promotion.discount, lots: [{ batch, capacity: promoted }] });
    }
    return groups.filter(group => group.lots.length);
  }
  quoteGroup(product, group, quantity, { reserved = new Map() } = {}) {
    const choice = normalizeChoice(group.choice), price = Number(product.sellingPrice ?? product.price);
    const unitDiscount = group.discount ? Math.floor(price * Number(group.discount.value) / 100) : 0;
    let remaining = quantity;
    const allocations = [];
    let availableQuantity = 0;
    for (const { batch, capacity } of group.lots) {
      const available = Math.max(0, Math.min(capacity, batch.quantity - (reserved.get(String(batch._id)) || 0)));
      availableQuantity += available;
      const count = Math.min(available, remaining);
      if (count > 0) allocations.push({ batchId: batch._id, inventoryItemId: product.inventoryItemId, batchNumber: batch.batchNumber, expiryDate: batch.expiryDate,
        importPrice: Number(batch.importPrice || 0), quantity: count,
        ...(group.discount ? { discountId: group.discount._id, discountQuantity: count, discountAmount: count * unitDiscount } : {}) });
      remaining -= count;
    }
    const publicAllocation = allocations.map(row => ({ expiryDate: row.expiryDate, quantity: row.quantity, originalPrice: price, unitPrice: price - unitDiscount, subtotal: row.quantity * (price - unitDiscount) }));
    const fingerprint = createHash('sha256').update(JSON.stringify({ choice, quantity, price, unitDiscount, lots: allocations.map(row => [String(row.batchId), row.expiryDate, row.quantity]) })).digest('hex');
    return { choice, lineKey: choiceKey(product._id, choice), label: choiceLabel(choice), quantity, availableQuantity, canFulfill: remaining === 0,
      originalPrice: price, price: price - unitDiscount, percent: Number(group.discount?.value || 0),
      subtotal: price * quantity, discountAmount: unitDiscount * quantity, total: (price - unitDiscount) * quantity,
      expiries: publicAllocation, quoteFingerprint: fingerprint, allocations,
      discount: group.discount ? { discount_id: group.discount._id, code: group.discount.code, scope: 'batch', type: 'percent', value: group.discount.value,
        batchId: group.discount.batchId, eligibleQuantity: quantity, discount_amount: unitDiscount * quantity,
        batchBreakdown: allocations.map(row => ({ productId: product._id, batchId: row.batchId, quantity: row.quantity, expiryDate: row.expiryDate, baseAmount: price * row.quantity })) } : null };
  }
  publicQuote(quote) {
    const { allocations: _allocations, discount: _discount, ...safe } = quote;
    return safe;
  }
  async options(productId, quantity = 1, options = {}) {
    const product = await this.db.collection('products').findOne({ _id: toObjectId(productId), status: 'active' }, { session: options.session });
    if (!product) throw new ApiError(404, 'Sản phẩm không còn khả dụng');
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10000) throw new ApiError(400, 'Số lượng không hợp lệ');
    const groups = await this.groups(product, options);
    const choices = groups.map(group => this.publicQuote(this.quoteGroup(product, group, quantity, options)));
    return { productId: product._id, longMinDays: read('EXPIRY_LONG_MIN_DAYS'), choices,
      defaultChoice: choices.find(row => row.choice.group === 'long')?.choice || choices.find(row => row.choice.group === 'other')?.choice || null };
  }
  async quote(product, value, quantity, options = {}) {
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10000) throw new ApiError(400, 'Số lượng không hợp lệ');
    const choice = normalizeChoice(value);
    const group = (await this.groups(product, options)).find(row => choiceKey(product._id, row.choice) === choiceKey(product._id, choice));
    if (!group) throw new ApiError(409, 'Nhóm hạn dùng đã hết hàng hoặc ưu đãi không còn hiệu lực. Vui lòng tự chọn lại.', 'EXPIRY_CHOICE_UNAVAILABLE');
    // Preserve a stricter previously accepted minimum if configuration changes.
    if (choice.group === 'long') group.lots = group.lots.filter(row => classifyExpiry(row.batch.expiryDate, options.now || new Date()).daysRemaining >= choice.minRemainingDays);
    group.choice = choice;
    const quote = this.quoteGroup(product, group, quantity, options);
    if (!quote.canFulfill) throw new ApiError(409, 'Số lượng vượt tồn của nhóm hạn dùng đã chọn. Không tự chuyển sang nhóm khác.', 'EXPIRY_CHOICE_STOCK');
    return quote;
  }
  async assertAllocation(item, { session, now = new Date(), capture = false, committedAt } = {}) {
    if (!item.expiryChoice) return;
    const choice = normalizeChoice(item.expiryChoice);
    // Shipping honors the minimum accepted on this order, even when an admin
    // subsequently tightens the default for new orders.
    if (!capture && choice.group === 'long' && Number.isSafeInteger(item.expiryChoice.minRemainingDays) && item.expiryChoice.minRemainingDays > 0)
      choice.minRemainingDays = item.expiryChoice.minRemainingDays;
    for (const allocation of item.batchAllocations || []) {
      const batch = await this.db.collection('inventory_batches').findOne({ _id: toObjectId(allocation.batchId), inventoryItemId: toObjectId(item.inventoryItemId) }, { session });
      if (!batch || !['available', 'sold_out'].includes(batch.status) || +new Date(batch.expiryDate) !== +new Date(allocation.expiryDate)
        || !(classifyExpiry(batch.expiryDate, now).daysRemaining > 0)
        || (choice.group === 'long' && classifyExpiry(batch.expiryDate, capture ? now : committedAt || now).daysRemaining < choice.minRemainingDays)) {
        throw new ApiError(409, 'Lô đã không còn đáp ứng hạn dùng đã xác nhận. Không được tự đổi lô.', 'EXPIRY_CHOICE_CHANGED');
      }
    }
    if (capture && choice.group === 'promotion') {
      const discount = await this.db.collection('discounts').findOne({ _id: toObjectId(choice.discountId) }, { session });
      const proposal = discount ? await this.db.collection('promotion_proposals').findOne({ _id: discount.proposalId, discountId: discount._id, approvalStatus: 'approved' }, { session }) : null;
      // A sold-out/quota-exhausted proposal can close after this order reserved
      // its units. That closure does not revoke this already counted hold.
      const exhaustedHold = proposal?.status === 'expired' && Number(discount?.usedQuantity) >= Number(discount?.batchQuantity);
      if (!discount || !proposal || !(discount.status === 'active' && proposal.open || exhaustedHold)
        || discount.scope !== 'batch' || !discount.isPublic
        || !(discount.applicable?.productIds || []).some(id => String(id) === String(item.productId || item.product_id))
        || !(discount.applicable?.batchIds || []).some(id => String(id) === String(discount.batchId))
        || String(proposal.batchId) !== String(discount.batchId)
        || (item.batchAllocations || []).some(row => String(row.batchId) !== String(discount.batchId))
        || String(proposal.productId) !== String(item.productId || item.product_id)
        || new Date(discount.startDate) > now || new Date(discount.endDate) <= now || Number(discount.value) !== Number(item.expiryOffer?.value))
        throw new ApiError(409, 'Ưu đãi đã thay đổi trước thanh toán. Vui lòng kiểm tra lại.', 'EXPIRY_CHOICE_CHANGED');
    }
  }
}
module.exports = ExpiryChoiceService;
