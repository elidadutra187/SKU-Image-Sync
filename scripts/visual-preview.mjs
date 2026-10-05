// Local visual test harness. No OAuth tokens, external API calls or real payments.
import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {createSyncRouter} from '../routes/sync.js';
import {createCommercialAccess} from '../services/commercialAccess.js';
import {setStoreSession} from '../services/session.js';
import NuvemshopClient from '../services/nuvemshop.js';
import ImageSyncService from '../services/imageSync.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const artifacts=await fs.mkdtemp(path.join(os.tmpdir(),'imagem-visual-'));
const image='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1ioAAAAASUVORK5CYII=';
const colors=['Azul','Verde','Vermelha','Amarela','Branca','Preta','Roxa','Rosa','Cinza','Laranja','Bege'];
const products=colors.map((color,index)=>({id:index+1,name:`Camiseta ${color}`,variants:[{sku:`CAM-${String(index+1).padStart(3,'0')}`}]}));
let demoBatchesUsed=0;
const client={
  async getProducts(){return products;},
  async getProduct(id){const item=products.find(p=>String(p.id)===String(id));if(!item)throw new Error('unknown product');return item;},
  async getProductImages(){return [{id:100,position:1,src:`data:image/png;base64,${image}`}];},
  async uploadProductImage(){return {id:200};},
  async deleteProductImage(){throw new Error('deletion disabled in visual test');},
  async delay(){},
};
NuvemshopClient.fromStore=async()=>client;
const access=createCommercialAccess({async status(){return {paid:false,demoBatchesUsed};},async reserve(){if(demoBatchesUsed>=10)return false;demoBatchesUsed++;return true;}});
const app=express();app.use(express.json());
app.get('/auth/status',(req,res)=>{setStoreSession(res,'visual-test');res.json({success:true,connected:true,storeId:'visual-test'});});
app.get('/auth/install',(req,res)=>res.redirect('/'));
app.get('/',async(req,res)=>{const html=await fs.readFile(path.join(root,'public/index.html'),'utf8');res.type('html').send(html.replace('<body>','<body><p style="text-align:center;background:#fff0d4;padding:12px;margin:0">Ambiente de teste: nenhum produto real será alterado.</p>'));});
app.get('/how-to',(req,res)=>res.sendFile(path.join(root,'public/how-to.html')));
app.get('/product-matching.js',(req,res)=>res.sendFile(path.join(root,'services/productMatching.js')));
app.use(express.static(path.join(root,'public')));
app.use('/sync',createSyncRouter({clientForStore:async()=>client,access,serviceFactory:options=>new ImageSyncService({...options,stateFile:path.join(artifacts,'state.json'),reportPath:path.join(artifacts,`${Date.now()}.csv`)})}));
for(const product of products)await fs.writeFile(path.join(artifacts,`${product.name}_01.png`),Buffer.from(image,'base64'));
console.log(JSON.stringify({port:3135,fixtureDirectory:artifacts}));
app.listen(3135,'127.0.0.1');
