import fs from 'node:fs';

type RenameIo={platform:NodeJS.Platform;rename:(from:string,to:string)=>void;wait:(ms:number)=>void};
const waits=new Int32Array(new SharedArrayBuffer(4));
const nativeIo:RenameIo={platform:process.platform,rename:(from,to)=>fs.renameSync(from,to),wait:ms=>{Atomics.wait(waits,0,0,ms);}};
const delays=[10,20,40,80,100] as const;

/** Replace one already-fsynced candidate; never retry the domain transaction. */
export function replaceJsonFileSync(temporary:string,destination:string,assertCurrent:()=>void,io:RenameIo=nativeIo):void {
  for(let attempt=0;;attempt++){
    // Validation errors must escape immediately, never become a retried commit.
    assertCurrent();
    try{io.rename(temporary,destination);return;}
    catch(error){
      const code=error&&typeof error==='object'&&'code' in error?error.code:undefined;
      if(io.platform!=='win32'||!['EPERM','EACCES','EBUSY'].includes(String(code))||attempt>=delays.length)throw error;
    }
    // Keep saveDb synchronous so its admitted writer turn cannot finish early.
    io.wait(delays[attempt]);
  }
}
