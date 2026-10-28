import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
import {spawn,type ChildProcess} from 'node:child_process';import {pathToFileURL} from 'node:url';
import {SqliteRecords} from '../src/server/sqlite-records';import {getDefaultPermissionsForRole} from '../src/types/treasury';
import {requestFixture} from './request-fixture.cjs';import {stoppedLegacyFixture} from './stopped-legacy-fixture';
const parent=process.env.TREASURY_TEST_DIR;
if(!parent?.replaceAll('\\','/').startsWith('C:/Users/reza/Desktop/پروژه‌ها/انتشار موقت khazaneh/work/'))throw Error('Explicit isolated fixture required');
const root=path.join(parent,'treasury-rejection-api'),base='http://127.0.0.1:55236',sqlite=process.env.TREASURY_TEST_STORAGE==='sqlite',tokens:Record<string,string>={},password=crypto.randomBytes(24).toString('base64url');
let child:ChildProcess,restart:()=>Promise<void>;
async function api(route:string,user?:string,body?:any){body=requestFixture(route,body);const response=await fetch(base+'/api'+route,{method:body?'POST':'GET',headers:{'content-type':'application/json',...(user?{authorization:'Bearer '+tokens[user]}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,data:await response.json()};}
function store(){if(!sqlite)return JSON.parse(fs.readFileSync(root+'/treasury-db.json','utf8'));const s=new SqliteRecords<any>(root+'/treasury.sqlite',false,true);try{return s.read();}finally{s.close();}}
const snapshot=()=>JSON.stringify(store());
const saved=(r:any)=>{const db=store();return r.kind==='BATCH_ITEM'?db.batchPayments.find((b:any)=>b.id===r.parentId).items.find((i:any)=>i.id===r.id):db[r.kind==='ADVANCE'?'advanceRequests':'paymentRequests'].find((i:any)=>i.id===r.id);};
const target=(r:any)=>({itemType:r.kind,requestId:r.parentId||r.id,...(r.parentId?{rowId:r.id}:{}),expectedVersion:r.version||1,expectedStatus:r.status});
const cmd=(r:any,action='REJECT',extra={})=>({action,reason:'TEST controlled decision',operationId:crypto.randomUUID(),targets:[target(r)],...extra});
const review=(r:any,stage:string)=>api('/review/row-action',stage.toLowerCase(),{...target(r),reviewStage:stage,action:'APPROVE'});
async function prepared(kind='PAYMENT',batchType='PAYMENT'){
 const made=await api(kind==='BATCH_ITEM'?'/batch-payments':kind==='ADVANCE'?'/advance-requests':'/payment-requests','requester',kind==='BATCH_ITEM'?{title:'TEST rejection group',batchType,items:[1,2].map(i=>({amount:12000,payeeName:'TEST '+i,description:'TEST'}))}:{amount:12000,reason:'TEST rejection',description:'TEST rejection',payeeName:'TEST recipient'});assert.equal(made.status,200);
 const p=made.data.batch||made.data.item,row=kind==='BATCH_ITEM'?p.items[0]:p,r={...row,kind,parentId:kind==='BATCH_ITEM'?p.id:undefined};
 for(const stage of ['APPROVER','ACCOUNTING'])assert.equal((await review({...r,...saved(r)},stage)).status,200);
 return {...r,...saved(r)};
}
before(async()=>{
 fs.mkdirSync(root,{recursive:true});const roles=['ADMIN','REQUESTER','APPROVER','ACCOUNTING','TREASURY'];
 const state:any={users:[...roles.map(r=>[r.toLowerCase(),r]),['treasury2','TREASURY']].map(([id,role])=>{const salt=crypto.randomBytes(16).toString('hex');return{id,name:'TEST '+id,personnelCode:id,role,company:'TEST',department:'TEST',isActive:true,supervisorId:id==='requester'?'approver':null,passwordSalt:salt,passwordHash:crypto.scryptSync(password,salt,64).toString('hex')};}),roleConfigs:roles.map(role=>({role,permissions:getDefaultPermissionsForRole(role),accessScope:role==='REQUESTER'?'SELF_ONLY':role==='APPROVER'?'ASSIGNED_AND_SUBORDINATES':'COMPANY_WIDE',allowedCompanies:['TEST'],approvalLimitRial:1000000,paymentLimitRial:1000000})),companies:[{id:'TEST-CO',name:'TEST',isActive:true},{id:'TEST-OTHER-CO',name:'TEST-OTHER',isActive:true}],departments:[],costCenters:[{id:'TEST-cost',code:'TEST',name:'TEST',companyName:'TEST',isActive:true}],companyBankAccounts:[{id:'TEST-source',bankName:'بانک ملت',accountTitle:'TEST',accountNumber:'000001',companyName:'TEST',isActive:true,isDefault:true}],advanceRequests:[],paymentRequests:[],batchPayments:[],manualPayments:[],dailyCovers:[],receiptArchives:[],notifications:[],securityAuditLogs:[],passwordRecoveryRequests:[],sessions:[],smsLogs:[],smsConfig:{enabled:false,provider:'CUSTOM',apiUrl:'',events:{}}};
 if(sqlite){const s=new SqliteRecords(root+'/treasury.sqlite',true);try{s.commit(state,undefined,s.signature());}finally{s.close();}}else fs.writeFileSync(root+'/treasury-db.json',JSON.stringify(state),{flag:'wx'});
 try{await fetch(base+'/api/health');throw Error('Isolated port occupied');}catch(e:any){if(e.message==='Isolated port occupied')throw e;}
 const entry=process.env.TREASURY_TEST_SERVER,args=entry?[entry]:['--import',pathToFileURL(path.resolve('tests/native-types.mjs')).href,path.resolve('server.ts')];
 restart=async()=>{child=spawn(process.execPath,['--import',pathToFileURL(path.resolve('tests/fail-commit.mjs')).href,'--import',pathToFileURL(path.resolve('tests/outbound-guard.mjs')).href,...args,'--host','127.0.0.1','--port','55236'],{cwd:entry?path.dirname(entry):process.cwd(),env:{PATH:process.env.PATH,SystemRoot:process.env.SystemRoot,NODE_ENV:'production',TREASURY_TEST_DIR:root,TREASURY_DATA_DIR:root,TREASURY_STORAGE_MODE:sqlite?'sqlite':'json',DISABLE_EXTERNAL_INTEGRATIONS:'true'},windowsHide:true,stdio:'ignore'});for(let i=0;i<100;i++){if(child.exitCode!==null)throw Error('Isolated server exited');try{if((await fetch(base+'/api/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}for(const id of [...roles.map(r=>r.toLowerCase()),'treasury2']){const r=await api('/auth/login',undefined,{personnelCode:id,password});assert.equal(r.status,200);tokens[id]=r.data.token;}};await restart();
});
after(async()=>{if(child?.exitCode===null){child.kill();await new Promise(r=>child.once('exit',r));}});
test('all four request forms: rejection and shared authorized restoration preserve money and approvals, one explicit group child only',async()=>{
 for(const [kind,batchType] of [['PAYMENT','PAYMENT'],['ADVANCE','ADVANCE'],['BATCH_ITEM','PAYMENT'],['BATCH_ITEM','ADVANCE']]){
  const r=await prepared(kind,batchType),old=saved(r),op=cmd(r),response=await api('/treasury/rejection','treasury',op);assert.equal(response.status,200);const held=saved(r);assert.equal(held.status,'Rejected_Treasury');assert.equal(held.treasuryRejections.length,1);assert.deepEqual(response.data.state[kind==='BATCH_ITEM'?'batchPayments':kind==='ADVANCE'?'advanceRequests':'paymentRequests'],store()[kind==='BATCH_ITEM'?'batchPayments':kind==='ADVANCE'?'advanceRequests':'paymentRequests']);
  for(const key of ['amount','approvedAmount','payeeName','costCenter','company','requesterId','approvedBySupervisorUserId','approvedByAccountingUserId','approverApprovedVersion','accountingApprovedVersion','attachments'])assert.deepEqual(held[key],old[key]);
  if(r.parentId)assert.equal(store().batchPayments.find((b:any)=>b.id===r.parentId).items[1].status,'Pending_Approver');
  const n=store().notifications.filter((n:any)=>n.eventType==='TREASURY_PAYMENT_REJECTED'&&n.requestId===(r.parentId||r.id));assert.equal(n.length,1);assert.equal(n[0].recipientUserId,'requester');assert.equal(n[0].recipientRole,null);
  assert.equal((await api('/treasury/rejection','treasury2',cmd({...r,...held},'RESTORE'))).status,200);const restored=saved(r);assert.equal(restored.status,'Pending_Treasury');assert.ok(restored.treasuryRejections[0].restoredAt);assert.equal(restored.treasuryRejections[0].restoredById,'treasury2');assert.equal(restored.treasuryRejections[0].restoreReason,'TEST controlled decision');assert.equal(restored.inPaymentAt,null);assert.equal(restored.auditHistory.length,old.auditHistory.length+2);
 }
});
test('reasons, explicit targets, stale forms, extra financial fields, actor spoofing and duplicate rows fail without mutation',async()=>{
 const r=await prepared(),held=snapshot();
 for(const extra of [{reason:' '},{reason:'x'.repeat(4001)},{amount:999},{operationId:'bad'},{targets:[]},{targets:[{...target(r),expectedVersion:999}]},{targets:[{...target(r),expectedStatus:'Paid'}]},{targets:[{...target(r),itemType:'BATCH'}]},{targets:[target(r),target(r)]}])assert.ok([400,409].includes((await api('/treasury/rejection','treasury',cmd(r,'REJECT',extra))).status));
 assert.equal(snapshot(),held);for(const user of ['requester','approver','accounting'])assert.equal((await api('/treasury/rejection',user,cmd(r))).status,403);
 assert.equal((await api('/treasury/rejection','treasury',cmd(r,'REJECT',{actorUserId:'admin',treasuryUserId:'admin'}))).status,403);assert.equal(snapshot(),held);assert.equal((await api('/treasury/rejection','treasury',cmd(r))).status,200);assert.equal(saved(r).treasuryRejections[0].byUserId,'treasury');
});
test('rejected rows cannot pay, move, use ordinary rejection review or correction routes; unpaid peers validate atomically',async()=>{
 const r=await prepared(),other=await prepared();assert.equal((await api('/treasury/rejection','treasury',cmd(r))).status,200);const current={...r,...saved(r)},held=snapshot();
 assert.equal((await api('/treasury/execute-payment','treasury',{sourceBankAccountId:'TEST-source',items:[{type:'PAYMENT',id:r.id}],idempotencyKey:'TEST-denied-'+r.id})).status,403);
 assert.equal((await api('/treasury/move-pool','treasury',{items:[{type:'PAYMENT',id:r.id}],targetPool:'IN_PAYMENT'})).status,403);
 assert.equal((await api('/review/row-action','accounting',{...target(current),reviewStage:'ACCOUNTING',action:'APPROVE',reason:'TEST'})).status,409);
 assert.equal((await api('/treasury/export','treasury',{purpose:'OPERATIONAL',pool:'QUEUE',uids:['PAY:'+r.id]})).status,409);
 assert.ok((await api('/treasury/return-for-correction','treasury',{...target(current),recipientStage:'REQUESTER',reason:'TEST'})).status>=400);
 assert.equal((await api('/treasury/rejection','treasury',cmd(other,'REJECT',{targets:[target(other),target(current)]}))).status,409);assert.equal(snapshot(),held);assert.equal(saved(other).status,'Pending_Treasury');
});
test('partial payment and every legacy financial evidence prohibit rejection',async()=>{
 const r=await prepared();assert.equal((await api('/treasury/execute-payment','treasury',{sourceBankAccountId:'TEST-source',items:[{type:'PAYMENT',id:r.id}],paymentAmount:1000,idempotencyKey:'TEST-partial-'+r.id})).status,200);const held=snapshot();assert.equal((await api('/treasury/rejection','treasury',cmd({...r,...saved(r)}))).status,409);assert.equal(snapshot(),held);
 for(const evidence of [{paidAmount:1},{receiptId:'TEST-receipt'},{paidAt:new Date().toISOString()},{sourceBankAccountId:'TEST-source'},{paymentHistory:[{id:'TEST-financial'}]}]){const row=await prepared();child=await stoppedLegacyFixture(child,root,sqlite,base,db=>Object.assign(db.paymentRequests.find((x:any)=>x.id===row.id),evidence));const before=snapshot();assert.equal((await api('/treasury/rejection','treasury',cmd({...row,...saved(row)}))).status,409);assert.equal(snapshot(),before);}
});
test('operation retry survives restart; conflicting reuse is rejected globally; failed commits are atomic and retryable',async()=>{
 const r=await prepared(),op=cmd(r),before=snapshot();fs.writeFileSync(root+'/test-fail-next-commit','TEST');assert.equal((await api('/treasury/rejection','treasury',op)).status,500);assert.equal(snapshot(),before);assert.equal((await api('/treasury/rejection','treasury',op)).status,200);const count=saved(r).auditHistory.length;
 child.kill();await new Promise(r=>child.once('exit',r));await restart();const replay=await api('/treasury/rejection','treasury',op);assert.equal(replay.status,200);assert.equal(replay.data.replayed,true);assert.equal(saved(r).auditHistory.length,count);
 assert.equal((await api('/treasury/rejection','treasury',{...op,reason:'TEST conflict'})).status,409);assert.equal((await api('/treasury/rejection','treasury2',op)).status,409);const other=await prepared();assert.equal((await api('/treasury/rejection','treasury',cmd(other,'REJECT',{operationId:op.operationId}))).status,409);
 const restore=cmd({...r,...saved(r)},'RESTORE');const original=snapshot();fs.writeFileSync(root+'/test-fail-next-commit','TEST');assert.equal((await api('/treasury/rejection','treasury',restore)).status,500);assert.equal(snapshot(),original);assert.equal((await api('/treasury/rejection','treasury',restore)).status,200);assert.equal((await api('/treasury/rejection','treasury',restore)).data.replayed,true);assert.equal(saved(r).auditHistory.length,count+1);
});
test('serialized reject/payment race and reject/restore duplicates have exactly one durable effect',async()=>{
 const r=await prepared();const replies=await Promise.all([api('/treasury/rejection','treasury',cmd(r)),api('/treasury/execute-payment','treasury',{sourceBankAccountId:'TEST-source',items:[{type:'PAYMENT',id:r.id}],idempotencyKey:'TEST-race-'+r.id})]);assert.equal(replies.filter(x=>x.status===200).length,1);
 const other=await prepared(),op=cmd(other);const duplicate=await Promise.all([api('/treasury/rejection','treasury',op),api('/treasury/rejection','treasury',op)]);assert.ok(duplicate.every(x=>x.status===200));assert.equal(saved(other).treasuryRejections.length,1);
 const restore=cmd({...other,...saved(other)},'RESTORE'),answers=await Promise.all([api('/treasury/rejection','treasury',restore),api('/treasury/rejection','treasury',restore)]);assert.ok(answers.every(x=>x.status===200));assert.equal(saved(other).treasuryRejections.filter((x:any)=>x.restoredAt).length,1);
});
test('fresh granular permissions and company scope fail closed, and removal of restoration authority is protected by open work',async()=>{
 const r=await prepared(),role=(await api('/state','admin')).data.roleConfigs.find((r:any)=>r.role==='TREASURY');
 for(const override of [{permissions:{...role.permissions,canRejectTreasuryPayment:false}},{permissions:{...role.permissions,canExecutePayment:false}},{allowedCompanies:['TEST-OTHER']}]){child=await stoppedLegacyFixture(child,root,sqlite,base,db=>{db.roleConfigs=db.roleConfigs.map((x:any)=>x.role===role.role?{...role,...override}:x);});const held=snapshot();assert.equal((await api('/treasury/rejection','treasury',cmd(r))).status,403);assert.equal(snapshot(),held);child=await stoppedLegacyFixture(child,root,sqlite,base,db=>{db.roleConfigs=db.roleConfigs.map((x:any)=>x.role===role.role?role:x);});}
 assert.equal((await api('/treasury/rejection','treasury',cmd(r))).status,200);assert.equal((await api('/roles/save','admin',{...role,permissions:{...role.permissions,canRestoreTreasuryPayment:false}})).status,409);
 child=await stoppedLegacyFixture(child,root,sqlite,base,db=>{db.roleConfigs=db.roleConfigs.map((x:any)=>x.role===role.role?{...role,permissions:{...role.permissions,canRestoreTreasuryPayment:false}}:x);});const held=snapshot();assert.equal((await api('/treasury/rejection','treasury',cmd({...r,...saved(r)},'RESTORE'))).status,403);assert.equal(snapshot(),held);
 child=await stoppedLegacyFixture(child,root,sqlite,base,db=>{db.roleConfigs=db.roleConfigs.map((x:any)=>x.role===role.role?role:x);});
});
