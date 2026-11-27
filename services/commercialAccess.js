import {getPool, initializeDatabase} from './database.js';
import {platformBillingConfigured} from './nativeBilling.js';
import {configuredTrialDays} from './monthlyBilling.js';
import {getYampiPaymentRuntime} from './yampiPaymentRuntime.js';
export const DEMO_PRODUCTS = 10;
export const DEMO_IMAGES = 10;
export const DEMO_BATCHES = 1;

function denied(message,status=402) { return Object.assign(new Error(message),{status}); }
// This decision is shared by the read-only status and every batch authorization.
// API availability is a separate backend decision: a ledger grant cannot bypass an API refusal.
function commercialDecision(access) {
  if(access.storeInstalled===false)return {allowed:false,accessReason:'store_not_installed',accessStatus:'unverified'};
  if(access.platformSuspended)return {allowed:false,accessReason:'platform_blocked',accessStatus:'suspended'};
  if(access.paid)return {allowed:true,accessReason:'paid',accessStatus:'paid'};
  if(access.courtesyActive)return {allowed:true,accessReason:'courtesy',accessStatus:'paid'};
  if(access.purchaseMode==='platform_monthly') {
    if(access.subscriptionState===null)return {allowed:false,accessReason:'unverified',accessStatus:'unverified'};
    return access.trialActive
      ?{allowed:true,accessReason:'trial_active',accessStatus:'trial_active'}
      :{allowed:false,accessReason:'trial_expired',accessStatus:'payment_unconfirmed'};
  }
  return access.demoBatchesUsed<DEMO_BATCHES
    ?{allowed:true,accessReason:'demo_available',accessStatus:'demo_available'}
    :{allowed:false,accessReason:'demo_exhausted',accessStatus:'payment_unconfirmed'};
}
function logDecision(storeId,decision,source='commercial_ledger') {
  console.info(JSON.stringify({event:'access_decision',store_id:String(storeId),allowed:decision.allowed,
    reason:decision.accessReason,source,timestamp:new Date().toISOString()}));
}
const paidAccessMessage=access=>access.purchaseMode==='platform_monthly'
  ? 'O período de teste ou a assinatura terminou. Regularize o Imagem em Lote na Nuvemshop para voltar a enviar imagens.'
  : 'Seu lote gratuito já foi utilizado. Confirme o pagamento para enviar novos lotes.';

const transientConnectionCodes = new Set(['08000','08001','08003','08006','57P01','57P02','57P03',
  'ECONNRESET','ECONNREFUSED','ETIMEDOUT','EAI_AGAIN','EPIPE']);

async function readAccessWithRetry(read,storeId) {
  try { return await read(); }
  catch (error) {
    if (!transientConnectionCodes.has(error?.code)) throw error;
  }
  await new Promise(resolve=>setTimeout(resolve,250));
  try { return await read(); }
  catch (error) {
    if (!transientConnectionCodes.has(error?.code)) throw error;
    const id=String(storeId);
    console.warn(JSON.stringify({event:'billing_verification_temporarily_unavailable',
      storeId:/^[0-9]{1,20}$/.test(id)?id:undefined,reason:error.code}));
    throw denied('Não foi possível verificar seu acesso. Tente novamente mais tarde.',503);
  }
}
export function validateBatchAccess(access,count,imageCount=count) {
  const decision=commercialDecision(access);
  if(decision.accessReason==='store_not_installed')throw denied('Conecte sua loja para continuar.',401);
  if(decision.accessReason==='platform_blocked')throw denied('O acesso da loja está suspenso na Nuvemshop.');
  if (!Number.isInteger(count) || count < 1) throw denied('Selecione ao menos um produto.',400);
  if (count > 50) throw denied('Envie até 50 produtos por lote.',400);
  if(decision.accessReason==='unverified')throw denied('Não foi possível verificar seu acesso. Tente novamente mais tarde.',503);
  if(!decision.allowed) {
    if(decision.accessReason==='trial_expired')throw denied('O período de teste terminou. Regularize a assinatura na Nuvemshop para enviar novas imagens.');
    throw denied(paidAccessMessage(access));
  }
  if(decision.accessReason!=='demo_available')return;
  if (!Number.isInteger(imageCount) || imageCount < 1 || imageCount > DEMO_IMAGES) throw denied('O lote gratuito permite no máximo 10 imagens. Selecione até 10 fotos para continuar.');
}

