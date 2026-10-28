import{test}from'node:test';import assert from'node:assert/strict';
import{initializePersonnelBalances}from'../src/server/personnel-balance-schema';
import{amendBalancePayment,balanceAmendmentState}from'../src/server/personnel-balance-amend';
import{financialDraft,rebaseFinancialDraft}from'../src/utils/personnel-balance-draft';
import{getDefaultPermissionsForRole}from'../src/types/treasury';
import{treasuryInput}from'../src/server/treasury-input';
import{treasuryTargets}from'../src/utils/treasury-targets';

function fixture(){
 const user:any={id:'accountant',name:'TEST ACCOUNTANT',role:'ACCOUNTING',company:'TEST',department:'TEST',isActive:true};
 const q:any={id:'Q',trackingCode:'TEST BAL',version:2,companyId:'C',company:'TEST',department:'TEST',requesterId:'maker',requesterName:'TEST MAKER',personnel:{name:'TEST STAFF'},description:'TEST original instruction',status:'FORWARDED',createdAt:'2026-10-27T00:00:00Z',updatedAt:'2026-10-27T00:00:00Z',audit:[],financial:{requestId:'P',trackingCode:'TEST PAYMENT',amount:12000,accountantId:user.id,accountantName:user.name,at:'2026-10-27T00:00:00Z'}};
 const p:any={id:'P',version:1,trackingCode:'TEST PAYMENT',companyId:'C',company:'TEST',requesterId:'maker',initialAmount:12000,amount:12000,approvedAmount:12000,payeeName:'TEST OLD HOLDER',accountOrCard:'0'.repeat(16),iban:'',bankName:'بانک ملت',costCenter:'TEST',accountingNote:'TEST old note',description:q.description,status:'Pending_Treasury',auditHistory:[],personnelBalanceRef:{schemaVersion:1,requestId:'Q',personnelName:'TEST STAFF'}};
 const db:any={personnelBalanceSchemaVersion:1,personnelBalanceRequests:[q],personnelBalanceOperations:[],paymentRequests:[p],users:[user],roleConfigs:[{role:'ACCOUNTING',allowedCompanies:['TEST']}],companies:[{id:'C',name:'TEST',isActive:true}],costCenters:[{id:'CC',name:'TEST',companyName:'TEST',isActive:true},{id:'CC2',name:'TEST TWO',companyName:'TEST',isActive:true}],dailyCovers:[],receiptArchives:[],bankInquiryJobs:[]};
 const auth:any=(u:any)=>({effectivePermissions:{...getDefaultPermissionsForRole(u.role),canViewPersonnelBalances:true,canReviewPersonnelBalance:true},effectiveAccessScope:'COMPANY_WIDE',effectiveApprovalLimitRial:100000,effectivePaymentLimitRial:100000});
 return{db,user,q,p,auth};
}
function approved(){const f=fixture();initializePersonnelBalances(f.db,true);return{...f,q:f.db.personnelBalanceRequests[0]};}
const body=(q:any,p:any,extra:any={})=>({expectedVersion:q.version,expectedPaymentVersion:p.version,amount:18000,costCenter:'TEST TWO',payeeName:'TEST NEW HOLDER',accountOrCard:'1'.repeat(16),iban:'',bankName:'بانک سامان',note:'TEST new note',reason:'TEST correction reason',identityVerified:true,...extra});

