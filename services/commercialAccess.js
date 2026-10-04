import {getPool, initializeDatabase} from './database.js';
export const DEMO_PRODUCTS = 10;

function denied(message,status=402) { return Object.assign(new Error(message),{status}); }
export function validateBatchAccess(access,count) {
  if (!Number.isInteger(count) || count < 1) throw denied('Selecione ao menos um produto.',400);
  if (count > 50) throw denied('Envie até 50 produtos por lote.',400);
  if (access.paid) return;
  if (access.demoUsed) throw denied('Seu lote demo já foi utilizado. O pagamento único libera novos lotes e reutilizações.');
  if (count > DEMO_PRODUCTS) throw denied('O demo permite um único lote de até 10 produtos. Selecione até 10 para continuar.');
}

// Separate from OAuth records: reconnecting does not grant another free batch.
const postgresRepository = {
  async pool() {
    const pool=getPool();
    if (!pool) throw denied('Não foi possível verificar seu acesso. Tente novamente mais tarde.',503);
    await initializeDatabase();
    return pool;
  },
  async status(storeId) {
    const pool=await this.pool();
    const {rows}=await pool.query('select paid_at, demo_used_at from image_sync_access where store_id=$1',[storeId]);
    return {paid:Boolean(rows[0]?.paid_at),demoUsed:Boolean(rows[0]?.demo_used_at)};
  },
  async reserve(storeId) {
    const pool=await this.pool();
    // A single conditional upsert serializes concurrent requests, including different instances.
    const {rows}=await pool.query(`
      insert into image_sync_access (store_id, demo_used_at) values ($1,now())
      on conflict (store_id) do update set demo_used_at=now()
      where image_sync_access.demo_used_at is null and image_sync_access.paid_at is null
      returning store_id`,[storeId]);
    return rows.length === 1;
  }
};

export function createCommercialAccess(repository=postgresRepository) {
  return {
    async status(storeId) {
      if (!storeId) throw denied('Conecte sua loja para continuar.',401);
      return {...await repository.status(storeId),demoProducts:DEMO_PRODUCTS,purchaseConfigured:false};
    },
    async authorize(storeId, productIds, {dryRun=false}={}) {
      const access=await this.status(storeId);
      validateBatchAccess(access,new Set(productIds.map(String)).size);
      if (!dryRun && !access.paid && !await repository.reserve(storeId)) {
        throw denied('Seu lote demo já foi utilizado. O pagamento único libera novos lotes e reutilizações.');
      }
      return access;
    }
  };
}
export default createCommercialAccess();
