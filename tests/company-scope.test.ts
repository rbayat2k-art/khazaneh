import {test} from 'node:test';import assert from 'node:assert/strict';
import {authorizeRequest,canSeeRequest,scopeState} from '../src/server/access-control';import {getDefaultPermissionsForRole} from '../src/types/treasury';
import {companyPolicy} from '../src/server/company-access';
import {freeze} from 'immer';
function setup(){
 const viewer:any={id:'SYN-VIEW',name:'TEST reviewer',role:'ACCOUNTING',company:'TEST-A',department:'TEST',additionalRoles:[]};
 const rows=['TEST-A','TEST-B'].map((company,i)=>({id:'SYN-PAY-'+i,requesterId:'SYN-OWNER-'+i,company,department:'TEST',amount:100,status:'Pending_Treasury',attachments:[{url:'TEST'}]}));
 const db:any={users:[viewer,...rows.map((r,i)=>({id:r.requesterId,role:'REQUESTER',name:'TEST owner',company:r.company,department:'TEST'}))],roleConfigs:[{role:'ACCOUNTING',allowedCompanies:['TEST-A']},{role:'TREASURY',allowedCompanies:['TEST-B']}],companies:[{id:'SYN-CMP-A',name:'TEST-A'},{id:'SYN-CMP-B',name:'TEST-B'}],departments:[],costCenters:[],advanceRequests:[],paymentRequests:rows,batchPayments:[],manualPayments:[],dailyCovers:[],receiptArchives:[],companyBankAccounts:[{id:'SYN-BANK-A',companyName:'TEST-A'},{id:'SYN-BANK-B',companyName:'TEST-B'}],notifications:[],securityAuditLogs:[],passwordRecoveryRequests:[],smsLogs:[]};
 const auth:any={effectivePermissions:getDefaultPermissionsForRole('ADMIN'),effectiveAccessScope:'COMPANY_WIDE',effectiveApprovalLimitRial:1000000,effectivePaymentLimitRial:1000000};return {viewer,db,auth};
}
test('company restriction precedes broad scope, ownership and supervisor assignment',()=>{
 const {viewer,db,auth}=setup();assert.equal(canSeeRequest(db.paymentRequests[0],viewer,db,auth),true);assert.equal(canSeeRequest(db.paymentRequests[1],viewer,db,auth),false);
 assert.equal(canSeeRequest({...db.paymentRequests[1],requesterId:viewer.id,supervisorId:viewer.id},viewer,db,auth),false);
 assert.equal(canSeeRequest({id:'TEST-UNKNOWN'},viewer,db,auth),false);
});
test('company union comes only from configured assigned roles and revocation takes immediate effect',()=>{
 const {viewer,db,auth}=setup();viewer.additionalRoles=['TREASURY'];assert.equal(canSeeRequest(db.paymentRequests[1],viewer,db,auth),true);
 db.roleConfigs[1].allowedCompanies=[];assert.equal(canSeeRequest(db.paymentRequests[1],viewer,db,auth),false);viewer.additionalRoles=['ADMIN','MISSING'];assert.equal(canSeeRequest(db.paymentRequests[1],viewer,db,auth),false);
 assert.equal(canSeeRequest(db.paymentRequests[1],{...viewer,role:'ADMIN'},db,auth),true);
});
test('projection protects bank masters, all receipt targets and mixed-company covers',()=>{
 const {viewer,db,auth}=setup();db.receiptArchives=[{id:'SYN-RA',relatedPaymentIds:[db.paymentRequests[0].id]},{id:'SYN-RB',relatedPaymentIds:db.paymentRequests.map((r:any)=>r.id)}];
 db.dailyCovers=[{id:'SYN-CA',advanceRequestIds:[],paymentRequestIds:[db.paymentRequests[0].id],manualPaymentIds:[]},{id:'SYN-CB',advanceRequestIds:[],paymentRequestIds:db.paymentRequests.map((r:any)=>r.id),manualPaymentIds:[]}];
 const result=scopeState(db,viewer,auth);assert.deepEqual(result.paymentRequests.map(r=>r.id),['SYN-PAY-0']);assert.deepEqual(result.companyBankAccounts!.map(r=>r.id),['SYN-BANK-A']);assert.deepEqual(result.receiptArchives.map(r=>r.id),['SYN-RA']);assert.deepEqual(result.dailyCovers.map(r=>r.id),['SYN-CA']);
});
test('mutation rejects an unauthorized source account even for an authorized financial target',()=>{
 const {viewer,db,auth}=setup();const denied=authorizeRequest({path:'/treasury/execute-payment',method:'POST',body:{items:[{type:'PAYMENT',id:'SYN-PAY-0'}],sourceBankAccountId:'SYN-BANK-B',bankRefNumber:'TEST'}},viewer,db,auth);assert.equal(denied?.status,403);
});
test('historical stable company IDs survive a display rename; ambiguous legacy ownership fails closed',()=>{
 const {viewer,db}=setup();db.companies[0].name='TEST renamed';db.roleConfigs[0].allowedCompanies=['TEST renamed'];const p=companyPolicy(viewer,db);
 assert.equal(p.financial({companyId:'SYN-CMP-A',company:'TEST-A'}),true);assert.equal(p.financial({companyId:'MISSING',company:'TEST renamed'}),false);assert.equal(p.financial({requesterId:'MISSING'}),false);assert.equal(p.financial({requesterId:'SYN-OWNER-1'}),false);
});
test('nested bank IDs, global defaults and delegation cannot bypass the company boundary',()=>{
 const {viewer,db,auth}=setup();for(const [path,body] of [['/treasury/bank-accounts/save',{account:{id:'SYN-BANK-B',companyName:'TEST-A'}}],['/treasury/bank-accounts/toggle-status',{accountId:'SYN-BANK-B'}],['/treasury/bank-accounts/set-default',{accountId:'SYN-BANK-A'}],['/roles/save',{role:'ACCOUNTING',allowedCompanies:['TEST-B']}],['/master-data/departments/bulk-create',{rows:[{companyId:'SYN-CMP-B',name:'TEST'}]}]] as const)assert.equal(authorizeRequest({path,method:'POST',body},viewer,db,auth)?.status,403,path);
});
test('decoy IDs cannot replace the resource actually executed by user or bank commands',()=>{
 const {viewer,db,auth}=setup();for(const [path,method,body] of [['/users/reset-password','POST',{id:viewer.id,targetUserId:'SYN-OWNER-1'}],['/users/toggle-status','POST',{userId:viewer.id,targetUserId:'SYN-OWNER-1'}],['/users/SYN-OWNER-1','DELETE',{id:viewer.id}],['/treasury/bank-accounts/toggle-status','POST',{account:{id:'SYN-BANK-A'},accountId:'SYN-BANK-B'}]] as const)assert.equal(authorizeRequest({path,method,body},viewer,db,auth)?.status,403,path);
});
test('clearing a default through save cannot promote a bank of an unauthorized company',()=>{
 const {viewer,db,auth}=setup();db.companyBankAccounts[0].isDefault=true;
 assert.equal(authorizeRequest({path:'/treasury/bank-accounts/save',method:'POST',body:{account:{id:'SYN-BANK-A',companyName:'TEST-A',isDefault:false,isActive:false}}},viewer,db,auth)?.status,403);
});

