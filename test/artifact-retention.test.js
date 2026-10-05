import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const module=await import('../services/syncArtifacts.js').catch(()=>({}));
test('redaction finds store reports after restarting the process',async()=>{
  assert.equal(typeof module.reportNameForStore,'function');
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'imagem-restart-'));
  try {
    const own=module.reportNameForStore('123'),other=module.reportNameForStore('456');
    await fs.writeFile(path.join(root,own),'private');await fs.writeFile(path.join(root,other),'other');
    await module.createArtifactRegistry({root}).deleteStore('123');
    await assert.rejects(()=>fs.stat(path.join(root,own)),e=>e.code==='ENOENT');
    assert.equal(await fs.readFile(path.join(root,other),'utf8'),'other');
  }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('expired reports are inaccessible and redaction deletes only that stores files',async()=>{
  assert.equal(typeof module.createArtifactRegistry,'function');
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'imagem-reports-'));
  let now=100;const registry=module.createArtifactRegistry({root,ttlMs:10,now:()=>now});
  try{
    await fs.writeFile(path.join(root,'a.csv'),'private');await fs.writeFile(path.join(root,'b.csv'),'other');
    registry.registerReport('a.csv','123');registry.registerReport('b.csv','456');
    assert.equal(registry.reportOwner('a.csv'),'123');
    await registry.deleteStore('123');assert.equal(registry.reportOwner('a.csv'),null);
    assert.equal(await fs.readFile(path.join(root,'b.csv'),'utf8'),'other');
    assert.throws(()=>registry.registerReport('../escape.csv','123'));
    now=111;assert.equal(registry.reportOwner('b.csv'),null);
    await registry.cleanup();await assert.rejects(()=>fs.stat(path.join(root,'b.csv')),e=>e.code==='ENOENT');
  }finally{await fs.rm(root,{recursive:true,force:true});}
});
