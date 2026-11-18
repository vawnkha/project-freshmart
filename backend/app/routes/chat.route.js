const express=require('express');
const {rateLimit}=require('express-rate-limit');
const auth=require('../middlewares/auth.middleware');
const validate=require('../middlewares/validate.middleware');
const schema=require('../validators/chat.validator');
const controller=require('../controllers/chat.controller');
function chatRouter(admin=false){
  const router=express.Router();router.use(auth);
  router.use(rateLimit({windowMs:60000,limit:240,standardHeaders:'draft-8',legacyHeaders:false,keyGenerator:req=>String(req.user.id),message:{message:'Thao tác chat quá nhanh. Vui lòng thử lại.'}}));
  if(admin)router.use(auth.authorizePermissions('admin:access','chat:read'));
  if(admin){
    router.get('/summary',controller.summary);router.get('/agents',controller.agents);
    router.get('/conversations',validate({query:schema.list}),controller.list);
    router.patch('/conversations/:id/status',validate({params:schema.id,body:schema.status}),controller.status);
    router.patch('/conversations/:id/assign',validate({params:schema.id,body:schema.assign}),controller.assign);
  }else router.get('/conversations/me',controller.me);
  router.post('/messages',validate({body:schema.message}),controller.send);
  router.get('/conversations/:id',validate({params:schema.id}),controller.detail);
  router.get('/conversations/:id/messages',validate({params:schema.id,query:schema.history}),controller.history);
  router.patch('/conversations/:id/read',validate({params:schema.id,body:schema.read}),controller.read);
  return router;
}
module.exports=chatRouter;
