import crypto from 'node:crypto';
import {getPool,initializeDatabase} from './database.js';

function cents(value) {
  const text=String(value ?? '');
  if(!/^\d+(\.\d{1,2})?$/.test(text))return null;
  const result=Math.round(Number(text)*100);
  return Number.isSafeInteger(result) && result>0 ? result : null;
}
export function nativeBillingConfigured() {
  return Boolean(process.env.NUVEMSHOP_CLIENT_SECRET && process.env.NUVEMSHOP_CLIENT_ID
    && cents(process.env.NUVEMSHOP_ONE_TIME_PRICE) && process.env.NUVEMSHOP_NATIVE_BILLING==='true');
}
async function grantPaidAccess({storeId,chargeId}) {
  const pool=getPool();if(!pool)throw new Error('database_unavailable');
  await initializeDatabase();
  const {rows}=await pool.query(`
    insert into image_sync_access (store_id,paid_at,payment_reference)
    select $1,now(),$2 where exists (select 1 from stores where store_id=$1)
    on conflict (store_id) do update set
      paid_at=coalesce(image_sync_access.paid_at,excluded.paid_at),
      payment_reference=coalesce(image_sync_access.payment_reference,excluded.payment_reference)
    returning store_id`,[storeId,chargeId]);
  if(!rows.length)throw new Error('unknown_store');
}

export function createBillingWebhook(options={}) {
  return async(req,res)=>{
    const secret=options.secret ?? process.env.NUVEMSHOP_CLIENT_SECRET;
    const appId=String(options.appId ?? process.env.NUVEMSHOP_CLIENT_ID ?? '');
    const price=cents(options.price ?? process.env.NUVEMSHOP_ONE_TIME_PRICE);
    const configured=options.secret ? true : nativeBillingConfigured();
    if(!secret || !appId || !price || !configured)return res.status(503).json({success:false});
    const body=Buffer.isBuffer(req.body)?req.body:req.rawBody;
    const signature=req.get('x-linkedstore-hmac-sha256') || '';
    if(!body || !/^[a-f0-9]{64}$/i.test(signature))return res.status(401).json({success:false});
    const expected=crypto.createHmac('sha256',secret).update(body).digest();
    if(!crypto.timingSafeEqual(expected,Buffer.from(signature,'hex')))return res.status(401).json({success:false});
    let event;try{event=JSON.parse(body.toString('utf8'));}catch{return res.status(400).json({success:false});}
    // Events belong to the store, so other apps' charges must always be ignored.
    if(String(event?.app_id)!==appId || event.event!=='charge/paid')return res.json({success:true,ignored:true});
    const charge=event.charge,storeId=String(event.store_id || ''),chargeId=String(event.id || '');
    if(!/^[1-9]\d*$/.test(storeId) || !chargeId || chargeId.length>128
      || String(charge?.id)!==chargeId || cents(charge?.amount_value)!==price
      || charge?.amount_currency!==(options.currency ?? process.env.NUVEMSHOP_BILLING_CURRENCY ?? 'BRL')
      || charge?.concept_code!==(options.concept ?? process.env.NUVEMSHOP_BILLING_CONCEPT ?? 'plan-cost')) {
      return res.json({success:true,ignored:true});
    }
    try {
      await (options.grant || grantPaidAccess)({storeId,chargeId});
      return res.json({success:true});
    }catch{return res.status(503).json({success:false});}
  };
}

export async function registerBillingWebhooks(client) {
  if(!nativeBillingConfigured())return;
  const base=process.env.APP_URL || process.env.RENDER_EXTERNAL_URL;
  if(!base || new URL(base).protocol!=='https:')throw new Error('billing_url_not_configured');
  const url=new URL('/webhooks/billing',base).href;
  const list=await client.request('/webhooks');
  for(const event of ['charge/paid','charge/failed']) {
    if(list.some(hook=>hook.event===event && hook.url===url))continue;
    await client.request('/webhooks',{method:'POST',body:JSON.stringify({event,url})});
  }
}