// Separate from OAuth records: reconnecting does not grant another free batch.
export function createPostgresAccessRepository(poolProvider=getPool,initialize=initializeDatabase) { return {
  async pool() {
    const pool=poolProvider();
    if (!pool) throw denied('Não foi possível verificar seu acesso. Tente novamente mais tarde.',503);
    await initialize();
    return pool;
  },
  async status(storeId) {
    const pool=await this.pool();
    const {rows}=await readAccessWithRetry(()=>pool.query(`select a.paid_at,a.demo_batches_used,
      case when $1::text like 'yampi:%' then true
        else exists(select 1 from stores where store_id=$1) end as store_installed,
      a.courtesy_until>statement_timestamp() as courtesy_active,p.status as purchase_status,
      m.paid_until,m.trial_until,m.lifecycle,m.partners_free,m.partners_paid_until,
      (coalesce(m.platform_suspended,false) or coalesce(m.lifecycle<>'active',false)) as platform_suspended,
      m.partners_paid_until>statement_timestamp() as partners_paid,
      ((m.paid_until>statement_timestamp() or m.official_active_at is not null) and m.lifecycle='active' and not m.platform_suspended) as monthly_paid,
      (m.trial_until>statement_timestamp() and m.lifecycle='active' and not m.platform_suspended) as trial_active
      from (select $1::text as store_id) s
      left join image_sync_access a on a.store_id=s.store_id
      left join image_sync_monthly m on m.store_id=s.store_id
      left join image_sync_purchase p on p.store_id=s.store_id`,[storeId]),storeId);
    const row=rows[0]||{};
    return {paid:(Boolean(row.paid_at)||Boolean(row.monthly_paid)||Boolean(row.partners_free)||Boolean(row.partners_paid))&&!row.platform_suspended,
      storeInstalled:row.store_installed,trialActive:Boolean(row.trial_active),courtesyActive:Boolean(row.courtesy_active)&&!row.platform_suspended,
      demoBatchesUsed:row.demo_batches_used??0,purchaseStatus:row.purchase_status||null,
      subscriptionUntil:row.partners_free?null:row.partners_paid_until||row.paid_until||null,trialUntil:row.trial_until||null,
      subscriptionState:row.lifecycle||null,platformSuspended:Boolean(row.platform_suspended)};
  },
  async reserve(storeId) {
    const pool=await this.pool();
    // A single conditional upsert serializes concurrent requests, including different instances.
    const {rows}=await pool.query(`
      insert into image_sync_access (store_id, demo_used_at, demo_batches_used)
      select $1,now(),1 where not exists(select 1 from image_sync_monthly
        where store_id=$1 and (platform_suspended or lifecycle<>'active'))
      and (not $3::boolean or exists (select 1 from image_sync_monthly
        where store_id=$1 and trial_until>statement_timestamp()
          and lifecycle='active' and not platform_suspended))
      on conflict (store_id) do update set
        demo_used_at=coalesce(image_sync_access.demo_used_at,now()),
        demo_batches_used=image_sync_access.demo_batches_used+1
      where image_sync_access.demo_batches_used < $2 and image_sync_access.paid_at is null
      returning store_id`,[storeId,DEMO_BATCHES,
        !String(storeId).startsWith('yampi:') && process.env.NUVEMSHOP_BILLING_MODEL==='platform_monthly']);
    return rows.length === 1;
  }
}; }
const postgresRepository=createPostgresAccessRepository();

export function createCommercialAccess(repository=postgresRepository) {
  return {
    async status(storeId) {
      if (!storeId) throw denied('Conecte sua loja para continuar.',401);
      let current;
      try {current=await repository.status(storeId);}
      catch {
        logDecision(storeId,{allowed:false,accessReason:'verification_unavailable'});
        throw denied('Não foi possível verificar seu acesso. Tente novamente mais tarde.',503);
      }
      if(!Number.isInteger(current.demoBatchesUsed) || current.demoBatchesUsed<0) {
        throw denied('Não foi possível verificar os lotes gratuitos. Tente novamente mais tarde.',503);
      }
      const monthly=!storeId.startsWith('yampi:') && process.env.NUVEMSHOP_BILLING_MODEL==='platform_monthly';
      const result={...current,demoUsed:monthly?false:current.demoBatchesUsed>=DEMO_BATCHES,
        demoBatches:monthly?null:DEMO_BATCHES,demoBatchesRemaining:monthly?null:Math.max(0,DEMO_BATCHES-current.demoBatchesUsed),
        demoProducts:monthly?null:DEMO_PRODUCTS,demoImages:monthly?null:DEMO_IMAGES,
        oneTimePriceCents:storeId.startsWith('yampi:')?7990:Math.round(Number(process.env.NUVEMSHOP_ONE_TIME_PRICE||'79.99')*100),
        monthlyPriceCents:Math.round(Number(process.env.NUVEMSHOP_MONTHLY_PRICE||'39.90')*100),
        trialDays:configuredTrialDays(),
        purchaseConfigured:storeId.startsWith('yampi:')?getYampiPaymentRuntime().available(storeId):platformBillingConfigured(),
        purchaseMode:storeId.startsWith('yampi:')?'mercadopago_once':process.env.NUVEMSHOP_BILLING_MODEL||'platform_once',
        paymentProvider:storeId.startsWith('yampi:')?(getYampiPaymentRuntime().available(storeId)?'mercadopago':'pending'):'nuvemshop'};
      const decision=commercialDecision(result);
      logDecision(storeId,decision);
      return {...result,...decision,storeId:String(storeId),platform:storeId.startsWith('yampi:')?'yampi':'nuvemshop',
        maxImages:decision.allowed&&!monthly&&!result.paid&&!result.courtesyActive?DEMO_IMAGES:null,
        decisionSource:'commercial_ledger',checkedAt:new Date().toISOString()};
    },
    async authorize(storeId, productIds, {dryRun=false,imageCount=productIds.length}={}) {
      const access=await this.status(storeId);
      validateBatchAccess(access,new Set(productIds.map(String)).size,imageCount);
      if (!dryRun && !access.paid && !access.courtesyActive && access.purchaseMode!=='platform_monthly' && !await repository.reserve(storeId)) {
        throw denied(paidAccessMessage(access));
      }
      return access;
    }
  };
}
export default createCommercialAccess();
