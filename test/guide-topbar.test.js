import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {JSDOM} from 'jsdom';

test('ElunaLab topbar, help icons and didactic guide',async()=>{
  const index=await fs.readFile('public/index.html','utf8');
  for(const page of ['index','how-to','privacy']){
    const html=await fs.readFile(`public/${page}.html`,'utf8');
    assert.match(html,/<header class="eluna-topbar">/,page);
    assert.match(html,/eluna-brand-company">ELUNA LAB</,page);
    assert.match(html,/data-eluna-support href="https:\/\/elunalab\.com\.br\/suporte" target="_blank"/,page);
    assert.match(html,/id="elunaLangSlot"/,page);
  }
  assert.match(index,/data-eluna-connection data-connected-when="#connection"/);
  const dom=new JSDOM(await fs.readFile('public/how-to.html','utf8'),{url:'https://imagens.example/how-to',runScripts:'outside-only'});
  for(const file of ['eluna-ui.js','guide-content.js','eluna-guide-page.js'])dom.window.eval(await fs.readFile(`public/${file}`,'utf8'));
  await new Promise(resolve=>dom.window.setTimeout(resolve,30));
  const {document}=dom.window;
  for(const locale of ['pt-BR','es','en']){
    document.documentElement.lang=locale;await new Promise(resolve=>dom.window.setTimeout(resolve,10));
    const steps=document.querySelectorAll('.eluna-guide-step');assert.equal(steps.length,8,locale);
    for(const link of document.querySelectorAll('.eluna-guide-go')){const id=link.getAttribute('href').split('#')[1];assert.ok(index.includes(`id="${id}"`),`${locale} -> ${id}`);}
    assert.ok(document.querySelectorAll('.eluna-guide-q').length>=4);
    assert.equal(document.querySelector('.eluna-guide-support a').href,'https://elunalab.com.br/suporte');
  }
  for(const m of index.matchAll(/data-guide-step="(\d+)"/g))assert.ok(Number(m[1])>=1&&Number(m[1])<=8);
  dom.window.close();
});
