import {getPool,initializeDatabase} from './database.js';
import {acquireStoreLock} from './storeLock.js';
import {deleteStoreUploadSessions} from './uploadSessions.js';
import {syncArtifacts} from './syncArtifacts.js';
async function cleanupStore(id){await deleteStoreUploadSessions(id);await syncArtifacts.deleteStore(id);}
export function createStoreRedactor(poolProvider=getPool,initialize=initializeDatabase,lock=acquireStoreLock,cleanup=cleanupStore) {
  return async storeId=>{
    const pool=poolProvider();if(!pool)throw new Error('database_unavailable');await initialize();
    const release=await lock(storeId);
    let client;
    try {
      client=await pool.connect();await client.query('begin');
      for(const table of ['image_sync_history','image_sync_purchase','image_sync_access','stores'])await client.query(`delete from ${table} where store_id=$1`,[String(storeId)]);
      await client.query('commit');await cleanup(String(storeId));
    }catch(error){if(client)await client.query('rollback');throw error;}
    finally{client?.release();await release();}
  };
}
export default createStoreRedactor();
