import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {spawn,type ChildProcess} from 'node:child_process';import {pathToFileURL} from 'node:url';
import {SqliteRecords} from '../src/server/sqlite-records';import {getDefaultPermissionsForRole} from '../src/types/treasury';
const parent=process.env.TREASURY_TEST_DIR;if(!parent?.replaceAll('\\','/').startsWith('C:/Users/reza/Desktop/پروژه‌ها/انتشار موقت khazaneh/work/'))throw Error('Explicit synthetic work directory required');
const root=path.join(parent,'open-work-api'),base='http://127.0.0.1:55246',password='Synthetic-Only!2026',tokens:Record<string,string>={},sqlite=process.env.TREASURY_TEST_STORAGE==='sqlite';let child:ChildProcess;
async function api(route:string,user?:string,body?:any){const r=await fetch(base+'/api'+route,{method:body?'POST':'GET',headers:{'content-type':'application/json',...(user?{authorization:'Bearer '+tokens[user]}:{})},...(body?{body:JSON.stringify(body)}:{})});return{status:r.status,data:await r.json()};}
function store():any{if(!sqlite)return JSON.parse(fs.readFileSync(root+'/treasury-db.json','utf8'));const s=new SqliteRecords(root+'/treasury.sqlite',false,true);try{return s.read();}finally{s.close();}}
const snap=()=>JSON.stringify(store()),saved=(id:string)=>store().paymentRequests.find((r:any)=>r.id===id),target=(r:any)=>({itemType:'PAYMENT',requestId:r.id,expectedVersion:r.version||1,expectedStatus:r.status});
const rejectionTarget=(r:any)=>({...target(r),expectedStage:r.reviewRejection?.stage,expectedRejectionId:r.reviewRejection?.id});
async function make(){const r=await api('/payment-requests','maker',{amount:12000,payeeName:'TEST recipient',description:'TEST open work',costCenter:'TEST',accountOrCard:'0'.repeat(16)});assert.equal(r.status,200);return r.data.item;}
async function review(row:any,user:string,stage:string,action='APPROVE'){return api('/review/row-action',user,{...target(saved(row.id)),reviewStage:stage,action,...(action==='APPROVE'?{}:{returnReason:'TEST reason'})});}
async function treasuryRow(){const r=await make();assert.equal((await review(r,'approver','APPROVER')).status,200);assert.equal((await review(r,'accounting','ACCOUNTING')).status,200);return saved(r.id);}
before(async()=>{
 fs.mkdirSync(root,{recursive:true});const roles=['ADMIN','REQUESTER','APPROVER','ACCOUNTING','TREASURY'];
 const data={users:[['admin','ADMIN'],['maker','REQUESTER'],['approver','APPROVER'],['accounting','ACCOUNTING'],['treasury','TREASURY'],['other','TREASURY'],['combo','ACCOUNTING']].map(([id,role])=>{const salt=crypto.randomBytes(16).toString('hex');return{id,personnelCode:id,name:'TEST '+id,role,additionalRoles:id==='combo'?['APPROVER']:[],company:'TEST',department:'TEST',isActive:true,supervisorId:id==='maker'?'approver':null,passwordSalt:salt,passwordHash:crypto.scryptSync(password,salt,64).toString('hex')};}),roleConfigs:roles.map(role=>({role,title:role,permissions:getDefaultPermissionsForRole(role),accessScope:role==='REQUESTER'?'SELF_ONLY':role==='APPROVER'?'ASSIGNED_AND_SUBORDINATES':'COMPANY_WIDE',allowedCompanies:['TEST'],approvalLimitRial:1000000,paymentLimitRial:1000000})),companies:[{id:'TEST-CO',name:'TEST',isActive:true}],departments:[{id:'TEST-DEP',name:'TEST',companyName:'TEST',isActive:true}],costCenters:[{id:'TEST-cost',name:'TEST',companyName:'TEST',isActive:true}],companyBankAccounts:[{id:'TEST-source',bankName:'بانک ملت',accountTitle:'TEST',accountNumber:'000001',companyName:'TEST',isActive:true,isDefault:true}],advanceRequests:[],paymentRequests:[],batchPayments:[],manualPayments:[],dailyCovers:[],receiptArchives:[],notifications:[],securityAuditLogs:[],passwordRecoveryRequests:[],sessions:[],smsLogs:[],smsConfig:{enabled:false,provider:'CUSTOM',apiUrl:'',events:{}}};
 if(sqlite){const s=new SqliteRecords(root+'/treasury.sqlite',true);try{s.commit(data,undefined,s.signature());}finally{s.close();}}else fs.writeFileSync(root+'/treasury-db.json',JSON.stringify(data),{flag:'wx'});
 try{await fetch(base+'/api/health');throw Error('Occupied synthetic port');}catch(e:any){if(e.message==='Occupied synthetic port')throw e;}
 const entry=process.env.TREASURY_TEST_SERVER;child=spawn(process.execPath,['--import',pathToFileURL(path.resolve('tests/fail-commit.mjs')).href,'--import',pathToFileURL(path.resolve('tests/outbound-guard.mjs')).href,...(entry?[entry]:['--import',pathToFileURL(path.resolve('tests/native-types.mjs')).href,path.resolve('server.ts')]),'--host','127.0.0.1','--port','55246'],{cwd:entry?path.dirname(entry):process.cwd(),env:{PATH:process.env.PATH,SystemRoot:process.env.SystemRoot,NODE_ENV:'production',TREASURY_TEST_DIR:root,TREASURY_DATA_DIR:root,TREASURY_STORAGE_MODE:sqlite?'sqlite':'json',DISABLE_EXTERNAL_INTEGRATIONS:'true'},windowsHide:true,stdio:'ignore'});
 for(let i=0;i<100;i++){if(child.exitCode!==null)throw Error('Synthetic server exited');try{if((await fetch(base+'/api/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 for(const user of data.users){const r=await api('/auth/login',undefined,{personnelCode:user.id,password});assert.equal(r.status,200);tokens[user.id]=r.data.token;}
});
after(async()=>{if(child?.exitCode===null){child.kill();await new Promise(r=>child.once('exit',r));}});

test('shared role reductions are atomic and cannot orphan pending rows, including companies, scope and ceilings',async()=>{
 await make();const role=store().roleConfigs.find((r:any)=>r.role==='APPROVER');
 for(const patch of [{permissions:{...role.permissions,canApprove:false}},{allowedCompanies:[]},{accessScope:'SELF_ONLY'},{approvalLimitRial:100}]){
  const before=snap();const r=await api('/roles/save','admin',{...role,...patch});try{assert.equal(r.status,409);assert.equal(r.data.code,'OPEN_WORK_BLOCKS_ACCESS_CHANGE');assert.equal(snap(),before);}finally{if(r.status===200)await api('/roles/save','admin',role);}
 }
});
test('user demotion cannot use the old replacement shortcut to move unsettled work',async()=>{
 const row=await make(),u=store().users.find((u:any)=>u.id==='approver'),before=snap();
 const r=await api('/users/save','admin',{id:u.id,name:u.name,personnelCode:u.personnelCode,company:u.company,department:u.department,role:'REQUESTER',additionalRoles:[],supervisorId:null,replacementSupervisorId:'combo'});
 try{assert.equal(r.status,409);assert.equal(r.data.code,'OPEN_WORK_BLOCKS_ACCESS_CHANGE');assert.equal(snap(),before);}finally{if(r.status===200){await api('/users/save','admin',{...u,role:'APPROVER'});const maker=store().users.find((u:any)=>u.id==='maker');await api('/users/save','admin',{...maker,supervisorId:'approver'});}}
 assert.equal(saved(row.id).status,'Pending_Approver');
});
test('open rejected owner cannot be deactivated; admin case-specific resolution preserves original rejection',async()=>{
 const row=await make();assert.equal((await review(row,'approver','APPROVER')).status,200);assert.equal((await review(row,'accounting','ACCOUNTING','REJECT')).status,200);const before=snap();
 const off=await api('/users/toggle-status','admin',{targetUserId:'accounting',isActive:false});
 try{assert.equal(off.status,409);assert.equal(snap(),before);}finally{if(off.status===200){await api('/users/toggle-status','admin',{targetUserId:'accounting',isActive:true});const login=await api('/auth/login',undefined,{personnelCode:'accounting',password});tokens.accounting=login.data.token;}}
 const body={...rejectionTarget(saved(row.id)),action:'APPROVE_REJECTED',expectedOwnerId:'accounting',reason:'TEST independent admin review'};
 assert.equal((await api('/admin/resolve-open-work','treasury',body)).status,403);
 assert.equal((await api('/admin/resolve-open-work','admin',{...body,reason:''})).status,400);
 assert.equal((await api('/admin/resolve-open-work','admin',body)).status,200);
 const final=saved(row.id);assert.equal(final.status,'Pending_Treasury');assert.equal(final.reviewRejection.byUserId,'accounting');assert.equal(final.reviewRejection.adminResolution.actorId,'admin');assert.equal(final.approvedByAccountingUserId,'admin');assert.equal(final.amount,row.amount);
 assert.equal((await api('/admin/resolve-open-work','admin',body)).status,409);
});
test('technical referrer cannot be deactivated; only eligible replacement is accepted with version and reason',async()=>{
 const row=await treasuryRow();assert.equal((await api('/treasury/return-for-correction','treasury',{...target(row),expectedStatus:undefined,recipientStage:'REQUESTER',reason:'TEST correction'})).status,200);
 const before=snap(),off=await api('/users/toggle-status','admin',{targetUserId:'treasury',isActive:false});try{assert.equal(off.status,409);assert.equal(snap(),before);}finally{if(off.status===200)await api('/users/toggle-status','admin',{targetUserId:'treasury',isActive:true});}
 const body={...target(saved(row.id)),action:'REASSIGN_CORRECTION',side:'REFERRER',expectedOwnerId:'treasury',newUserId:'other',reason:'TEST documented replacement'};
 assert.equal((await api('/admin/resolve-open-work','admin',{...body,newUserId:'maker'})).status,403);
 assert.equal((await api('/admin/resolve-open-work','admin',{...body,expectedVersion:999})).status,409);
 assert.equal((await api('/admin/resolve-open-work','admin',body)).status,200);const final=saved(row.id);assert.equal(final.status,'Needs_Revision');assert.equal(final.treasuryCorrection.byUserId,'other');assert.equal(final.treasuryCorrection.reassignments.at(-1).byUserId,'admin');assert.equal(final.amount,row.amount);
 assert.equal((await api('/requests/resubmit','maker',{itemType:'PAYMENT',requestId:row.id,expectedVersion:final.version,description:'TEST corrected'})).status,200);assert.equal(saved(row.id).status,'Pending_Treasury');
});
test('admin can close only the selected rejected child, with retry and failure safety',async()=>{
 const made=await api('/batch-payments','maker',{items:[1,2].map(i=>({amount:1000*i,payeeName:'TEST child',description:'TEST',accountOrCard:'0'.repeat(16)}))});assert.equal(made.status,200);const b=made.data.batch,row=b.items[0];
 assert.equal((await api('/review/row-action','approver',{itemType:'BATCH_ITEM',requestId:b.id,rowId:row.id,reviewStage:'APPROVER',action:'REJECT',expectedVersion:1,expectedStatus:'Pending_Approver',returnReason:'TEST reject'})).status,200);
 const rejected=store().batchPayments.find((x:any)=>x.id===b.id).items[0];
 const body={itemType:'BATCH_ITEM',requestId:b.id,rowId:row.id,expectedVersion:1,expectedStatus:'Rejected',expectedStage:'APPROVER',expectedRejectionId:rejected.reviewRejection.id,expectedOwnerId:'approver',action:'CLOSE_REJECTED',reason:'TEST admin closure'};
 const before=snap();fs.writeFileSync(root+'/test-fail-next-commit','TEST');assert.equal((await api('/admin/resolve-open-work','admin',body)).status,500);assert.equal(snap(),before);
 const replies=await Promise.all([api('/admin/resolve-open-work','admin',body),api('/admin/resolve-open-work','admin',body)]);assert.deepEqual(replies.map(r=>r.status).sort(),[200,409]);const batch=store().batchPayments.find((x:any)=>x.id===b.id);assert.equal(batch.items[0].status,'Closed');assert.equal(batch.items[1].status,'Pending_Approver');
});
test('ADMIN replay cannot resolve a later rejection by the same multi-role actor; supervisor provenance survives accounting rejection',async()=>{
 const combo=store().users.find((u:any)=>u.id==='combo'),maker=store().users.find((u:any)=>u.id==='maker');
 assert.equal((await api('/users/save','admin',{...maker,supervisorId:'combo'})).status,200);
 const row=await make();assert.equal((await review(row,'combo','APPROVER','REJECT')).status,200);
 const first={...rejectionTarget(saved(row.id)),expectedOwnerId:'combo',action:'APPROVE_REJECTED',reason:'TEST supervisor resolution'};
 assert.equal((await api('/admin/resolve-open-work','admin',first)).status,200);
 assert.equal((await review(row,'combo','ACCOUNTING','REJECT')).status,200);
 const before=snap();assert.equal((await api('/admin/resolve-open-work','admin',first)).status,409);assert.equal(snap(),before);
 assert.equal((await api('/admin/resolve-open-work','admin',{...rejectionTarget(saved(row.id)),expectedOwnerId:'combo',action:'APPROVE_REJECTED',reason:'TEST new accounting decision'})).status,200);
 const current=saved(row.id);assert.equal(current.approvedBySupervisorUserId,'admin');assert.equal(current.adminSupervisorApproval.actorId,'admin');
 assert.equal((await api('/treasury/return-for-correction','other',{itemType:'PAYMENT',requestId:row.id,expectedVersion:current.version,recipientStage:'APPROVER',reason:'TEST actual supervisor actor'})).status,200);
 assert.equal(saved(row.id).treasuryCorrection.toUserId,'admin');
 assert.equal((await api('/users/save','admin',{...maker,supervisorId:'approver'})).status,200);assert.ok(combo);
});
test('supplementary role removal is allowed only when equivalent effective authority remains; role resets cannot bypass dependencies',async()=>{
 const role=store().roleConfigs.find((r:any)=>r.role==='APPROVER');
 assert.equal((await api('/roles/save','admin',{...role,role:'TEST_SUPER_TWO',title:'TEST second supervisor',baseTemplateRole:'APPROVER'})).status,200);
 const combo=store().users.find((u:any)=>u.id==='combo'),maker=store().users.find((u:any)=>u.id==='maker');
 assert.equal((await api('/users/save','admin',{...combo,additionalRoles:['APPROVER','TEST_SUPER_TWO']})).status,200);
 assert.equal((await api('/users/save','admin',{...maker,supervisorId:'combo'})).status,200);const row=await make();
 assert.equal((await api('/users/save','admin',{...combo,additionalRoles:['TEST_SUPER_TWO']})).status,200);
 assert.equal((await review(row,'combo','APPROVER')).status,200);
 const held=snap();assert.equal((await api('/roles/reset-defaults','admin',{role:'APPROVER'})).status,409);assert.equal(snap(),held);
 assert.equal((await api('/users/save','admin',{...maker,supervisorId:'approver'})).status,200);
});
test('wrong event, financial injection and forged administrator identity cannot settle open rejected work',async()=>{
 const row=await make();assert.equal((await review(row,'approver','APPROVER','REJECT')).status,200);
 const body={...rejectionTarget(saved(row.id)),expectedOwnerId:'approver',action:'CLOSE_REJECTED',reason:'TEST case review'},before=snap();
 for(const extra of [{expectedRejectionId:'TEST-OLD'},{expectedStage:'ACCOUNTING'},{expectedOwnerId:'other'}])assert.equal((await api('/admin/resolve-open-work','admin',{...body,...extra})).status,409);
 for(const extra of [{amount:1},{requesterId:'other'},{actorId:'admin'},{attachments:[]}])assert.equal((await api('/admin/resolve-open-work','admin',{...body,...extra})).status,400);
 assert.equal((await api('/admin/resolve-open-work','accounting',body)).status,403);assert.equal(snap(),before);
});
test('future requester correction and complete-payment capacity cannot be removed while dependent work remains',async()=>{
 const row=await make(),requesterRole=store().roleConfigs.find((r:any)=>r.role==='REQUESTER'),treasuryRole=store().roleConfigs.find((r:any)=>r.role==='TREASURY');
 const before=snap();assert.equal((await api('/roles/save','admin',{role:'REQUESTER',permissions:{...requesterRole.permissions,canResubmitRevision:false}})).status,409);assert.equal(snap(),before);
 assert.equal((await review(row,'approver','APPROVER')).status,200);assert.equal((await review(row,'accounting','ACCOUNTING')).status,200);
 const beforeCap=snap();assert.equal((await api('/roles/save','admin',{role:'TREASURY',paymentLimitRial:100})).status,409);assert.equal(snap(),beforeCap);assert.ok(treasuryRole.paymentLimitRial>100);
});

test('ADMIN can replace an accounting correction recipient without granting scope or changing financial terms',async()=>{
 const row=await treasuryRow();assert.equal((await api('/treasury/return-for-correction','other',{...target(row),expectedStatus:undefined,recipientStage:'ACCOUNTING',reason:'TEST accounting technical correction'})).status,200);
 const held=saved(row.id),body={...target(held),action:'REASSIGN_CORRECTION',side:'RECIPIENT',expectedOwnerId:'accounting',newUserId:'combo',reason:'TEST documented recipient replacement'},before=snap();
 assert.equal((await api('/admin/resolve-open-work','admin',{...body,newUserId:'maker'})).status,403);assert.equal(snap(),before);
 assert.equal((await api('/admin/resolve-open-work','admin',body)).status,200);const assigned=saved(row.id);
 assert.equal(assigned.treasuryCorrection.toUserId,'combo');assert.equal(assigned.treasuryCorrection.reassignments.at(-1).fromUserId,'accounting');
 for(const key of ['amount','approvedAmount','payeeName','costCenter','approvedBySupervisorUserId','approvedByAccountingUserId'])assert.equal(assigned[key],held[key]);
 const correction={itemType:'PAYMENT',requestId:row.id,expectedVersion:assigned.version,description:'TEST corrected technical details'},afterAssignment=snap();
 assert.equal((await api('/requests/resubmit','accounting',correction)).status,403);assert.equal(snap(),afterAssignment);
 assert.equal((await api('/requests/resubmit','combo',correction)).status,200);assert.equal(saved(row.id).status,'Pending_Treasury');
});
