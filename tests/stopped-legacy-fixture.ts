// Exercise already-invalid legacy authority without adding a production bypass.
// The actual writer MUST be stopped before this isolated fixture is changed.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {spawn,type ChildProcess} from 'node:child_process';import {SqliteRecords} from '../src/server/sqlite-records';
export async function stoppedLegacyFixture(child:ChildProcess,root:string,sqlite:boolean,base:string,change:(db:any)=>void):Promise<ChildProcess>{
 const resolved=path.resolve(root).replaceAll('\\','/');assert.ok(resolved.startsWith('C:/Users/reza/Desktop/پروژه‌ها/انتشار موقت khazaneh/work/'));assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname));
 if(child.exitCode===null&&child.signalCode===null){child.kill();await new Promise(r=>child.once('exit',r));}assert.ok(child.exitCode!==null||child.signalCode!==null);
 if(sqlite){const s=new SqliteRecords(root+'/treasury.sqlite',false);try{const before=s.read(),next=structuredClone(before);change(next);s.commit(next,before,s.signature());}finally{s.close();}}else{const db=JSON.parse(fs.readFileSync(root+'/treasury-db.json','utf8'));change(db);fs.writeFileSync(root+'/treasury-db.json',JSON.stringify(db));}
 const args=child.spawnargs.slice(1),entry=args.find(a=>a.endsWith('/server.cjs')||a.endsWith('\\server.cjs'));
 const restarted=spawn(process.execPath,args,{cwd:entry?path.dirname(entry):process.cwd(),env:{...process.env,PORT:new URL(base).port,NODE_ENV:'production',TREASURY_TEST_DIR:root,TREASURY_DATA_DIR:root,TREASURY_STORAGE_MODE:sqlite?'sqlite':'json',DISABLE_EXTERNAL_INTEGRATIONS:'true'},windowsHide:true,stdio:'ignore'});
 for(let i=0;i<100;i++){if(restarted.exitCode!==null)throw Error('Legacy fixture server exited');try{if((await fetch(base+'/api/health')).ok)return restarted;}catch{}await new Promise(r=>setTimeout(r,50));}
 restarted.kill();throw Error('Legacy fixture readiness failed');
}
