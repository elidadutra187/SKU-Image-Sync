import crypto from 'node:crypto';
import {getPool,initializeDatabase} from './database.js';

export function merchantAlias(value){
  const alias=String(value || '').toLowerCase();
  if(!/^[a-z0-9][a-z0-9_-]{0,99}$/.test(alias))throw new Error('invalid_yampi_merchant');
  return alias;
}
function key(){
  const secret=process.env.YAMPI_TOKEN_SECRET || process.env.SESSION_SECRET || process.env.NUVEMSHOP_CLIENT_SECRET;
  if(!secret)throw new Error('yampi_encryption_not_configured');
  return crypto.createHash('sha256').update('imagem-em-lote-yampi:'+secret).digest();
}
export function encrypt(value){
  const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key(),iv);
  const ciphertext=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);
  return Buffer.concat([iv,cipher.getAuthTag(),ciphertext]).toString('base64url');
}
export function decrypt(value){
  const bytes=Buffer.from(value,'base64url');const decipher=crypto.createDecipheriv('aes-256-gcm',key(),bytes.subarray(0,12));
  decipher.setAuthTag(bytes.subarray(12,28));return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]).toString('utf8'));
}
export function createPkce(){const verifier=crypto.randomBytes(64).toString('hex');
  return {verifier,challenge:crypto.createHash('sha256').update(verifier).digest('base64url')};}
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
let initializing;
export async function yampiPool(){
  const pool=getPool();if(!pool)throw new Error('database_unavailable');await initializeDatabase();
  initializing ??= (async()=>{
    await pool.query(`create table if not exists image_sync_yampi_stores(alias text primary key, credentials text not null, installed_at timestamptz not null default now(), updated_at timestamptz not null default now())`);
    await pool.query(`create table if not exists image_sync_yampi_oauth(state_hash text primary key,browser_hash text not null,verifier text not null,expires_at timestamptz not null)`);
    await pool.query(`create table if not exists image_sync_yampi_media(token_hash text primary key,store_id text not null,content bytea not null,mime text not null,expires_at timestamptz not null)`);
  })().catch(e=>{initializing=null;throw e;});
  await initializing;return pool;
}
export const yampiRepository={
  async createState(state,browser,verifier){const pool=await yampiPool();
    await pool.query('delete from image_sync_yampi_oauth where expires_at<now()');
    await pool.query(`insert into image_sync_yampi_oauth values($1,$2,$3,now()+interval '10 minutes')`,[hash(state),hash(browser),encrypt({verifier})]);},
  async consumeState(state,browser){if(!state || !browser)return null;const pool=await yampiPool();
    const {rows}=await pool.query('delete from image_sync_yampi_oauth where state_hash=$1 and browser_hash=$2 and expires_at>now() returning verifier',[hash(state),hash(browser)]);
    return rows[0]?decrypt(rows[0].verifier).verifier:null;},
  async save(alias,token){alias=merchantAlias(alias);const pool=await yampiPool();
    await pool.query(`insert into image_sync_yampi_stores(alias,credentials) values($1,$2) on conflict(alias) do update set credentials=excluded.credentials,updated_at=now()`,[alias,encrypt(token)]);},
  async accessToken(alias,refresh){alias=merchantAlias(alias);const pool=await yampiPool(),client=await pool.connect();
    try{await client.query('begin');const {rows}=await client.query('select credentials from image_sync_yampi_stores where alias=$1 for update',[alias]);
      if(!rows[0])throw new Error('Conecte sua loja Yampi para continuar.');
      let token=decrypt(rows[0].credentials);
      if(Number(token.expiresAt)<=Date.now()+30000){const next=await refresh(token.refresh_token);
        token={...next,refresh_token:next.refresh_token || token.refresh_token,expiresAt:Date.now()+Number(next.expires_in || 600)*1000};
        await client.query('update image_sync_yampi_stores set credentials=$2,updated_at=now() where alias=$1',[alias,encrypt(token)]);}
      await client.query('commit');return token.access_token;
    }catch(e){await client.query('rollback');throw e;}finally{client.release();}},
  async disconnect(alias){const pool=await yampiPool();await pool.query('delete from image_sync_yampi_stores where alias=$1',[merchantAlias(alias)]);
    await pool.query('delete from image_sync_yampi_media where store_id=$1',['yampi:'+alias]);},
};

export const temporaryMedia={
  async create(storeId,image){
    const base=process.env.APP_URL || process.env.RENDER_EXTERNAL_URL;if(!base || new URL(base).protocol!=='https:')throw new Error('yampi_media_url_not_configured');
    const content=Buffer.from(image.attachment,'base64');if(!content.length || content.length>10*1024*1024)throw new Error('invalid_image_size');
    const extension=String(image.filename).split('.').pop().toLowerCase();
    const mime={jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif'}[extension];
    if(!mime)throw new Error('invalid_image_type');
    const token=crypto.randomBytes(32).toString('hex'),pool=await yampiPool();
    await pool.query('delete from image_sync_yampi_media where expires_at<now()');
    await pool.query(`insert into image_sync_yampi_media values($1,$2,$3,$4,now()+interval '10 minutes')`,[hash(token),storeId,content,mime]);
    return `${base.replace(/\/$/,'')}/yampi/media/${token}`;
  },
  async read(token){if(!/^[a-f0-9]{64}$/.test(token))return null;const pool=await yampiPool();
    const {rows}=await pool.query('select content,mime from image_sync_yampi_media where token_hash=$1 and expires_at>now()',[hash(token)]);return rows[0] || null;},
};
