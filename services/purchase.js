import {getPool,initializeDatabase} from './database.js';
import commercialAccess,{DEMO_BATCHES} from './commercialAccess.js';
import NuvemshopClient from './nuvemshop.js';
import {nativeBillingConfigured,registerBillingWebhooks} from './nativeBilling.js';
const fail=(message,status)=>Object.assign(new Error(message),{status,public:true});
export function createPurchaseRepository(poolProvider=getPool,initialize=initializeDatabase){return {
  async pool(){const pool=poolProvider();if(!pool)throw fail('Não foi possível verificar seu acesso. Tente novamente mais tarde.',503);await initialize();return pool;},
  async claim(storeId){const pool=await this.pool();const {rows}=await pool.query(`insert into image_sync_purchase(store_id,status)
    select $1,'creating' where exists(select 1 from stores where store_id=$1)
    and exists(select 1 from image_sync_access where store_id=$1 and demo_batches_used >= $2 and paid_at is null)
    on conflict(store_id) do nothing returning store_id`,[storeId,DEMO_BATCHES]);return rows.length===1;},
  async get(storeId){const pool=await this.pool();const {rows}=await pool.query('select status,charge_id as "chargeId" from image_sync_purchase where store_id=$1',[storeId]);return rows[0] || null;},
  async save(chargeId,storeId){const pool=await this.pool();await pool.query("update image_sync_purchase set charge_id=$1,status=case when status='paid' then status else 'pending' end,updated_at=now() where store_id=$2",[chargeId,storeId]);}
};}

// Billing POST must never inherit the catalog client's automatic retries.
export async function requestNativeCharge(client,body,appId,fetcher=fetch){
  const response=await fetcher(`${client.baseUrl}/services/${encodeURIComponent(appId)}/charges`,{
    method:'POST',signal:AbortSignal.timeout(20000),headers:{Authorization:`Bearer ${client.accessToken}`,
      'User-Agent':client.userAgent,'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!response.ok)throw new Error('native_charge_not_confirmed');
  return response.json();
}
export function createPurchaseService({repository=createPurchaseRepository(),access=commercialAccess,
  configured=nativeBillingConfigured,appId=process.env.NUVEMSHOP_CLIENT_ID,clientForStore=NuvemshopClient.fromStore,
  prepareClient=async client=>registerBillingWebhooks(client)}={}){return {
  async purchase(storeId,confirmed){
    if(confirmed!==true)throw fail('Confirme a compra única de R$79,90 por loja.',400);
    if(!configured())throw fail('A compra pela Nuvemshop ainda não está disponível. Fale com o suporte.',503);
    const current=await access.status(storeId);
    if(current.paid)return {status:'paid'};
    if(current.demoBatchesUsed<DEMO_BATCHES)throw fail(`Utilize seus ${DEMO_BATCHES} lotes gratuitos antes de comprar.`,409);
    const client=await clientForStore(storeId);
    // Register the paid notification before creating any charge.
    if(!client.requestCharge)await prepareClient(client);
    if(!await repository.claim(storeId))return await repository.get(storeId) || {status:'creating'};
    const from=new Date(),to=new Date(from.getTime()+24*60*60*1000);
    const body={description:'Imagem em Lote: acesso em pagamento único por loja',
      external_reference:`imagememlote-${appId}-${storeId}-one-time`,
      from_date:from.toISOString(),to_date:to.toISOString(),amount_value:79.90,amount_currency:'BRL',
      concept_code:process.env.NUVEMSHOP_BILLING_CONCEPT || 'app-cost'};
    try{
      const charge=client.requestCharge?await client.requestCharge(body):await requestNativeCharge(client,body,appId);
      if(!charge?.id || String(charge.id).length>128 || Number(charge.amount_value)!==79.9 || charge.amount_currency!=='BRL')throw new Error('invalid_charge_response');
      await repository.save(String(charge.id),storeId);
      return {status:'pending',chargeId:String(charge.id)};
    }catch{throw fail('Não foi possível confirmar a criação da cobrança. Fale com o suporte antes de tentar novamente.',503);}
  }
};}
export default createPurchaseService();
