import {getPool,initializeDatabase} from './database.js';
export function createImageHistory(poolProvider=getPool,initialize=initializeDatabase) {
  return {
    async load(storeId) {
      const pool=poolProvider();if(!pool)throw new Error('database_unavailable');await initialize();
      const {rows}=await pool.query('select product_key,state from image_sync_history where store_id=$1',[String(storeId)]);
      return {skus:Object.fromEntries(rows.map(row=>[row.product_key,row.state]))};
    },
    async save(storeId,state) {
      const pool=poolProvider();if(!pool)throw new Error('database_unavailable');await initialize();
      for(const [key,value] of Object.entries(state.skus)) {
        const result=await pool.query(`insert into image_sync_history(store_id,product_key,state)
          select $1,$2,$3::jsonb where exists(select 1 from stores where store_id=$1)
          on conflict(store_id,product_key) do update set state=excluded.state,updated_at=now()
          returning product_key`,[String(storeId),key,JSON.stringify(value)]);
        if(!result.rows.length)throw new Error('store_no_longer_authorized');
      }
    },
  };
}
export default createImageHistory();
