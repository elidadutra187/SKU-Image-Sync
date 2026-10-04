import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {createUploadSession, deleteUploadSession, getSessionImagePath} from '../services/uploadSessions.js';
test('flat uploads group numbered photos without merging different product names', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'sku-upload-'));
  const names = ['Camiseta Azul_01.jpg','Camiseta Azul_02.jpg','Camiseta Verde_01.jpg'];
  const files = await Promise.all(names.map(async (name,index) => {
    const filePath=path.join(dir,String(index)); await fs.writeFile(filePath,'image');
    return {path:filePath,originalname:name,size:5};
  }));
  const session = await createUploadSession({files,manifest:[],storeId:'test'});
  try {
    assert.equal(session.groups.length,2);
    assert.equal(session.groups.find(group=>group.sourceFolder==='Camiseta Azul').images.length,2);
    const group=session.groups[0];
    assert.equal(getSessionImagePath(session.id,group.sku,'../other.jpg'),null);
    assert.equal(getSessionImagePath(session.id,group.sku,'not-uploaded.jpg'),null);
  } finally { await deleteUploadSession(session.id); await fs.rm(dir,{recursive:true,force:true}); }
});
