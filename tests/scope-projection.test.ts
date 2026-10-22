import {test} from 'node:test';import assert from 'node:assert/strict';import {freeze} from 'immer';
import {scopeState,canSeeRequest} from '../src/server/access-control';import {getDefaultPermissionsForRole} from '../src/types/treasury';
const user=(id:string,supervisorId?:string)=>({id,name:'TEST '+id,role:'APPROVER',company:'TEST',department:'TEST',supervisorId});
const state:any=freeze({users:[user('VIEW'),user('DIRECT','VIEW'),user('CHAIN','DIRECT'),user('OTHER','LOOP'),user('LOOP','OTHER')],roleConfigs:[{role:'APPROVER',allowedCompanies:['TEST']}],advanceRequests:[],paymentRequests:['DIRECT','CHAIN','OTHER','MISSING'].map(id=>({id,requesterId:id,department:'TEST',amount:100,attachments:[{url:'TEST'}],paymentHistory:[{receiptFileUrl:'TEST'}]})),batchPayments:[],manualPayments:[],dailyCovers:[],receiptArchives:[],companyBankAccounts:[],notifications:[],securityAuditLogs:[],passwordRecoveryRequests:[],smsLogs:[],smsConfig:{enabled:false}},true);
const viewer:any=state.users[0];
test('fully authorized immutable collections retain identity only after all current visibility checks pass',()=>{
 const complete:any=freeze({...state,paymentRequests:state.paymentRequests.slice(0,2)},true),auth:any={effectivePermissions:getDefaultPermissionsForRole('APPROVER'),effectiveAccessScope:'COMPANY_WIDE'};
 assert.equal(scopeState(complete,viewer,auth).paymentRequests,complete.paymentRequests);
 const restricted=scopeState(complete,viewer,{...auth,effectiveAccessScope:'SELF_ONLY'});assert.deepEqual(restricted.paymentRequests,[]);
 assert.deepEqual(scopeState(complete,viewer,{...auth,effectivePermissions:{...auth.effectivePermissions,canViewRequests:false}}).paymentRequests,[]);
 const mutable=structuredClone(complete);assert.notEqual(scopeState(mutable,viewer,auth).paymentRequests,mutable.paymentRequests,'mutable input cannot establish a retained baseline');
});
test('indexed projection retains the exact visibility rules including missing owners and cycles',()=>{
 for(const scope of ['SELF_ONLY','DEPARTMENT','ASSIGNED_AND_SUBORDINATES','COMPANY_WIDE']){
  const auth:any={effectivePermissions:getDefaultPermissionsForRole('APPROVER'),effectiveAccessScope:scope};
  assert.deepEqual(scopeState(state,viewer,auth).paymentRequests.map(r=>r.id),state.paymentRequests.filter((r:any)=>canSeeRequest(r,viewer,state,auth)).map((r:any)=>r.id));
 }
});

test('a projection traverses each repeated requester hierarchy once without retaining its access decision',()=>{
 const many:any=freeze({...state,paymentRequests:Array.from({length:1000},(_,i)=>({id:'TEST-REPEATED-'+i,requesterId:'CHAIN',company:'TEST',amount:100}))},true),auth:any={effectivePermissions:getDefaultPermissionsForRole('APPROVER'),effectiveAccessScope:'ASSIGNED_AND_SUBORDINATES'};
 const countSets=(work:()=>void)=>{const OriginalSet=globalThis.Set;let calls=0;globalThis.Set=class<T>extends OriginalSet<T>{constructor(values?:Iterable<T>|null){super(values);calls++;}};try{work();}finally{globalThis.Set=OriginalSet;}return calls;};
 const referenceSets=countSets(()=>{assert.equal(many.paymentRequests.filter((r:any)=>canSeeRequest(r,many.users[0],many,auth)).length,1000);});let projected:any;
 const projectionSets=countSets(()=>{projected=scopeState(many,many.users[0],auth);});assert.equal(projected.paymentRequests.length,1000);assert.ok(referenceSets>=1000,'reference per-row traversal must exercise the measured allocation hotspot');assert.ok(projectionSets<=30,'same requester chain must not allocate/traverse once per historical row');
 const versions=[
  {...many,users:many.users.map((owner:any)=>owner.id==='CHAIN'?{...owner,supervisorId:'OTHER'}:owner)},
  {...many,users:[{...many.users[2],supervisorId:'OTHER'},...many.users]},
  {...many,users:many.users.filter((owner:any)=>owner.id!=='DIRECT')},
  {...many,users:many.users.map((owner:any)=>owner.id==='CHAIN'?{...owner,supervisorId:'CHAIN'}:owner)},
  {...many,paymentRequests:[{id:'TEST-ASSIGNED',requesterId:'MISSING',supervisorId:'VIEW',company:'TEST',amount:100},{id:'TEST-FOREIGN',requesterId:'CHAIN',supervisorId:'VIEW',company:'OTHER',amount:100}]},
 ];
 for(const version of versions){const current:any=freeze(version,true),view=current.users.find((u:any)=>u.id==='VIEW');assert.deepEqual(scopeState(current,view,auth).paymentRequests.map(r=>r.id),current.paymentRequests.filter((r:any)=>canSeeRequest(r,view,current,auth)).map((r:any)=>r.id));}
 assert.deepEqual(scopeState(many,many.users[0],{...auth,effectivePermissions:{...auth.effectivePermissions,canViewRequests:false}}).paymentRequests,[]);
 const other=many.users.find((u:any)=>u.id==='OTHER');assert.deepEqual(scopeState(many,other,auth).paymentRequests.map(r=>r.id),many.paymentRequests.filter((r:any)=>canSeeRequest(r,other,many,auth)).map((r:any)=>r.id));
});

