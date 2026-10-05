import {getPool,initializeDatabase} from './database.js';
// Transaction locks also work with Neon/PgBouncer transaction pooling.
export function createStoreLock(poolProvider=getPool,initialize=initializeDatabase) {
  return async storeId=>{
    const pool=poolProvider();
    if(!pool){const release=async()=>{};release.assertActive=()=>{};return release;}
    await initialize();const client=await pool.connect();
    let released=false,lost=false,heartbeat;
    const onError=()=>{lost=true;};client.on('error',onError);
    try {
      await client.query('begin');
      const {rows}=await client.query("select pg_try_advisory_xact_lock(hashtext('imagememlote'),hashtext($1)) as locked",[String(storeId)]);
      if(!rows[0].locked)throw Object.assign(new Error('Um lote desta loja está em processamento. Aguarde a conclusão.'),{status:409,public:true});
      heartbeat=setInterval(()=>{client.query('select 1').catch(onError);},30000);heartbeat.unref();
      const release=async()=>{
        if(released)return;released=true;clearInterval(heartbeat);
        try{if(!lost)await client.query('commit');}finally{client.removeListener('error',onError);client.release(lost);}
      };
      release.assertActive=()=>{if(lost || released)throw new Error('processing_lock_lost');};
      return release;
    }catch(error){clearInterval(heartbeat);await client.query('rollback').catch(()=>{lost=true;});client.removeListener('error',onError);client.release(lost);throw error;}
  };
}
export const acquireStoreLock=createStoreLock();
