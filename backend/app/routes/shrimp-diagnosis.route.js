const router = require("express").Router();
const { rateLimit } = require("express-rate-limit");
const auth = require("../middlewares/auth.middleware");
const validate = require("../middlewares/validate.middleware");
const upload = require("../middlewares/shrimp-diagnosis-upload.middleware");
const controller = require("../controllers/shrimp-diagnosis.controller");
const { params, listQuery } = require("../validators/shrimp-diagnosis.validator");
router.use(auth, (req, res, next) => { res.set("Cache-Control", "private, no-store"); next(); });
router.post("/", rateLimit({ windowMs: 60000, limit: 10, standardHeaders: "draft-8", legacyHeaders: false,
  message: { message: "Bạn phân tích quá nhanh. Vui lòng thử lại sau một phút." } }), upload, controller.create);
router.get("/", validate({ query: listQuery }), controller.list);
router.get("/:id/image", validate({ params }), controller.image);
router.get("/:id", validate({ params }), controller.detail);
router.delete("/:id", validate({ params }), controller.remove);
module.exports = router;
