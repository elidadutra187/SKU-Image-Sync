import {merchantAlias,yampiRepository,temporaryMedia} from './yampiStore.js';
export async function tokenRequest(body,fetchImpl=fetch){
  const response=await fetchImpl('https://auth.yampi.com.br/oauth/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(body),signal:AbortSignal.timeout(30000)});
  const data=await response.json();if(!response.ok || !data.access_token || !data.refresh_token)throw new Error('yampi_token_exchange_failed');return data;
}
const numeric=value=>{if(!/^[1-9]\d*$/.test(String(value)))throw new Error('invalid_yampi_id');return String(value);};
let requestQueue=Promise.resolve(),lastRequestAt=0;
export class YampiClient{
  constructor({alias,clientId=process.env.YAMPI_CLIENT_ID,token,fetchImpl=fetch,media=temporaryMedia}){
    this.alias=merchantAlias(alias);this.storeId='yampi:'+this.alias;this.clientId=clientId;
    if(!clientId)throw new Error('yampi_not_configured');
    this.token=token || (()=>yampiRepository.accessToken(this.alias,refresh_token=>tokenRequest({client_id:this.clientId,grant_type:'refresh_token',refresh_token})));
    this.fetchImpl=fetchImpl;this.media=media;
  }
  async wait(extraMs=0){
    const previous=requestQueue;let release;requestQueue=new Promise(r=>release=r);await previous;
    try{const pause=Math.max(2100-(Date.now()-lastRequestAt),extraMs);if(pause>0)await new Promise(r=>setTimeout(r,pause));lastRequestAt=Date.now();}
    finally{release();}
  }
  async request(endpoint,options={},attempt=0,retryMs=0){
    await this.wait(retryMs);
    const response=await this.fetchImpl(`https://api.dooki.com.br/v2/${this.alias}${endpoint}`,{...options,headers:{Accept:'application/json','Content-Type':'application/json',Authorization:'Bearer '+await this.token(),'X-Partner-Client-ID':this.clientId},signal:AbortSignal.timeout(60000)});
    if(response.status===429 && (!options.method || options.method==='GET') && attempt<2){
      const seconds=Number(response.headers.get('retry-after'));
      return this.request(endpoint,options,attempt+1,Math.min(60000,Math.max(2100,Number.isFinite(seconds)?seconds*1000:5000)));
    }
    if(!response.ok)throw new Error(`Yampi API ${response.status}`);
    return response.status===204?null:response.json();
  }
  async list(endpoint){const result=[];
    for(let page=1;page<=500;page++){
      const response=await this.request(`${endpoint}?limit=100&page=${page}`);
      if(!Array.isArray(response.data))throw new Error('invalid_yampi_catalog');
      result.push(...response.data);const pagination=response.meta?.pagination || response.meta?.meta?.pagination;
      if(pagination?.total_pages ? page>=Number(pagination.total_pages) : response.data.length<100)return result;
    }throw new Error('yampi_catalog_too_large');
  }
  async getProducts(){
    if(this.catalog)return this.catalog;
    const products=await this.list('/catalog/products'),skus=await this.list('/catalog/skus');
    const names=new Map(products.map(p=>[String(p.id),p.name]));
    this.catalog=skus.map(sku=>{const base=names.get(String(sku.product_id)) || sku.title || sku.sku;
      const values=(sku.variations || []).map(v=>v.value).filter(Boolean);
      return {id:sku.id,name:values.length?`${base} — ${values.join(' / ')} (${sku.sku})`:base,
        matchNames:[base,sku.title].filter(Boolean),variants:[{sku:sku.sku}],platformProductId:sku.product_id};});
    return this.catalog;
  }
  async getProduct(id){numeric(id);const found=(await this.getProducts()).find(p=>String(p.id)===String(id));
    if(!found)throw new Error('Produto não encontrado nesta loja.');return found;}
  async getProductBySku(sku){const found=(await this.getProducts()).filter(p=>p.variants.some(v=>v.sku===sku));
    if(found.length!==1)throw new Error('Escolha manualmente o produto e a variação.');return found[0];}
  async getProductImages(id){const response=await this.request(`/catalog/skus/${numeric(id)}/images`);
    if(!Array.isArray(response.data))throw new Error('invalid_yampi_images');
    return response.data.map(image=>({...image,src:image.large?.url || image.medium?.url || image.thumb?.url,position:image.order}));}
  async uploadProductImage(id,image){const url=await this.media.create(this.storeId,image);
    const response=await this.request(`/catalog/skus/${numeric(id)}/images`,{method:'POST',body:JSON.stringify({upload_option:'resize',images:[{url}]})});
    if(!response.data?.[0]?.id)throw new Error('yampi_upload_not_confirmed');return response.data[0];}
  deleteProductImage(id,imageId){return this.request(`/catalog/skus/${numeric(id)}/images/${numeric(imageId)}`,{method:'DELETE'});}
  async delay(){}
  async testConnection(){try{await this.request('/catalog/products?limit=1');return {connected:true,storeId:this.storeId,platform:'yampi'};}
    catch{return {connected:false,platform:'yampi'};}}
}
export default YampiClient;
