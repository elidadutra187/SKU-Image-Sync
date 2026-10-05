import {imageGroupName,normalizeName} from '/product-matching.js';

const $=id=>document.getElementById(id);
const state={connected:false,files:[],session:null,items:[],catalog:[],access:null,busy:false};
const escape=value=>String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const selected=()=>[...document.querySelectorAll('[data-select]:checked')].map(input=>input.value);
const message=(text,error=false)=>{ $('message').textContent=text;$('message').classList.toggle('error',error);};

async function request(url,options) {
  const response=await fetch(url,options);
  const data=await response.json();
  if(!response.ok || data.success===false)throw new Error(data.error || 'Não foi possível concluir. Tente novamente.');
  return data;
}
function busy(value,text) {
  state.busy=value;$('loading').hidden=!value;if(text)message(text);
  for(const element of document.querySelectorAll('button,input,select'))element.disabled=value;
  updateActions();
}
function updateActions() {
  for(const checkbox of document.querySelectorAll('[data-select]')) {
    checkbox.disabled=state.busy || !state.items.find(item=>item.sku===checkbox.value)?.product || !state.session;
  }
  const count=selected().length;
  $('preview').disabled=state.busy || !state.connected || !state.files.length;
  $('simulate').disabled=state.busy || !count;
  const blocked=state.access && !state.access.paid && state.access.demoUsed;
  $('send').disabled=state.busy || !count || !state.access || blocked;
  $('selectionCount').textContent=count ? `${count} grupo(s) selecionado(s). Cada produto conta uma vez no demo.` : 'Marque os produtos que deseja atualizar.';
}
function renderAccess(access) {
  state.access=access;
  $('access').hidden=false;
  $('accessText').textContent=access.paid?'Acesso liberado para novos lotes e reutilizações.':access.demoUsed
    ?'Seus 10 lotes gratuitos já foram utilizados. O pagamento único de R$79,90 por loja libera os próximos lotes e reutilizações.'
    :`Você tem ${access.demoBatchesRemaining} de ${access.demoBatches} lotes gratuitos disponíveis. Cada lote permite até ${access.demoProducts} produtos. Conferir e simular não consome lotes.`;
  $('purchasePending').hidden=access.paid || !access.demoUsed;
  $('purchasePending').textContent=access.purchaseConfigured
    ?'O pagamento único de R$79,90 por loja é pela Nuvemshop. O acesso será liberado após a confirmação do pagamento.'
    :'O pagamento único será de R$79,90 por loja, pela Nuvemshop. A liberação do pagamento ainda está em preparação.';
  $('refreshAccess').hidden=access.paid || !access.demoUsed || !access.purchaseConfigured;
  $('batchSize').querySelectorAll('option').forEach(option=>{option.disabled=!access.paid && Number(option.value)>10;});
  if(!access.paid)$('batchSize').value='10';
  updateBatches();updateActions();
}
function groups() {
  const result=new Map();
  for(const file of state.files) {
    const parts=(file.webkitRelativePath || file.name).replaceAll('\\','/').split('/');
    const label=parts.length>1?parts.at(-2):imageGroupName(file.name);
    const key=normalizeName(label);
    if(!result.has(key))result.set(key,{label,files:[]});
    result.get(key).files.push(file);
  }
  return [...result.values()].sort((a,b)=>a.label.localeCompare(b.label,'pt-BR',{numeric:true}));
}
function updateBatches() {
  const count=groups().length,size=Number($('batchSize').value),old=Number($('batchPage').value || 0);
  const pages=Math.max(1,Math.ceil(count/size));$('batchPage').replaceChildren();
  for(let index=0;index<pages;index++)$('batchPage').add(new Option(count?`Lote ${index+1}: grupos ${index*size+1} a ${Math.min((index+1)*size,count)}`:'Selecione as fotos',String(index)));
  $('batchPage').value=String(Math.min(old,pages-1));
  $('fileCount').textContent=count?`${state.files.length} foto(s) selecionada(s), em ${count} grupo(s). Confira os produtos na próxima etapa.`:'Nenhuma foto selecionada.';
}
function selectFiles(files) {
  state.files=[...files].filter(file=>/\.(jpe?g|png|webp|gif)$/i.test(file.name));
  state.session=null;state.items=[];$('review').hidden=true;$('report').hidden=true;
  updateBatches();updateActions();
  message('Fotos selecionadas. Clique em “Encontrar produtos” para conferir a associação.');
}
function images(list,local) {
  return list.length?`<div class="photos">${list.map(image=>`<figure><img loading="lazy" src="${escape(local?image.previewUrl:image.src)}" alt="${escape(local?image.originalName || image.filename:'Foto atual do produto')}"><figcaption>${escape(local?image.originalName || image.filename:'Foto atual')}</figcaption></figure>`).join('')}</div>`:'<p class="muted">Nenhuma foto.</p>';
}
function renderItems() {
  $('review').hidden=false;$('products').replaceChildren();
  for(const item of state.items) {
    const card=document.createElement('article');card.className='product';
    const options=[...new Map([...(item.suggestions || []),...state.catalog].map(product=>[String(product.id),product])).values()];
    card.innerHTML=`<div class="product-heading"><label class="selection"><input data-select type="checkbox" value="${escape(item.sku)}" ${item.status==='ok'?'checked':'disabled'}><span>${escape(item.product?.name || item.sourceFolder)}</span></label><span class="badge ${item.status==='ok'?'':'attention'}">${item.status==='ok'?'Pronto para conferir':'Escolha o produto'}</span></div>
      <p class="muted">Arquivos: ${escape(item.sourceFolder)} · ${item.localImages.length} foto(s)</p>
      <p>${item.status==='ok'?`Identificado ${item.matchReason==='sku'?'pelo SKU':item.matchReason==='manual'?'por sua escolha':'pelo nome'}. Confira antes de enviar.`:escape(item.error)}</p>
      <details ${item.status==='ok'?'':'open'}><summary>${item.status==='ok'?'Trocar o produto associado':'Associar estas fotos a um produto'}</summary>
        <label>Buscar produto pelo nome<input data-product-search type="search" placeholder="Digite parte do nome"></label>
        <label>Produto que receberá as fotos<select data-product-choice><option value="">Selecione um produto</option>${options.map(product=>`<option value="${escape(product.id)}">${escape(product.name)} (#${escape(product.id)})</option>`).join('')}</select></label><button type="button" class="secondary" data-match>Confirmar produto</button>
      </details><div class="photo-columns"><section><h3>Fotos que você selecionou</h3>${images(item.localImages,true)}</section><section><h3>Fotos atuais na loja</h3>${images(item.remoteImages,false)}</section></div>`;
    card.querySelector('[data-select]').addEventListener('change',updateActions);
    const choice=card.querySelector('[data-product-choice]');
    card.querySelector('[data-product-search]').addEventListener('input',event=>{
      const query=normalizeName(event.target.value);
      for(const option of choice.options)if(option.value)option.hidden=!normalizeName(option.textContent).includes(query);
    });
    card.querySelector('[data-match]').addEventListener('click',async()=>{
      if(!choice.value)return message('Selecione um produto na lista.',true);
      busy(true,'Conferindo o produto escolhido...');
      try {
        const data=await request(`/sync/session/${state.session}/match`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({groupId:item.sku,productId:choice.value})});
        state.items=state.items.map(previous=>previous.sku===item.sku?data.item:previous);
        renderItems();message('Produto associado. Confira as fotos antes de enviar.');
      } catch(error){message(error.message,true);}finally{busy(false);}
    });
    $('products').append(card);
  }
  $('reviewSummary').textContent=`${state.items.filter(item=>item.status==='ok').length} de ${state.items.length} grupo(s) associado(s). Grupos sem produto não serão enviados.`;
  updateActions();
}
async function preview() {
  const size=Number($('batchSize').value),start=Number($('batchPage').value)*size;
  const files=groups().slice(start,start+size).flatMap(group=>group.files);
  const form=new FormData();files.forEach(file=>form.append('images',file,file.name));
  form.append('manifest',JSON.stringify(files.map(file=>({path:file.webkitRelativePath || file.name}))));
  if($('csv').files[0])form.append('csv',$('csv').files[0]);
  busy(true,'Encontrando os produtos pelo nome das fotos. Aguarde...');
  try {
    const data=await request('/sync/preview',{method:'POST',body:form});
    state.session=data.sessionId;state.items=data.items;state.catalog=data.catalog;
    renderAccess(data.access);renderItems();
    message('Confira os produtos e as fotos abaixo. Nenhuma imagem da loja foi alterada.');
    $('review').scrollIntoView({block:'start'});
  } catch(error){message(error.message,true);}finally{busy(false);}
}
async function run(dryRun) {
  const selectedSkus=selected(),mode=$('mode').value;
  const demoNotice=state.access?.paid?'':' Ao iniciar, você utiliza 1 dos seus lotes gratuitos disponíveis.';
  if(!dryRun && !window.confirm(mode==='replace'
    ?'Este modo vai remover as fotos atuais dos produtos selecionados e enviar as novas. Confirma?'
    :'Você conferiu os produtos e as fotos? Enviar agora?'+demoNotice))return;
  busy(true,dryRun?'Simulando o envio, sem alterar a loja...':'Enviando as fotos para a loja...');
  try {
    const data=await request(`/sync/session/${state.session}/run`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({dryRun,mode,selectedSkus})});
    for(;;) {
      const {job}=await request(`/sync/job/${data.jobId}`);
      message(`Processando: ${job.progress?.completed || 0} de ${job.progress?.total || selectedSkus.length} produto(s).`);
      if(job.status==='failed')throw new Error('O processamento encontrou um problema. Consulte o suporte antes de tentar novamente.');
      if(job.status==='completed') {
        const stats=job.result?.stats || {};
        message(`${dryRun?'Simulação concluída. Nenhuma foto foi alterada.':'Envio concluído.'} Produtos: ${stats.processed || 0}. Fotos enviadas: ${stats.uploaded || 0}. Erros: ${stats.errors || 0}.`,Boolean(stats.errors));
        if(job.result?.reportDownloadUrl){$('report').href=job.result.reportDownloadUrl;$('report').hidden=false;}
        if(!dryRun){state.session=null;document.querySelectorAll('[data-select]').forEach(input=>{input.checked=false;});}
        break;
      }
      await new Promise(resolve=>setTimeout(resolve,1500));
    }
  }catch(error){message(error.message,true);}finally{
    try{renderAccess(await request('/sync/access'));}catch{}
    busy(false);if(!state.session){$('simulate').disabled=true;$('send').disabled=true;}
  }
}
$('images').addEventListener('change',event=>selectFiles(event.target.files));
$('folder').addEventListener('change',event=>selectFiles(event.target.files));
for(const name of ['dragover','drop'])$('dropzone').addEventListener(name,event=>{
  event.preventDefault();if(name==='drop')selectFiles(event.dataTransfer.files);
});
$('preview').addEventListener('click',preview);
$('refreshAccess').addEventListener('click',async()=>{
  busy(true,'Verificando a confirmação do pagamento...');
  try {
    const access=await request('/sync/access');renderAccess(access);
    message(access.paid?'Pagamento confirmado. Seu acesso está liberado.':'A Nuvemshop ainda não confirmou o pagamento. Aguarde a compensação e tente novamente.');
  }catch(error){message(error.message,true);}finally{busy(false);}
});
$('simulate').addEventListener('click',()=>run(true));$('send').addEventListener('click',()=>run(false));
$('batchSize').addEventListener('change',()=>{state.session=null;$('review').hidden=true;updateBatches();updateActions();});$('batchPage').addEventListener('change',()=>{state.session=null;$('review').hidden=true;updateActions();});
$('mode').addEventListener('change',()=>{$('modeHelp').textContent=$('mode').value==='add'?'As fotos atuais serão mantidas.':$('mode').value==='sync'?'Atualiza fotos enviadas anteriormente por este app que tenham mudado.':'Atenção: remove todas as fotos atuais dos produtos selecionados.';});
async function initialize() {
  try {
    const connection=await request('/auth/status');state.connected=Boolean(connection.connected && connection.storeId);
    $('connection').textContent=state.connected?'Loja conectada':'Conecte a loja para começar';
    $('connect').hidden=state.connected;
    if(state.connected)renderAccess(await request('/sync/access'));
  } catch(error){message(error.message,true);}
  updateActions();
}
initialize();
