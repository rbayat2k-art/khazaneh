import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
import {spawn,type ChildProcess} from 'node:child_process';import {pathToFileURL} from 'node:url';
import {getDefaultPermissionsForRole} from '../src/types/treasury';
import {SqliteRecords} from '../src/server/sqlite-records';
import {todayJalali} from '../src/utils/current-date';
import {requestFixture} from './request-fixture.cjs';
import {manualFixture as requireManual} from './manual-fixture.cjs';
import {requestTimeFields} from '../src/utils/record-time';
const parent=process.env.TREASURY_TEST_DIR;
if(!parent?.replaceAll('\\','/').startsWith('C:/Users/reza/Desktop/پروژه‌ها/انتشار موقت khazaneh/work/'))throw Error('Explicit synthetic form-date test root required');
const root=path.join(parent,'form-date-api'),base='http://127.0.0.1:55231',sqlite=process.env.TREASURY_TEST_STORAGE==='sqlite',password='Synthetic-Only!2026',tokens:Record<string,string>={};
let child:ChildProcess;let serverErrors='';
async function api(route:string,user?:string,body?:object){body=route==='/treasury/manual-payment'&&body?requireManual(body):requestFixture(route,body);const r=await fetch(base+'/api'+route,{method:body?'POST':'GET',headers:{'content-type':'application/json',...(user?{authorization:'Bearer '+tokens[user]}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()};}
function readStore():string{if(!sqlite)return fs.readFileSync(root+'/treasury-db.json','utf8');const store=new SqliteRecords(root+'/treasury.sqlite',false,true);try{return JSON.stringify(store.read());}finally{store.close();}}
before(async()=>{
 fs.mkdirSync(root,{recursive:false});const roles=['ADMIN','REQUESTER','APPROVER','ACCOUNTING','TREASURY'] as const;
 const state={users:roles.map(role=>{const id=role.toLowerCase(),salt=crypto.randomBytes(16).toString('hex');return {id,personnelCode:id,name:'TEST '+id,role,company:'TEST',department:'TEST',isActive:true,phone:'',supervisorId:role==='REQUESTER'?'approver':null,passwordSalt:salt,passwordHash:crypto.scryptSync(password,salt,64).toString('hex')};}),roleConfigs:roles.map(role=>({role,permissions:getDefaultPermissionsForRole(role),accessScope:role==='REQUESTER'?'SELF_ONLY':role==='APPROVER'?'ASSIGNED_AND_SUBORDINATES':'COMPANY_WIDE',allowedCompanies:['TEST'],approvalLimitRial:1000000000,paymentLimitRial:1000000000})),companyBankAccounts:[{id:'TEST-form-bank',bankName:'بانک ملت',accountTitle:'TEST source',accountNumber:'000001',companyName:'TEST',isActive:true,isDefault:true}],companies:[],departments:[],costCenters:[],advanceRequests:[],paymentRequests:[],batchPayments:[],manualPayments:[],dailyCovers:[],receiptArchives:[],notifications:[],securityAuditLogs:[],passwordRecoveryRequests:[],sessions:[],smsLogs:[],smsConfig:{enabled:false,provider:'CUSTOM',apiUrl:'',events:{}}};
 Object.assign(state,{costCenters:[{id:'TEST-cost',code:'TEST',name:'TEST',companyName:'TEST',isActive:true},{id:'TEST-disabled',code:'TEST-disabled',name:'TEST disabled center',companyName:'TEST',isActive:false},{id:'TEST-outside',code:'TEST-outside',name:'TEST outside center',companyName:'OUTSIDE',isActive:true}]});
 if(sqlite){const s=new SqliteRecords(root+'/treasury.sqlite',true);try{s.commit(state,undefined,s.signature());}finally{s.close();}}else fs.writeFileSync(root+'/treasury-db.json',JSON.stringify(state),{flag:'wx'});
 try{await fetch(base+'/api/health');throw Error('Occupied synthetic date port');}catch(e:any){if(e.message==='Occupied synthetic date port')throw e;}
 const entry=process.env.TREASURY_TEST_SERVER;if(!entry)throw Error('Built candidate required');
 child=spawn(process.execPath,['--import',pathToFileURL(path.resolve('tests/outbound-guard.mjs')).href,entry,'--host','127.0.0.1','--port','55231'],{cwd:path.dirname(entry),env:{PATH:process.env.PATH,SystemRoot:process.env.SystemRoot,NODE_ENV:'production',TREASURY_DATA_DIR:root,TREASURY_STORAGE_MODE:sqlite?'sqlite':'json',DISABLE_EXTERNAL_INTEGRATIONS:'true'},windowsHide:true,stdio:['ignore','ignore','pipe']});
 child.stderr?.on('data',chunk=>{serverErrors=(serverErrors+String(chunk)).slice(-4000);});
 for(let i=0;i<100;i++){if(child.exitCode!==null)throw Error('Synthetic date server exited');try{if((await fetch(base+'/api/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 for(const role of roles){const id=role.toLowerCase(),r=await api('/auth/login',undefined,{personnelCode:id,password});assert.equal(r.status,200);tokens[id]=r.data.token;}
});
after(async()=>{if(child?.exitCode===null){child.kill();await new Promise(r=>child.once('exit',r));}});

test('server-owned registration instants persist for all request kinds; client dates cannot overwrite creation or treasury action time',async()=>{
 for(const kind of ['PAYMENT','ADVANCE','BATCH_ITEM']){
  const start=Date.now(),body={amount:12000,payeeName:'TEST timestamp',reason:'TEST timestamp',description:'TEST timestamp',createdAtIso:'2001-01-01T00:00:00Z'},made=await api(kind==='BATCH_ITEM'?'/batch-payments':kind==='ADVANCE'?'/advance-requests':'/payment-requests','requester',kind==='BATCH_ITEM'?{title:'TEST timestamp group',createdAtIso:body.createdAtIso,items:[body,{...body,payeeName:'TEST untouched timestamp sibling'}]}:body);assert.equal(made.status,200);
  const parent=made.data.batch||made.data.item,row=kind==='BATCH_ITEM'?parent.items[0]:parent,registered=parent.createdAtIso;assert.ok(Date.parse(registered)>=start&&Date.parse(registered)<=Date.now());assert.equal(parent.createdAt,todayJalali(new Date(registered)));if(kind==='BATCH_ITEM')assert.equal(row.createdAtIso,undefined);
  const target={itemType:kind,requestId:parent.id,...(kind==='BATCH_ITEM'?{rowId:row.id}:{})};assert.equal((await api('/requests/edit-submitted','requester',{...target,expectedVersion:1,changes:{description:'TEST edited, registration retained'}})).status,200);
  const get=()=>{const state=JSON.parse(readStore());return kind==='BATCH_ITEM'?state.batchPayments.find((b:any)=>b.id===parent.id):state[kind==='ADVANCE'?'advanceRequests':'paymentRequests'].find((p:any)=>p.id===parent.id);};
  for(const stage of ['APPROVER','ACCOUNTING']){const current=kind==='BATCH_ITEM'?get().items[0]:get();assert.equal((await api('/review/row-action',stage.toLowerCase(),{...target,expectedVersion:current.version,expectedStatus:current.status,reviewStage:stage,action:'APPROVE'})).status,200);}
  const item=kind==='BATCH_ITEM'?{id:row.id,type:kind,batchId:parent.id}:{id:row.id,type:kind};let earlier='';
  for(const index of [1,2]){const start=Date.now(),payload={items:[item],sourceBankAccountId:'TEST-form-bank',dateJalali:'1403/01/01',paymentAmount:6000,idempotencyKey:'TEST-time-'+row.id+'-'+index,bankRefNumber:'TEST-time-'+index},result=await api('/treasury/execute-payment','treasury',payload);assert.equal(result.status,200);const saved=kind==='BATCH_ITEM'?get().items[0]:get();assert.equal(get().createdAtIso,registered);assert.ok(Date.parse(saved.paidAt)>=start&&Date.parse(saved.paidAt)<=Date.now());assert.ok(saved.paidAt>=earlier);earlier=saved.paidAt;assert.equal(saved.paidDateJalali,'1403/01/01');assert.equal(requestTimeFields(get(),[saved]).treasuryActionDate,todayJalali(new Date(saved.paidAt)));assert.equal(saved.paymentHistory.length,index);
   const held=readStore();assert.equal((await api('/treasury/execute-payment','treasury',payload)).status,index===1?409:403);assert.equal(readStore(),held);
   const own=(await api('/state','requester')).data;const visible=kind==='BATCH_ITEM'?own.batchPayments.find((b:any)=>b.id===parent.id).items[0]:own[kind==='ADVANCE'?'advanceRequests':'paymentRequests'].find((p:any)=>p.id===parent.id);assert.equal(visible.paidAt,saved.paidAt);
  }
  if(kind==='BATCH_ITEM'){const sibling=get().items[1];assert.equal(sibling.status,'Pending_Approver');assert.equal(requestTimeFields(get(),[sibling]).treasuryActionTime,'—');}
 }
 const start=Date.now(),manual=await api('/treasury/manual-payment','treasury',{amount:12000,payee:'TEST manual timestamp',sourceBankAccountId:'TEST-form-bank',date:'1403/01/01',createdAtIso:'2001-01-01T00:00:00Z'});assert.equal(manual.status,200);const record=JSON.parse(readStore()).manualPayments.at(0);assert.ok(Date.parse(record.createdAtIso)>=start);assert.equal(record.date,'1403/01/01');
});
test('single payment requires explicit active allowed cost center, meaningful description/payee and amount without writes on failure',async()=>{
 const good={amount:12000,payeeName:'TEST required recipient',description:'TEST required description',costCenter:'TEST',accountOrCard:'0'.repeat(16),iban:'',attachments:[]};
 for(const field of ['description','payeeName','costCenter','amount'])for(const value of [undefined,'','   ']){const held=readStore();assert.equal((await api('/payment-requests','requester',{...good,[field]:value})).status,400,field);assert.equal(readStore(),held);}
 for(const costCenter of ['TEST missing center','TEST disabled center','TEST outside center']){const held=readStore();assert.equal((await api('/payment-requests','requester',{...good,costCenter})).status,400);assert.equal(readStore(),held);}
 const result=await api('/payment-requests','requester',good);assert.equal(result.status,200);assert.equal(result.data.item.costCenter,'TEST');assert.equal(result.data.item.attachments.length,0,'attachment warning does not forbid submission');
});
test('unknown destination bank is not replaced with Mellat in new single or batch records',async()=>{
 for(const bankName of [undefined,'']){
  const body={amount:12000,accountOrCard:'9'.repeat(16),bankName};
  const single=await api('/payment-requests','requester',body);assert.equal(single.status,200);assert.equal(single.data.item.bankName,'');
  const batch=await api('/batch-payments','requester',{title:'TEST unknown issuer',items:[{...body,payeeName:'TEST'}]});assert.equal(batch.status,200,serverErrors);assert.equal(batch.data.batch.items[0].bankName,'');
 }
});
test('Jalali form dates reject invalid and past NEW requests without writes, but preserve historical document dates',async()=>{
 const today=todayJalali(),past='1403/01/01';
 for(const dueDate of [past,'2026/10/23','1405/07/31','1404/12/30','1405/1/01','n/a',7]){
  const before=readStore();assert.equal((await api('/payment-requests','requester',{amount:12000,payeeName:'TEST date boundary',dueDate})).status,400);assert.equal(readStore(),before);
  assert.equal((await api('/advance-requests','requester',{amount:12000,reason:'TEST date boundary',suggestedDate:dueDate})).status,400);assert.equal(readStore(),before);
 }
 const created=await api('/payment-requests','requester',{amount:12000,payeeName:'TEST valid Jalali',dueDate:today,createdAt:past});assert.equal(created.status,200);assert.equal(created.data.item.createdAt,today);
 const target={itemType:'PAYMENT',requestId:created.data.item.id};
 assert.equal((await api('/requests/edit-submitted','requester',{...target,expectedVersion:1,changes:{dueDate:past}})).status,200);
 const before=readStore();assert.equal((await api('/requests/edit-submitted','requester',{...target,expectedVersion:2,changes:{dueDate:'1405/07/31'}})).status,400);assert.equal(readStore(),before);
 for(const user of ['approver','accounting']){const visible=(await api('/state',user)).data.paymentRequests.find((p:any)=>p.id===created.data.item.id);assert.equal((await api('/review/row-action',user,{...target,expectedVersion:visible.version||1,expectedStatus:visible.status,reviewStage:user==='approver'?'APPROVER':'ACCOUNTING',action:'APPROVE'})).status,200);}
 const payload={sourceBankAccountId:'TEST-form-bank',items:[{type:'PAYMENT',id:created.data.item.id}],idempotencyKey:'TEST-form-date-payment',bankRefNumber:'TEST-NO-TRANSFER'};
 const held=readStore();assert.equal((await api('/treasury/execute-payment','treasury',{...payload,dateJalali:'2026-10-23'})).status,400);assert.equal(readStore(),held);
 const paid=await api('/treasury/execute-payment','treasury',{...payload,dateJalali:past});assert.equal(paid.status,200);assert.equal(paid.data.receipt.dateJalali,past);
 for(const route of ['/treasury/manual-payment','/treasury/daily-cover']){const snapshot=readStore();assert.equal((await api(route,'treasury',{sourceBankAccountId:'TEST-form-bank',amount:12000,date:'2026-10-23'})).status,400);assert.equal(readStore(),snapshot);}
});
