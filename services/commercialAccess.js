import {getPool, initializeDatabase} from './database.js';
import {nativeBillingConfigured} from './nativeBilling.js';
export const DEMO_PRODUCTS = 10;
export const DEMO_IMAGES = 10;
export const DEMO_BATCHES = 1;

function denied(message,status=402) { return Object.assign(new Error(message),{status}); }
export function validateBatchAccess(access,count,imageCount=count) {
  if (!Number.isInteger(count) || count < 1) throw denied('Selecione ao menos um produto.',400);
  if (count > 50) throw denied('Envie até 50 produtos por lote.',400);
  if (access.paid) return;
  if (access.demoBatchesUsed >= DEMO_BATCHES) throw denied('Seu lote gratuito já foi utilizado. O pagamento único de R$79,90 libera novos lotes e reutilizações.');
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
    const {rows}=await pool.query(`select a.paid_at,a.demo_batches_used,p.status as purchase_status
      from image_sync_access a left join image_sync_purchase p on p.store_id=a.store_id where a.store_id=$1`,[storeId]);
    return {paid:Boolean(rows[0]?.paid_at),demoBatchesUsed:rows[0]?.demo_batches_used ?? 0,purchaseStatus:rows[0]?.purchase_status || null};
  },
  async reserve(storeId) {
    const pool=await this.pool();
    // A single conditional upsert serializes concurrent requests, including different instances.
    const {rows}=await pool.query(`
      insert into image_sync_access (store_id, demo_used_at, demo_batches_used) values ($1,now(),1)
      on conflict (store_id) do update set
        demo_used_at=coalesce(image_sync_access.demo_used_at,now()),
        demo_batches_used=image_sync_access.demo_batches_used+1
      where image_sync_access.demo_batches_used < $2 and image_sync_access.paid_at is null
      returning store_id`,[storeId,DEMO_BATCHES]);
    return rows.length === 1;
  }
}; }
const postgresRepository=createPostgresAccessRepository();

export function createCommercialAccess(repository=postgresRepository) {
  return {
    async status(storeId) {
      if (!storeId) throw denied('Conecte sua loja para continuar.',401);
      const current=await repository.status(storeId);
      if(!Number.isInteger(current.demoBatchesUsed) || current.demoBatchesUsed<0) {
        throw denied('Não foi possível verificar os lotes gratuitos. Tente novamente mais tarde.',503);
      }
      return {...current,demoUsed:current.demoBatchesUsed>=DEMO_BATCHES,
        demoBatches:DEMO_BATCHES,demoBatchesRemaining:Math.max(0,DEMO_BATCHES-current.demoBatchesUsed),demoProducts:DEMO_PRODUCTS,demoImages:DEMO_IMAGES,
        purchaseConfigured:nativeBillingConfigured(),paymentProvider:'nuvemshop'};
    },
    async authorize(storeId, productIds, {dryRun=false,imageCount=productIds.length}={}) {
      const access=await this.status(storeId);
      validateBatchAccess(access,new Set(productIds.map(String)).size,imageCount);
      if (!dryRun && !access.paid && !await repository.reserve(storeId)) {
        throw denied('Seu lote gratuito já foi utilizado. O pagamento único de R$79,90 libera novos lotes e reutilizações.');
      }
      return access;
    }
  };
}
export default createCommercialAccess();
