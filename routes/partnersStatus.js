import crypto from 'node:crypto';
import {Router} from 'express';
import {getPool,initializeDatabase} from '../services/database.js';

const states=new Set(['paid','free','unpaid','cancelled','suspended']);
const blockedStates=new Set(['unpaid','cancelled','suspended']);
const month=30*86400000;

export async function applyPartnersStatus({storeId,state,paidAt},{poolProvider=getPool,initialize=initializeDatabase}={}){
  const pool=poolProvider();
  if(!pool)throw new Error('database_unavailable');
  await initialize();
  const blocked=blockedStates.has(state);
  const paidUntil=state==='paid'?new Date(Date.parse(paidAt)+month).toISOString():null;
  const {rows}=await pool.query(`
    insert into image_sync_monthly as current
      (store_id,lifecycle,platform_suspended,partners_free,partners_paid_until,last_blocked_at)
    select store_id,$2,$3,$4,$5,case when $3 then statement_timestamp() end from stores where store_id=$1
    on conflict(store_id) do update set lifecycle=excluded.lifecycle,
      platform_suspended=excluded.platform_suspended,
      partners_free=excluded.partners_free,partners_paid_until=excluded.partners_paid_until,
      paid_until=case when excluded.platform_suspended then null else current.paid_until end,
      last_charge_id=case when excluded.platform_suspended then null else current.last_charge_id end,
      last_blocked_at=coalesce(excluded.last_blocked_at,current.last_blocked_at),
      updated_at=statement_timestamp()
    where excluded.platform_suspended
      or (not current.platform_suspended and current.lifecycle='active')
      -- A NEW Partners payment can restore a previously suspended subscription.
      -- A stale payment from before the most recent block cannot do so.
      or ($2='active' and $5::timestamptz is not null
        and $6::timestamptz>coalesce(current.last_blocked_at,'-infinity'::timestamptz))
    returning store_id,lifecycle,platform_suspended,partners_free,partners_paid_until
  `,[storeId,blocked?state:'active',blocked,state==='free',paidUntil,state==='paid'?paidAt:null]);
  const row=rows[0];
  if(!row || row.lifecycle!==(blocked?state:'active') || row.platform_suspended!==blocked
    || row.partners_free!==(state==='free')
    || (row.partners_paid_until?new Date(row.partners_paid_until).toISOString():null)!==paidUntil) return null;
  return {storeId,state,paidUntil};
}

export function createPartnersStatusRouter({apply=applyPartnersStatus,token=()=>process.env.BILLING_ADMIN_TOKEN,now=Date.now}={}){
  const router=Router();
  router.post('/partners-status',async(req,res)=>{
    const expected=Buffer.from(token()||'');
    const provided=Buffer.from(req.get('X-Admin-Token')||'');
    if(!expected.length||provided.length!==expected.length||!crypto.timingSafeEqual(provided,expected))
      return res.status(403).json({success:false,error:'forbidden'});
    const {storeId,state,paidAt}=req.body||{};
    const paidTime=Date.parse(paidAt);
    const time=now();
    if(!req.is('application/json') || !['string','number'].includes(typeof storeId)
      || !/^[1-9][0-9]{0,19}$/.test(String(storeId)) || !states.has(state)
      || (state==='paid' && (typeof paidAt!=='string' || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}T/.test(paidAt)
        || !Number.isFinite(paidTime) || paidTime>time || paidTime<=time-month)))
      return res.status(400).json({success:false,error:'invalid_partners_status'});
    try{
      const result=await apply({storeId:String(storeId),state,paidAt});
      if(!result)return res.status(409).json({success:false,error:'partners_status_not_applied'});
      return res.json({success:true,...result});
    }catch{
      return res.status(503).json({success:false,error:'partners_status_unavailable'});
    }
  });
  return router;
}