test('mutable or getter supervisor dependencies keep the original current per-row traversal',()=>{
 const auth:any={effectivePermissions:getDefaultPermissionsForRole('APPROVER'),effectiveAccessScope:'ASSIGNED_AND_SUBORDINATES'},owner={...state.users[2]},current:any={...state,users:Object.freeze(state.users.map((u:any)=>u.id==='CHAIN'?owner:u)),paymentRequests:[{id:'FIRST',requesterId:'CHAIN',company:'TEST',amount:100},{id:'SECOND',requesterId:'CHAIN',get company(){owner.supervisorId='OTHER';return 'TEST';},amount:100}]};
 assert.deepEqual(scopeState(current,viewer,auth).paymentRequests.map(r=>r.id),['FIRST'],'a shallow frozen users array is not an immutable hierarchy proof');
 let reads=0;const accessor=Object.freeze({...state.users[2],get supervisorId(){reads++;return 'DIRECT';}}),withGetter:any={...state,users:Object.freeze(state.users.map((u:any)=>u.id==='CHAIN'?accessor:u)),paymentRequests:freeze(Array.from({length:100},(_,i)=>({id:'GETTER-'+i,requesterId:'CHAIN',company:'TEST',amount:100})),true)};
 assert.equal(scopeState(withGetter,viewer,auth).paymentRequests.length,100);assert.ok(reads>100,'frozen accessors cannot establish a retained traversal result');
});

test('virtual Proxy supervisor data cannot establish a per-projection hierarchy proof',()=>{
 const auth:any={effectivePermissions:getDefaultPermissionsForRole('APPROVER'),effectiveAccessScope:'ASSIGNED_AND_SUBORDINATES'};let supervisor='DIRECT';const target={...state.users[2]};delete target.supervisorId;
 const owner=new Proxy(Object.freeze(target),{get(value,key,receiver){if(key==='supervisorId')return supervisor;return Reflect.get(value,key,receiver);}});assert.equal('supervisorId' in owner,false);
 for(const proxyArray of [false,true]){supervisor='DIRECT';const users=Object.freeze(state.users.map((u:any)=>u.id==='CHAIN'?owner:u)),current:any={...state,users:proxyArray?new Proxy(users,{}):users,paymentRequests:[{id:'FIRST',requesterId:'CHAIN',company:'TEST',amount:100},{id:'SECOND',requesterId:'CHAIN',get company(){supervisor='OTHER';return 'TEST';},amount:100}]};assert.deepEqual(scopeState(current,viewer,auth).paymentRequests.map(r=>r.id),['FIRST']);}
});
test('immutable attachment redaction is reused without caching current access or altering its source',()=>{
 const auth:any={effectivePermissions:{...getDefaultPermissionsForRole('APPROVER'),canViewAttachments:false},effectiveAccessScope:'COMPANY_WIDE'};
 const first=scopeState(state,viewer,auth),second=scopeState(state,viewer,auth);assert.equal(first.paymentRequests[0],second.paymentRequests[0]);assert.equal((first.paymentRequests[0] as any).attachments,undefined);assert.equal((first.paymentRequests[0].paymentHistory![0] as any).receiptFileUrl,undefined);assert.equal(state.paymentRequests[0].attachments[0].url,'TEST');
 assert.equal(scopeState(state,viewer,{...auth,effectivePermissions:{...auth.effectivePermissions,canViewAttachments:true}}).paymentRequests[0],state.paymentRequests[0]);
 assert.deepEqual(scopeState(state,viewer,{...auth,effectivePermissions:{...auth.effectivePermissions,canViewRequests:false}}).paymentRequests,[]);
 assert.deepEqual(scopeState(state,{...viewer,mustChangePassword:true},auth).paymentRequests,[]);
 const next:any=freeze({...state,paymentRequests:[{...state.paymentRequests[0],amount:200}]},true);assert.equal(scopeState(next,viewer,auth).paymentRequests[0].amount,200);assert.equal(first.paymentRequests[0].amount,100);
});

