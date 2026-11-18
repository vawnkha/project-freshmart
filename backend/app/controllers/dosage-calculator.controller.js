const MongoDB=require('../utils/mongodb.util');
const DosageCalculatorService=require('../services/dosage-calculator.service');
exports.eligible=async(req,res,next)=>{try{res.send(await new DosageCalculatorService(MongoDB.client).eligible(req.query));}catch(error){next(error);}};
exports.product=async(req,res,next)=>{try{res.send({data:await new DosageCalculatorService(MongoDB.client).getProduct(req.params.id)});}catch(error){next(error);}};
exports.calculate=async(req,res,next)=>{try{res.send({success:true,data:await new DosageCalculatorService(MongoDB.client).calculate(req.body)});}catch(error){next(error);}};
