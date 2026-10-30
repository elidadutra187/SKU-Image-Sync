/* ElunaLab access notice v1. Backend decisions only; no financial requests. */
(() => {
 'use strict';
 if(window.ElunaBillingNotice)return;
 const help='https://atendimento.nuvemshop.com.br/pt_BR/pague-seu-plano/como-e-feito-o-pagamento-dos-aplicativos-instalados-na-minha-nuvemshop';
 const words={
  pt:{payment:'Pagamento pendente',paymentBody:'O acesso está bloqueado até a confirmação do pagamento. Confira a assinatura do aplicativo na plataforma da sua loja.',missing:'Assinatura não encontrada',missingBody:'A plataforma não localizou uma assinatura para este aplicativo. Isso não confirma uma dívida. Fale com o suporte para verificar a ativação.',unknown:'Não foi possível verificar a assinatura',unknownBody:'O acesso está temporariamente bloqueado porque não conseguimos confirmar a assinatura. Tente novamente ou fale com o suporte.',regularize:'Como regularizar',support:'Falar com o suporte',retry:'Verificar novamente',close:'Entendi',open:'Ver aviso',label:'Aviso sobre o acesso'},
  en:{payment:'Payment pending',paymentBody:'Access is blocked until payment is confirmed. Check the app subscription in your store platform.',missing:'Subscription not found',missingBody:'The platform did not find a subscription for this app. This does not confirm an outstanding debt. Contact support to check activation.',unknown:'Could not verify the subscription',unknownBody:'Access is temporarily blocked because we could not confirm the subscription. Try again or contact support.',regularize:'How to resolve',support:'Contact support',retry:'Check again',close:'Got it',open:'View notice',label:'Access notice'},
  es:{payment:'Pago pendiente',paymentBody:'El acceso está bloqueado hasta confirmar el pago. Revisa la suscripción de la app en la plataforma de tu tienda.',missing:'No se encontró la suscripción',missingBody:'La plataforma no encontró una suscripción para esta app. Esto no confirma una deuda. Contacta al soporte para verificar la activación.',unknown:'No se pudo verificar la suscripción',unknownBody:'El acceso está temporalmente bloqueado porque no pudimos confirmar la suscripción. Intenta nuevamente o contacta al soporte.',regularize:'Cómo regularizar',support:'Contactar al soporte',retry:'Verificar nuevamente',close:'Entendido',open:'Ver aviso',label:'Aviso de acceso'}
 };
 let current=null,banner,dialog,seen=new Set(),focusBefore=null;
 try{seen=new Set(JSON.parse(sessionStorage.getItem('eluna:billing:seen')||'[]'));}catch{}
 function node(tag,text,attribute){const n=document.createElement(tag);if(text)n.textContent=text;if(attribute)n.setAttribute(attribute,'');return n;}
 function category(s){const status=s.status||s.state||'';if(['missing_subscription','subscription_missing'].includes(status))return 'missing';if(['payment_required','payment_pending','payment_blocked','suspended','past_due','expired','unpaid'].includes(status))return 'payment';return 'unknown';}
 function persist(){try{sessionStorage.setItem('eluna:billing:seen',JSON.stringify([...seen].slice(-100)));}catch{}}
 function key(s){return location.host+location.pathname.split('/')[1]+':'+(s.platform||'nuvemshop')+':'+String(s.storeId||s.store_id||'connected');}
 function close(remember=true){if(!dialog?.open)return;if(remember&&current){seen.add(key(current));persist();}if(typeof dialog.close==='function')dialog.close();else dialog.removeAttribute('open');(banner?.querySelector('[data-billing-open]')||focusBefore)?.focus();}
 function show(){if(!dialog||dialog.open||banner.hidden)return;focusBefore=document.activeElement;if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');if(current){seen.add(key(current));persist();}dialog.querySelector('[data-billing-close]').focus();}
 function safeLink(value,fallback){if(typeof value!=='string')return fallback;try{const u=new URL(value,location.origin);return u.origin===location.origin&&(u.protocol==='https:'||u.protocol==='http:')?u.pathname+u.search+u.hash:fallback;}catch{return fallback;}}
 function build(){
  if(banner?.isConnected&&dialog?.isConnected)return;
  banner=node('section');banner.id='eluna-billing-notice';banner.className='eluna-billing-notice';banner.hidden=true;banner.setAttribute('role','status');banner.setAttribute('aria-live','polite');
  const content=node('div');content.className='eluna-billing-copy';const title=node('h2');title.dataset.billingTitle='';const description=node('p');description.dataset.billingBody='';content.append(title,description);banner.append(content);
  const actions=node('div');actions.className='eluna-billing-actions';const action=node('a',null,'data-billing-action');action.target='_blank';action.rel='noopener noreferrer';const retry=node('button',null,'data-billing-retry');retry.type='button';retry.addEventListener('click',()=>window.dispatchEvent(new CustomEvent('eluna:billing-retry')));const open=node('button',null,'data-billing-open');open.type='button';open.addEventListener('click',show);actions.append(action,retry,open);banner.append(actions);
  const mount=document.querySelector('[data-billing-notice-mount]')||document.querySelector('main')||document.body;mount.prepend(banner);
  dialog=node('dialog');dialog.id='eluna-billing-dialog';dialog.className='eluna-billing-dialog';dialog.setAttribute('aria-labelledby','eluna-billing-dialog-title');dialog.setAttribute('aria-describedby','eluna-billing-dialog-description');const dt=node('h2');dt.id='eluna-billing-dialog-title';const dd=node('p');dd.id='eluna-billing-dialog-description';const da=node('a',null,'data-billing-action');da.target='_blank';da.rel='noopener noreferrer';const dc=node('button',null,'data-billing-close');dc.type='button';dc.addEventListener('click',()=>close());const group=node('div');group.className='eluna-billing-actions';group.append(da,dc);dialog.append(dt,dd,group);dialog.addEventListener('cancel',e=>{e.preventDefault();close();});document.body.append(dialog);
 }
 function update(s){
  current=s;
  if(!s?.connected||s.allowed!==false){if(banner)banner.hidden=true;close(false);return;}
  build();
  const lang=(document.documentElement.lang||'pt').split('-')[0],w=words[lang]||words.pt,type=category(s),title=w[type==='unknown'?'unknown':type],body=w[type==='unknown'?'unknownBody':type+'Body'];
  banner.hidden=false;banner.dataset.state=type;banner.setAttribute('aria-label',w.label);banner.querySelector('[data-billing-title]').textContent=title;banner.querySelector('[data-billing-body]').textContent=body;dialog.querySelector('h2').textContent=title;dialog.querySelector('p').textContent=body;
  const support=safeLink(s.supportUrl,'/support.html');
  const href=type==='payment'?(s.platform==='yampi'?safeLink(s.billingUrl,support):help):support;
  for(const a of [banner,dialog].flatMap(el=>[...el.querySelectorAll('[data-billing-action]')])){a.href=href;a.textContent=type==='payment'?w.regularize:w.support;}
  banner.querySelector('[data-billing-retry]').textContent=w.retry;banner.querySelector('[data-billing-open]').textContent=w.open;dialog.querySelector('[data-billing-close]').textContent=w.close;
  if(!seen.has(key(s)))show();
 }
 window.ElunaBillingNotice={update};
 window.addEventListener('eluna:billing',event=>update(event.detail));
 new MutationObserver(()=>{if(current&&window.document)update(current);}).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
})();
