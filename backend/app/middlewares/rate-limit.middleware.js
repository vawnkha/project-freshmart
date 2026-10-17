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

module.exports = { aiLimiter, authLimiter, publicWriteLimiter };
