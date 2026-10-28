import {test} from 'node:test';import assert from 'node:assert/strict';
import {initializePersonnelBalances} from '../src/server/personnel-balance-schema';
import {personnelRequestDraft,rebasePersonnelRequestDraft} from '../src/utils/personnel-request-draft';
const legacy=()=>({personnelBalanceSchemaVersion:2,personnelBalanceRequests:[{id:'Q',version:1,status:'PENDING_ACCOUNTING',personnel:{name:'TEST'},description:'TEST',audit:[],accountingRevisions:[]}],personnelBalanceOperations:[],paymentRequests:[],users:[{id:'TEST'}],roleConfigs:[]}) as any;
test('schema2 expands to3 without inventing a requester amount or altering existing rows and permissions',()=>{
 const db=legacy(),before=structuredClone(db);assert.equal(initializePersonnelBalances(db,true),true);assert.equal(db.personnelBalanceSchemaVersion,3);assert.deepEqual(db,{...before,personnelBalanceSchemaVersion:3});const current=structuredClone(db);assert.equal(initializePersonnelBalances(db,true),false);assert.deepEqual(db,current);
});
test('newer fields under old schema and malformed requester amounts fail closed without partial migration',()=>{
 for(const amount of [0,-1,1.5,'250000',null,Number.MAX_SAFE_INTEGER+1]){const db={...legacy(),personnelBalanceSchemaVersion:3};db.personnelBalanceRequests[0].requestedAmount=amount;const before=structuredClone(db);assert.throws(()=>initializePersonnelBalances(db,true));assert.deepEqual(db,before);}
 const old=legacy();old.personnelBalanceRequests[0].requestedAmount=250000;assert.throws(()=>initializePersonnelBalances(old,true));assert.equal(old.personnelBalanceSchemaVersion,2);
});
test('new schema preserves explicit declared amounts and null clearing in append-only source audit',()=>{
 const db={...legacy(),personnelBalanceSchemaVersion:3};db.personnelBalanceRequests[0].requestedAmount=250000;db.personnelBalanceRequests[0].audit=[{requestedAmountChange:{before:null,after:250000}}];assert.equal(initializePersonnelBalances(db,true),false);delete db.personnelBalanceRequests[0].requestedAmount;db.personnelBalanceRequests[0].audit.push({requestedAmountChange:{before:250000,after:null}});assert.equal(initializePersonnelBalances(db,true),false);assert.equal(db.personnelBalanceRequests[0].requestedAmount,undefined);
});
test('a refreshed returned request adopts untouched declared amount and description instead of silently restoring stale values',()=>{
 const old=personnelRequestDraft({description:'old',requestedAmount:100}),fresh=personnelRequestDraft({description:'fresh',requestedAmount:200});assert.deepEqual(rebasePersonnelRequestDraft(old,old,fresh),{draft:fresh,conflicts:{}});
 const local={...old,description:'my clarification'},r=rebasePersonnelRequestDraft(local,old,{...fresh,description:'old'});assert.deepEqual(r,{draft:{description:'my clarification',requestedAmount:'200'},conflicts:{}});
});
test('maker amount and description conflicts survive repeated refreshes and clearing until explicitly chosen',()=>{
 const old=personnelRequestDraft({description:'old',requestedAmount:100}),local={description:'mine',requestedAmount:'150'},fresh=personnelRequestDraft({description:'other',requestedAmount:200}),first=rebasePersonnelRequestDraft(local,old,fresh);assert.deepEqual(Object.keys(first.conflicts).sort(),['description','requestedAmount']);
 const second=rebasePersonnelRequestDraft(first.draft,fresh,fresh,first.conflicts);assert.deepEqual(second,first);const empty=personnelRequestDraft({description:'other'}),third=rebasePersonnelRequestDraft(second.draft,fresh,empty,second.conflicts);assert.equal(third.conflicts.requestedAmount?.latest,'');assert.equal(third.draft.requestedAmount,'150');
 assert.deepEqual(rebasePersonnelRequestDraft({...third.draft,requestedAmount:''},empty,empty,third.conflicts).conflicts,{description:third.conflicts.description});
});
