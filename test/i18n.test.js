import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {translate,rows} from '../public/locales.js';

test('all pages switch languages, retain selection and translate dynamic updates without altering merchant data',async()=>{
  const runtime=(await fs.readFile('public/i18n.js','utf8')).replace(/^import .*;\n/,'').replaceAll('export const ','const ');
  for(const page of ['index','how-to','support','privacy']) {
    const dom=new JSDOM(await fs.readFile(`public/${page}.html`,'utf8'),{url:`https://imagememlote.onrender.com/${page}`,runScripts:'outside-only'});
    const w=dom.window;w.translate=translate;w.eval(runtime);
    const select=w.document.querySelector('#app-language');
    for(const language of ['en','es','pt-BR']) {
      select.value=language;select.dispatchEvent(new w.Event('change'));
      assert.equal(w.document.documentElement.lang,language);
      assert.equal(w.localStorage.getItem('imagememlote.language'),language);
      assert.equal(w.document.querySelectorAll('#app-language').length,1);
      if(page==='support')assert.equal(w.document.querySelector('#name').placeholder,language==='en'?'Your name':language==='es'?'Tu nombre':'Seu nome');
    }
    const original='Seus 10 lotes gratuitos já foram utilizados. O pagamento único de R$79,90 libera novos lotes e reutilizações.';
    const status=w.document.createElement('p');status.textContent=original;w.document.body.append(status);
    const merchant=w.document.createElement('span');merchant.dataset.noTranslate='';merchant.textContent='Camiseta Azul';w.document.body.append(merchant);
    select.value='en';select.dispatchEvent(new w.Event('change'));
    assert.match(status.textContent,/10 free batches/);assert.equal(merchant.textContent,'Camiseta Azul');
    status.textContent='Processando: 2 de 10 produto(s).';await new Promise(resolve=>setTimeout(resolve,5));
    assert.equal(status.textContent,'Processing: 2 of 10 product(s).');
    select.value='es';select.dispatchEvent(new w.Event('change'));assert.equal(status.textContent,'Procesando: 2 de 10 producto(s).');
    select.value='pt-BR';select.dispatchEvent(new w.Event('change'));assert.equal(status.textContent,'Processando: 2 de 10 produto(s).');
    const persisted=new JSDOM(await fs.readFile('public/privacy.html','utf8'),{url:'https://imagememlote.onrender.com/privacy',runScripts:'outside-only'});
    persisted.window.localStorage.setItem('imagememlote.language','es');persisted.window.translate=translate;persisted.window.eval(runtime);
    assert.equal(persisted.window.document.documentElement.lang,'es');assert.match(persisted.window.document.body.textContent,/Política de privacidad/);
    persisted.window.dispatchEvent(new persisted.window.Event('pagehide'));w.dispatchEvent(new w.Event('pagehide'));
    persisted.window.close();w.close();
  }
});

test('interface text across all pages has English and Spanish translations',async()=>{
  const ignored=new Set(['Imagem em Lote','1','2','3','·','.','elunalab@gmail.com']);
  for(const page of ['index','how-to','support','privacy']) {
    const dom=new JSDOM(await fs.readFile(`public/${page}.html`,'utf8'));
    const walk=dom.window.document.createTreeWalker(dom.window.document.body,dom.window.NodeFilter.SHOW_TEXT);
    while(walk.nextNode()){
      const node=walk.currentNode,text=node.textContent.trim();
      if(!text || ignored.has(text) || node.parentElement.closest('script,style,code'))continue;
      for(const lang of ['en','es'])assert.ok(rows.some(row=>row[0]===text && row[lang==='en'?1:2]),`Missing ${lang} translation: ${page}: ${text}`);
    }
    dom.window.close();
  }
});
