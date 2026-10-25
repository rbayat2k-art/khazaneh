import {test,before,after} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {spawn,type ChildProcess} from 'node:child_process';import {pathToFileURL} from 'node:url';
import {SqliteRecords} from '../src/server/sqlite-records';import {inquiryFixture} from './inquiry-fixture';
const parent=process.env.TREASURY_TEST_DIR;if(!parent?.replaceAll('\\','/').startsWith('C:/Users/reza/Desktop/پروژه‌ها/انتشار موقت khazaneh/work/'))throw Error('Explicit synthetic work root required');
const root=parent+'/inquiry-production-api',base='http://127.0.0.1:55237',tokens:Record<string,string>={};let child:ChildProcess;
function state():any{const s=new SqliteRecords(root+'/treasury.sqlite',false,true);try{return s.read();}finally{s.close();}}
const calls=()=>JSON.parse(fs.readFileSync(root+'/provider-calls.json','utf8')),target=(id='P')=>({itemType:'PAYMENT',requestId:id,expectedVersion:1});
async function api(route:string,user?:string,body?:any){const r=await fetch(base+'/api'+route,{method:body===undefined?'GET':'POST',headers:{'content-type':'application/json',...(user?{authorization:'Bearer '+tokens[user]}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,data:await r.json()};}
async function stop(){if(child?.exitCode===null){child.kill();await new Promise(r=>child.once('exit',r));}}
async function start(allowed=true){await stop();const entry=process.env.TREASURY_TEST_SERVER;
 child=spawn(process.execPath,['--import',pathToFileURL(path.resolve('tests/fail-commit.mjs')).href,'--import',pathToFileURL(path.resolve('tests/inquiry-live-transport.mjs')).href,...(entry?[entry]:['--import',pathToFileURL(path.resolve('tests/native-types.mjs')).href,path.resolve('server.ts')]),'--host','127.0.0.1','--port','55237'],{cwd:entry?path.dirname(entry):process.cwd(),env:{PATH:process.env.PATH,SystemRoot:process.env.SystemRoot,NODE_ENV:'production',TREASURY_TEST_DIR:root,TREASURY_DATA_DIR:root,TREASURY_STORAGE_MODE:'sqlite',DISABLE_EXTERNAL_INTEGRATIONS:'true',TREASURY_INQUIRY_VAULT_DIR:root+'/secrets',TREASURY_INQUIRY_NETWORK_ALLOWED:allowed?'true':'false'},stdio:'ignore',windowsHide:true});
 let ready=false;for(let i=0;i<100;i++){if(child.exitCode!==null)throw Error('Synthetic inquiry server exited');try{if((await fetch(base+'/api/health')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,50));}assert.ok(ready);
 for(const user of ['admin','treasury','requester']){const r=await api('/auth/login',undefined,{personnelCode:user,password:'Synthetic-Only!2026'});assert.equal(r.status,200);tokens[user]=r.data.token;}
}
async function config(enabled=true,automatic=false,patch:any={}){const c=(await api('/bank-inquiry/config','admin')).data;return api('/bank-inquiry/config','admin',{enabled,automatic,companyIds:['C'],dailyLimit:100,expectedRevision:c.config.revision,connectionVersion:c.connectionVersion,acknowledgeCredit:enabled,...patch});}
async function enqueue(id='P'){const c=(await api('/bank-inquiry/config','admin')).data;return api('/bank-inquiry/enqueue','treasury',{targets:[target(id)],operationKey:'pay-idem-'+crypto.randomUUID(),connectionVersion:c.connectionVersion,acknowledgeCredit:true});}
async function waitFor(id:string,expected:string){for(let i=0;i<150;i++){const r=state().paymentRequests.find((r:any)=>r.id===id);if(r.bankInquiry?.status===expected)return r;await new Promise(r=>setTimeout(r,20));}throw Error('Expected isolated inquiry status not reached');}
before(async()=>{fs.mkdirSync(root+'/secrets/keys',{recursive:true,mode:0o700});fs.writeFileSync(root+'/secrets/keys/master.key',crypto.randomBytes(32),{flag:'wx',mode:0o600});const s=new SqliteRecords(root+'/treasury.sqlite',true);try{s.commit(inquiryFixture(),undefined,s.signature());}finally{s.close();}await start(false);});after(stop);
test('LIVE without a key exposes settings but cannot activate or make a provider request',async()=>{
 await start();const c=(await api('/bank-inquiry/config','admin')).data;assert.equal(c.mode,'LIVE');assert.equal(c.connections.available,true);assert.equal(c.keyConfigured,false);assert.equal(c.configured,false);assert.equal((await config()).status,400);assert.equal((await api('/bank-inquiry/credits','admin')).data.result.kind,'NOT_CONFIGURED');assert.deepEqual(calls(),{credits:0,lookup:0});await start(false);
});
test('Production connection management is available with network closed; current global manager only and write-only key',async()=>{
 const c=(await api('/bank-inquiry/config','admin')).data;assert.equal(c.mode,'DISABLED');assert.equal(c.connections.available,true);
 const body={action:'UPDATE',connectionId:'primary',expectedRevision:0,profile:{name:'TEST PRIMARY',settings:{},credentials:{apiKey:'SYNTHETIC-PRIMARY'}}};
 assert.equal((await api('/bank-inquiry/connections',undefined,body)).status,401);assert.equal((await api('/bank-inquiry/connections','treasury',body)).status,403);
 const before=JSON.stringify(state()),saved=await api('/bank-inquiry/connections','admin',body);assert.equal(saved.status,200);assert.equal(JSON.stringify(saved).includes('SYNTHETIC-PRIMARY'),false);assert.equal(JSON.stringify(state()),before);
 assert.equal((await config()).status,409);assert.equal((await api('/bank-inquiry/credits','admin')).status,409);assert.deepEqual(calls(),{credits:0,lookup:0});assert.equal((await config(false)).status,200);
});
test('dedicated LIVE flag retains stored keys but requires explicit current-connection consent before spending',async()=>{
 await start();const c=(await api('/bank-inquiry/config','admin')).data;assert.equal(c.mode,'LIVE');assert.equal(c.requiresActivation,true);assert.equal(c.keyConfigured,true);assert.equal(c.configured,false);assert.equal(c.connections.profiles[0].hasCredentials,true);
 assert.equal((await config(true,false,{acknowledgeCredit:false})).status,400);assert.equal((await config(true,false,{connectionVersion:'stale'})).status,400);assert.equal((await enqueue()).status,400);assert.deepEqual(calls(),{credits:0,lookup:0});
 assert.equal((await config()).status,200);assert.deepEqual(calls(),{credits:0,lookup:0});const credit=await api('/bank-inquiry/credits','admin');assert.equal(credit.data.ok,true);assert.deepEqual(calls(),{credits:1,lookup:0});
});
test('live lookup, scope and retry use the actual durable commands without changing money or input name',async()=>{
 assert.equal((await enqueue('OTHER')).status,403);const made=await enqueue();assert.equal(made.status,200);const row=await waitFor('P','FOUND');assert.equal(row.bankInquiry.source,'LIVE');assert.equal(row.amount,100);assert.equal(row.approvedAmount,100);assert.equal(row.paidAmount,0);assert.equal(row.payeeName,'TEST INPUT OWNER');
 const count=calls().lookup;const op=state().bankInquiryOperations[0];assert.equal((await api('/bank-inquiry/enqueue','treasury',{targets:op.targets,operationKey:op.key,acknowledgeCredit:true,connectionVersion:'stale'})).status,200);assert.equal(calls().lookup,count);
});
test('key rotation during provider I/O invalidates response and previous activation without mutating financial records',async()=>{
 fs.writeFileSync(root+'/provider-hold','TEST');assert.equal((await enqueue('HELD')).status,200);for(let i=0;i<100&&calls().lookup<2;i++)await new Promise(r=>setTimeout(r,20));assert.equal(calls().lookup,2);
 const c=(await api('/bank-inquiry/config','admin')).data,before=JSON.stringify(state());assert.equal((await api('/bank-inquiry/credential','admin',{apiKey:'SYNTHETIC-ROTATED',expectedRevision:c.connections.revision})).status,200);assert.equal(JSON.stringify(state()),before);fs.unlinkSync(root+'/provider-hold');
 const row=await waitFor('HELD','ERROR');assert.equal(row.iban,'');assert.equal(row.amount,100);assert.equal(row.bankInquiry.code,'STALE_RESULT');const changed=(await api('/bank-inquiry/config','admin')).data;assert.equal(changed.activationRequired,true);assert.equal(changed.configured,false);assert.equal((await enqueue('AUTO')).status,400);
 await start();assert.equal((await api('/bank-inquiry/config','admin')).data.activationRequired,true);assert.deepEqual(calls(),{credits:0,lookup:0});
});
test('activation commit failure and same-revision races do not create implicit authority or charges',async()=>{
 const before=JSON.stringify(state());fs.writeFileSync(root+'/test-fail-next-commit','TEST');assert.equal((await config()).status,500);assert.equal(JSON.stringify(state()),before);assert.equal((await api('/bank-inquiry/config','admin')).data.activationRequired,true);
 const c=(await api('/bank-inquiry/config','admin')).data,body={enabled:true,automatic:false,companyIds:['C'],dailyLimit:100,expectedRevision:c.config.revision,connectionVersion:c.connectionVersion,acknowledgeCredit:true};const r=await Promise.all([api('/bank-inquiry/config','admin',body),api('/bank-inquiry/config','admin',body)]);assert.deepEqual(r.map(x=>x.status).sort(),[200,409]);assert.deepEqual(calls(),{credits:0,lookup:0});
});
test('automatic lookup only runs after explicit activation, and selecting another profile revokes old activation',async()=>{
 assert.equal((await config(true,true)).status,200);await waitFor('AUTO','FOUND');assert.equal(state().paymentRequests.find((r:any)=>r.id==='OTHER').bankInquiry,undefined);assert.ok(calls().lookup>=1);assert.equal(state().smsLogs.length,0);
 const c=(await api('/bank-inquiry/config','admin')).data,before=JSON.stringify(state()),made=await api('/bank-inquiry/connections','admin',{action:'CREATE',expectedRevision:c.connections.revision,profile:{name:'TEST SECOND',providerId:'cardinfo-v1',settings:{},credentials:{apiKey:'SYNTHETIC-SECOND'}}});assert.equal(made.status,200);assert.equal(JSON.stringify(state()),before);const m=made.data.connections,id=m.profiles.find((p:any)=>p.id!=='primary').id,count=calls();
 assert.equal((await api('/bank-inquiry/connections','admin',{action:'SELECT',connectionId:id,expectedRevision:m.revision})).status,200);assert.equal((await api('/bank-inquiry/config','admin')).data.activationRequired,true);await new Promise(r=>setTimeout(r,120));assert.deepEqual(calls(),count);
});
test('disabled restart/restore posture keeps the catalog but cannot dispatch a previously active service',async()=>{
 await start(false);const c=(await api('/bank-inquiry/config','admin')).data;assert.equal(c.mode,'DISABLED');assert.equal(c.connections.profiles.length,2);assert.equal(c.keyConfigured,true);assert.equal(c.configured,false);assert.equal((await enqueue()).status,400);assert.deepEqual(calls(),{credits:0,lookup:0});
});
test('revoking a real session during an awaited credit check prevents returning its result',async()=>{
 await start();fs.writeFileSync(root+'/provider-hold-credit','TEST');const pending=api('/bank-inquiry/credits','admin');for(let i=0;i<100&&calls().credits<1;i++)await new Promise(r=>setTimeout(r,20));assert.equal(calls().credits,1);
 assert.equal((await api('/auth/logout','admin',{})).status,200);fs.unlinkSync(root+'/provider-hold-credit');const result=await pending;assert.equal(result.status,403);assert.equal(JSON.stringify(result.data).includes('TEST PRIVATE CONNECTION'),false);assert.equal(calls().lookup,0);
});
