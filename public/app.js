import {t} from '/i18n.js';
import {imageGroupName,normalizeName} from '/product-matching.js';
import {buildCsv,csvRowMatchesFile,fileKey,parseCsvAssignments} from '/csv-mapping.js';

const $=id=>document.getElementById(id);
const state={connected:false,apiAvailable:false,paymentRequired:false,inputMode:'images',files:[],csvRows:null,session:null,items:[],catalog:[],access:null,busy:false,selection:new Set(),reviewPage:0,jobId:null};
const platform=$('platform');
platform.value=new URLSearchParams(location.search).get('platform')==='yampi'?'yampi':'nuvemshop';
const updatePlatform=()=>{$('connect').href=platform.value==='yampi'?'/auth/yampi/install':'/auth/install';};
platform.addEventListener('change',updatePlatform);updatePlatform();
const escape=value=>String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const selected=()=>[...state.selection];
const message=(text,error=false)=>{ $('message').textContent=text;$('message').classList.toggle('error',error);};

async function request(url,options={},timeoutMs=30000) {
  let response;
  try{response=await fetch(url,{signal:AbortSignal.timeout(timeoutMs),...options});}
  catch(error){
    if(error?.name==='TimeoutError')throw Object.assign(new Error('A consulta demorou mais que o esperado. Escolha um lote menor e tente novamente.'),{timeout:true});
    throw error;
  }
  const data=await response.json();
  if(!response.ok || data.success===false)throw Object.assign(new Error(data.error || 'Não foi possível concluir. Tente novamente.'),{status:response.status});
  return data;
}
function busy(value,text) {
  state.busy=value;$('loading').hidden=!value;if(text)message(text);
  for(const element of document.querySelectorAll('button,input,select'))element.disabled=value;
  updateActions();
}
function updateActions() {
  $('retainNotice').hidden=$('mode').value!=='add';
  for(const checkbox of document.querySelectorAll('[data-select]')) {
    checkbox.disabled=state.busy || !state.items.find(item=>item.sku===checkbox.value)?.product || !state.session;
  }
  if(state.access)$('purchase').disabled=state.busy || ['creating','pending'].includes(state.access.purchaseStatus);
  const count=selected().length;
  $('preview').disabled=state.busy || !state.connected || !state.apiAvailable || !state.files.length || state.inputMode==='csv'&&!state.csvRows;
  $('simulate').disabled=state.busy || !!state.jobId || !count || !state.session;
  $('previousPage').disabled=state.busy||state.reviewPage===0;
  $('nextPage').disabled=state.busy||state.reviewPage>=Math.max(0,$('reviewPage').options.length-1);
  const imageCount=state.items.filter(item=>selected().includes(item.sku)).reduce((n,item)=>n+item.localImages.length,0);
  const oversized=state.access && !state.access.paid && imageCount>10;
  const blocked=state.access && !state.access.paid && state.access.demoUsed;
  $('send').disabled=state.busy || !!state.jobId || !count || !state.session || !state.access || blocked || oversized;
  $('selectionCount').textContent=count ? `${imageCount} imagem(ns) selecionada(s). ${oversized ? 'No gratuito, selecione no máximo 10 imagens.' : 'Confira as fotos antes de enviar.'}` : 'Marque os produtos que deseja atualizar.';
}
function renderAccess(access) {
  state.access=access;
  $('access').hidden=false;
  $('accessPlan').textContent='Pagamento único de R$79,90 por loja, sem mensalidade. Inclui um lote gratuito de até 10 imagens.';
  $('accessText').textContent=access.paid?'Acesso liberado para novos lotes e reutilizações.':access.demoUsed
    ?access.paymentProvider==='pending'?'Seu lote gratuito já foi utilizado. Novos envios aguardam a liberação da cobrança Yampi.':'Seu lote gratuito já foi utilizado. O pagamento único de R$79,90 por loja libera os próximos lotes e reutilizações.'
    :`Você tem ${access.demoBatchesRemaining} de ${access.demoBatches} lotes gratuitos disponíveis. O lote gratuito permite até ${access.demoImages} imagens. Conferir e simular não consome lotes.`;
  $('purchasePending').hidden=access.paid || !access.demoUsed;
  $('purchasePending').textContent=access.paymentProvider==='pending'
    ?'A cobrança para lojas Yampi ainda está em preparação. Fale com o suporte para acompanhar a disponibilidade de novos envios.'
    :access.purchaseConfigured
    ?'O pagamento único de R$79,90 por loja é pela Nuvemshop. O acesso será liberado após a confirmação do pagamento.'
    :'O pagamento único será de R$79,90 por loja, pela Nuvemshop. A liberação do pagamento ainda está em preparação.';
  $('purchase').hidden=access.paid || !access.demoUsed || !access.purchaseConfigured;
  $('purchase').textContent=access.purchaseMode==='platform_once'?'Ver pagamento na Nuvemshop':'Comprar acesso por R$79,90';
  $('purchase').disabled=state.busy || access.purchaseMode!=='platform_once'&&['creating','pending'].includes(access.purchaseStatus);
  $('refreshAccess').hidden=access.paid || !access.demoUsed || !access.purchaseConfigured;
  $('batchSize').querySelectorAll('option').forEach(option=>{option.disabled=!access.paid && Number(option.value)>10;});
  if(!access.paid)$('batchSize').value='10';
  updateBatches();updateActions();
}
function csvGroups() {
  // Index by path and by filename once: a 1,000-row CSV must not compare every row with every photo.
  const byKey=new Map(),result=new Map();
  for(const file of state.files)for(const key of new Set([fileKey(file.webkitRelativePath || file.name),fileKey(file.name)])) {
    if(!byKey.has(key))byKey.set(key,[]);byKey.get(key).push(file);
  }
  for(const row of state.csvRows || []) {
    if(!result.has(row.sku))result.set(row.sku,{label:row.sku,files:[],rows:[]});
    const group=result.get(row.sku);group.rows.push(row);
    for(const file of byKey.get(row.key) || [])
      if(!group.files.includes(file)&&csvRowMatchesFile(row.key,file.webkitRelativePath || file.name,file.name))group.files.push(file);
  }
  return [...result.values()];
}
function groups() {
  if(state.inputMode==='csv')return csvGroups();
  const result=new Map();
  for(const file of state.files) {
    const parts=(file.webkitRelativePath || file.name).replaceAll('\\','/').split('/');
    const label=parts.length>2?parts.at(-2):imageGroupName(file.name);
    const key=$('individual').checked ? String(state.files.indexOf(file)) : normalizeName(label);
    if(!result.has(key))result.set(key,{label,files:[]});
    result.get(key).files.push(file);
  }
  return [...result.values()].sort((a,b)=>a.label.localeCompare(b.label,'pt-BR',{numeric:true}));
}
function batchGroups() {
  const size=Number($('batchSize').value),start=Number($('batchPage').value || 0)*size;
  return groups().slice(start,start+size);
}
function updateWeight() {
  const bytes=batchGroups().flatMap(group=>group.files).reduce((total,file)=>total+(file.size || 0),0),mb=Math.round(bytes/1024/1024);
  $('batchWeight').hidden=mb<100;
  $('batchWeight').textContent=`As fotos deste lote somam ${mb} MB. O envio pode levar alguns minutos, conforme a sua internet. Se demorar, escolha um lote menor ou reduza o tamanho das fotos.`;
}
function updateBatches() {
  const count=groups().length,size=Number($('batchSize').value),old=Number($('batchPage').value || 0);
  const pages=Math.max(1,Math.ceil(count/size));$('batchPage').replaceChildren();
  $('batchOptions').hidden=count<=10;
  if(pages>1)$('batchOptions').open=true;
  for(let index=0;index<pages;index++)$('batchPage').add(new Option(count?`Lote ${index+1}: grupos ${index*size+1} a ${Math.min((index+1)*size,count)}`:'Selecione as fotos',String(index)));
  $('batchPage').value=String(Math.min(old,pages-1));
  $('fileCount').textContent=count?`${state.files.length} foto(s) selecionada(s), em ${count} grupo(s). Confira os produtos na próxima etapa.`
    :state.files.length&&state.inputMode==='csv'?`${state.files.length} foto(s) selecionada(s). Selecione o CSV para organizar os lotes.`:'Nenhuma foto selecionada.';
  updateWeight();
}
function selectFiles(files) {
  state.files=[...files].filter(file=>/\.(jpe?g|png|webp|gif)$/i.test(file.name));
  state.session=null;state.items=[];state.selection.clear();state.reviewPage=0;$('review').hidden=true;$('report').hidden=true;
  updateBatches();updateActions();
  message(state.paymentRequired?'Fotos selecionadas. A Nuvemshop exige regularizar o pagamento do aplicativo antes de consultar os produtos. Consulte o aviso de acesso acima.':state.files.length?'Fotos selecionadas. Clique em “Encontrar produtos” para conferir a associação.':'Selecione fotos JPG, PNG, WebP ou GIF para continuar.',state.paymentRequired);
}
function images(list,local) {
  return list.length?`<div class="photos">${list.map(image=>`<figure><img ${local?'data-no-translate':''} loading="lazy" src="${escape(local?image.previewUrl:image.src)}" alt="${escape(local?image.originalName || image.filename:'Foto atual do produto')}"><figcaption ${local?'data-no-translate':''}>${escape(local?image.originalName || image.filename:'Foto atual')}</figcaption></figure>`).join('')}</div>`:'<p class="muted">Nenhuma foto.</p>';
}
function renderItems() {
  $('review').hidden=false;$('products').replaceChildren();
  const size=Number($('reviewPageSize').value),pages=[[]];let used=0,total=0;
  for(const original of state.items)for(let start=0;start<original.localImages.length;) {
    if(used===size){pages.push([]);used=0;}
    const chunk=original.localImages.slice(start,start+size-used);
    pages.at(-1).push({...original,localImages:chunk,totalImages:original.localImages.length});
    start+=chunk.length;used+=chunk.length;total+=chunk.length;
  }
  state.reviewPage=Math.max(0,Math.min(state.reviewPage,pages.length-1));
  $('reviewPage').replaceChildren();
  pages.forEach((_,i)=>$('reviewPage').add(new Option(String(i+1),String(i))));$('reviewPage').value=String(state.reviewPage);
  $('previousPage').disabled=state.busy||state.reviewPage===0;$('nextPage').disabled=state.busy||state.reviewPage===pages.length-1;
  $('pageSummary').textContent=`Página ${state.reviewPage+1} de ${pages.length} · imagens ${total?state.reviewPage*size+1:0} a ${Math.min((state.reviewPage+1)*size,total)} de ${total}.`;
  for(const item of pages[state.reviewPage]) {
    const card=document.createElement('article');card.className='product';
    const options=[...new Map([...(item.suggestions || []),...state.catalog].map(product=>[String(product.id),product])).values()];
    card.innerHTML=`<div class="product-heading"><label class="selection"><input data-select type="checkbox" value="${escape(item.sku)}" ${state.selection.has(item.sku)?'checked':''} ${item.status==='ok'?'':'disabled'}><span data-no-translate>${escape(item.product?.name || item.sourceFolder)}</span></label><span class="badge ${item.status==='ok'?'':'attention'}">${item.status==='ok'?'Pronto para conferir':'Escolha o produto'}</span></div>
      <p class="muted">Arquivos: ${escape(item.sourceFolder)} · ${item.localImages.length} foto(s)</p>
      <p>${item.status==='ok'?`Identificado ${item.matchReason==='sku'?'pelo SKU':item.matchReason==='manual'?'por sua escolha':'pelo nome'}. Confira antes de enviar.`:escape(item.error)}</p>
      <details ${item.status==='ok'?'':'open'}><summary>${item.status==='ok'?'Trocar o produto associado':'Associar estas fotos a um produto'}</summary>
        <label>Buscar produto pelo nome<input data-product-search type="search" placeholder="Digite parte do nome"></label>
        <label>Produto que receberá as fotos<select data-product-choice><option value="">Selecione um produto</option>${options.map(product=>`<option data-no-translate value="${escape(product.id)}">${escape(product.name)} (#${escape(product.id)})</option>`).join('')}</select></label><button type="button" class="secondary" data-match>Confirmar produto</button>
      </details><div class="photo-columns"><section><h3>Fotos que você selecionou</h3>${images(item.localImages,true)}</section><section><h3>Fotos atuais na loja</h3>${images(item.remoteImages,false)}</section></div>`;
    card.querySelector('[data-select]').addEventListener('change',event=>{if(event.target.checked)state.selection.add(item.sku);else state.selection.delete(item.sku);updateActions();});
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
        state.selection.add(item.sku);
        renderItems();message('Produto associado. Confira as fotos antes de enviar.');
      } catch(error){message(error.message,true);}finally{busy(false);}
    });
    $('products').append(card);
  }
  $('reviewSummary').textContent=`${state.items.filter(item=>item.status==='ok').length} de ${state.items.length} grupo(s) associado(s). Grupos sem produto não serão enviados.`;
  $('matchHelp').hidden=state.items.every(item=>item.product);
  updateActions();
}
async function preview() {
  const batch=batchGroups(),files=[...new Set(batch.flatMap(group=>group.files))];
  const form=new FormData();files.forEach(file=>form.append('images',file,file.name));
  form.append('individual',String($('individual').checked));
  form.append('inputMode',state.inputMode);
  form.append('manifest',JSON.stringify(files.map(file=>({path:file.webkitRelativePath || file.name}))));
  // Each CSV batch carries only its own rows, so the server validates exactly the photos sent.
  if(state.inputMode==='csv')form.append('csv',new Blob([buildCsv(batch.flatMap(group=>group.rows))],{type:'text/csv'}),$('csv').files[0]?.name || 'fotos.csv');
  busy(true,state.inputMode==='csv'?'Conferindo os SKUs e arquivos do CSV...':'Encontrando os produtos pelo nome das fotos. Aguarde...');
  try {
    const data=await request('/sync/preview',{method:'POST',body:form},300000);
    state.session=data.sessionId;state.items=data.items;state.catalog=data.catalog;
    state.selection=new Set(state.items.filter(item=>item.status==='ok').map(item=>item.sku));state.reviewPage=0;
    renderAccess(data.access);renderItems();
    message('Confira os produtos e as fotos abaixo. Nenhuma imagem da loja foi alterada.');
    $('review').scrollIntoView({block:'start'});
  } catch(error){message(error.timeout?'As fotos deste lote demoraram demais para enviar. Escolha um lote menor ou reduza o tamanho das fotos e tente novamente.':error.message,true);}finally{busy(false);}
}
function renderProgress(job) {
  const p=job.progress||{},stats=job.result?.stats||p,total=Number(p.total)||0,done=Number(p.completed)||0;
  const complete=job.status==='completed',failed=job.status==='failed';
  const percent=complete?100:Math.min(99,Math.max(0,total?Math.floor(done/total*100):0));
  $('progressPanel').hidden=false;$('uploadProgress').value=percent;
  $('progressTitle').textContent=failed?'Envio interrompido':complete?(job.dryRun?'Simulação concluída':stats.errors?'Envio concluído com erros':'Envio concluído'):(job.dryRun?'Simulando o lote...':'Enviando fotos...');
  $('progressText').textContent=`${percent}% · ${done} de ${total} produto(s) finalizado(s).`;
  $('progressStats').textContent=`Fotos enviadas: ${stats.uploaded||0}. Fotos já existentes: ${stats.skipped||0}. Erros: ${stats.errors||0}.`;
  $('progressNotice').textContent=failed?'O processamento foi interrompido. Algumas fotos podem ter sido enviadas. Consulte o suporte antes de repetir.':complete?'O processamento terminou. Confira o resultado e baixe o relatório quando disponível.':'O envio está em andamento. Aguarde a confirmação de conclusão.';
  $('resumeProgress').hidden=true;
}
async function watchJob(jobId) {
  let failures=0;
  for(;;) {
    let job;
    try{({job}=await request(`/sync/job/${jobId}`));failures=0;}
    catch(error){
      failures++;$('progressNotice').textContent='A conexão com o progresso falhou. O envio pode continuar no servidor. Estamos tentando atualizar.';
      if(failures>=3){$('resumeProgress').hidden=false;message('Não foi possível atualizar o progresso. Clique em Atualizar progresso antes de tentar outro envio.',true);return;}
      await new Promise(r=>setTimeout(r,1500));continue;
    }
    renderProgress(job);
    if(['completed','failed'].includes(job.status)) {
      state.jobId=null;
      if(!job.dryRun){state.session=null;state.selection.clear();document.querySelectorAll('[data-select]').forEach(input=>{input.checked=false;});}
      if(job.result?.reportDownloadUrl){$('report').href=job.result.reportDownloadUrl;$('report').hidden=false;}
      message($('progressTitle').textContent+'. '+$('progressStats').textContent,job.status==='failed'||Boolean(job.result?.stats?.errors));
      return;
    }
    await new Promise(r=>setTimeout(r,1500));
  }
}
async function run(dryRun) {
  const selectedSkus=selected(),mode=$('mode').value;
  const demoNotice=state.access?.paid?'':' '+t('Ao iniciar, você utiliza 1 dos seus lotes gratuitos disponíveis.');
  if(!dryRun && !window.confirm(mode==='replace'
    ?t('Este modo vai remover as fotos atuais dos produtos selecionados e enviar as novas. Confirma?')
    :t('Você conferiu os produtos e as fotos? Enviar agora?')+demoNotice))return;
  busy(true,dryRun?'Simulando o envio, sem alterar a loja...':'Enviando as fotos para a loja...');
  renderProgress({status:'running',dryRun,progress:{total:selectedSkus.length,completed:0}});
  $('progressPanel').scrollIntoView({block:'start'});
  try {
    const data=await request(`/sync/session/${state.session}/run`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({dryRun,mode,selectedSkus})});
    state.jobId=data.jobId;await watchJob(data.jobId);
  }catch(error){
    message(error.message,true);
    if(error.status){state.jobId=null;$('progressTitle').textContent='Envio não iniciado';$('progressNotice').textContent=error.message;}
    else{state.jobId='unknown';$('progressNotice').textContent='Não foi possível confirmar o início. Atualize o progresso antes de repetir o envio.';$('resumeProgress').hidden=false;}
  }finally{
    try{renderAccess(await request('/sync/access'));}catch{}
    busy(false);if(!state.session){$('simulate').disabled=true;$('send').disabled=true;}
  }
}
$('reviewPageSize').addEventListener('change',()=>{state.reviewPage=0;renderItems();});
$('reviewPage').addEventListener('change',()=>{state.reviewPage=Number($('reviewPage').value);renderItems();});
for(const [id,step] of [['previousPage',-1],['nextPage',1]])$(id).addEventListener('click',()=>{state.reviewPage+=step;renderItems();$('reviewPagination').scrollIntoView({block:'start'});});
$('resumeProgress').addEventListener('click',async()=>{
  busy(true);
  try{
    if(state.jobId==='unknown'){
      const data=await request('/sync/status');
      if(!data.job){message('Não encontramos confirmação do envio. Consulte o suporte antes de reenviar.',true);return;}
      state.jobId=data.job.id;
    }
    if(state.jobId)await watchJob(state.jobId);
  }catch(error){message(error.message,true);$('resumeProgress').hidden=false;}finally{busy(false);}
});
$('individual').addEventListener('change',()=>{state.session=null;state.items=[];state.selection.clear();$('review').hidden=true;updateBatches();updateActions();});
$('images').addEventListener('change',event=>selectFiles(event.target.files));
$('folder').addEventListener('change',event=>selectFiles(event.target.files));
$('csvImages').addEventListener('change',event=>selectFiles(event.target.files));
$('csv').addEventListener('change',async()=>{
  state.session=null;state.items=[];state.selection.clear();state.csvRows=null;$('review').hidden=true;$('report').hidden=true;
  const file=$('csv').files[0];$('csvCount').textContent=file?.name||'';
  if(file)try{state.csvRows=[...parseCsvAssignments(await file.text())].map(([key,row])=>({key,...row}));}catch(error){message(error.message,true);}
  updateBatches();updateActions();
});
for(const radio of document.querySelectorAll('[name="inputMode"]'))radio.addEventListener('change',()=>{
  if(!radio.checked)return;state.inputMode=radio.value;
  for(const id of ['images','folder','csv','csvImages'])$(id).value='';
  $('csvCount').textContent='';state.csvRows=null;$('individual').checked=false;
  for(const mode of ['images','folder','csv'])$(mode+'Panel').hidden=state.inputMode!==mode;
  $('groupOptions').hidden=state.inputMode==='csv';selectFiles([]);
});
for(const name of ['dragover','drop'])$('dropzone').addEventListener(name,event=>{
  event.preventDefault();if(name==='drop'&&state.inputMode==='images')selectFiles(event.dataTransfer.files);
});
$('preview').addEventListener('click',preview);
$('purchase').addEventListener('click',async()=>{
  if(state.access?.purchaseMode==='platform_once'){
    message('Abra Aplicativos no administrador da Nuvemshop e confira o pagamento do Imagem em Lote. Se já pagou, não compre novamente: fale com o suporte para recuperar o acesso.');
    return;
  }
  if(!confirm(t('Confirma a compra única de R$79,90 por loja, cobrada pela Nuvemshop, sem mensalidade?')))return;
  busy(true,'Solicitando a compra pela Nuvemshop...');
  try{
    const purchase=await request('/sync/purchase',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirmed:true})});
    renderAccess(await request('/sync/access'));
    message(purchase.managedBy==='nuvemshop'?'Abra Aplicativos no administrador da Nuvemshop e confira o pagamento do Imagem em Lote. Se já pagou, não compre novamente: fale com o suporte para recuperar o acesso.':purchase.status==='paid'?'Pagamento confirmado. Seu acesso está liberado.':purchase.status==='pending'?'Cobrança solicitada. Consulte os pagamentos no administrador da Nuvemshop. O acesso será liberado após a confirmação.':'A criação da cobrança está sendo verificada. Fale com o suporte antes de tentar novamente.');
  }catch(error){message(error.message,true);}finally{busy(false);}
});
$('refreshAccess').addEventListener('click',async()=>{
  busy(true,'Verificando a confirmação do pagamento...');
  try {
    const access=await request('/sync/access');renderAccess(access);
    message(access.paid?'Pagamento confirmado. Seu acesso está liberado.':'A Nuvemshop ainda não confirmou o pagamento. Aguarde a compensação e tente novamente.');
  }catch(error){message(error.message,true);}finally{busy(false);}
});
$('simulate').addEventListener('click',()=>run(true));$('send').addEventListener('click',()=>run(false));
$('batchSize').addEventListener('change',()=>{state.session=null;$('review').hidden=true;updateBatches();updateActions();});$('batchPage').addEventListener('change',()=>{state.session=null;$('review').hidden=true;updateWeight();updateActions();});
$('mode').addEventListener('change',()=>{$('modeHelp').textContent=$('mode').value==='add'?'As fotos atuais serão mantidas.':$('mode').value==='sync'?'Atualiza fotos enviadas anteriormente por este app que tenham mudado.':'Atenção: remove todas as fotos atuais dos produtos selecionados.';updateActions();});
async function initialize() {
  try {
    const connection=await request('/auth/status');state.connected=Boolean(connection.connected && connection.storeId);
    state.paymentRequired=Boolean(connection.paymentRequired);
    state.apiAvailable=state.connected && connection.apiAvailable!==false;
    $('connection').textContent=state.connected?`${t('Loja conectada')} · ${connection.storeId}`:'Conecte a loja para começar';
    $('connect').hidden=state.connected;
    if(state.connected){platform.value=connection.platform==='yampi'?'yampi':'nuvemshop';updatePlatform();}
    $('platformLabel').hidden=state.connected;
    $('disconnect').hidden=!state.connected || connection.platform!=='yampi';
    $('connectionIssue').hidden=!state.paymentRequired;
    if(state.paymentRequired)message('A loja está conectada. A Nuvemshop bloqueou o acesso aos produtos até a regularização do pagamento do aplicativo. Suas fotos ainda não foram enviadas.',true);
    if(state.connected)renderAccess(await request('/sync/access'));
    if(state.connected){
      const active=await request('/sync/status');
      if(active.running&&active.job){state.jobId=active.job.id;busy(true);renderProgress(active.job);try{await watchJob(state.jobId);}finally{busy(false);}}
    }
  } catch(error){message(error.message,true);}
  updateActions();
}
$('disconnect').addEventListener('click',async()=>{
  if(!confirm(t('Desconectar esta loja Yampi? O lote gratuito utilizado não será reiniciado.')))return;
  try{await request('/auth/yampi/disconnect',{method:'POST'});location.href='/?platform=yampi';}
  catch(error){message(error.message,true);}
});
initialize();
