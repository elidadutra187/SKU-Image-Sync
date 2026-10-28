import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createUploadSession,deleteUploadSession} from '../services/uploadSessions.js';
const names=['Porcelanato_Delta_Armani_Acqua_120x120_Acetinado__01.jpg','Porcelanato_Delta_Armani_Acqua_120x120_Acetinado__02.jpg','Porcelanato_Delta_Basalto_90x90_Acetinado__01.jpg'];
const catalog=[{id:1,name:'Porcelanato Delta Armani Acqua 120x120 Acetinado',variants:[{sku:'0001'}]},{id:2,name:'Porcelanato Delta Basalto 90x90 Acetinado',variants:[{sku:'0002'}]}];
async function session(options,check) {
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'image-inputs-'));let s;
 try {const files=await Promise.all((options.names||names).map(async(name,i)=>{const p=path.join(dir,String(i));await fs.writeFile(p,'image');return{path:p,originalname:name,size:5};}));
 s=await createUploadSession({files,catalog,storeId:'test',...options});await check(s);
 }finally{if(s)await deleteUploadSession(s.id);await fs.rm(dir,{recursive:true,force:true});}
}
test('Desktop fotos root folder groups product filenames identically to image selection',async()=>{
 await session({inputMode:'folder',manifest:names.map(n=>({path:'fotos/'+n}))},s=>{
  assert.equal(s.groups.length,2);assert.equal(s.groups.find(g=>g.sourceFolder.includes('Armani')).images.length,2);
 });
});
test('SKU subfolders still group arbitrary camera filenames',async()=>{
 await session({names:['IMG_001.jpg','IMG_002.jpg'],inputMode:'folder',manifest:[{path:'fotos/0001 - Piso/IMG_001.jpg'},{path:'fotos/0001 - Piso/IMG_002.jpg'}]},s=>{
  assert.equal(s.groups.length,1);assert.equal(s.groups[0].sourceFolder,'0001 - Piso');
 });
});
test('selecting a SKU folder itself still resolves its arbitrary filenames',async()=>{
 await session({names:['IMG_001.jpg','IMG_002.jpg'],inputMode:'folder',manifest:[{path:'0001 - Piso/IMG_001.jpg'},{path:'0001 - Piso/IMG_002.jpg'}]},s=>{
  assert.equal(s.groups.length,1);assert.equal(s.groups[0].sourceFolder,'0001 - Piso');
 });
});
test('CSV maps arbitrary photos to SKUs preserving leading zero and quoted semicolon names',async()=>{
 await session({names:['foto;1.jpg','foto2.jpg'],inputMode:'csv',csvText:'\uFEFFsku;arquivo\r\n0001;"foto;1.jpg"\r\n0002;foto2.jpg'},s=>{
  assert.equal(s.groups.length,2);assert.deepEqual(s.groups.map(g=>g.csvSku).sort(),['0001','0002']);
 });
});
test('CSV missing file does not silently produce an empty successful preview',async()=>{
 await assert.rejects(()=>session({inputMode:'csv',csvText:'sku,arquivo\n0001,inexistente.jpg'},()=>{}),/inexistente.jpg/);
});
test('CSV conflicting targets for same file is rejected',async()=>{
 await assert.rejects(()=>session({inputMode:'csv',csvText:'sku,arquivo\n0001,'+names[0]+'\n0002,'+names[0]},()=>{}),/mais de um SKU/);
});
