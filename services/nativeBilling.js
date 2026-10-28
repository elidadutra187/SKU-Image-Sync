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
    && cents(process.env.NUVEMSHOP_ONE_TIME_PRICE)===7990
    && (process.env.NUVEMSHOP_BILLING_CURRENCY || 'BRL')==='BRL'
    && process.env.NUVEMSHOP_BILLING_MODEL==='usage_once'
    && process.env.NUVEMSHOP_NATIVE_BILLING==='true');
}
export function platformBillingConfigured(){return Boolean(process.env.NUVEMSHOP_CLIENT_SECRET&&/^\d+$/.test(process.env.NUVEMSHOP_CLIENT_ID||''));}
export async function knownPlatformStore({storeId}){
 const pool=getPool();if(!pool)throw Error('database_unavailable');await initializeDatabase();
 return (await pool.query('select store_id from stores where store_id=$1',[storeId])).rows.length===1;
}
export async function grantPlatformPaidAccess({storeId,chargeId,receipt},poolProvider=getPool,initialize=initializeDatabase){
 const pool=poolProvider();if(!pool)throw Error('database_unavailable');await initialize();
 const {rows}=await pool.query(`with confirmed as (
  insert into image_sync_native_receipts(charge_id,store_id,app_id,amount_value,amount_currency,from_date,to_date)
  select $2,$1,$3,$4,$5,$6,$7 from stores where store_id=$1
  on conflict(charge_id) do update set charge_id=excluded.charge_id
  where image_sync_native_receipts.store_id=excluded.store_id
   and image_sync_native_receipts.app_id=excluded.app_id
   and image_sync_native_receipts.amount_value=excluded.amount_value
   and image_sync_native_receipts.amount_currency=excluded.amount_currency
   and image_sync_native_receipts.from_date=excluded.from_date
   and image_sync_native_receipts.to_date=excluded.to_date
  returning store_id
 ) insert into image_sync_access(store_id,paid_at,payment_reference)
 select store_id,now(),$2 from confirmed
 on conflict(store_id) do update set paid_at=coalesce(image_sync_access.paid_at,excluded.paid_at),payment_reference=coalesce(image_sync_access.payment_reference,excluded.payment_reference)
 returning store_id`,[storeId,chargeId,receipt.appId,receipt.amountValue,receipt.amountCurrency,receipt.fromDate,receipt.toDate]);
 if(!rows.length)throw Error('native_receipt_not_applied');
}
async function isExpectedCharge({storeId,chargeId}){
  const pool=getPool();if(!pool)throw new Error('database_unavailable');await initializeDatabase();
  const {rows}=await pool.query('select charge_id,status from image_sync_purchase where store_id=$1',[storeId]);
  if(rows[0]?.status==='creating')throw new Error('charge_creation_pending');
  return rows[0]?.charge_id===chargeId;
}
async function grantPaidAccess({storeId,chargeId}) {
  const pool=getPool();if(!pool)throw new Error('database_unavailable');
  await initializeDatabase();
  const {rows}=await pool.query(`
    with confirmed as (
      update image_sync_purchase set status='paid',updated_at=now()
      where store_id=$1 and charge_id=$2 and exists(select 1 from stores where store_id=$1)
      returning store_id
    )
    insert into image_sync_access (store_id,paid_at,payment_reference)
    select $1,now(),$2 from confirmed
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
    const mode=options.mode??process.env.NUVEMSHOP_BILLING_MODEL??'platform_once';
    const price=cents(options.price ?? process.env.NUVEMSHOP_ONE_TIME_PRICE??'79.90');
    const configured=options.secret ? true : mode==='platform_once'?platformBillingConfigured():nativeBillingConfigured();
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
      || !(mode==='platform_once'&&!options.currency?['BRL','ARS'].includes(charge?.amount_currency):charge?.amount_currency===(options.currency ?? process.env.NUVEMSHOP_BILLING_CURRENCY ?? 'BRL'))
      || charge?.concept_code!==(options.concept ?? process.env.NUVEMSHOP_BILLING_CONCEPT ?? 'app-cost')) {
      return res.json({success:true,ignored:true});
    }
    try {
      if(mode==='platform_once'){
        const from=Date.parse(charge.from_date),to=Date.parse(charge.to_date);
        if(typeof charge.from_date!=='string'||typeof charge.to_date!=='string'||!Number.isFinite(from)||!Number.isFinite(to)||to<=from)return res.json({success:true,ignored:true});
        if(!await (options.isKnownStore||knownPlatformStore)({storeId}))return res.status(503).json({success:false});
        await (options.grant||grantPlatformPaidAccess)({storeId,chargeId,receipt:{appId,amountValue:price/100,amountCurrency:charge.amount_currency,fromDate:new Date(from).toISOString(),toDate:new Date(to).toISOString()}});
        return res.json({success:true});
      }
      if(!await (options.isExpectedCharge || isExpectedCharge)({storeId,chargeId}))return res.json({success:true,ignored:true});
      await (options.grant || grantPaidAccess)({storeId,chargeId});
      return res.json({success:true});
    }catch{return res.status(503).json({success:false});}
  };
}

export async function registerBillingWebhooks(client) {
  if(!platformBillingConfigured()&&!nativeBillingConfigured())return;
  const base=process.env.APP_URL || process.env.RENDER_EXTERNAL_URL;
  if(!base || new URL(base).protocol!=='https:')throw new Error('billing_url_not_configured');
  const url=new URL('/webhooks/billing',base).href;
  const list=await client.request('/webhooks');
  const events=['charge/paid','charge/failed'];
  for(const event of events) {
    if(list.some(hook=>hook.event===event && hook.url===url))continue;
    await client.request('/webhooks',{method:'POST',body:JSON.stringify({event,url})});
  }
  // After an address change, retire this app's billing webhooks still pointing to the old host.
  for(const hook of list) {
    if(events.includes(hook.event) && /\/webhooks\/billing$/.test(String(hook.url)) && hook.url!==url && hook.id!=null)
      await client.request(`/webhooks/${hook.id}`,{method:'DELETE'});
  }
}

// Re-points billing webhooks of every connected store, e.g. after APP_URL moves to a new domain.
export async function refreshAllBillingWebhooks({listStoreIds,clientFor,log=console}) {
  if(!platformBillingConfigured()&&!nativeBillingConfigured())return 0;
  let updated=0;
  for(const id of await listStoreIds()) {
    try { await registerBillingWebhooks(await clientFor(id)); updated++; }
    catch { log.error('Atualização de webhooks de cobrança pendente para uma loja.'); }
  }
  return updated;
}