test('unchanged financial selection survives unrelated commits only while the current company policy is identical',()=>{
 const original:any=freeze({...state,paymentRequests:[...state.paymentRequests,{id:'FOREIGN',company:'FOREIGN',amount:100},{id:'CATALOG',companyId:'NEW',amount:100}]},true);
 const auth:any={effectivePermissions:getDefaultPermissionsForRole('APPROVER'),effectiveAccessScope:'COMPANY_WIDE'},first=scopeState(original,viewer,auth);
 const unrelated:any=freeze({...original,users:original.users.map((u:any)=>({...u,name:'TEST renamed'})),securityAuditLogs:[{id:'TEST-audit'}]},true),again=scopeState(unrelated,unrelated.users[0],auth);
 assert.equal(first.paymentRequests,again.paymentRequests,'same immutable collection and effective financial policy must reuse the partial selection across root snapshots');assert.equal(again.users[0].name,'TEST renamed');
 const revoked:any=freeze({...unrelated,roleConfigs:[{role:'APPROVER',allowedCompanies:['FOREIGN']}]},true);assert.deepEqual(scopeState(revoked,revoked.users[0],auth).paymentRequests.map(r=>r.id),['FOREIGN']);
 const ownerChanged:any=freeze({...unrelated,users:unrelated.users.map((u:any)=>({...u,company:'FOREIGN'}))},true);assert.deepEqual(scopeState(ownerChanged,ownerChanged.users[0],auth).paymentRequests,[]);
 const catalog:any=freeze({...unrelated,companies:[{id:'NEW',name:'TEST'}]},true);assert.ok(scopeState(catalog,catalog.users[0],auth).paymentRequests.some(r=>r.id==='CATALOG'));
 assert.deepEqual(scopeState(unrelated,unrelated.users[0],{...auth,effectivePermissions:{...auth.effectivePermissions,canViewRequests:false}}).paymentRequests,[]);
 assert.deepEqual(scopeState(unrelated,{...unrelated.users[0],mustChangePassword:true},auth).paymentRequests,[]);
 assert.deepEqual(scopeState(unrelated,unrelated.users[0],{...auth,effectiveAccessScope:'SELF_ONLY'}).paymentRequests,[]);
 const hidden=scopeState(unrelated,unrelated.users[0],{...auth,effectivePermissions:{...auth.effectivePermissions,canViewAttachments:false}});assert.equal(hidden.paymentRequests[0].attachments,undefined);assert.equal(first.paymentRequests[0].attachments![0].url,'TEST');
});

test('reused financial selections match current owner and catalog policy including deletion and first duplicate owner',()=>{
 const auth:any={effectivePermissions:getDefaultPermissionsForRole('APPROVER'),effectiveAccessScope:'COMPANY_WIDE'};
 const base:any=freeze({...state,companies:[{id:'TEST-ID',name:'TEST'}],paymentRequests:[{id:'LEGACY',requesterId:'DIRECT',amount:100},{id:'STABLE',companyId:'TEST-ID',amount:100},{id:'DENIED',company:'OTHER',amount:100}]},true);
 scopeState(base,base.users[0],auth);
 const versions=[
  {...base,users:base.users.filter((u:any)=>u.id!=='DIRECT')},
  {...base,users:[{...base.users[1],company:'OTHER'},...base.users]},
  {...base,users:[...base.users,{...base.users[1],company:'OTHER'}]},
  {...base,companies:[]},
  {...base,companies:[{id:'OTHER-ID',name:'OTHER'}]},
 ];
 for(const version of versions){const current:any=freeze(version,true),view=current.users.find((u:any)=>u.id==='VIEW');assert.deepEqual(scopeState(current,view,auth).paymentRequests.map(r=>r.id),current.paymentRequests.filter((r:any)=>canSeeRequest(r,view,current,auth)).map((r:any)=>r.id));}
 assert.deepEqual(scopeState(freeze(versions[1],true) as any,base.users[0],auth).paymentRequests.map(r=>r.id),['STABLE']);
 assert.deepEqual(scopeState(freeze(versions[2],true) as any,base.users[0],auth).paymentRequests.map(r=>r.id),['LEGACY','STABLE']);
});