test('schema1 migration preserves original amounts, links, histories and all unrelated data; schema3 is idempotent',()=>{
 const{db}=fixture(),before=structuredClone(db);assert.equal(initializePersonnelBalances(db,true),true);assert.equal(db.personnelBalanceSchemaVersion,3);assert.equal(db.personnelBalanceRequests[0].financial.initialAmount,12000);assert.deepEqual(db.personnelBalanceRequests[0].accountingRevisions,[]);for(const k of['paymentRequests','users','roleConfigs','costCenters','personnelBalanceOperations'])assert.deepEqual(db[k],before[k]);const installed=structuredClone(db);assert.equal(initializePersonnelBalances(db,true),false);assert.deepEqual(db,installed);
});
test('schema1 with newer fields and inconsistent links fail closed without overwriting data',()=>{
 for(const change of[(d:any)=>d.personnelBalanceRequests[0].accountingRevisions=[],(d:any)=>d.personnelBalanceRequests[0].financial.initialAmount=1,(d:any)=>d.paymentRequests[0].initialAmount=1]){const{db}=fixture();change(db);const before=structuredClone(db);assert.throws(()=>initializePersonnelBalances(db,true));assert.deepEqual(db,before);}
});
test('amendment preserves initial amount and identity while synchronizing both current amounts and before/after snapshots',()=>{
 const{db,q,p,user,auth}=approved();const initial=structuredClone(p);amendBalancePayment(db,user,q,body(q,p),auth);assert.equal(p.amount,18000);assert.equal(p.approvedAmount,18000);assert.equal(q.financial.amount,18000);assert.equal(p.initialAmount,12000);assert.equal(q.financial.initialAmount,12000);assert.equal(p.costCenter,'TEST TWO');assert.equal(p.description,initial.description);assert.deepEqual(p.personnelBalanceRef,initial.personnelBalanceRef);assert.equal(q.accountingRevisions[0].before.note,'TEST old note');assert.equal(q.accountingRevisions[0].after.note,'TEST new note');assert.equal(initializePersonnelBalances(db,true),false);p.amount=18001;assert.throws(()=>initializePersonnelBalances(db,true));
});
test('every payment or receipt/cover witness blocks amendment, including an otherwise unpaid pool row',()=>{
 for(const change of[(f:any)=>f.p.paidAmountSoFar=1,(f:any)=>f.p.paidAmount=1,(f:any)=>f.p.paymentExecutions=[{}],(f:any)=>f.p.paymentHistory=[{}],(f:any)=>f.p.receiptId='R',(f:any)=>f.p.status='Paid',(f:any)=>f.p.sourceAccountSnapshot={accountTitle:'TEST'},(f:any)=>f.db.receiptArchives.push({relatedPaymentIds:['P']}),(f:any)=>f.db.dailyCovers.push({paymentRequestIds:['P']})]){const f=approved();change(f);assert.equal(balanceAmendmentState(f.user,f.q,f.db,f.auth).allowed,false);assert.throws(()=>amendBalancePayment(f.db,f.user,f.q,body(f.q,f.p),f.auth));}
});
test('unpaid in-payment amendment returns to queue and cancels stale bank jobs and owner proof',()=>{
 const{db,q,p,user,auth}=approved();p.status='In_Payment';p.inPaymentBy='treasury';p.bankInquiry={status:'QUEUED',jobId:'J',fingerprint:'TEST',ownerConfirmed:true};p.bankPayeeName='TEST OLD';db.bankInquiryJobs.push({id:'J',status:'QUEUED',target:{itemType:'PAYMENT',requestId:'P',expectedVersion:1}});amendBalancePayment(db,user,q,body(q,p),auth);assert.equal(p.status,'Pending_Treasury');assert.equal(p.inPaymentBy,null);assert.equal(db.bankInquiryJobs[0].status,'CANCELLED');assert.equal(p.bankInquiry.code,'STALE_RESULT');assert.equal(p.bankInquiry.ownerConfirmed,false);assert.equal(p.bankPayeeName,undefined);
});
test('fresh server fields merge into untouched draft; conflicts require a choice rather than hidden overwrites',()=>{
 const base=financialDraft({amount:12000,costCenter:'TEST',payeeName:'',accountOrCard:'',iban:'',bankName:'',note:'old'}),draft={...base,note:'my note'},latest={...base,accountOrCard:'TEST fresh card',note:'other note'};const result=rebaseFinancialDraft(draft,base,latest);assert.equal(result.draft.accountOrCard,'TEST fresh card');assert.equal(result.draft.note,'my note');assert.deepEqual(Object.keys(result.conflicts),['note']);assert.equal(result.conflicts.note!.latest,'other note');assert.deepEqual(rebaseFinancialDraft(base,base,latest).conflicts,{});
});
test('amended personnel payments reject legacy/stale treasury targets and require observed paid balance',()=>{
 const code=(r:ReturnType<typeof treasuryInput>)=>'status'in r?r.status:undefined;
 const{db,q,p,user,auth}=approved();amendBalancePayment(db,user,q,body(q,p),auth);
 for(const expectedVersion of[undefined,1])assert.equal(code(treasuryInput({items:[{type:'PAYMENT',id:'P',...expectedVersion?{expectedVersion}:{}}]},db,false)),409);
 assert.equal(treasuryInput({items:[{type:'PAYMENT',id:'P',expectedVersion:2}]},db,false).error,undefined);
 assert.equal(code(treasuryInput({items:[{type:'PAYMENT',id:'P',expectedVersion:2}]},db,true)),409);
 assert.equal(treasuryInput({items:[{type:'PAYMENT',id:'P',expectedVersion:2}],expectedPaidAmounts:{'PAYMENT:P':0},idempotencyKey:'TEST'},db,true).error,undefined);
 assert.deepEqual(treasuryTargets([{id:'P',type:'PAYMENT',rawPayment:p}as any]),[{type:'PAYMENT',id:'P',expectedVersion:2}]);
});
test('unresolved draft conflicts survive further refreshes until chosen or equal to the server value',()=>{
 const base=financialDraft({amount:12000,costCenter:'TEST',payeeName:'A',accountOrCard:'',iban:'',bankName:'',note:''}),draft={...base,payeeName:'B'},latest={...base,payeeName:'C'};
 const first=rebaseFinancialDraft(draft,base,latest),second=rebaseFinancialDraft(first.draft,latest,latest,first.conflicts);
 assert.equal(second.draft.payeeName,'B');assert.equal(second.conflicts.payeeName!.latest,'C');
 const third=rebaseFinancialDraft(second.draft,latest,{...latest,amount:'15000'},second.conflicts);assert.equal(third.conflicts.payeeName!.latest,'C');assert.equal(third.draft.amount,'15000');
 assert.deepEqual(rebaseFinancialDraft(third.draft,{...latest,amount:'15000'},{...latest,amount:'15000',payeeName:'B'},third.conflicts).conflicts,{});
});
