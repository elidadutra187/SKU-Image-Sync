import crypto from 'node:crypto';
import {getPool,initializeDatabase} from './database.js';
import {grantMonthlyReceipt,updateMonthlyLifecycle,setMonthlySuspended} from './monthlyBilling.js';

function cents(value) {
  const text=String(value ?? '');
  if(!/^\d+(\.\d{1,2})?$/.test(text))return null;
  const result=Math.round(Number(text)*100);
  return Number.isSafeInteger(result) && result>0 ? result : null;
}
export function nativeBillingConfigured() {
  return Boolean(process.env.NUVEMSHOP_CLIENT_SECRET && process.env.NUVEMSHOP_CLIENT_ID
    && cents(process.env.NUVEMSHOP_ONE_TIME_PRICE)===7999
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
    const configuredPrice=options.price ?? (mode==='platform_monthly' ? process.env.NUVEMSHOP_MONTHLY_PRICE : process.env.NUVEMSHOP_ONE_TIME_PRICE);
    const price=cents(configuredPrice??(mode==='platform_monthly'?'39.90':'79.99'));
    const configured=options.secret ? true : ['platform_once','platform_monthly'].includes(mode)?platformBillingConfigured():nativeBillingConfigured();
    if(!secret || !appId || !price || !configured)return res.status(503).json({success:false});
    const body=Buffer.isBuffer(req.body)?req.body:req.rawBody;
    const signature=req.get('x-linkedstore-hmac-sha256') || '';
    if(!body || !/^[a-f0-9]{64}$/i.test(signature))return res.status(401).json({success:false});
    const expected=crypto.createHmac('sha256',secret).update(body).digest();
    if(!crypto.timingSafeEqual(expected,Buffer.from(signature,'hex')))return res.status(401).json({success:false});
    let event;try{event=JSON.parse(body.toString('utf8'));}catch{return res.status(400).json({success:false});}
    if(mode==='platform_monthly' && ['app_subscription/updated','app/suspended','app/resumed'].includes(event?.event)) {
      // Subscription lifecycle events are app-specific; charge events are store-wide.
      if(String(event?.id)!==appId || !/^[1-9]\\d*$/.test(String(event.store_id||'')))
        return res.json({success:true,ignored:true});
      try {
        const storeId=String(event.store_id);
        if(!await (options.isKnownStore||knownPlatformStore)({storeId}))
          return res.status(503).json({success:false});
        if(event.event==='app_subscription/updated') {
          if(!['installed','uninstalled','churn','phoenix','plan_changed'].includes(event.topic))
            return res.json({success:true,ignored:true});
          await (options.subscriptionEvent||updateMonthlyLifecycle)({storeId,topic:event.topic});
        } else await (options.suspensionEvent||setMonthlySuspended)({storeId,suspended:event.event==='app/suspended'});
        return res.json({success:true});
      } catch {return res.status(503).json({success:false});}
    }
    // Store-wide charge events must always be scoped to our own app.
    if(String(event?.app_id)!==appId || event.event!=='charge/paid')return res.json({success:true,ignored:true});
    const charge=event.charge,storeId=String(event.store_id || ''),chargeId=String(event.id || '');
    const receivedPrice=cents(charge?.amount_value);
    // This price change is for BRL only. Keep the previous ARS contract unchanged.
    const expectedPrice=mode==='platform_once' && options.price==null && charge?.amount_currency==='ARS'?7990:price;
    // Recognize both authorized BRL prices even if the old environment value remains.
    const platformBrlPrice=mode==='platform_once' && charge?.amount_currency==='BRL'
      && [7990,7999].includes(expectedPrice);
    // Nuvemshop prorates the first period to its billing anchor. Do not reject legitimate partial payments.
    const monthlyProrated=mode==='platform_monthly' && charge?.amount_currency==='BRL'
      && Number.isInteger(receivedPrice) && receivedPrice>0 && receivedPrice<=price;
    // Payments from the retired one-time model are still permanent licences, even if delivered late.
    const oldFixedCharge=mode==='platform_monthly' && charge?.amount_currency==='BRL' && [7990,7999].includes(receivedPrice);
    const acceptedPrice=monthlyProrated || oldFixedCharge || (platformBrlPrice?[7990,7999].includes(receivedPrice):receivedPrice===expectedPrice);
    if(!/^[1-9]\d*$/.test(storeId) || !chargeId || chargeId.length>128
      || String(charge?.id)!==chargeId || !acceptedPrice
      || !(mode==='platform_once'&&!options.currency?['BRL','ARS'].includes(charge?.amount_currency):charge?.amount_currency===(options.currency ?? process.env.NUVEMSHOP_BILLING_CURRENCY ?? 'BRL'))
      || charge?.concept_code!==(options.concept ?? process.env.NUVEMSHOP_BILLING_CONCEPT ?? 'app-cost')) {
      return res.json({success:true,ignored:true});
    }
    try {
      if(mode==='platform_once'||mode==='platform_monthly'){
        const from=Date.parse(charge.from_date),to=Date.parse(charge.to_date);
        if(typeof charge.from_date!=='string'||typeof charge.to_date!=='string'||!Number.isFinite(from)||!Number.isFinite(to)||to<=from)return res.json({success:true,ignored:true});
        if(!await (options.isKnownStore||knownPlatformStore)({storeId}))return res.status(503).json({success:false});
        const receipt={appId,amountValue:receivedPrice/100,amountCurrency:charge.amount_currency,
          fromDate:new Date(from).toISOString(),toDate:new Date(to).toISOString()};
        if(mode==='platform_monthly'&&!oldFixedCharge){
          if(to-from>62*86400000)return res.json({success:true,ignored:true});
          await (options.grantMonthly||grantMonthlyReceipt)({storeId,chargeId,receipt});
        } else await (options.grant||grantPlatformPaidAccess)({storeId,chargeId,receipt});
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
  if(process.env.NUVEMSHOP_BILLING_MODEL==='platform_monthly')
    events.push('app_subscription/updated','app/suspended','app/resumed','subscription/updated');
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

const permanentStoreRefusal=error=>[401,402,403,404].includes(error?.status)||/^Missing environment variables: .*OAuth/.test(String(error?.message));

// Re-points billing webhooks of every connected store, e.g. after APP_URL moves to a new domain.
export async function refreshAllBillingWebhooks({listStoreIds,clientFor,log=console,failOnPartial=false}) {
  if(!platformBillingConfigured()&&!nativeBillingConfigured())return 0;
  let updated=0,failed=0,refused=0;
  for(const id of await listStoreIds()) {
    try { await registerBillingWebhooks(await clientFor(id)); updated++; }
    catch(error) {
      // Uninstalled, unpaid or token-less stores refuse every attempt: retrying them every 5 minutes
      // only kept the Neon compute awake. They are rechecked on the next idle (daily) scan.
      if(permanentStoreRefusal(error)){refused++;continue;}
      failed++; log.error('Atualização de webhooks de cobrança pendente para uma loja.');
    }
  }
  // Lets the reconciler retry soon instead of waiting for the next idle scan, for transient errors only.
  if(failOnPartial&&failed)throw Object.assign(Error('billing_webhooks_pending'),{updated,failed,refused});
  return updated;
}
