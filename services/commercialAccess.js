import {getPool, initializeDatabase} from './database.js';
import {nativeBillingConfigured} from './nativeBilling.js';
export const DEMO_PRODUCTS = 10;
export const DEMO_BATCHES = 10;

function denied(message,status=402) { return Object.assign(new Error(message),{status}); }
export function validateBatchAccess(access,count) {
  if (!Number.isInteger(count) || count < 1) throw denied('Selecione ao menos um produto.',400);
  if (count > 50) throw denied('Envie até 50 produtos por lote.',400);
  if (access.paid) return;
  if (access.demoBatchesUsed >= DEMO_BATCHES) throw denied('Seus 10 lotes gratuitos já foram utilizados. O pagamento único de R$79,90 libera novos lotes e reutilizações.');
  if (count > DEMO_PRODUCTS) throw denied('Cada lote gratuito permite até 10 produtos. Selecione até 10 para continuar.');
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
    const {rows}=await pool.query('select paid_at, demo_batches_used from image_sync_access where store_id=$1',[storeId]);
    return {paid:Boolean(rows[0]?.paid_at),demoBatchesUsed:rows[0]?.demo_batches_used ?? 0};
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
      if(!Number.isInteger(current.demoBatchesUsed) || current.demoBatchesUsed<0 || current.demoBatchesUsed>DEMO_BATCHES) {
        throw denied('Não foi possível verificar os lotes gratuitos. Tente novamente mais tarde.',503);
      }
      return {...current,demoUsed:current.demoBatchesUsed>=DEMO_BATCHES,
        demoBatches:DEMO_BATCHES,demoBatchesRemaining:DEMO_BATCHES-current.demoBatchesUsed,demoProducts:DEMO_PRODUCTS,
        purchaseConfigured:nativeBillingConfigured(),paymentProvider:'nuvemshop'};
    },
    async authorize(storeId, productIds, {dryRun=false}={}) {
      const access=await this.status(storeId);
      validateBatchAccess(access,new Set(productIds.map(String)).size);
      if (!dryRun && !access.paid && !await repository.reserve(storeId)) {
        throw denied('Seus 10 lotes gratuitos já foram utilizados. O pagamento único de R$79,90 libera novos lotes e reutilizações.');
      }
      return access;
    }
  };
}
export default createCommercialAccess();
