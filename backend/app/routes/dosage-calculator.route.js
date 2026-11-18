const router=require('express').Router();
const controller=require('../controllers/dosage-calculator.controller');
const validate=require('../middlewares/validate.middleware');
const {calculationSchema}=require('../validators/dosage-calculator.validator');
const {dosageLimiter}=require('../middlewares/rate-limit.middleware');
router.post('/calculate',dosageLimiter,validate({body:calculationSchema}),controller.calculate);
module.exports=router;
