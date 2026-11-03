import {getPool,initializeDatabase} from './database.js';
// Privileged reconciliation only. Never expose this writer as a public webhook
// or accept a merchant claim in place of a receipt checked in Partners.
export async function recordPartnerPaymentEvidence(input,{query,appId=process.env.NUVEMSHOP_CLIENT_ID}={}){
 if(input?.source!=='nuvemshop_partners_commissions'||input.status!=='paid'||String(input.appId)!==String(appId)||
  !/^\d+$/.test(String(input.creditId))||!/^\d+$/.test(String(input.storeId))||
  !/^https:\/\/partners\.nuvemshop\.com\.br\/payments\/details\/[a-f0-9-]{36}$/.test(input.url||'')||
  !/^\d{4}-\d{2}-\d{2}$/.test(input.paymentDate||'')||!Number.isInteger(input.contractedDays)||input.contractedDays<1||input.contractedDays>45||
  !Number.isFinite(input.grossPaidBRL)||input.grossPaidBRL<=0||!['BRL','ARS','MXN','COP','CLP'].includes(input.nativeCurrency)||!Number.isFinite(input.nativeAmount)||input.nativeAmount<=0)throw Error('invalid_partners_payment_evidence');
 const evidence={source:input.source,status:'paid',creditId:String(input.creditId),storeId:String(input.storeId),appId:String(appId),url:input.url,paymentDate:input.paymentDate,contractedDays:input.contractedDays,grossPaidBRL:input.grossPaidBRL,nativeCurrency:input.nativeCurrency,nativeAmount:input.nativeAmount,nativeFrom:null,nativeTo:null};
 if(!query){await initializeDatabase();const pool=getPool();if(!pool)throw Error('database_unavailable');query=(...args)=>pool.query(...args);}
 const result=await query(`INSERT INTO image_sync_partner_receipts(credit_id,store_id,app_id,evidence)
  VALUES($1,$2,$3,$4::jsonb) ON CONFLICT(credit_id) DO UPDATE SET credit_id=excluded.credit_id
  WHERE image_sync_partner_receipts.store_id=excluded.store_id AND image_sync_partner_receipts.app_id=excluded.app_id AND image_sync_partner_receipts.evidence=excluded.evidence
  RETURNING credit_id`,[evidence.creditId,evidence.storeId,evidence.appId,JSON.stringify(evidence)]);
 if(!result.rows?.length)throw Error('partners_credit_already_bound');
 return evidence;
}
