// Test-process preload only; never imported by application code or release bundles.
import fs from 'node:fs';import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
const root=process.env.TREASURY_TEST_DIR,allowed='C:/Users/reza/Desktop/پروژه‌ها/انتشار موقت khazaneh/work/';
if(!root||!path.isAbsolute(root)||!path.resolve(root).replaceAll('\\','/').startsWith(allowed)||path.resolve(process.env.TREASURY_DATA_DIR||'')!==path.resolve(root)||process.env.DISABLE_EXTERNAL_INTEGRATIONS!=='true')throw Error('Explicit isolated fixture required for commit fault injection');
// PM2's IPC listener can keep a failed initializer alive despite exitCode=1.
// This opt-in belongs only to a freshly spawned synthetic regression process.
if(process.env.TREASURY_TEST_KEEP_INIT_ALIVE==='true'){
 if(!process.connected||!process.send)throw Error('explicit test IPC channel required');
 process.on('message',()=>{});
}
const original=fs.renameSync,db=path.join(path.resolve(root),'treasury-db.json'),marker=path.join(root,'test-fail-next-commit');
fs.renameSync=function(from,to){if(path.resolve(String(to))===db&&fs.existsSync(marker)){fs.unlinkSync(marker);throw Object.assign(Error('Synthetic commit failure'),{code:'EIO'});}return original.apply(this,arguments);};
const read=fs.readFileSync;
fs.readFileSync=function(file,...args){if(path.resolve(String(file))===db&&fs.existsSync(path.join(root,'test-count-db-reads')))fs.appendFileSync(path.join(root,'test-db-read-count'),'R');return read.call(this,file,...args);};
// A scalar copy counter for explicitly tagged synthetic history; no payloads.
const slice=Array.prototype.slice;
Array.prototype.slice=function(...args){if(this.length>=500&&[this[0]?.id,this[1]?.id].some(id=>typeof id==='string'&&id.startsWith('TEST-COPY-'))&&fs.existsSync(path.join(root,'test-count-large-copies')))fs.appendFileSync(path.join(root,'test-large-copy-count'),'C');return slice.apply(this,args);};
const execute=DatabaseSync.prototype.exec,prepare=DatabaseSync.prototype.prepare;
DatabaseSync.prototype.exec=function(sql){if(sql==='COMMIT'&&fs.existsSync(marker)){fs.unlinkSync(marker);throw Error('Synthetic SQLite commit failure');}return execute.call(this,sql);};
DatabaseSync.prototype.prepare=function(sql){if(sql.startsWith('SELECT * FROM collections')&&fs.existsSync(path.join(root,'test-count-db-reads')))fs.appendFileSync(path.join(root,'test-db-read-count'),'R');return prepare.call(this,sql);};
