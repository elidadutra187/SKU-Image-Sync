import {Router} from 'express';
import multer from 'multer';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import ImageSyncService from '../services/imageSync.js';
import NuvemshopClient from '../services/nuvemshop.js';
import {readStoreSession} from '../services/session.js';
import commercialAccess from '../services/commercialAccess.js';
import {displayProductName,matchProduct} from '../services/productMatching.js';
import {getCurrentJob,getJob,hasRunningJob,startSyncJob} from '../services/syncJobs.js';
import {createUploadSession,deleteUploadSession,foldersForSession,getSessionImagePath,getUploadSession} from '../services/uploadSessions.js';
import {acquireStoreLock} from '../services/storeLock.js';
import {syncArtifacts,reportNameForStore} from '../services/syncArtifacts.js';
import purchaseService from '../services/purchase.js';

const upload=multer({dest:'uploads/tmp',limits:{fileSize:10*1024*1024,files:500,fields:3,fieldSize:256*1024,parts:503}});
const fail=(message,status=400)=>Object.assign(new Error(message),{status,public:true});
const publicProduct=product=>({id:product.id,name:displayProductName(product)});

export function createSyncRouter({clientForStore=storeId=>NuvemshopClient.fromStore(storeId),
  access=commercialAccess,serviceFactory=options=>new ImageSyncService(options)}={}) {
  const router=Router();
  const wrap=handler=>(req,res,next)=>Promise.resolve(handler(req,res)).catch(next);
  router.use((req,res,next)=>{
    req.storeId=readStoreSession(req);
    if(!req.storeId)return res.status(401).json({success:false,error:'Conecte sua loja para continuar.'});
    if(req.method!=='GET' && req.headers.origin) {
      const expected=process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || req.protocol+'://'+req.get('host');
      if(new URL(expected).origin!==req.headers.origin)return res.status(403).json({success:false,error:'Origem não autorizada.'});
    }
    res.setHeader('Cache-Control','no-store');next();
  });
  function ownedSession(req) {
    const session=getUploadSession(req.params.sessionId);
    if(!session)throw fail('A prévia expirou. Selecione as fotos e gere uma nova prévia.',404);
    if(session.storeId!==req.storeId)throw fail('Esta prévia pertence a outra loja.',403);
    if(session.running)throw fail('Este lote já está sendo processado.',409);
    return session;
  }
  async function itemPreview(group,client) {
    const product=group.productId ? await client.getProduct(group.productId) : null;
    const remoteImages=product ? await client.getProductImages(product.id) : [];
    return {sku:group.sku,sourceFolder:group.sourceFolder,selected:Boolean(product),
      status:product?'ok':'error',matchReason:group.matchReason,
      error:group.matchStatus==='ambiguous'?'Há mais de um produto com esse nome. Escolha o correto.':'Escolha o produto que deve receber estas fotos.',
      product:product?publicProduct(product):null,localImages:group.images,
      remoteImages:remoteImages.map(image=>({id:image.id,src:image.src,position:image.position})),
      suggestions:group.suggestions || []};
  }
  router.get('/access',wrap(async(req,res)=>res.json({success:true,...await access.status(req.storeId)})));
  router.post('/purchase',wrap(async(req,res)=>res.json({success:true,...await purchaseService.purchase(req.storeId,req.body?.confirmed)})));
  for(const endpoint of ['/dry-run','/add','/sync','/replace']) {
    router.post(endpoint,(req,res)=>res.status(410).json({success:false,error:'Selecione as imagens e use a prévia para enviar seu lote.'}));
  }
  router.post('/preview',upload.fields([{name:'images',maxCount:500},{name:'csv',maxCount:1}]),wrap(async(req,res)=>{
    let session;
    try {
      const manifest=JSON.parse(req.body?.manifest || '[]');
      if(!Array.isArray(manifest))throw fail('A lista de fotos é inválida. Selecione os arquivos novamente.');
      const files=req.files?.images || [];
      if(!files.length)throw fail('Selecione ao menos uma foto.');
      const client=await clientForStore(req.storeId),catalog=await client.getProducts();
      session=await createUploadSession({files,manifest,storeId:req.storeId,catalog,
        csvText:req.files?.csv?.[0] ? await fs.readFile(req.files.csv[0].path,'utf8') : ''});
      session.catalog=catalog;
      for(const group of session.groups) {
        const matches=[group.sourceFolder,...group.images.map(image=>image.originalName)].map(source=>matchProduct(source,catalog));
        const skuMatches=matches.filter(match=>match.reason==='sku');
        const pool=skuMatches.length?skuMatches:matches;
        const matched=[...new Map(pool.filter(match=>match.product).map(match=>[String(match.product.id),match])).values()];
        const ambiguous=pool.some(match=>match.status==='ambiguous') || matched.length>1;
        const chosen=!ambiguous && matched.length===1?matched[0]:null;
        group.productId=chosen?.product.id || null;group.matchReason=chosen?.reason || null;
        group.matchStatus=ambiguous?'ambiguous':chosen?'matched':'unmatched';
        group.suggestions=[...new Map(pool.flatMap(match=>match.product?[match.product]:match.suggestions)
          .map(product=>[String(product.id),publicProduct(product)])).values()].slice(0,10);
      }
      if(session.csvSkus.length)session.groups=session.groups.filter(group=>catalog.some(product=>String(product.id)===String(group.productId)
        && (product.variants || []).some(variant=>session.csvSkus.includes(String(variant.sku)))));
      if(session.groups.length>50)throw fail('Selecione até 50 grupos de fotos por prévia.');
      const items=[];for(const group of session.groups)items.push(await itemPreview(group,client));
      res.json({success:true,sessionId:session.id,items,count:items.length,catalog:catalog.map(publicProduct),
        access:await access.status(req.storeId)});
    } catch(error) {if(session)await deleteUploadSession(session.id);throw error;}
    finally {for(const file of Object.values(req.files || {}).flat())await fs.rm(file.path,{force:true});}
  }));
  router.post('/session/:sessionId/match',wrap(async(req,res)=>{
    const session=ownedSession(req),group=session.groups.find(item=>item.sku===req.body?.groupId);
    const product=session.catalog.find(item=>String(item.id)===String(req.body?.productId));
    if(!group || !product)throw fail('Escolha um produto válido desta loja.');
    const client=await clientForStore(req.storeId);await client.getProduct(product.id);
    group.productId=product.id;group.matchReason='manual';group.matchStatus='matched';
    res.json({success:true,item:await itemPreview(group,client)});
  }));
  router.get('/session/:sessionId/image/:sku/:filename',wrap(async(req,res)=>{
    const session=getUploadSession(req.params.sessionId);
    if(!session || session.storeId!==req.storeId)throw fail('Foto não encontrada.',404);
    const filePath=getSessionImagePath(session.id,req.params.sku,req.params.filename);
    if(!filePath)throw fail('Foto não encontrada.',404);
    res.sendFile(path.resolve(filePath));
  }));
  router.post('/session/:sessionId/run',wrap(async(req,res)=>{
    if(hasRunningJob())throw fail('Um lote está em processamento. Aguarde a conclusão.',409);
    const session=ownedSession(req);
    if(req.body?.dryRun!==undefined && typeof req.body.dryRun!=='boolean')throw fail('A opção de simulação é inválida.');
    const dryRun=req.body?.dryRun===true,mode=req.body?.mode || 'add',selected=req.body?.selectedSkus;
    if(!['add','sync','replace'].includes(mode))throw fail('Selecione um modo válido.');
    if(!Array.isArray(selected) || !selected.length)throw fail('Selecione ao menos um produto na prévia.');
    const folders=foldersForSession(session,selected.map(String));
    if(!folders.length || folders.some(folder=>!folder.productId))throw fail('Escolha o produto de cada grupo selecionado.');
    const client=await clientForStore(req.storeId);
    for(const id of new Set(folders.map(folder=>folder.productId)))await client.getProduct(id);
    const releaseStoreLock=await acquireStoreLock(req.storeId);
    session.running=true;
    try {
      await access.authorize(req.storeId,folders.map(folder=>folder.productId),{dryRun});
      const reportName=reportNameForStore(req.storeId);
      const job=startSyncJob({mode,dryRun,run:async(onProgress)=>{
        try {
          const result=await serviceFactory({mode,dryRun,folders,concurrency:1,storeId:req.storeId,onProgress,assertProcessing:releaseStoreLock.assertActive,
            reportPath:'reports/'+reportName,
            stateFile:'uploads/state-'+crypto.createHash('sha256').update(req.storeId).digest('hex')+'.json'}).run();
          if(result.report?.reportPath)syncArtifacts.registerReport(reportName,req.storeId);
          if(!dryRun)await deleteUploadSession(session.id);
          return {success:true,mode,dryRun,...result,reportDownloadUrl:result.report?.reportPath?'/sync/report/'+reportName:null};
        } finally {session.running=false;await releaseStoreLock();}
      }});
      syncArtifacts.registerJob(job.id,req.storeId);res.status(202).json({success:true,status:'running',jobId:job.id,job});
    } catch(error) {session.running=false;await releaseStoreLock();throw error;}
  }));
  router.get('/report/:filename',wrap(async(req,res)=>{
    const filename=req.params.filename;
    if(syncArtifacts.reportOwner(filename)!==req.storeId)throw fail('Relatório não encontrado.',404);
    res.download(path.resolve('reports',filename),filename);
  }));
  router.get('/job/:jobId',(req,res)=>{
    const job=syncArtifacts.jobOwner(req.params.jobId)===req.storeId?getJob(req.params.jobId):null;
    if(!job)return res.status(404).json({success:false,error:'Processamento não encontrado.'});
    res.json({success:true,job});
  });
  router.get('/status',(req,res)=>{
    const current=getCurrentJob();
    const owned=current && syncArtifacts.jobOwner(current.id)===req.storeId;
    res.json({running:Boolean(owned && current.status==='running'),job:owned?current:null});
  });
  router.use(async(error,req,res,next)=>{
    for(const file of Object.values(req.files || {}).flat())await fs.rm(file.path,{force:true}).catch(()=>{});
    const status=error instanceof multer.MulterError?400:error.status || 500;
    res.status(status).json({success:false,error:error instanceof multer.MulterError
      ?'Envie até 500 fotos, com no máximo 10 MB por foto.'
      :error.public || (error.status && error.status<500)?error.message:'Não foi possível concluir. Tente novamente ou fale com o suporte.'});
  });
  return router;
}
export default createSyncRouter();