test('mutable or accessor company policy and password gates never reuse another visibility result',()=>{
 const auth:any={effectivePermissions:getDefaultPermissionsForRole('APPROVER'),effectiveAccessScope:'COMPANY_WIDE'},base:any=freeze({...state,paymentRequests:[...state.paymentRequests,{id:'FOREIGN',company:'OTHER',amount:100}]},true);
 scopeState(base,viewer,auth);
 const mutableUsers=structuredClone(base.users),mutable:any={...base,users:mutableUsers};scopeState(mutable,viewer,auth);mutableUsers.forEach((u:any)=>u.company='OTHER');assert.deepEqual(scopeState(mutable,viewer,auth).paymentRequests,[]);
 let company='TEST';const owner=Object.freeze({id:'DIRECT',get company(){return company;}}),accessor:any={...base,users:Object.freeze([base.users[0],owner])};scopeState(accessor,viewer,auth);company='OTHER';assert.deepEqual(scopeState(accessor,viewer,auth).paymentRequests,[]);
 let mustChange=false;const gated:any=Object.freeze({...viewer,get mustChangePassword(){return mustChange;}});scopeState(base,gated,auth);mustChange=true;assert.deepEqual(scopeState(base,gated,auth).paymentRequests,[]);
});

test('equivalent role selections share no grants and contradictory company declarations remain denied',()=>{
 const auth:any={effectivePermissions:getDefaultPermissionsForRole('APPROVER'),effectiveAccessScope:'COMPANY_WIDE'};
 const base:any=freeze({...state,users:[...state.users,{id:'SECOND',role:'ACCOUNTING',company:'TEST'}],roleConfigs:[...state.roleConfigs,{role:'ACCOUNTING',allowedCompanies:['TEST']}],paymentRequests:[{id:'YES',company:'TEST',amount:100},{id:'NO',company:'TEST',companyName:'OTHER',amount:100}]},true);
 const a=scopeState(base,base.users[0],auth),b=scopeState(base,base.users.at(-1),auth);assert.equal(a.paymentRequests,b.paymentRequests);assert.deepEqual(a.paymentRequests.map(r=>r.id),['YES']);
 const current:any=freeze({...base,roleConfigs:[base.roleConfigs[0],{role:'ACCOUNTING',allowedCompanies:[]}]},true);
 assert.deepEqual(scopeState(current,current.users.at(-1),auth).paymentRequests,[]);assert.equal(scopeState(current,current.users[0],auth).paymentRequests,a.paymentRequests);
});

test('unchanged authorized selections do not rebuild their related identifier set for every read',()=>{
 let reads=0;const row=new Proxy(Object.freeze({id:'TEST-ROW',company:'TEST',amount:100}),{get(target,key,receiver){if(key==='id')reads++;return Reflect.get(target,key,receiver);}});
 const current:any=freeze({...state,paymentRequests:[row,{id:'TEST-FOREIGN',company:'OTHER',amount:100}]},true),auth:any={effectivePermissions:getDefaultPermissionsForRole('APPROVER'),effectiveAccessScope:'COMPANY_WIDE'};
 scopeState(current,viewer,auth);const before=reads;scopeState({...current,securityAuditLogs:[]},viewer,auth);assert.equal(reads,before,'stable authorized collections must reuse derived identifiers, not rescan every financial ID');
});

test('cached derived identifiers never keep receipt, cover or notification access after company revocation',()=>{
 const base:any=freeze({...state,paymentRequests:[{id:'SYN-PAY',company:'TEST',amount:100}],receiptArchives:[{id:'SYN-RECEIPT',relatedPaymentIds:['SYN-PAY']}],dailyCovers:[{id:'SYN-COVER',paymentRequestIds:['SYN-PAY']}],notifications:[{id:'SYN-NOTICE',eventType:'PAYMENT_EXECUTED',recipientUserId:viewer.id,receiptId:'SYN-RECEIPT'}]},true),auth:any={effectivePermissions:{...getDefaultPermissionsForRole('APPROVER'),canViewAttachments:true,canViewTreasuryQueue:true},effectiveAccessScope:'COMPANY_WIDE'};
 for(let i=0;i<2;i++){const visible=scopeState(base,viewer,auth);assert.equal(visible.receiptArchives.length,1);assert.equal(visible.dailyCovers.length,1);assert.equal(visible.notifications?.length,1);}
 const revoked:any=freeze({...base,roleConfigs:[{role:'APPROVER',allowedCompanies:[]}]},true),hidden=scopeState(revoked,viewer,auth);assert.deepEqual(hidden.paymentRequests,[]);assert.deepEqual(hidden.receiptArchives,[]);assert.deepEqual(hidden.dailyCovers,[]);assert.deepEqual(hidden.notifications,[]);
});