test('interleaved scopes do not repeatedly rescan already proven immutable all-visible receipts and revoke immediately',()=>{
 const fixture=setup();let reads=0;const receipt=new Proxy(Object.freeze({id:'SYN-RECEIPT',relatedPaymentIds:Object.freeze(['SYN-PAY-0'])}),{get(target,key,receiver){if(key==='relatedPaymentIds')reads++;return Reflect.get(target,key,receiver);}}),db=freeze({...fixture.db,receiptArchives:Object.freeze([receipt])},true) as any,viewer=db.users[0],auth=fixture.auth;
 const first=scopeState(db,viewer,auth);assert.equal(first.receiptArchives.length,1);scopeState(db,freeze({...viewer,role:'REQUESTER'},true),{...auth,effectivePermissions:{...auth.effectivePermissions,canViewReceiptArchive:false,canViewAttachments:false}});
 reads=0;const second=scopeState({...db,notifications:freeze([],true)},viewer,auth);assert.equal(second.receiptArchives,first.receiptArchives);assert.equal(reads,0,'interleaving must not discard the exact immutable membership/all-visible proof');
 const revoked=freeze({...db,roleConfigs:db.roleConfigs.map((r:any)=>({...r,allowedCompanies:[]}))},true);assert.equal(scopeState(revoked,viewer,auth).receiptArchives.length,0);assert.equal(scopeState(db,viewer,{...auth,effectivePermissions:{...auth.effectivePermissions,canViewReceiptArchive:false,canViewAttachments:false}}).receiptArchives.length,0);
});

test('manual-only receipt visibility never becomes a retained financial membership grant',()=>{
 const {viewer,db,auth}=setup();db.receiptArchives=[{id:'SYN-MANUAL-RECEIPT',relatedPaymentIds:['SYN-MANUAL']}];db.manualPayments=[{id:'SYN-MANUAL',sourceBankAccountId:'SYN-BANK-A',createdById:viewer.id}];const initial=freeze(db,true) as any,v=initial.users[0];assert.equal(scopeState(initial,v,auth).receiptArchives.length,1);
 const revoked=freeze({...initial,roleConfigs:initial.roleConfigs.map((r:any)=>({...r,allowedCompanies:[]}))},true);assert.equal(scopeState(revoked,v,auth).receiptArchives.length,0);assert.equal(scopeState({...initial,manualPayments:freeze([],true)},v,auth).receiptArchives.length,0);
});
