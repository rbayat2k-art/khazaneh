import {test} from 'node:test';import assert from 'node:assert/strict';import {companyPolicy} from '../src/server/company-access';
test('company references remain conjunctive and only absent declarations use the validated owner',()=>{
 const db:any={companies:[{id:'TEST-ID',name:'TEST'}],users:[{id:'TEST-owner',company:'TEST'},{id:'TEST-other',company:'OTHER'}],companyBankAccounts:[],roleConfigs:[{role:'REQUESTER',allowedCompanies:['TEST']},{role:'ACCOUNTING',allowedCompanies:['OTHER']}]};
 const view:any={id:'TEST-viewer',role:'REQUESTER'},policy=companyPolicy(view,db),values=[undefined,null,'','TEST',' TEST ','OTHER',0,false,[],{}];
 for(const company of values)for(const companyName of values)for(const requesterId of ['TEST-owner','TEST-other','MISSING']){
  const row={company,companyName,requesterId},refs=['company','companyName'].filter(key=>(row as any)[key]!==undefined&&(row as any)[key]!==null&&(row as any)[key]!=='').map(key=>(row as any)[key]);
  const expected=refs.length?refs.every(policy.has):policy.has(db.users.find((u:any)=>u.id===requesterId)?.company);assert.equal(policy.financial(row),expected);
 }
 assert.equal(policy.financial({companyId:'MISSING',company:'TEST'}),false);assert.equal(policy.financial({companyId:'TEST-ID',company:'historical name'}),true);
 assert.equal(companyPolicy({...view,additionalRoles:['ACCOUNTING']},db).financial({company:'OTHER'}),true);
 assert.equal(companyPolicy(view,{...db,roleConfigs:[]}).financial({company:'TEST'}),false);
});
