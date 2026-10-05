import {translate} from './locales.js';
const supported=['pt-BR','en','es'],key='imagememlote.language';
let language='pt-BR';
try{const saved=localStorage.getItem(key);if(supported.includes(saved))language=saved;}catch{}
const originals=new WeakMap();
export const t=text=>translate(text,language);
export const currentLanguage=()=>language;

const toolbar=document.createElement('div');toolbar.className='language-toolbar';
toolbar.innerHTML='<label for="app-language">Idioma / Language</label><select id="app-language" aria-label="Idioma / Language"><option value="pt-BR">Português (Brasil)</option><option value="en">English</option><option value="es">Español</option></select>';
document.querySelector('main').prepend(toolbar);
const selector=toolbar.querySelector('select');selector.value=language;
const style=document.createElement('style');style.textContent='.language-toolbar{display:flex;justify-content:flex-end;align-items:center;gap:12px;margin:0 0 24px;font:14px system-ui}.language-toolbar label{margin:0;font-weight:600}.language-toolbar select{width:auto!important;min-width:150px;min-height:44px;padding:8px 12px;margin:0;border:1px solid #b7c5d8;border-radius:8px;background:white;color:#17243a;font:15px system-ui}';document.head.append(style);
function render() {
  observer.disconnect();document.documentElement.lang=language;
  const walk=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
  while(walk.nextNode()) {
    const node=walk.currentNode;
    if(!node.textContent.trim() || node.parentElement.closest('script,style,.language-toolbar,[data-no-translate]'))continue;
    const previous=originals.get(node);
    const original=previous && node.textContent===previous.rendered?previous.original:node.textContent;
    const rendered=t(original);if(node.textContent!==rendered)node.textContent=rendered;
    originals.set(node,{original,rendered});
  }
  for(const element of document.querySelectorAll('[placeholder],[aria-label],[alt],[title],title')) {
    if(element.closest('.language-toolbar,[data-no-translate]'))continue;
    const records=originals.get(element) || {};
    for(const attr of ['placeholder','aria-label','alt','title']) {
      if(!element.hasAttribute(attr))continue;
      const value=element.getAttribute(attr),previous=records[attr];
      const original=previous && value===previous.rendered?previous.original:value;
      const rendered=t(original);if(value!==rendered)element.setAttribute(attr,rendered);
      records[attr]={original,rendered};
    }
    if(element.tagName==='TITLE'){
      const value=element.textContent,previous=records.text;
      const original=previous && value===previous.rendered?previous.original:value;
      const rendered=t(original);element.textContent=rendered;records.text={original,rendered};
    }
    originals.set(element,records);
  }
  observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['placeholder','aria-label','alt','title']});
}
const observer=new MutationObserver(render);
window.addEventListener('pagehide',()=>observer.disconnect());
window.addEventListener('pageshow',render);
selector.addEventListener('change',()=>{language=selector.value;try{localStorage.setItem(key,language);}catch{}render();window.dispatchEvent(new CustomEvent('app-language-change',{detail:language}));});
window.addEventListener('storage',event=>{if(event.key===key && supported.includes(event.newValue)){language=event.newValue;selector.value=language;render();}});
window.ImagemEmLoteI18n={t,currentLanguage};
render();
