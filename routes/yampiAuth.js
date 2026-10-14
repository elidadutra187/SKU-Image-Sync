import {Router} from 'express';
import crypto from 'node:crypto';
import {createPkce,merchantAlias,yampiRepository,temporaryMedia} from '../services/yampiStore.js';
import {tokenRequest,YampiClient} from '../services/yampi.js';
import {readStoreSession,setStoreSession} from '../services/session.js';
const cookieName='image_sync_yampi_oauth';
const redirectUri=()=>process.env.YAMPI_REDIRECT_URI || `${process.env.APP_URL || process.env.RENDER_EXTERNAL_URL}/auth/yampi/callback`;
function browserCookie(req){const value=(req.headers.cookie || '').split(';').map(v=>v.trim()).find(v=>v.startsWith(cookieName+'='));return value?.slice(cookieName.length+1);}
function writeCookie(res,value,age){res.append('Set-Cookie',`${cookieName}=${value}; Path=/auth/yampi; HttpOnly; SameSite=Lax; Max-Age=${age}${process.env.NODE_ENV==='production'?'; Secure':''}`);}
export function createYampiAuthRouter({repository=yampiRepository,exchange=tokenRequest,verify=async(alias,accessToken)=>new YampiClient({alias,token:async()=>accessToken}).testConnection()}={}){
  const router=Router(),wrap=handler=>(req,res,next)=>Promise.resolve(handler(req,res)).catch(next);
  router.get('/install',wrap(async(req,res)=>{
    const clientId=process.env.YAMPI_CLIENT_ID;if(!clientId)return res.status(503).send('A conexão com a Yampi está em preparação.');
    const {verifier,challenge}=createPkce(),state=crypto.randomBytes(32).toString('hex'),browser=crypto.randomBytes(32).toString('hex');
    await repository.createState(state,browser,verifier);writeCookie(res,browser,600);
    res.redirect('https://auth.yampi.com.br/oauth/authorize?'+new URLSearchParams({client_id:clientId,redirect_uri:redirectUri(),response_type:'code',state,code_challenge:challenge,code_challenge_method:'S256'}));
  }));
  router.get('/callback',wrap(async(req,res)=>{
    // Marketplace installation can begin at the callback with no authorization code.
    if(!req.query.code && !req.query.error)return res.redirect('/auth/yampi/install');
    if(typeof req.query.state!=='string' || typeof req.query.code!=='string' || !browserCookie(req))return res.status(400).send('Conexão inválida. Abra o app e conecte novamente sua loja Yampi.');
    const verifier=await repository.consumeState(req.query.state,browserCookie(req));
    if(!verifier)return res.status(400).send('Conexão expirada. Conecte novamente sua loja Yampi.');
    const token=await exchange({grant_type:'authorization_code',client_id:process.env.YAMPI_CLIENT_ID,redirect_uri:redirectUri(),code:req.query.code,code_verifier:verifier});
    const alias=merchantAlias(token.merchant || token.alias || req.query.merchant);
    if(req.query.merchant && merchantAlias(req.query.merchant)!==alias)throw new Error('yampi_merchant_mismatch');
    if(!(await verify(alias,token.access_token)).connected)throw new Error('yampi_merchant_not_verified');
    await repository.save(alias,{...token,expiresAt:Date.now()+Number(token.expires_in || 600)*1000});
    writeCookie(res,'',0);setStoreSession(res,'yampi:'+alias);res.redirect('/?platform=yampi&connected=1');
  }));
  router.post('/disconnect',wrap(async(req,res)=>{
    const storeId=readStoreSession(req);if(!storeId?.startsWith('yampi:'))return res.sendStatus(401);
    const expected=new URL(process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || req.protocol+'://'+req.get('host')).origin;
    if(req.headers.origin!==expected)return res.sendStatus(403);
    await repository.disconnect(storeId.slice(6));res.append('Set-Cookie','sku_image_sync_store=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');res.json({success:true});
  }));
  return router;
}
export const yampiMediaRouter=Router();
yampiMediaRouter.get('/:token',async(req,res,next)=>{try{const image=await temporaryMedia.read(req.params.token);
  if(!image)return res.sendStatus(404);res.set({'Cache-Control':'no-store','Content-Type':image.mime,'X-Content-Type-Options':'nosniff'}).send(image.content);
}catch(e){next(e);}});
export default createYampiAuthRouter();
