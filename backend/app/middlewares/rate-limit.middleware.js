const { rateLimit } = require("express-rate-limit");

function createLimiter({ windowMs, limit, message }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { message },
  });
}

const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: "Quá nhiều yêu cầu xác thực, vui lòng thử lại sau",
});

const publicWriteLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: "Quá nhiều yêu cầu, vui lòng thử lại sau",
});

const aiLimiter = createLimiter({
  windowMs: 60 * 1000,
  limit: 20,
  message: "Bạn đang gửi câu hỏi quá nhanh, vui lòng thử lại sau",
});

const dosageLimiter=createLimiter({windowMs:60000,limit:require('../config/dosage-calculator').requestsPerMinute,message:'Bạn đang tính hoặc tải dữ liệu quá nhanh. Vui lòng thử lại sau một phút.'});
const subscriptionLimiter = createLimiter({ windowMs: 60000, limit: 120, message: "Bạn đang gửi yêu cầu đăng ký quá nhanh. Vui lòng thử lại sau một phút." });
module.exports = { aiLimiter, authLimiter, publicWriteLimiter, dosageLimiter, subscriptionLimiter };
