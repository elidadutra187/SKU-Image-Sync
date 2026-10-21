import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

test('translation and footer observers settle and leave the event loop responsive',()=>{
  const child=spawnSync(process.execPath,['--input-type=module','-e',`
    import fs from 'node:fs';
    import assert from 'node:assert/strict';
    import {JSDOM} from 'jsdom';
    import {translate} from './public/locales.js';
    const dom=new JSDOM('<!doctype html><html lang="pt-BR"><head><title>Imagem em Lote</title></head><body><main><p>Selecione as fotos</p></main></body></html>',{url:'https://example.test',runScripts:'outside-only'});
    const w=dom.window;
    let mutations=0;
    const counter=new w.MutationObserver(records=>{mutations+=records.length;});
    counter.observe(w.document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true});
    w.translate=translate;
    w.eval(fs.readFileSync('public/elunalab-footer.js','utf8'));
    w.eval(fs.readFileSync('public/i18n.js','utf8').replace(/^import .*;\\r?\\n/,'').replaceAll('export const ','const '));
    await new Promise(resolve=>setTimeout(resolve,30));
    const select=w.document.querySelector('#app-language');
    for(const language of ['en','es','pt-BR']){
      select.value=language;select.dispatchEvent(new w.Event('change'));
      await new Promise(resolve=>setTimeout(resolve,30));
      assert.equal(w.document.documentElement.lang,language);
      assert.match(w.document.querySelector('#elunalab-credit').textContent,language==='en'?/Created by/:language==='es'?/Creado por/:/Criado pela/);
      const settledCount=mutations;
      await new Promise(resolve=>setTimeout(resolve,40));
      assert.equal(mutations,settledCount,'Translation and footer must stop mutating once the language has settled');
    }
    w.document.querySelector('main').append(w.document.createTextNode('Processando: 2 de 10 produto(s).'));
    await new Promise(resolve=>setTimeout(resolve,30));
    counter.disconnect();w.close();
  `],{cwd:process.cwd(),encoding:'utf8',timeout:15000});
  assert.ifError(child.error);
  assert.equal(child.status,0,child.stderr);
});
