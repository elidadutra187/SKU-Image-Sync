import {Router} from 'express';
import crypto from 'node:crypto';
import redactStore from '../services/storeData.js';

export function createPrivacyRouter({secret=()=>process.env.NUVEMSHOP_CLIENT_SECRET,redact=redactStore}={}) {
  const router=Router();
  for(const action of ['store-redact','customers-redact','customers-data-request']) {
    router.post('/'+action,async(req,res)=>{
      const key=secret();if(!key)return res.status(503).json({success:false});
      const body=Buffer.isBuffer(req.body)?req.body:req.rawBody;
      const signature=req.get('x-linkedstore-hmac-sha256') || '';
      if(!body || !/^[a-f0-9]{64}$/i.test(signature))return res.status(401).json({success:false});
      const expected=crypto.createHmac('sha256',key).update(body).digest();
      if(!crypto.timingSafeEqual(expected,Buffer.from(signature,'hex')))return res.status(401).json({success:false});
      let payload;try{payload=JSON.parse(body.toString('utf8'));}catch{return res.status(400).json({success:false});}
      if(!/^[1-9]\d*$/.test(String(payload?.store_id || '')))return res.status(400).json({success:false});
      try {
        if(action==='store-redact'){await redact(String(payload.store_id));return res.json({success:true,action,deleted:true});}
        // No customer/order records are collected. Never echo the request's personal data.
        return res.json({success:true,action,customerDataStored:false});
      }catch{return res.status(503).json({success:false});}
    });
  }
  router.get('/status',(req,res)=>res.json({success:true,webhooks:['POST /webhooks/store-redact','POST /webhooks/customers-redact','POST /webhooks/customers-data-request']}));
  return router;
}
export default createPrivacyRouter();
