import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {getJob,forgetJob} from './syncJobs.js';
const RETENTION_MS=24*60*60*1000;
const storePrefix=storeId=>'imagem-'+crypto.createHash('sha256').update(String(storeId)).digest('hex')+'-';
export const reportNameForStore=storeId=>storePrefix(storeId)+crypto.randomUUID()+'.csv';
export function createArtifactRegistry({root=path.resolve('reports'),ttlMs=RETENTION_MS,now=Date.now}={}) {
  const reports=new Map(),jobs=new Map();
  const expired=record=>now()-record.createdAt>=ttlMs;
  const validFile=name=>/^[a-zA-Z0-9_.-]+\.csv$/.test(name) && path.basename(name)===name;
  async function removeReport(name){if(!validFile(name))throw new Error('invalid_report_name');await fs.rm(path.resolve(root,name),{force:true});reports.delete(name);}
  return {
    registerReport(name,storeId){if(!validFile(name))throw new Error('invalid_report_name');reports.set(name,{storeId,createdAt:now()});},
    reportOwner(name){const record=reports.get(name);return record && !expired(record)?record.storeId:null;},
    registerJob(id,storeId){jobs.set(id,{storeId,createdAt:now()});},
    jobOwner(id){const record=jobs.get(id);return record && (!expired(record) || getJob(id)?.status==='running')?record.storeId:null;},
    async cleanup(){
      for(const [name,record] of reports)if(expired(record))await removeReport(name);
      for(const [id,record] of jobs)if(expired(record) && getJob(id)?.status!=='running'){jobs.delete(id);forgetJob(id);}
      // Files from a previous process have no owner registry and must not accumulate.
      for(const entry of await fs.readdir(root,{withFileTypes:true}).catch(()=>[]))if(entry.isFile() && validFile(entry.name)){
        const file=path.resolve(root,entry.name),stat=await fs.stat(file).catch(()=>null);
        if(stat && now()-stat.mtimeMs>=ttlMs && !reports.has(entry.name))await fs.rm(file,{force:true});
      }
    },
    async deleteStore(storeId){
      for(const [name,record] of reports)if(record.storeId===storeId)await removeReport(name);
      for(const entry of await fs.readdir(root,{withFileTypes:true}).catch(()=>[]))
        if(entry.isFile() && entry.name.startsWith(storePrefix(storeId)) && validFile(entry.name))await removeReport(entry.name);
      for(const [id,record] of jobs)if(record.storeId===storeId){jobs.delete(id);forgetJob(id);}
    }
  };
}
export const syncArtifacts=createArtifactRegistry();
export function startArtifactCleanup(){
  syncArtifacts.cleanup().catch(()=>{});
  const timer=setInterval(()=>syncArtifacts.cleanup().catch(()=>{}),30*60*1000);timer.unref();return timer;
}
