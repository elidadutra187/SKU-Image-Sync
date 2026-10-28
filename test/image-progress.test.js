import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {ImageSyncService} from '../services/imageSync.js';
test('image counter advances after each confirmed photo, before product completes',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'image-progress-'));const filePath=path.join(dir,'photo.jpg');await fs.writeFile(filePath,'photo');
 const updates=[];const service=new ImageSyncService({onProgress:p=>updates.push(p)});
 service.client={uploadProductImage:async()=>({id:7}),delay:async()=>{}};service.report={addSuccess:async()=>{}};
 try{await service.uploadImage(1,'SKU',{filename:'photo.jpg',filePath,size:5,hash:'hash'},1,{files:{}});assert.equal(updates.at(-1)?.uploaded,1);}
 finally{await fs.rm(dir,{recursive:true,force:true});}
});
