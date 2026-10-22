import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
export const STORE_LOCK_NAME='.server-lock.json';
/** The transfer process holds the same exclusive lease the application checks.
 * It never guesses whether an existing lease is safe to reclaim. */
export function whileStopped<T>(files:string[],operation:()=>T):T {
 const leases:Array<{file:string;body:string}>=[];
 try {
  for(const dir of [...new Set(files.map(file=>path.dirname(file)))].sort()){
   const file=path.join(dir,STORE_LOCK_NAME),body=JSON.stringify({pid:process.pid,operation:'storage-transfer',nonce:crypto.randomUUID()});
   try{fs.writeFileSync(file,body,{flag:'wx',mode:0o600});}catch{throw Error('Stop the owning application and resolve its lease before storage transfer.');}
   leases.push({file,body});
  }
  return operation();
 }finally{for(const lease of leases.reverse())if(fs.readFileSync(lease.file,'utf8')===lease.body)fs.unlinkSync(lease.file);}
}
