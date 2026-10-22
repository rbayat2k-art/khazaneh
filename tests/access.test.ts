import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { spawn, type ChildProcess } from 'node:child_process';
import { getDefaultPermissionsForRole } from '../src/types/treasury';
import { authorizeRequest, scopeState } from '../src/server/access-control';
import { canEditSubmittedRequest } from '../src/utils/request-edit';
import {assessBankImport} from '../src/utils/bank-account-import';
import {SqliteRecords} from '../src/server/sqlite-records';
import {StateSyncClient} from '../src/utils/state-sync';

const root = process.env.TREASURY_TEST_DIR;
if (!root || path.resolve(root) === path.resolve('data')) throw new Error('Set TREASURY_TEST_DIR to a disposable directory outside the live data directory.');
fs.mkdirSync(root, { recursive: true });
const dbFile = path.join(root, 'treasury-db.json');
const sqlite=process.env.TREASURY_TEST_STORAGE==='sqlite';
const backing=sqlite?new SqliteRecords<any>(path.join(root,'treasury.sqlite'),true):undefined;
function readStore():string{return backing?JSON.stringify(backing.read()):fs.readFileSync(dbFile,'utf8');}
function writeStore(value:string):void{if(backing){const old=Number((backing.connection.prepare('SELECT revision FROM store_version').get() as any).revision)>0?backing.read():undefined;backing.commit(JSON.parse(value),old,backing.signature());}else fs.writeFileSync(dbFile,value);}
const port = Number(process.env.TREASURY_TEST_PORT || 4322);
const base = `http://127.0.0.1:${port}`;
const password = 'Synthetic-Only!2026';
const users = ['admin', 'requester', 'other', 'approver', 'accounting', 'treasury', 'forced'].map((id) => {
  const role = id === 'admin' ? 'ADMIN' : id === 'approver' ? 'APPROVER' : id === 'accounting' ? 'ACCOUNTING' : id === 'treasury' ? 'TREASURY' : 'REQUESTER';
  const salt = crypto.randomBytes(16).toString('hex');
  return { id, name: `TEST ${id}`, personnelCode: id, department: 'TEST', company: 'TEST', role, phone: '', isActive: true,
    supervisorId: ['requester', 'forced'].includes(id) ? 'approver' : null, preferences: {}, mustChangePassword: id === 'forced',
    passwordSalt: salt, passwordHash: crypto.scryptSync(password, salt, 64).toString('hex') };
});
const roleConfigs = ['ADMIN','REQUESTER','APPROVER','ACCOUNTING','TREASURY'].map(role => ({
  role, title: role, description: 'Synthetic fixture', baseTemplateRole: role, defaultLandingSection: role === 'ADMIN' ? 'ADMIN_PANEL' : role,
  accessScope: role === 'REQUESTER' ? 'SELF_ONLY' : role === 'APPROVER' ? 'ASSIGNED_AND_SUBORDINATES' : 'COMPANY_WIDE',
  allowedCompanies: ['TEST'], approvalLimitRial: 1000000, paymentLimitRial: 1000000, permissions: getDefaultPermissionsForRole(role),
}));
const fixture: any = { users, roleConfigs, companies: [], departments: [], costCenters: [], companyBankAccounts: [],
  advanceRequests: [], paymentRequests: [], batchPayments: [], manualPayments: [], dailyCovers: [], receiptArchives: [],
  notifications: [], securityAuditLogs: [], passwordRecoveryRequests: [], sessions: [], smsLogs: [],
  smsConfig: { enabled: false, provider: 'KAVENEGAR', apiUrl: '', senderNumber: '', events: {} } };
// An explicitly synthetic pre-upgrade record, written before starting the isolated server.
fixture.paymentRequests.push({id:'TEST-legacy-bank-revision',trackingCode:'TEST-LEGACY-BANK-REVISION',requesterId:'requester',requesterName:'TEST requester',department:'TEST',supervisorId:'approver',supervisorName:'TEST approver',status:'Needs_Revision',version:1,amount:12000,initialAmount:12000,description:'TEST legacy banking separators',payeeName:'TEST legacy recipient',accountOrCard:'0000-0000-0000-0001',iban:'IR00 '+ '0'.repeat(21)+'1',bankName:'بانک ملت',costCenter:'TEST',priority:'Normal',createdAt:'1405/07/29',dueDate:'1405/07/29',approvedBySupervisorUserId:'approver',approvedBySupervisorName:'TEST approver',approvedBySupervisorAt:'TEST',returnedByRole:'ACCOUNTING',returnedByUserId:'accounting',returnedReason:'TEST document correction',comments:[],attachments:[],auditHistory:[{id:'TEST-legacy-submit',action:'TEST submit',actorId:'requester',stage:'REQUESTER',decision:'SUBMIT',version:1,changedBy:'TEST requester',changedAt:'TEST'},{id:'TEST-legacy-approval',action:'TEST approve',actorId:'approver',stage:'APPROVER',decision:'APPROVE',version:1,changedBy:'TEST approver',changedAt:'TEST'},{id:'TEST-legacy-return',action:'TEST return',actorId:'accounting',stage:'ACCOUNTING',decision:'RETURN_FOR_REVISION',version:1,changedBy:'TEST accounting',changedAt:'TEST'}]});
fixture.paymentRequests.push({...structuredClone(fixture.paymentRequests[0]),id:'TEST-legacy-numeric-bank',trackingCode:'TEST-LEGACY-NUMERIC-BANK',accountOrCard:1234567890123456});
for(const n of [1,2])fixture.paymentRequests.push({...structuredClone(fixture.paymentRequests[0]),id:'TEST-fraction-'+n,trackingCode:'TEST-FRACTION-'+n,status:'Pending_Treasury',amount:1.5,initialAmount:1.5,approvedAmount:1.5,accountOrCard:'',iban:'',approvedByAccountingUserId:'accounting'});
let child: ChildProcess;
const tokens: Record<string,string> = {};
let requestId: string;
let stdout = '';
async function api(route: string, user?: string, body?: any, method = body === undefined ? 'GET' : 'POST') {
  const response = await fetch(base + '/api' + route, { method, headers: { 'Content-Type':'application/json', ...(user ? { Authorization: `Bearer ${tokens[user] || user}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const data = response.headers.get('content-type')?.includes('application/json') ? await response.json() : {error:'Non-JSON HTTP response'};
  return { status: response.status, data };
}
before(async () => {
  // Refuse to reuse an occupied endpoint. Never send fixture logins to a live instance.
  try { await fetch(base + '/api/health'); throw new Error('TEST PORT ALREADY IN USE'); } catch (error: any) { if (error.message === 'TEST PORT ALREADY IN USE') throw error; }
  writeStore(JSON.stringify(fixture, null, 2));
  const entry=process.env.TREASURY_TEST_SERVER;
  if(entry && (!path.isAbsolute(entry) || path.basename(entry)!=='server.cjs')) throw Error('explicit built server entry required');
  child = spawn(process.execPath, ['--import',pathToFileURL(path.resolve('tests/fail-commit.mjs')).href,...(entry ? [entry] : ['--import','./tests/native-types.mjs','server.ts']),'--host','127.0.0.1','--port',String(port)], {
    cwd: entry ? path.dirname(entry) : process.cwd(), env: { ...process.env, NODE_ENV:'production', TREASURY_STORAGE_MODE:sqlite?'sqlite':'json', TREASURY_DATA_DIR:root, DISABLE_EXTERNAL_INTEGRATIONS:'true' }, stdio: ['ignore','pipe','pipe'], windowsHide: true,
  });
  child.stdout?.on('data', d => stdout += d.toString()); child.stderr?.on('data', d => stdout += d.toString());
  for (let n=0; n<100; n++) {
    if (child.exitCode !== null) throw new Error(stdout);
    try { if ((await fetch(base + '/api/health')).ok) break; } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  assert.equal((await fetch(base + '/api/health')).status, 200);
  for (const u of users) {
    const result = await api('/auth/login', undefined, { personnelCode:u.personnelCode, password });
    assert.equal(result.status, 200, JSON.stringify(result.data)); tokens[u.id] = result.data.token;
    assert.ok(tokens[u.id]);
  }
});
after(async () => {
  fs.writeFileSync(path.join(root!, 'server-test.log'), stdout);
  backing?.close();
  if (child && child.exitCode === null) { child.kill(); await new Promise(r => child.once('exit', r)); }
});

function assertStoreUnchanged(before:string){
  const after=readStore();
  if(before!==after){const a=JSON.parse(before),b=JSON.parse(after);const changed=Object.keys(a).filter(k=>JSON.stringify(a[k])!==JSON.stringify(b[k]));assert.fail('Synthetic store changed in keys: '+changed.join(','));}
}
test('bank identifiers reject incomplete new and amended values without partial writes',async()=>{
  const invalids=[{accountOrCard:'0'.repeat(15)},{accountOrCard:'0'.repeat(17)},{accountOrCard:1234567890123456},{accountOrCard:'0'.repeat(16)+'x'},{iban:'IR'},{iban:'IR'+'0'.repeat(23)},{iban:'IR'+'0'.repeat(25)},{iban:'IR'+'0'.repeat(24)+'x'}];
  for(const fields of invalids){
    const before=readStore();
    assert.equal((await api('/payment-requests','requester',{amount:12000,payeeName:'TEST bank validation',...fields})).status,400);
    assert.equal((await api('/batch-payments','requester',{title:'TEST invalid bank group',items:[{amount:12000,payeeName:'TEST valid'},{amount:12000,payeeName:'TEST invalid',...fields}]})).status,400);
    assertStoreUnchanged(before);
  }
  const created=await api('/payment-requests','requester',{amount:12000,payeeName:'TEST normalized bank',accountOrCard:'۰۰۰۰-۰۰۰۰-۰۰۰۰-۰۰۰۱',iban:'ir'+'٠'.repeat(23)+'١'});assert.equal(created.status,200);assert.equal(created.data.item.accountOrCard,'0000000000000001');assert.equal(created.data.item.iban,'IR'+'0'.repeat(23)+'1');
  const command={requesterId:'requester',itemType:'PAYMENT',requestId:created.data.item.id,expectedVersion:1};
  for(const fields of invalids){const before=readStore();assert.equal((await api('/requests/edit-submitted','requester',{...command,changes:fields})).status,400);assertStoreUnchanged(before);}
  await api('/review/row-action','approver',{...command,action:'RETURN_FOR_REVISION',returnReason:'TEST correct bank'});
  for(const fields of invalids){const before=readStore();assert.equal((await api('/requests/resubmit','requester',{...command,...fields})).status,400);assertStoreUnchanged(before);}
});
test('financial inputs reject coercible non-money and group aggregate overflow before writing',async()=>{
 for(const amount of [true,[],[1],{},'1e3',' 100 ',0,-1,1.5,9007199254740992]){
  const before=readStore();assert.equal((await api('/payment-requests','requester',{amount,payeeName:'TEST invalid money'})).status,400);assertStoreUnchanged(before);
 }
 const before=readStore();assert.equal((await api('/batch-payments','requester',{title:'TEST overflow',items:[{amount:Number.MAX_SAFE_INTEGER,payeeName:'TEST one'},{amount:1,payeeName:'TEST two'}]})).status,400);assertStoreUnchanged(before);
 const {command,reviewer}=await reviewFixture('PAYMENT','APPROVER');await api('/state','admin');
 for(const newAmount of [true,[1],1.5,9007199254740992]){const snapshot=readStore();assert.equal((await api('/review/row-action',reviewer,{...command,action:'UPDATE_AMOUNT_COMMENT',newAmount,amountChangeReason:'TEST invalid edited amount'})).status,400);assertStoreUnchanged(snapshot);}
});

test('review amount edits require a real reason even when amount is unchanged and persist it for the authorized chain',async()=>{
  for(const kind of ['PAYMENT','ADVANCE','BATCH_PAYMENT','BATCH_ADVANCE']) for(const stage of ['APPROVER','ACCOUNTING']){
    const {command,reviewer}=await reviewFixture(kind,stage);
    await api('/state','admin'); // Settle the existing post-approval legacy backfill before the no-write boundary.
    for(const action of ['UPDATE_AMOUNT_COMMENT','UPDATE_AND_APPROVE'])for(const reason of [undefined,'','   ','\u200c\u200f',null,7,'x'.repeat(2001)]){
      const before=readStore();assert.equal((await api('/review/row-action',reviewer,{...command,action,newAmount:12000,amountChangeReason:reason,comment:'TEST official edit note'})).status,400);assertStoreUnchanged(before);
    }
    const result=await api('/review/row-action',reviewer,{...command,action:'UPDATE_AMOUNT_COMMENT',newAmount:12000,amountChangeReason:'TEST required reason '+kind+stage,comment:'TEST official edit note'});assert.equal(result.status,200,result.data.error);
    const saved=savedReviewRow(result.data.state,command),entry=saved.auditHistory.find((a:any)=>a.reason==='TEST required reason '+kind+stage);assert.ok(entry);assert.equal(entry.actorId,reviewer);assert.equal(entry.stage,stage);assert.equal(entry.comment,'TEST official edit note');
    const visible=(await api('/state','requester')).data;assert.ok(savedReviewRow(visible,command).auditHistory.some((a:any)=>a.id===entry.id));
    const foreign=(await api('/state','other')).data;assert.ok(![...foreign.paymentRequests,...foreign.advanceRequests,...foreign.batchPayments].some((r:any)=>r.id===command.requestId));
  }
});

test('master-data creates allocate prefixed codes on the server and keep existing codes immutable',async()=>{
  const first=await api('/master-data/companies/save','admin',{name:'TEST auto company A',code:'caller-code'});assert.equal(first.status,200);
  const company=first.data.state.companies.find((c:any)=>c.name==='TEST auto company A');assert.equal(company.code,'001001');
  const second=await api('/master-data/companies/save','admin',{name:'TEST auto company B'});assert.equal(second.status,200);assert.equal(second.data.state.companies.find((c:any)=>c.name==='TEST auto company B').code,'001002');
  const dept=await api('/master-data/departments/save','admin',{name:'TEST auto department',companyId:company.id});assert.equal(dept.status,200);assert.equal(dept.data.state.departments.find((d:any)=>d.name==='TEST auto department').code,'002001');
  const cc=await api('/master-data/cost-centers/save','admin',{name:'TEST auto center',companyId:company.id});assert.equal(cc.status,200);assert.equal(cc.data.state.costCenters.find((c:any)=>c.name==='TEST auto center').code,'003001');
  assert.equal((await api('/master-data/companies/save','admin',{...company,name:'TEST auto company renamed',code:'forged'})).status,400);
  assert.equal((await api('/master-data/companies/save','admin',{id:company.id,name:'TEST auto company renamed'})).status,200);
  assert.equal((await api('/state','admin')).data.companies.find((c:any)=>c.id===company.id).code,'001001');
});

test('bank validation covers both group kinds, child amendments and resubmission with optional blanks intact',async()=>{
  for(const batchType of ['PAYMENT','ADVANCE']){
    const bad={title:'TEST invalid child',batchType,items:[{amount:12000,payeeName:'TEST valid optional'},{amount:13000,payeeName:'TEST invalid',iban:'IR'+'0'.repeat(25)}]};
    const before=readStore();assert.equal((await api('/batch-payments','requester',bad)).status,400);assertStoreUnchanged(before);
    const result=await api('/batch-payments','requester',{...bad,items:bad.items.slice(0,1)});assert.equal(result.status,200);const b=result.data.batch;
    const target={itemType:'BATCH_ITEM',requestId:b.id,rowId:b.items[0].id,expectedVersion:1};
    for(const changes of [{accountOrCard:'12345'},{iban:'IR12345'},{accountOrCard:null},{iban:123456}]){const before=readStore();assert.equal((await api('/requests/edit-submitted','requester',{...target,changes})).status,400);assertStoreUnchanged(before);}
    assert.equal((await api('/review/row-action','approver',{...target,action:'RETURN_FOR_REVISION',returnReason:'TEST bank correction'})).status,200);
    await api('/state','admin'); // Settle existing return normalization before comparing the failed mutation boundary.
    const snapshot=readStore();assert.equal((await api('/requests/resubmit','requester',{...target,accountOrCard:'0'.repeat(17)})).status,400);assertStoreUnchanged(snapshot);
    assert.equal((await api('/requests/resubmit','requester',{...target,accountOrCard:'',iban:''})).status,200);
  }
});

test('review reasons reject legacy and bulk bypasses and failed commits leave amount notes and stage unchanged',async()=>{
  const {command,reviewer}=await reviewFixture('ADVANCE','ACCOUNTING');await api('/state','admin');
  const before=readStore();
  assert.equal((await api('/accounting/review',reviewer,{requestType:'ADVANCE',requestId:command.requestId,action:'APPROVE',approvedAmount:14000})).status,400);
  assert.equal((await api('/review/bulk-action',reviewer,{action:'APPROVE',newAmount:14000,items:[command]})).status,400);assertStoreUnchanged(before);
  const body={...command,action:'UPDATE_AND_APPROVE',newAmount:14000,amountChangeReason:'TEST failed then committed reason',comment:'TEST public note'};
  fs.writeFileSync(path.join(root!,'test-fail-next-commit'),'synthetic fault');assert.equal((await api('/review/row-action',reviewer,body)).status,500);assertStoreUnchanged(before);
  const result=await api('/review/row-action',reviewer,body);assert.equal(result.status,200);const saved=savedReviewRow(result.data.state,command);assert.equal(saved.status,'Pending_Treasury');assert.equal(saved.approvedAmount,14000);assert.equal(saved.auditHistory.filter((a:any)=>a.reason===body.amountChangeReason).length,1);
  for(const viewer of ['requester','approver','accounting','treasury'])assert.ok(savedReviewRow((await api('/state',viewer)).data,command).auditHistory.some((a:any)=>a.reason===body.amountChangeReason&&a.comment===body.comment));
});

test('plain approval cannot smuggle a lower edited amount past the real approval limit',async()=>{
  for(const kind of ['PAYMENT','ADVANCE','BATCH_PAYMENT','BATCH_ADVANCE'])for(const stage of ['APPROVER','ACCOUNTING']){
    const {command,reviewer}=await reviewFixture(kind,stage);
    assert.equal((await api('/review/row-action','admin',{...command,action:'UPDATE_AMOUNT_COMMENT',newAmount:2000000,amountChangeReason:'TEST above reviewer cap'})).status,200);
    await api('/state','admin');const before=readStore();
    for(const fields of [{newAmount:1},{approvedAmount:1},{newAmount:1,amountChangeReason:'TEST smuggled reason'}]){
      assert.equal((await api('/review/row-action',reviewer,{...command,expectedVersion:2,action:'APPROVE',...fields})).status,400);assertStoreUnchanged(before);
    }
    assert.equal((await api('/review/row-action',reviewer,{...command,expectedVersion:2,action:'APPROVE'})).status,403);assertStoreUnchanged(before);
  }
});

test('canonical IBAN validation keeps legacy unprefixed account imports duplicate-safe',()=>{
  const values={bankName:'بانک ملت',accountTitle:'TEST identifier',companyName:'TEST',accountNumber:'00001234',iban:'0'.repeat(24)};
  const made=assessBankImport([{rowNumber:2,values}],[]).rows[0].account!;assert.ok(made);const existing=[{...made,id:'TEST legacy',createdAt:'TEST',iban:values.iban}];const before=JSON.stringify(existing);
  const result=assessBankImport([{rowNumber:2,values}],existing);assert.equal(result.duplicateCount,1);assert.equal(result.errorCount,0);assert.equal(JSON.stringify(existing),before);
});

test('bank-account save rejects invalid card and IBAN types without writing accounts or audit',async()=>{
  for(const fields of [{cardNumber:'0'.repeat(15)},{cardNumber:'0'.repeat(17)},{cardNumber:1234567890123456},{iban:'IR'},{iban:'IR'+'0'.repeat(25)},{iban:null}]){
    const before=readStore();assert.equal((await api('/treasury/bank-accounts/save','admin',{account:{bankName:'بانک ملت',accountTitle:'TEST no invalid bank account',accountNumber:'000012345',...fields}})).status,400);assertStoreUnchanged(before);
  }
});

test('canonical bank formatting alone never invalidates a legacy supervisor approval on resubmission',async()=>{
  const result=await api('/requests/resubmit','requester',{itemType:'PAYMENT',requestId:'TEST-legacy-bank-revision',accountOrCard:'0000000000000001',iban:'IR'+'0'.repeat(23)+'1'});assert.equal(result.status,200);assert.equal(result.data.item.status,'Pending_Accounting');assert.equal(result.data.item.invalidatedPriorApproval,false);assert.equal(result.data.item.approvedBySupervisorUserId,'approver');
});

test('repairing a legacy numeric card succeeds and invalidates its prior supervisor approval',async()=>{
  const result=await api('/requests/resubmit','requester',{itemType:'PAYMENT',requestId:'TEST-legacy-numeric-bank',accountOrCard:'1234567890123456',iban:'IR'+'0'.repeat(23)+'1'});
  assert.equal(result.status,200);assert.equal(result.data.item.accountOrCard,'1234567890123456');assert.equal(result.data.item.status,'Pending_Approver');assert.equal(result.data.item.invalidatedPriorApproval,true);assert.ok(!result.data.item.approvedBySupervisorUserId);
});

test('bulk master-data creation is atomic, permission-bound, relationally valid and duplicate-safe',async()=>{
  const state=(await api('/state','admin')).data,company=state.companies[0],otherCompany=state.companies[1];
  const input={rows:[{name:'TEST bulk unit A',companyId:company.id},{name:'TEST bulk unit B',companyId:company.id}]};
  const before=readStore();
  assert.equal((await api('/master-data/departments/bulk-create','requester',input)).status,403);
  assert.equal((await api('/master-data/departments/bulk-create','admin',{...input,actorId:'requester'})).status,403);
  for(const rows of [[input.rows[0],{name:'',companyId:company.id}],[input.rows[0],input.rows[0]],[{name:'TEST invalid',companyId:'missing'}],[{...input.rows[0],id:'forged'}]])assert.equal((await api('/master-data/departments/bulk-create','admin',{rows})).status,400);
  assert.equal(readStore(),before);
  const made=await api('/master-data/departments/bulk-create','admin',input);assert.equal(made.status,200);assert.equal(made.data.created.length,2);assert.equal(new Set(made.data.created.map((r:any)=>r.id)).size,2);
  const after=readStore();assert.equal((await api('/master-data/departments/bulk-create','admin',input)).status,400);assert.equal(readStore(),after);
  const departmentId=made.data.created[0].id;
  assert.equal((await api('/master-data/cost-centers/bulk-create','admin',{rows:[{name:'TEST wrong company',companyId:otherCompany.id,departmentId}]})).status,400);assert.equal(readStore(),after);
  const centers=await api('/master-data/cost-centers/bulk-create','admin',{rows:[{name:'TEST bulk center A',companyId:company.id,departmentId},{name:'TEST bulk center B',companyId:company.id}]});assert.equal(centers.status,200);assert.equal(centers.data.created.length,2);assert.equal(centers.data.created[0].departmentId,departmentId);
});

test('concurrent allocations and single plus bulk creations never reuse codes, including after deletion',async()=>{
  const companyId=(await api('/state','admin')).data.companies[0].id;
  const replies=await Promise.all(Array.from({length:5},(_,i)=>api('/master-data/departments/save','admin',{name:'TEST concurrent unit '+i,companyId})).concat([api('/master-data/departments/bulk-create','admin',{rows:[{name:'TEST concurrent batch A',companyId},{name:'TEST concurrent batch B',companyId}]})]));
  assert.ok(replies.every(r=>r.status===200));
  const units=(await api('/state','admin')).data.departments.filter((d:any)=>d.name.startsWith('TEST concurrent'));
  assert.equal(units.length,7);assert.equal(new Set(units.map((d:any)=>d.code)).size,7);assert.equal(new Set(units.map((d:any)=>d.id)).size,7);assert.ok(units.every((d:any)=>/^002\d{3,}$/.test(d.code)));
  const last=[...units].sort((a:any,b:any)=>Number(a.code.slice(3))-Number(b.code.slice(3))).at(-1);
  assert.equal((await api('/master-data/departments/delete','admin',{id:last.id})).status,200);
  const next=await api('/master-data/departments/save','admin',{name:'TEST after delete',companyId});assert.equal(next.status,200);assert.ok(Number(next.data.state.departments.find((d:any)=>d.name==='TEST after delete').code.slice(3))>Number(last.code.slice(3)));
});

test('legacy code high-water survives deletion before the first allocation metadata exists',async()=>{
  for(const [kind,pool,prefix] of [['companies','companies','001'],['departments','departments','002'],['cost-centers','costCenters','003']]){
    const db=JSON.parse(readStore()),company=db.companies[0],id='TEST-legacy-'+kind;
    delete db.masterDataCodeSequences[kind];db[pool].push({id,code:prefix+'900',name:'TEST legacy '+kind,companyId:company.id,companyName:company.name,isActive:true,isDefault:false,createdAt:'1405/07/29'});
    writeStore(JSON.stringify(db,null,2));
    assert.equal((await api('/master-data/'+kind+'/delete','admin',{id})).status,200);
    const name='TEST after legacy delete '+kind,created=await api('/master-data/'+kind+'/save','admin',{name,companyId:company.id});assert.equal(created.status,200);assert.equal(created.data.state[pool].find((r:any)=>r.name===name).code,prefix+'901');
  }
});

test('failed bulk commit leaves rows, audit and code counter unchanged and explicit retry commits once',async()=>{
  const db=JSON.parse(readStore()),companyId=db.companies[0].id;
  const input={rows:[{name:'TEST failed commit unit A',companyId},{name:'TEST failed commit unit B',companyId}]};
  const before=readStore(),next=db.masterDataCodeSequences.departments+1;
  fs.writeFileSync(path.join(root!,'test-fail-next-commit'),'synthetic fault');
  assert.equal((await api('/master-data/departments/bulk-create','admin',input)).status,500);
  assert.equal(readStore(),before);
  const retry=await api('/master-data/departments/bulk-create','admin',input);assert.equal(retry.status,200);assert.equal(retry.data.created.length,2);assert.equal(retry.data.created[0].code,'002'+String(next).padStart(3,'0'));
  const committed=readStore();assert.equal((await api('/master-data/departments/bulk-create','admin',input)).status,400);assert.equal(readStore(),committed);
});

const bankPath='/treasury/bank-accounts/';
function bankRow(n:number,changes:Record<string,unknown>={}){return {rowNumber:n+2,values:{bankName:'بانک ملت',accountTitle:'TEST import '+n,companyName:'TEST',accountNumber:'00190'+String(n).padStart(6,'0'),iban:'',cardNumber:'',accountType:'',branchName:'',branchCode:'',allowedPaymentMethods:'',status:'',isDefault:'',description:'',...changes}};}
async function bankPreview(rows:any[],user='admin'){return api(bankPath+'import-preview',user,{rows});}
async function bankCommit(rows:any[],preview:any,user='admin'){return api(bankPath+'import',user,{rows,previewToken:preview.previewToken});}
test('bank import preview is read-only; commit appends all new accounts and skips identical duplicates preserving old defaults',async()=>{
  const old=bankRow(1);assert.equal((await api(bankPath+'save','admin',old.values)).status,200);
  await api('/state','admin');const before=readStore(),accounts=JSON.parse(before).companyBankAccounts;
  const rows=[{...old,rowNumber:2},bankRow(2,{branchCode:'0007'}),bankRow(3)];
  const preview=await bankPreview(rows);assert.equal(preview.status,200,preview.data.error);assert.equal(readStore(),before);assert.equal(preview.data.report.newCount,2);assert.equal(preview.data.report.duplicateCount,1);assert.equal(preview.data.report.errorCount,0);
  const saved=await bankCommit(rows,preview.data);assert.equal(saved.status,200,saved.data.error);assert.equal(saved.data.createdCount,2);assert.equal(saved.data.skippedCount,1);
  const persisted=JSON.parse(readStore());assert.deepEqual(persisted.companyBankAccounts.slice(0,accounts.length),accounts);assert.equal(persisted.companyBankAccounts.find((a:any)=>a.accountNumber===bankRow(2).values.accountNumber).branchCode,'0007');assert.equal(persisted.companyBankAccounts.filter((a:any)=>a.isDefault).length,1);
  const retry=await bankPreview(rows);assert.equal(retry.data.report.duplicateCount,3);const unchanged=readStore();assert.equal((await bankCommit(rows,retry.data)).data.createdCount,0);assert.equal(readStore(),unchanged);
});
test('bank import conflicts, invalid rows and default changes reject the whole file without mutating existing accounts',async()=>{
  for(const rows of [[bankRow(10),bankRow(11,{accountNumber:'bad'})],[bankRow(12),{...bankRow(12,{accountTitle:'TEST conflicting title'}),rowNumber:15}],[bankRow(13,{isDefault:'بله'})],[bankRow(14,{accountNumber:123456})],[bankRow(15,{id:'forged'})],[bankRow(16,{bankName:'TEST unknown bank'})]]){
    const before=readStore(),preview=await bankPreview(rows);assert.equal(preview.status,200);assert.ok(preview.data.report.errorCount>0);assert.equal((await bankCommit(rows,preview.data)).status,400);assert.equal(readStore(),before);
  }
  const rows=[bankRow(20),{...bankRow(20),rowNumber:23}];const duplicate=await bankPreview(rows);assert.equal(duplicate.status,200);assert.equal(duplicate.data.report.newCount,1);assert.equal(duplicate.data.report.duplicateCount,1);assert.equal((await bankCommit(rows,duplicate.data)).data.createdCount,1);
  const conflict=[bankRow(1,{accountTitle:'TEST cannot overwrite existing'})];assert.ok((await bankPreview(conflict)).data.report.errorCount>0);
});
test('bank import is permission-bound and rejects identity/shape tampering and revoked permissions at commit',async()=>{
  const rows=[bankRow(30)];for(const actor of ['requester','approver','accounting'])assert.equal((await bankPreview(rows,actor)).status,403);
  assert.equal((await api(bankPath+'import-preview','treasury',{rows,actorId:'admin'})).status,403);
  assert.equal((await api(bankPath+'import-preview','admin',{rows,unknown:true})).status,400);
  assert.equal((await bankPreview([])).status,400);assert.equal((await bankPreview(Array.from({length:201},(_,i)=>bankRow(300+i)))).status,400);
  const role=(await api('/state','admin')).data.roleConfigs.find((r:any)=>r.role==='TREASURY'),preview=await bankPreview(rows,'treasury');assert.equal(preview.status,200);
  try{assert.equal((await api('/roles/save','admin',{...role,permissions:{...role.permissions,canManageBankAccounts:false}})).status,200);const before=readStore();assert.equal((await bankCommit(rows,preview.data,'treasury')).status,403);assert.equal(readStore(),before);}finally{assert.equal((await api('/roles/save','admin',role)).status,200);}
});
test('bank import detects stale previews, serializes double submit and rolls failed commit back for an explicit retry',async()=>{
  const rows=[bankRow(40),bankRow(41)],preview=await bankPreview(rows);assert.equal(preview.status,200);
  const changed=[bankRow(40,{description:'TEST changed after review'}),bankRow(41)];assert.equal((await bankCommit(changed,preview.data)).status,409);
  const before=readStore();fs.writeFileSync(path.join(root!,'test-fail-next-commit'),'synthetic fault');assert.equal((await bankCommit(rows,preview.data)).status,500);assert.equal(readStore(),before);
  const outcomes=await Promise.all([bankCommit(rows,preview.data),bankCommit(rows,preview.data)]);assert.deepEqual(outcomes.map(r=>r.status).sort(),[200,409]);
  const next=[bankRow(42)],stale=await bankPreview(next);assert.equal((await api(bankPath+'save','admin',bankRow(43).values)).status,200);assert.equal((await bankCommit(next,stale.data)).status,409);
});

async function reviewFixture(kind:string,stage:string){
  let parent:any,row:any,itemType:string;
  if(kind.startsWith('BATCH')){parent=(await api('/batch-payments','requester',{title:'TEST rejection '+kind,batchType:kind==='BATCH_ADVANCE'?'ADVANCE':'PAYMENT',items:[{amount:12000,payeeName:'TEST rejection first'},{amount:13000,payeeName:'TEST untouched sibling'}]})).data.batch;row=parent.items[0];itemType='BATCH_ITEM';}
  else {parent=(await api(kind==='ADVANCE'?'/advance-requests':'/payment-requests','requester',{amount:12000,reason:'TEST rejected advance',description:'TEST rejected payment',payeeName:'TEST payee'})).data.item;row=parent;itemType=kind;}
  const command={itemType,requestId:parent.id,...(itemType==='BATCH_ITEM'?{rowId:row.id}:{}),reviewStage:stage,expectedVersion:row.version||1,expectedStatus:stage==='APPROVER'?'Pending_Approver':'Pending_Accounting'};
  if(stage==='ACCOUNTING')assert.equal((await api('/review/row-action','approver',{...command,reviewStage:'APPROVER',expectedStatus:'Pending_Approver',action:'APPROVE'})).status,200);
  return {command,parent,row,reviewer:stage==='APPROVER'?'approver':'accounting'};
}
function savedReviewRow(db:any,command:any){return command.itemType==='BATCH_ITEM'?db.batchPayments.find((b:any)=>b.id===command.requestId).items.find((r:any)=>r.id===command.rowId):(command.itemType==='ADVANCE'?db.advanceRequests:db.paymentRequests).find((r:any)=>r.id===command.requestId);}

async function securityPaymentFixture(kind='PAYMENT',allChildren=true){
  const f=await reviewFixture(kind,'ACCOUNTING');
  assert.equal((await api('/review/row-action','accounting',{...f.command,action:'APPROVE'})).status,200);
  if(f.parent.items){const second={...f.command,rowId:f.parent.items[1].id,reviewStage:'APPROVER',expectedStatus:'Pending_Approver'};assert.equal((await api('/review/row-action','approver',{...second,action:'APPROVE'})).status,200);if(allChildren)assert.equal((await api('/review/row-action','accounting',{...second,reviewStage:'ACCOUNTING',expectedStatus:'Pending_Accounting',action:'APPROVE'})).status,200);}
  await api('/state','admin');let db=JSON.parse(readStore());
  if(!db.companyBankAccounts.length){assert.equal((await api('/treasury/bank-accounts/save','admin',{account:{bankName:'بانک آزمون',accountTitle:'TEST security source',accountNumber:'000000001',companyName:'TEST',isActive:true}})).status,200);db=JSON.parse(readStore());}
  const sourceBankAccountId=db.companyBankAccounts[0].id;
  return {...f,sourceBankAccountId,payload:{sourceBankAccountId,items:[{type:f.parent.items?'BATCH':kind,id:f.parent.id}],bankRefNumber:'TEST-NO-TRANSFER',idempotencyKey:'TEST-'+crypto.randomUUID()}};
}

test('security payment rejects conflicting target aliases and cannot pay a child awaiting accounting',async()=>{
  const f=await securityPaymentFixture('BATCH_PAYMENT',false),[ready,pending]=f.parent.items;
  const before=readStore(),item={type:'BATCH_ITEM',batchId:f.parent.id,id:pending.id,requestId:f.parent.id,rowId:ready.id};
  assert.equal((await api('/treasury/execute-payment','treasury',{...f.payload,items:[item]})).status,400);assertStoreUnchanged(before);
  assert.equal((await api('/treasury/move-pool','treasury',{items:[item],targetPool:'IN_PAYMENT'})).status,400);assertStoreUnchanged(before);
});

test('security payment rejects invalid partial amounts and conflicting amount aliases with no writes',async()=>{
  const f=await securityPaymentFixture();
  for(const fields of [{paymentAmount:0},{partialAmount:-1},{paymentAmount:'abc'},{paymentAmount:0.5},{paymentAmount:true},{paymentAmount:null},{paymentAmount:9007199254740992},{paymentAmount:100,partialAmount:200}]){const before=readStore();assert.equal((await api('/treasury/execute-payment','treasury',{...f.payload,...fields})).status,400);assertStoreUnchanged(before);}
});

test('security payment rejects whole group partials and overlapping parent child selections',async()=>{
  const f=await securityPaymentFixture('BATCH_PAYMENT'),child={type:'BATCH_ITEM',batchId:f.parent.id,id:f.parent.items[0].id};
  const before=readStore();
  assert.equal((await api('/treasury/execute-payment','treasury',{...f.payload,paymentAmount:1})).status,400);assertStoreUnchanged(before);
  for(const items of [[child,...f.payload.items],[...f.payload.items,child]]){assert.equal((await api('/treasury/execute-payment','treasury',{...f.payload,items})).status,400);assertStoreUnchanged(before);}
});

test('security payment whole group uses child histories and receipt equals exact remaining allocations',async()=>{
  const f=await securityPaymentFixture('BATCH_PAYMENT'),child={type:'BATCH_ITEM',batchId:f.parent.id,id:f.parent.items[0].id};
  assert.equal((await api('/treasury/execute-payment','treasury',{...f.payload,items:[child],paymentAmount:2000,idempotencyKey:'TEST-first-'+crypto.randomUUID()})).status,200);
  const paid=await api('/treasury/execute-payment','treasury',f.payload);assert.equal(paid.status,200);assert.equal(paid.data.receipt.amount,23000);
  const db=JSON.parse(readStore()),batch=db.batchPayments.find((b:any)=>b.id===f.parent.id);assert.equal(batch.status,'Paid');
  for(const row of batch.items){assert.equal(row.paidAmountSoFar,row.approvedAmount??row.amount);assert.equal(row.remainingPayableAmount,0);assert.equal(row.paymentHistory.reduce((sum:number,p:any)=>sum+p.amount,0),row.paidAmountSoFar);assert.ok(row.paymentHistory.some((p:any)=>p.idempotencyKey===f.payload.idempotencyKey));}
  const other=await securityPaymentFixture();const before=readStore();assert.equal((await api('/treasury/execute-payment','treasury',{...other.payload,idempotencyKey:f.payload.idempotencyKey})).status,409);assertStoreUnchanged(before);
});

test('security payment failure and competing settlement never leave partial history or a duplicate receipt',async()=>{
  const f=await securityPaymentFixture();await api('/state','admin');const before=readStore();fs.writeFileSync(path.join(root!,'test-fail-next-commit'),'synthetic fault');
  assert.equal((await api('/treasury/execute-payment','treasury',f.payload)).status,500);assertStoreUnchanged(before);
  const results=await Promise.all([api('/treasury/execute-payment','treasury',f.payload),api('/treasury/execute-payment','treasury',f.payload)]);assert.equal(results.filter(r=>r.status===200).length,1);assert.equal(results.filter(r=>[403,409].includes(r.status)).length,1);
  const db=JSON.parse(readStore()),row=db.paymentRequests.find((r:any)=>r.id===f.parent.id);assert.equal(row.paymentHistory.length,1);assert.equal(row.paymentHistory[0].amount,12000);assert.equal(db.receiptArchives.filter((r:any)=>r.relatedPaymentIds.includes(row.id)).length,1);
});
test('concurrent stale partial forms with different keys cannot settle against the same observed balance',async()=>{
 const f=await securityPaymentFixture(),payload={...f.payload,paymentAmount:5000,expectedPaidAmounts:{['PAYMENT:'+f.parent.id]:0}};
 const results=await Promise.all([1,2].map(n=>api('/treasury/execute-payment','treasury',{...payload,idempotencyKey:'TEST-balance-'+n+'-'+crypto.randomUUID()})));
 assert.equal(results.filter(r=>r.status===200).length,1);assert.equal(results.filter(r=>r.status===409&&r.data.code==='STALE_PAYMENT_BALANCE').length,1);
 const row=JSON.parse(readStore()).paymentRequests.find((p:any)=>p.id===f.parent.id);assert.equal(row.paidAmountSoFar,5000);assert.equal(row.paymentHistory.length,1);
 const next=await api('/treasury/execute-payment','treasury',{...payload,expectedPaidAmounts:{['PAYMENT:'+f.parent.id]:5000},paymentAmount:7000,idempotencyKey:'TEST-current-'+crypto.randomUUID()});assert.equal(next.status,200);assert.equal(next.data.receipt.amount,7000);
});

test('security payment rejects overlapping group and all children before making a doubled receipt',async()=>{
  const f=await securityPaymentFixture('BATCH_PAYMENT'),children=f.parent.items.map((r:any)=>({type:'BATCH_ITEM',batchId:f.parent.id,id:r.id}));const before=readStore();
  assert.equal((await api('/treasury/execute-payment','treasury',{...f.payload,items:[...children,...f.payload.items]})).status,400);assertStoreUnchanged(before);
});

test('security payment rejects fractional legacy allocations even when their total is an integer',async()=>{
  const f=await securityPaymentFixture(),before=readStore();assert.equal((await api('/treasury/execute-payment','treasury',{...f.payload,items:[1,2].map(n=>({type:'PAYMENT',id:'TEST-fraction-'+n}))})).status,400);assertStoreUnchanged(before);
});

test('security OTP never persists a recovery code even when external integrations are disabled',async()=>{
  assert.equal((await api('/users/save','admin',{id:'requester',name:'TEST requester',personnelCode:'requester',role:'REQUESTER',company:'TEST',department:'TEST',supervisorId:'approver',phone:'09000000001'})).status,200);
  assert.equal((await api('/sms/config','admin',{enabled:true,provider:'CUSTOM',senderNumber:'100000',apiKey:'TEST-NOT-A-KEY',apiUrl:'https://synthetic-sms.invalid',events:{sendOtpOnRecovery:true}})).status,200);
  const result=await api('/auth/recovery-send-otp',undefined,{personnelCode:'requester',phone:'09000000001'});assert.equal(result.status,502);
  const logs=JSON.parse(readStore()).smsLogs.filter((r:any)=>r.eventType==='OTP_RECOVERY');assert.ok(logs.length);assert.equal(logs.some((r:any)=>/\b\d{6}\b/.test(r.messagePreview+' '+r.messageSummary)),false);
  assert.equal((await api('/sms/config','admin',{enabled:false})).status,200);
});

test('committed snapshots avoid repeated disk decoding without caching stale authorization',async()=>{
  await api('/state','requester');
  const marker=path.join(root!,'test-count-db-reads'),count=path.join(root!,'test-db-read-count');fs.writeFileSync(marker,'TEST');fs.writeFileSync(count,'');
  try{assert.equal((await api('/state','requester')).status,200);assert.equal(fs.readFileSync(count,'utf8').length,0);fs.writeFileSync(count,'');assert.equal((await api('/payment-requests','requester',{amount:12000,payeeName:'TEST request-owned snapshot'})).status,200);assert.equal(fs.readFileSync(count,'utf8').length,0);}finally{fs.unlinkSync(marker);}
});

test('a durable command response uses its published snapshot without recopying historical draft arrays',async()=>{
 const before=readStore(),db=JSON.parse(before),marker=path.join(root!,'test-count-large-copies'),counter=path.join(root!,'test-large-copy-count');
 try{
  db.paymentRequests=Array.from({length:1000},(_,i)=>({id:'TEST-COPY-'+i,trackingCode:'TEST-COPY-'+i,requesterId:'requester',requesterName:'TEST requester',company:'TEST',department:'TEST',supervisorId:'approver',status:'Pending_Approver',version:1,amount:100,initialAmount:100,description:'TEST synthetic history',payeeName:'TEST',attachments:[],auditHistory:[]}));writeStore(JSON.stringify(db));assert.equal((await api('/state','requester')).status,200);
  fs.writeFileSync(counter,'');fs.writeFileSync(marker,'TEST');const made=await api('/payment-requests','requester',{amount:12000,payeeName:'TEST committed response',description:'TEST no copy after publish'});assert.equal(made.status,200);fs.unlinkSync(marker);const copies=fs.readFileSync(counter,'utf8').length;assert.ok(copies<=3,'first draft write, normalization and commit may copy history, but response must reuse the already durable snapshot; copies='+copies);
  const persisted=JSON.parse(readStore()).paymentRequests;assert.deepEqual(made.data.state.paymentRequests,persisted);assert.equal(persisted.length,1001);assert.equal(persisted.find((r:any)=>r.id===made.data.item.id).amount,12000);
 }finally{if(fs.existsSync(marker))fs.unlinkSync(marker);writeStore(before);}
});

test('unsafe upload URLs and active SVG reject every new-document write atomically',async()=>{
 const file={id:'TEST-file',name:'TEST.png',size:4,type:'image/png',url:'javascript:alert(1)',uploadedAt:'TEST'};
 for(const [route,body]of [['/advance-requests',{amount:12000,reason:'TEST',attachments:[file]}],['/payment-requests',{amount:12000,payeeName:'TEST',attachments:[file]}],['/batch-payments',{title:'TEST',items:[{amount:12000,payeeName:'TEST',attachments:[file]}]}]] as const){await api('/state','admin');const before=readStore();assert.equal((await api(route,'requester',body)).status,400);assertStoreUnchanged(before);}
 const f=await securityPaymentFixture(),before=readStore();
 for(const url of ['javascript:alert(1)','https://example.invalid/TEST.png','data:text/html;base64,PHNjcmlwdD4=','data:image/svg+xml;base64,'+Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>').toString('base64')]){assert.equal((await api('/treasury/execute-payment','treasury',{...f.payload,receiptFileUrl:url})).status,400);assertStoreUnchanged(before);}
 const r=await reviewFixture('PAYMENT','APPROVER');assert.equal((await api('/review/row-action','approver',{...r.command,action:'RETURN_FOR_REVISION',returnReason:'TEST document'})).status,200);await api('/state','admin');const held=readStore();assert.equal((await api('/requests/resubmit','requester',{itemType:'PAYMENT',requestId:r.parent.id,amount:12000,newAttachments:[file]})).status,400);assertStoreUnchanged(held);
});

test('generated receipt escapes authored XML while retaining the original financial record',async()=>{
 const f=await securityPaymentFixture(),db=JSON.parse(readStore());db.paymentRequests.find((r:any)=>r.id===f.parent.id).payeeName='TEST <script>alert(1)</script> & recipient';writeStore(JSON.stringify(db));
 const paid=await api('/treasury/execute-payment','treasury',f.payload);assert.equal(paid.status,200);const svg=decodeURIComponent(paid.data.receipt.fileUrl.split(',').slice(1).join(','));assert.ok(!svg.includes('<script>'));assert.ok(svg.includes('&lt;script&gt;'));assert.equal(paid.data.state.paymentRequests.find((r:any)=>r.id===f.parent.id).payeeName,'TEST <script>alert(1)</script> & recipient');
});

test('rejection is reviewer-owned, stage-bound and recoverable for every single and batch type',async()=>{
  for(const kind of ['ADVANCE','PAYMENT','BATCH_ADVANCE','BATCH_PAYMENT'])for(const stage of ['APPROVER','ACCOUNTING']){
    const {command,parent,reviewer}=await reviewFixture(kind,stage),before=JSON.parse(readStore());
    const result=await api('/review/row-action',reviewer,{...command,action:'REJECT',returnReason:'TEST held for decision'});assert.equal(result.status,200,result.data.error);
    const rejected=savedReviewRow(result.data.state,command);assert.equal(rejected.status,'Rejected');assert.equal(rejected.reviewRejection.byUserId,reviewer);assert.equal(rejected.reviewRejection.stage,stage);assert.equal(rejected.version,1);
    const unchanged=readStore();assert.equal((await api('/review/row-action','admin',{...command,expectedStatus:'Rejected',action:'APPROVE'})).status,403);
    assert.equal((await api('/review/row-action',reviewer,{...command,expectedStatus:'Rejected',reviewStage:stage==='APPROVER'?'ACCOUNTING':'APPROVER',action:'APPROVE'})).status,409);
    assert.equal((await api('/review/row-action',reviewer,{...command,action:'APPROVE'})).status,409);
    assert.equal((await api('/requests/resubmit','requester',{...command,amount:15000,description:'TEST bypass'})).status,403);
    assert.equal((await api('/requests/edit-submitted','requester',{itemType:command.itemType,requestId:command.requestId,rowId:command.rowId,expectedVersion:2,changes:{amount:16000}})).status,409);
    assert.equal(readStore(),unchanged);
    const approved=await api('/review/row-action',reviewer,{...command,expectedStatus:'Rejected',action:'APPROVE'});assert.equal(approved.status,200,approved.data.error);const saved=savedReviewRow(approved.data.state,command);assert.equal(saved.status,stage==='APPROVER'?'Pending_Accounting':'Pending_Treasury');assert.equal(saved.amount,12000);assert.ok(saved.reviewRejection.resolvedAt);assert.equal(saved.auditHistory.filter((a:any)=>a.decision==='REJECT').length,1);
    if(command.itemType==='BATCH_ITEM'){const sibling=(db:any)=>db.batchPayments.find((b:any)=>b.id===parent.id).items[1];assert.deepEqual(sibling(approved.data.state),sibling(before));}
  }
});

test('rejected requests can only be closed with a reason and remain archived, never resubmitted or paid',async()=>{
  for(const kind of ['ADVANCE','PAYMENT','BATCH_ADVANCE','BATCH_PAYMENT'])for(const stage of ['APPROVER','ACCOUNTING']){
    const {command,reviewer}=await reviewFixture(kind,stage);assert.equal((await api('/review/row-action',reviewer,{...command,action:'REJECT',returnReason:'TEST hold'})).status,200);
    const before=readStore();assert.equal((await api('/review/row-action',reviewer,{...command,expectedStatus:'Rejected',action:'CLOSE_REJECTED'})).status,400);assert.equal(readStore(),before);
    const closed=await api('/review/row-action',reviewer,{...command,expectedStatus:'Rejected',action:'CLOSE_REJECTED',returnReason:'TEST final closure'});assert.equal(closed.status,200,closed.data.error);const row=savedReviewRow(closed.data.state,command);assert.equal(row.status,'Closed');assert.equal(row.reviewRejection.closeReason,'TEST final closure');assert.ok(row.auditHistory.some((a:any)=>a.decision==='CLOSE_REJECTED'));
    const final=readStore();assert.equal((await api('/review/row-action',reviewer,{...command,expectedStatus:'Closed',action:'APPROVE'})).status,409);assert.equal((await api('/requests/resubmit','requester',{...command,amount:12000})).status,403);
    assert.equal((await api('/treasury/execute-payment','treasury',{items:[{type:command.itemType,id:command.rowId||command.requestId,...(command.itemType==='BATCH_ITEM'?{batchId:command.requestId}:{})}]})).status,403);assert.equal(readStore(),final);
  }
});

test('rejection needs a reason and observed version; bulk rejection is atomic and legacy aliases cannot silently return',async()=>{
  const {command}=await reviewFixture('BATCH_PAYMENT','APPROVER'),before=readStore();
  assert.equal((await api('/review/row-action','approver',{...command,action:'REJECT'})).status,400);
  assert.equal((await api('/review/row-action','approver',{...command,expectedVersion:undefined,action:'REJECT',returnReason:'TEST'})).status,409);
  assert.equal((await api('/approver/review','approver',{requestType:'BATCH',requestId:command.requestId,action:'REJECT'})).status,403);
  assert.equal(readStore(),before);
  const batch=JSON.parse(before).batchPayments.find((b:any)=>b.id===command.requestId),items=batch.items.map((r:any)=>({...command,rowId:r.id}));
  assert.equal((await api('/review/bulk-action','approver',{reviewStage:'APPROVER',action:'REJECT',returnReason:'TEST bulk rejection',items:[items[0],{...items[1],expectedVersion:99}]})).status,409);assert.equal(readStore(),before);
  const result=await api('/review/bulk-action','approver',{reviewStage:'APPROVER',action:'REJECT',returnReason:'TEST bulk rejection',items});assert.equal(result.status,200,result.data.error);assert.equal(result.data.successCount,2);assert.ok(result.data.state.batchPayments.find((b:any)=>b.id===command.requestId).items.every((r:any)=>r.status==='Rejected'));
});

test('rejection and resolution serialize competing decisions and failed commits without partial changes',async()=>{
  const {command}=await reviewFixture('PAYMENT','APPROVER');const reject={...command,action:'REJECT',returnReason:'TEST concurrent rejection'};
  const before=readStore();fs.writeFileSync(path.join(root!,'test-fail-next-commit'),'synthetic fault');assert.equal((await api('/review/row-action','approver',reject)).status,500);assert.equal(readStore(),before);
  const competing=await Promise.all([api('/review/row-action','approver',reject),api('/review/row-action','approver',reject)]);assert.deepEqual(competing.map(r=>r.status).sort(),[200,409]);
  const held=readStore();fs.writeFileSync(path.join(root!,'test-fail-next-commit'),'synthetic fault');assert.equal((await api('/review/row-action','approver',{...command,expectedStatus:'Rejected',action:'CLOSE_REJECTED',returnReason:'TEST close'})).status,500);assert.equal(readStore(),held);
  const resolutions=await Promise.all([api('/review/row-action','approver',{...command,expectedStatus:'Rejected',action:'APPROVE'}),api('/review/row-action','approver',{...command,expectedStatus:'Rejected',action:'CLOSE_REJECTED',returnReason:'TEST close'})]);assert.deepEqual(resolutions.map(r=>r.status).sort(),[200,409]);
});

test('rejection recovery rechecks current permission, limit, scope and assignment and never changes content',async()=>{
  const {command}=await reviewFixture('PAYMENT','ACCOUNTING');
  assert.equal((await api('/review/row-action','accounting',{...command,action:'REJECT',returnReason:'TEST permission hold'})).status,200);
  const resolve={...command,expectedStatus:'Rejected',action:'APPROVE'},role=(await api('/state','admin')).data.roleConfigs.find((r:any)=>r.role==='ACCOUNTING');
  for(const edit of [{permissions:{...role.permissions,canApprove:false}},{approvalLimitRial:10},{accessScope:'SELF_ONLY'}]){
    assert.equal((await api('/roles/save','admin',{...role,...edit})).status,200);
    const before=readStore();assert.equal((await api('/review/row-action','accounting',resolve)).status,403);assert.equal(readStore(),before);
    assert.equal((await api('/roles/save','admin',role)).status,200);
  }
  const before=readStore();
  for(const injected of [{newAmount:1},{approvedAmount:1},{attachments:[]},{reviewRejection:{byUserId:'admin'}}])assert.equal((await api('/review/row-action','accounting',{...resolve,...injected})).status,400);
  assert.equal(readStore(),before);
  assert.equal((await api('/review/row-action','accounting',resolve)).status,200);
  const assigned=await reviewFixture('ADVANCE','APPROVER');assert.equal((await api('/review/row-action','approver',{...assigned.command,action:'REJECT',returnReason:'TEST assigned'})).status,200);
  const user=(await api('/state','admin')).data.users.find((u:any)=>u.id==='requester');assert.equal((await api('/users/save','admin',{...user,supervisorId:null})).status,200);
  // Clearing assignment alone must not grant another reviewer ownership of a held decision.
  assert.equal((await api('/review/row-action','accounting',{...assigned.command,reviewStage:'APPROVER',expectedStatus:'Rejected',action:'APPROVE'})).status,403);
  assert.equal((await api('/users/save','admin',user)).status,200);
});

test('mixed group rejection and closure never authorize whole-group commands or alter an eligible sibling',async()=>{
  const batch=(await api('/batch-payments','requester',{title:'TEST mixed rejection',items:[{amount:100,payeeName:'TEST held'},{amount:200,payeeName:'TEST closed'},{amount:300,payeeName:'TEST eligible'}]})).data.batch;
  const command=(n:number,stage='APPROVER',status='Pending_Approver')=>({itemType:'BATCH_ITEM',requestId:batch.id,rowId:batch.items[n].id,expectedVersion:1,expectedStatus:status,reviewStage:stage});
  for(const n of [0,1])assert.equal((await api('/review/row-action','approver',{...command(n),action:'REJECT',returnReason:'TEST hold'})).status,200);
  assert.equal((await api('/review/row-action','approver',{...command(1,'APPROVER','Rejected'),action:'CLOSE_REJECTED',returnReason:'TEST final'})).status,200);
  assert.equal((await api('/review/row-action','approver',{...command(2),action:'APPROVE'})).status,200);
  assert.equal((await api('/review/row-action','accounting',{...command(2,'ACCOUNTING','Pending_Accounting'),action:'APPROVE'})).status,200);
  await api('/state','admin'); // Existing loader normalizes legacy accounting-ID aliases before the no-write snapshot.
  const before=readStore(),saved=JSON.parse(before).batchPayments.find((b:any)=>b.id===batch.id);
  assert.equal(saved.status,'Mixed');assert.deepEqual(saved.items.map((r:any)=>r.status),['Rejected','Closed','Pending_Treasury']);
  for(const [route,actor] of [['/approver/review','approver'],['/accounting/review','accounting']])assert.equal((await api(route,actor,{requestType:'BATCH',requestId:batch.id,action:'APPROVE'})).status,403);
  assert.equal((await api('/review/bulk-action','approver',{reviewStage:'APPROVER',action:'REJECT',returnReason:'TEST duplicate',items:[command(0,'APPROVER','Rejected'),command(0,'APPROVER','Rejected')]})).status,400);
  assert.equal((await api('/treasury/move-pool','treasury',{targetPool:'IN_PAYMENT',items:[{type:'BATCH',id:batch.id}]})).status,403);
  assert.equal(readStore(),before);
  assert.equal((await api('/review/row-action','approver',{...command(0,'APPROVER','Rejected'),action:'APPROVE'})).status,200);
  const after=JSON.parse(readStore()).batchPayments.find((b:any)=>b.id===batch.id);assert.deepEqual(after.items[1],saved.items[1]);assert.deepEqual(after.items[2],saved.items[2]);
  const moved=await api('/treasury/move-pool','treasury',{targetPool:'IN_PAYMENT',items:[{type:'BATCH_ITEM',id:batch.items[2].id,batchId:batch.id}]});assert.equal(moved.status,200);assert.equal(moved.data.movedCount,1);
  const final=JSON.parse(readStore()).batchPayments.find((b:any)=>b.id===batch.id);assert.equal(final.items[2].status,'In_Payment');assert.deepEqual(final.items[0],after.items[0]);assert.deepEqual(final.items[1],after.items[1]);
});

test('single-request rejection rejects selector aliases and cannot apply one target twice',async()=>{
  for(const kind of ['PAYMENT','ADVANCE'])for(const stage of ['APPROVER','ACCOUNTING']){
    const {command,reviewer}=await reviewFixture(kind,stage);await api('/state','admin');const before=readStore();
    assert.equal((await api('/review/bulk-action',reviewer,{reviewStage:stage,action:'REJECT',returnReason:'TEST alias',items:[{...command,rowId:'fake-1'},{...command,rowId:'fake-2'}]})).status,400);
    assert.equal((await api('/review/row-action',reviewer,{...command,rowId:'fake',action:'REJECT',returnReason:'TEST alias'})).status,400);
    assert.equal(crypto.createHash('sha256').update(Buffer.from(readStore())).digest('hex'),crypto.createHash('sha256').update(before).digest('hex'));
  }
});

test('legacy rejected records without explicit owner fail closed and are not claimed by current reviewer',async()=>{
  const db={...fixture,advanceRequests:[{id:'legacy-held',requesterId:'requester',company:'TEST',department:'TEST',supervisorId:'approver',amount:100,status:'Rejected',version:1}]};
  const viewer=users.find(u=>u.id==='approver')!;
  const auth:any={effectivePermissions:getDefaultPermissionsForRole('APPROVER'),effectiveAccessScope:'ASSIGNED_AND_SUBORDINATES',effectiveApprovalLimitRial:1000000,effectivePaymentLimitRial:0};
  const denied=authorizeRequest({method:'POST',path:'/review/row-action',body:{reviewStage:'APPROVER',itemType:'ADVANCE',requestId:'legacy-held',expectedVersion:1,expectedStatus:'Rejected',action:'APPROVE'}},viewer as any,db as any,auth);
  assert.ok(denied);assert.notEqual(denied?.status,200);
});

test('multiple roles persist and expose both admitted cartables without replacing the primary role', async () => {
  const saved=await api('/users/save','admin',{name:'TEST combined reviewer',personnelCode:'combined',department:'TEST',company:'TEST',role:'ACCOUNTING',additionalRoles:['APPROVER'],password,mustChangePassword:false,accessScope:'COMPANY_WIDE',financialApprovalLimit:1000000});
  assert.equal(saved.status,200);
  const user=saved.data.state.users.find((u:any)=>u.personnelCode==='combined');
  assert.deepEqual(user.additionalRoles,['APPROVER']);
  assert.equal(user.role,'ACCOUNTING');
  assert.equal(user.effectivePermissions.canAccessApproverCartable,true);
  assert.equal(user.effectivePermissions.canAccessAccountingCartable,true);
});

test('role assignment validates sets, preserves omitted roles, rejects self escalation and referenced-role deletion', async () => {
  const state=await api('/state','admin');
  const combined=state.data.users.find((u:any)=>u.personnelCode==='combined');
  const payload={...combined,additionalRoles:['APPROVER','ACCOUNTING','APPROVER']};
  const normalized=await api('/users/save','admin',payload);
  assert.equal(normalized.status,200);
  assert.deepEqual(normalized.data.state.users.find((u:any)=>u.id===combined.id).additionalRoles,['APPROVER']);
  for(const roles of [['ADMIN'],['MISSING'], 'APPROVER', [42]]) {
    assert.equal((await api('/users/save','admin',{...payload,additionalRoles:roles})).status,400);
  }
  assert.equal((await api('/users/save','admin',{...payload,role:'MISSING',additionalRoles:[]})).status,400);
  const {additionalRoles:_,...legacyPayload}=combined;
  assert.equal((await api('/users/save','admin',legacyPayload)).status,200);
  assert.deepEqual(JSON.parse(readStore()).users.find((u:any)=>u.id===combined.id).additionalRoles,['APPROVER']);
  assert.equal((await api('/users/save','admin',{...users[0],additionalRoles:['APPROVER']})).status,403);
  const customRole='TEST_SUPPLEMENT';
  assert.equal((await api('/roles/save','admin',{role:customRole,title:'TEST supplement',baseTemplateRole:'REQUESTER'})).status,200);
  assert.equal((await api('/users/save','admin',{...combined,additionalRoles:['APPROVER',customRole]})).status,200);
  assert.equal((await api('/roles/delete','admin',{role:customRole})).status,409);
  assert.equal((await api('/users/save','requester',{...combined,additionalRoles:['TREASURY']})).status,403);
  assert.equal((await api('/users/save','admin',{...combined,additionalRoles:['APPROVER']})).status,200);
});

test('combined reviewer is stage-bound and assignment-bound; can explicitly perform both stages on another person request', async () => {
  const combined=(await api('/state','admin')).data.users.find((u:any)=>u.personnelCode==='combined');
  const auth=await api('/auth/login',undefined,{personnelCode:'combined',password});
  tokens.combined=auth.data.token;
  assert.equal(auth.status,200);
  const foreign=await api('/advance-requests','requester',{amount:100,reason:'TEST another supervisor'});
  assert.equal((await api('/review/row-action','combined',{itemType:'ADVANCE',requestId:foreign.data.item.id,reviewStage:'APPROVER',action:'APPROVE'})).status,403);
  assert.equal((await api('/accounting/review','combined',{requestId:foreign.data.item.id,requestType:'ADVANCE',action:'APPROVE'})).status,403);
  const created=await api('/users/save','admin',{name:'TEST assigned',personnelCode:'assigned',department:'TEST',company:'TEST',role:'REQUESTER',password,mustChangePassword:false,supervisorId:combined.id});
  assert.equal(created.status,200);
  tokens.assigned=(await api('/auth/login',undefined,{personnelCode:'assigned',password})).data.token;
  const row=(await api('/advance-requests','assigned',{amount:100,reason:'TEST two distinct stages'})).data.item;
  const action={itemType:'ADVANCE',requestId:row.id,reviewStage:'APPROVER',action:'RETURN_FOR_REVISION',returnReason:'TEST clarify'};
  assert.equal((await api('/review/row-action','combined',action)).status,200);
  assert.equal(JSON.parse(readStore()).advanceRequests.find((r:any)=>r.id===row.id).returnedByRole,'APPROVER');
  assert.equal((await api('/requests/resubmit','assigned',{itemType:'ADVANCE',requestId:row.id,amount:100,description:'TEST clarified'})).status,200);
  assert.equal((await api('/review/row-action','combined',{...action,action:'APPROVE'})).status,200);
  assert.equal((await api('/review/row-action','combined',{...action,action:'APPROVE'})).status,409);
  assert.equal((await api('/approver/review','combined',{requestId:row.id,requestType:'ADVANCE',action:'APPROVE'})).status,403);
  assert.equal((await api('/review/row-action','combined',{...action,reviewStage:'ACCOUNTING',action:'APPROVE'})).status,200);
  const result=JSON.parse(readStore()).advanceRequests.find((r:any)=>r.id===row.id);
  assert.equal(result.status,'Pending_Treasury');
  assert.equal(result.approvedBySupervisorUserId,combined.id);
  assert.equal(result.approvedByAccountingUserId,combined.id);
  assert.equal((await api('/review/row-action','combined',{...action,reviewStage:'ACCOUNTING',action:'APPROVE'})).status,409);
});

test('combined reviewer resolves only the explicit rejection stage; both decisions stay distinct',async()=>{
  const row=(await api('/advance-requests','assigned',{amount:100,reason:'TEST combined rejected stages'})).data.item;
  const command={itemType:'ADVANCE',requestId:row.id,expectedVersion:1};
  for(const stage of ['APPROVER','ACCOUNTING']){
    assert.equal((await api('/review/row-action','combined',{...command,reviewStage:stage,expectedStatus:stage==='APPROVER'?'Pending_Approver':'Pending_Accounting',action:'REJECT',returnReason:'TEST combined '+stage})).status,200);
    const held=readStore();
    assert.equal((await api('/review/row-action','combined',{...command,reviewStage:stage==='APPROVER'?'ACCOUNTING':'APPROVER',expectedStatus:'Rejected',action:'APPROVE'})).status,409);
    assert.equal(readStore(),held);
    assert.equal((await api('/review/row-action','combined',{...command,reviewStage:stage,expectedStatus:'Rejected',action:'APPROVE'})).status,200);
  }
  const saved=JSON.parse(readStore()).advanceRequests.find((r:any)=>r.id===row.id);assert.equal(saved.status,'Pending_Treasury');assert.equal(saved.version,1);assert.deepEqual(saved.auditHistory.filter((a:any)=>a.decision==='REJECT').map((a:any)=>a.stage),['APPROVER','ACCOUNTING']);
});

test('self edit cannot clear explicit zero limits into inherited positive authority', async () => {
  const role='TEST_USER_MANAGER';
  assert.equal((await api('/roles/save','admin',{role,title:role,baseTemplateRole:'REQUESTER',approvalLimitRial:1000000,paymentLimitRial:1000000,permissions:{...getDefaultPermissionsForRole('REQUESTER'),canManageUsers:true,canApprove:true,canExecutePayment:true}})).status,200);
  const saved=await api('/users/save','admin',{name:'TEST manager',personnelCode:'manager',department:'TEST',company:'TEST',role,password,mustChangePassword:false,financialApprovalLimit:0,paymentExecutionLimit:0});
  assert.equal(saved.status,200);
  const manager=saved.data.state.users.find((u:any)=>u.personnelCode==='manager');
  tokens.manager=(await api('/auth/login',undefined,{personnelCode:'manager',password})).data.token;
  const before=readStore();
  for(const field of ['financialApprovalLimit','paymentExecutionLimit']) for(const value of [null,'',1]) assert.equal((await api('/users/save','manager',{...manager,[field]:value})).status,403);
  assert.equal((await api('/users/save','manager',{...manager,accessScope:'COMPANY_WIDE'})).status,403);
  assert.equal((await api('/users/save','manager',{...manager,additionalRoles:['APPROVER']})).status,403);
  assert.equal(readStore(),before);
});

test('supplementary requester role permits own submissions, never own approval; explicit scope/zero limits remain binding', async () => {
  assert.equal((await api('/users/save','admin',{name:'TEST limited',personnelCode:'limited',department:'TEST',company:'TEST',role:'ACCOUNTING',additionalRoles:['APPROVER','REQUESTER'],password,mustChangePassword:false,financialApprovalLimit:0,accessScope:'SELF_ONLY'})).status,200);
  tokens.limited=(await api('/auth/login',undefined,{personnelCode:'limited',password})).data.token;
  const me=(await api('/auth/me','limited')).data.user;
  assert.equal(me.effectiveApprovalLimitRial,0);
  assert.equal(me.effectiveAccessScope,'SELF_ONLY');
  assert.equal(me.effectivePermissions.canSubmitSingleAdvance,true);
  const own=(await api('/advance-requests','limited',{amount:100,reason:'TEST own'})).data.item;
  assert.equal((await api('/review/row-action','limited',{itemType:'ADVANCE',requestId:own.id,reviewStage:'ACCOUNTING',action:'APPROVE'})).status,403);
  assert.equal(JSON.parse(readStore()).advanceRequests.find((r:any)=>r.id===own.id).status,'Pending_Accounting');
  assert.equal((await api('/users/save','admin',{name:'TEST invalid assignment',personnelCode:'invalid-assignment',department:'TEST',company:'TEST',role:'REQUESTER',password,supervisorId:me.id})).status,400);
});

test('requests without supervisor route directly to accounting, including batches, notifications and resubmission', async () => {
  const created=await api('/users/save','admin',{name:'TEST no supervisor',personnelCode:'direct',department:'TEST',company:'TEST',role:'REQUESTER',password,mustChangePassword:false});
  assert.equal(created.status,200);
  tokens.direct=(await api('/auth/login',undefined,{personnelCode:'direct',password})).data.token;
  const advance=(await api('/advance-requests','direct',{amount:100,reason:'TEST direct advance'})).data.item;
  const payment=(await api('/payment-requests','direct',{amount:100,payeeName:'TEST payee',description:'TEST direct payment'})).data.item;
  const batch=(await api('/batch-payments','direct',{title:'TEST direct batch',items:[{amount:100,payeeName:'TEST payee'}]})).data.batch;
  for(const row of [advance,payment,batch,...batch.items]) assert.equal(row.status,'Pending_Accounting');
  await api('/state','direct'); // exercise the normal loader/backfill, not only the submit DTO
  const loaded=JSON.parse(readStore());
  for(const row of [loaded.advanceRequests.find((r:any)=>r.id===advance.id),loaded.paymentRequests.find((r:any)=>r.id===payment.id),loaded.batchPayments.find((r:any)=>r.id===batch.id).items[0]]) {
    assert.ok(!row.approverId && !row.approvedBySupervisorUserId && !row.approvedByApproverAt,'direct route must not fabricate a supervisor approval');
  }
  for(const [itemType,row,rowId] of [['ADVANCE',advance,undefined],['PAYMENT',payment,undefined],['BATCH_ITEM',batch,batch.items[0].id]] as const){
    const body={itemType,requestId:row.id,rowId};
    assert.equal((await api('/review/row-action','approver',{...body,action:'APPROVE'})).status,403);
    assert.equal((await api('/review/row-action','accounting',{...body,action:'RETURN_FOR_REVISION',returnReason:'TEST accounting correction'})).status,200);
    assert.equal((await api('/requests/resubmit','direct',{...body,amount:200,description:'TEST sensitive correction'})).status,200);
    const db=JSON.parse(readStore());
    const result=itemType==='BATCH_ITEM'?db.batchPayments.find((r:any)=>r.id===row.id).items[0]:[...db.advanceRequests,...db.paymentRequests].find((r:any)=>r.id===row.id);
    assert.equal(result.status,'Pending_Accounting');
    const notification=db.notifications.find((n:any)=>n.requestId===row.id&&n.eventType==='REQUEST_RESUBMITTED');
    assert.equal(notification.recipientRole,'ACCOUNTING');
    assert.equal(notification.targetSection,'ACCOUNTING');
    assert.equal((await api('/review/row-action','accounting',{...body,action:'APPROVE'})).status,200);
  }
});

test('legacy batch review enforces each targeted row amount before any mutation', async () => {
  const created=(await api('/batch-payments','requester',{title:'TEST legacy limit',items:[{amount:2000000,payeeName:'TEST large'}]})).data.batch;
  const before=readStore();
  assert.equal((await api('/approver/review','approver',{requestType:'BATCH',requestId:created.id,action:'APPROVE'})).status,403);
  assert.equal(readStore(),before);
  const direct=(await api('/batch-payments','other',{title:'TEST direct legacy limit',items:[{amount:2000000,payeeName:'TEST large'}]})).data.batch;
  const accountingBefore=readStore();
  assert.equal((await api('/accounting/review','accounting',{requestType:'BATCH',requestId:direct.id,action:'APPROVE'})).status,403);
  assert.equal(readStore(),accountingBefore);
});

test('unsupported legacy update actions never become returns for a read-only reviewer', async () => {
  const role=(await api('/state','admin')).data.roleConfigs.find((r:any)=>r.role==='ACCOUNTING');
  assert.equal((await api('/roles/save','admin',{...role,permissions:{...role.permissions,canApprove:false,canEditAmount:false,canReturnForRevision:false}})).status,200);
  const row=(await api('/advance-requests','direct',{amount:100,reason:'TEST read-only legacy'})).data.item;
  const before=readStore();
  assert.equal((await api('/accounting/review','accounting',{requestId:row.id,requestType:'ADVANCE',action:'UPDATE_AMOUNT_COMMENT'})).status,403);
  assert.equal(readStore(),before);
  assert.equal((await api('/roles/save','admin',role)).status,200);
});

test('removing supplementary supervisor role requires safe reassignment; existing session loses permission immediately', async () => {
  const combined=(await api('/state','admin')).data.users.find((u:any)=>u.personnelCode==='combined');
  const pending=(await api('/advance-requests','assigned',{amount:100,reason:'TEST pending reassignment'})).data.item;
  const before=readStore();
  assert.equal((await api('/users/save','admin',{...combined,additionalRoles:['REQUESTER']})).status,409);
  assert.equal(readStore(),before);
  assert.equal((await api('/users/save','admin',{...combined,additionalRoles:['REQUESTER'],replacementSupervisorId:'approver'})).status,200);
  const after=JSON.parse(readStore());
  assert.equal(after.advanceRequests.find((r:any)=>r.id===pending.id).supervisorId,'approver');
  assert.equal(after.users.find((u:any)=>u.personnelCode==='assigned').supervisorId,'approver');
  assert.equal((await api('/auth/me','combined')).data.user.effectivePermissions.canAccessApproverCartable,false);
  assert.equal((await api('/review/row-action','combined',{itemType:'ADVANCE',requestId:pending.id,action:'APPROVE'})).status,403);
});

test('owner can edit an untouched submitted request in place, preserving route and original amount', async () => {
  const row=(await api('/advance-requests','requester',{amount:10000,reason:'TEST editable request'})).data.item;
  const result=await api('/requests/edit-submitted','requester',{itemType:'ADVANCE',requestId:row.id,expectedVersion:1,changes:{amount:12000,description:'TEST corrected before review',requestedMonth:'1405/07',suggestedDate:'1405/07/30'}});
  assert.equal(result.status,200,result.data.error);
  assert.equal(result.data.item.id,row.id);
  assert.equal(result.data.item.status,'Pending_Approver');
  assert.equal(result.data.item.supervisorId,'approver');
  assert.equal(result.data.item.amount,12000);
  assert.equal(result.data.item.initialAmount,10000);
  assert.equal(result.data.item.version,2);
  const state=(await api('/state','requester')).data;
  assert.equal(state.advanceRequests.find((r:any)=>r.id===row.id).reason,'TEST corrected before review');
});

test('submitted edits reject other identities, workflow fields, stale versions and invalid amounts without writing', async () => {
  const row=(await api('/payment-requests','requester',{amount:10000,payeeName:'TEST original',description:'TEST edit boundary'})).data.item;
  const edit={itemType:'PAYMENT',requestId:row.id,expectedVersion:1,changes:{amount:15000}};
  const before=readStore();
  assert.equal((await api('/requests/edit-submitted','other',edit)).status,403);
  assert.equal((await api('/requests/edit-submitted','admin',edit)).status,403);
  assert.equal((await api('/requests/edit-submitted','requester',{...edit,requesterId:'admin'})).status,403);
  assert.equal((await api('/requests/edit-submitted','requester',{...edit,expectedVersion:0})).status,409);
  assert.equal((await api('/requests/edit-submitted','requester',{...edit,expectedVersion:undefined})).status,409);
  for(const changes of [{status:'Paid'},{supervisorId:'admin'},{requesterId:'admin'},{approvedAmount:1},{amount:-1},{amount:1.2},{attachments:[{id:'bad',url:'https://invalid.example/private',name:'TEST',size:1,type:'image/png'}]}])assert.equal((await api('/requests/edit-submitted','requester',{...edit,changes})).status,400);
  assert.equal(readStore(),before);
});

test('any accepted reviewer action locks owner edits; rejected review attempts do not lock', async () => {
  for(const action of ['APPROVE','UPDATE_AND_APPROVE','RETURN_FOR_REVISION','UPDATE_AMOUNT_COMMENT']){
    const row=(await api('/advance-requests','requester',{amount:10000,reason:'TEST lock '+action})).data.item;
    assert.equal((await api('/review/row-action','approver',{itemType:'ADVANCE',requestId:row.id,action,...(action==='RETURN_FOR_REVISION'?{returnReason:'TEST correction'}:action.startsWith('UPDATE_')?{newAmount:10000,amountChangeReason:'TEST required review reason'}:{})})).status,200);
    const saved=JSON.parse(readStore()).advanceRequests.find((r:any)=>r.id===row.id);
    assert.ok(saved.reviewStartedAt);
    assert.equal((await api('/requests/edit-submitted','requester',{itemType:'ADVANCE',requestId:row.id,expectedVersion:saved.version||1,changes:{amount:14000}})).status,409);
  }
  const row=(await api('/advance-requests','requester',{amount:10000,reason:'TEST unsuccessful review'})).data.item;
  assert.equal((await api('/review/row-action','approver',{itemType:'ADVANCE',requestId:row.id,action:'RETURN_FOR_REVISION'})).status,400);
  assert.equal((await api('/requests/edit-submitted','requester',{itemType:'ADVANCE',requestId:row.id,expectedVersion:1,changes:{description:'TEST still editable'}})).status,200);
});

test('review of an amended request requires the observed version and never approves unseen contents', async () => {
  const row=(await api('/advance-requests','requester',{amount:10000,reason:'TEST stale reviewer'})).data.item;
  assert.equal((await api('/requests/edit-submitted','requester',{itemType:'ADVANCE',requestId:row.id,expectedVersion:1,changes:{amount:13000}})).status,200);
  const approve={itemType:'ADVANCE',requestId:row.id,action:'APPROVE'};
  assert.equal((await api('/review/row-action','approver',{...approve,expectedVersion:1})).status,409);
  assert.equal((await api('/review/row-action','approver',approve)).status,409);
  assert.equal((await api('/review/row-action','approver',{...approve,expectedVersion:2})).status,200);
});

test('batch edits affect only untouched rows, retain reviewed sibling and reconcile total and attachments', async () => {
  const batch=(await api('/batch-payments','requester',{title:'TEST mixed editable batch',items:[{amount:10000,payeeName:'TEST locked'},{amount:20000,payeeName:'TEST editable'}]})).data.batch;
  assert.equal((await api('/review/row-action','approver',{itemType:'BATCH_ITEM',requestId:batch.id,rowId:batch.items[0].id,action:'APPROVE'})).status,200);
  const saved=(await api('/state','requester')).data.batchPayments.find((b:any)=>b.id===batch.id);
  const sibling=JSON.stringify(saved.items[0]);
  const attachment={id:'TEST-pdf',name:'TEST.pdf',size:5,type:'application/pdf',url:'data:application/pdf;base64,dGVzdA==',uploadedAt:'2026-10-21T00:00:00.000Z'};
  const edit={itemType:'BATCH_ITEM',requestId:batch.id,rowId:batch.items[1].id,expectedVersion:1,changes:{amount:25000,payeeName:'TEST corrected',attachments:[attachment]}};
  assert.equal((await api('/requests/edit-submitted','requester',edit)).status,200);
  const after=(await api('/state','requester')).data.batchPayments.find((b:any)=>b.id===batch.id);
  assert.equal(JSON.stringify(after.items[0]),sibling);
  assert.equal(after.title,batch.title);assert.equal(after.totalAmount,35000);assert.equal(after.items[1].version,2);
  assert.equal(after.items[1].attachments[0].url,attachment.url);
  assert.equal((await api('/requests/edit-submitted','requester',{...edit,rowId:batch.items[0].id})).status,409);
  assert.equal((await api('/requests/edit-submitted','requester',{...edit,expectedVersion:2,changes:{attachments:[]}})).status,200);
});

test('direct-accounting batch amendments are version-protected through legacy and bulk review', async () => {
  const batch=(await api('/batch-payments','other',{title:'TEST direct amended batch',items:[{amount:10000,payeeName:'TEST direct'}]})).data.batch;
  const id=batch.items[0].id;
  assert.equal((await api('/requests/edit-submitted','other',{itemType:'BATCH_ITEM',requestId:batch.id,rowId:id,expectedVersion:1,changes:{amount:18000}})).status,200);
  const command={requestType:'BATCH',requestId:batch.id,action:'APPROVE'};
  assert.equal((await api('/accounting/review','accounting',command)).status,409);
  assert.equal((await api('/accounting/review','accounting',{...command,expectedItemVersions:{[id]:1}})).status,409);
  assert.equal((await api('/review/bulk-action','accounting',{action:'APPROVE',items:[{itemType:'BATCH_ITEM',requestId:batch.id,rowId:id,expectedVersion:1}]})).status,409);
  assert.equal((await api('/accounting/review','accounting',{...command,expectedItemVersions:{[id]:2}})).status,200);
  const row=JSON.parse(readStore()).batchPayments.find((b:any)=>b.id===batch.id).items[0];assert.ok(row.reviewStartedAt);assert.equal(row.status,'Pending_Treasury');
});

test('unsupported bulk actions cannot stamp an untouched request for a read-only reviewer',async()=>{
  const role=(await api('/state','admin')).data.roleConfigs.find((r:any)=>r.role==='APPROVER');
  const row=(await api('/advance-requests','requester',{amount:10000,reason:'TEST unsupported bulk'})).data.item;
  assert.equal((await api('/roles/save','admin',{...role,permissions:{...role.permissions,canApprove:false,canEditAmount:false,canReturnForRevision:false}})).status,200);
  try {
    const before=readStore();
    for(const action of ['UPDATE_AMOUNT_COMMENT','RETURN','UPDATE_AND_APPROVE'])assert.equal((await api('/review/bulk-action','approver',{action,items:[{itemType:'ADVANCE',requestId:row.id,expectedVersion:1}]})).status,403);
    assert.equal((await api('/review/bulk-action','approver',{action:'REJECT',returnReason:'TEST denied',items:[{itemType:'ADVANCE',requestId:row.id,expectedVersion:1,expectedStatus:'Pending_Approver'}]})).status,403);
    assert.equal(readStore(),before);
  } finally { assert.equal((await api('/roles/save','admin',role)).status,200); }
});

test('legacy batch selectors cannot bypass amended sibling versions',async()=>{
  for(const [owner,reviewer,route] of [['requester','approver','/approver/review'],['other','accounting','/accounting/review']]){
    const batch=(await api('/batch-payments',owner,{title:'TEST mixed selectors',items:[{amount:10000,payeeName:'TEST untouched'},{amount:20000,payeeName:'TEST amended'}]})).data.batch;
    assert.equal((await api('/requests/edit-submitted',owner,{itemType:'BATCH_ITEM',requestId:batch.id,rowId:batch.items[1].id,expectedVersion:1,changes:{amount:22000}})).status,200);
    const before=readStore();
    const command={requestType:'BATCH',requestId:batch.id,action:'APPROVE'};
    assert.equal((await api(route,reviewer,{...command,itemType:'BATCH_ITEM',rowId:batch.items[0].id,expectedVersion:1})).status,409);
    assert.equal(readStore(),before);
    assert.equal((await api(route,reviewer,{...command,expectedItemVersions:{[batch.items[1].id]:2}})).status,200);
  }
});

test('concurrent owner edits and concurrent review never lose updates or approve a stale edit', async () => {
  let row=(await api('/advance-requests','requester',{amount:10000,reason:'TEST competing edits'})).data.item;
  const edit={itemType:'ADVANCE',requestId:row.id,expectedVersion:1,changes:{amount:15000}};
  const attempts=await Promise.all([api('/requests/edit-submitted','requester',edit),api('/requests/edit-submitted','requester',{...edit,changes:{amount:16000}})]);
  assert.deepEqual(attempts.map(r=>r.status).sort(),[200,409]);
  let saved=(await api('/state','requester')).data.advanceRequests.find((r:any)=>r.id===row.id);assert.equal(saved.version,2);assert.equal(saved.auditHistory.filter((a:any)=>a.decision==='EDIT_SUBMITTED').length,1);
  row=(await api('/advance-requests','requester',{amount:10000,reason:'TEST edit versus review'})).data.item;
  const raced=await Promise.all([api('/requests/edit-submitted','requester',{...edit,requestId:row.id}),api('/review/row-action','approver',{itemType:'ADVANCE',requestId:row.id,expectedVersion:1,action:'APPROVE'})]);
  assert.deepEqual(raced.map(r=>r.status).sort(),[200,409]);
  saved=(await api('/state','requester')).data.advanceRequests.find((r:any)=>r.id===row.id);
  assert.ok((saved.status==='Pending_Approver'&&saved.version===2)||(saved.status==='Pending_Accounting'&&saved.amount===10000));
});

test('revoking submission permission blocks an existing session from editing its own request',async()=>{
  const row=(await api('/advance-requests','requester',{amount:10000,reason:'TEST revoked edit'})).data.item;
  const role=(await api('/state','admin')).data.roleConfigs.find((r:any)=>r.role==='REQUESTER');
  assert.equal((await api('/roles/save','admin',{...role,permissions:{...role.permissions,canSubmitSingleAdvance:false}})).status,200);
  assert.equal((await api('/requests/edit-submitted','requester',{itemType:'ADVANCE',requestId:row.id,expectedVersion:1,changes:{amount:15000}})).status,403);
  assert.equal((await api('/roles/save','admin',role)).status,200);
});

test('legacy or ambiguous review evidence fails closed without treating a requester edit as review',()=>{
  const row:any={id:'TEST',status:'Pending_Approver',version:1,auditHistory:[{action:'ثبت اولیه درخواست مساعده'}]};
  assert.equal(canEditSubmittedRequest(row,'approver','requester'),true);
  for(const change of [{reviewStartedAt:'TEST'},{approverNote:'TEST'},{comments:[{}]},{auditHistory:[]},{auditHistory:[{action:'TEST unknown action'}]},{isResubmitted:true}])assert.equal(canEditSubmittedRequest({...row,...change},'approver','requester'),false);
  const edit={action:'ویرایش درخواست پیش از شروع بررسی',stage:'REQUESTER',decision:'EDIT_SUBMITTED',actorId:'requester'};
  assert.equal(canEditSubmittedRequest({...row,auditHistory:[...row.auditHistory,edit]},'approver','requester'),true);
  assert.equal(canEditSubmittedRequest({...row,auditHistory:[{...edit,actorId:'other'}]},'approver','requester'),false);
});

test('anonymous and expired sessions cannot read data or mutate any protected API', async () => {
  for (const [route,body] of [['/state',undefined],['/reset',{}],['/users/save',{}],['/requests/edit-submitted',{}],['/review/row-action',{}],['/treasury/execute-payment',{}]] as const) assert.equal((await api(route,undefined,body)).status,401);
  assert.equal((await api('/state','invalid-token')).status,401);
  const db = JSON.parse(readStore());
  db.sessions.push({ token:'expired-token', userId:'admin', expiresAt:Date.now()-1, createdAt:0, revoked:false });
  db.sessions.push({ token:'revoked-token', userId:'admin', expiresAt:Date.now()+100000, createdAt:0, revoked:true });
  writeStore(JSON.stringify(db));
  assert.equal((await api('/state','expired-token')).status,401);
  assert.equal((await api('/state','revoked-token')).status,401);
});
test('reset is disabled even for admin; requester cannot impersonate or administer', async () => {
  assert.equal((await api('/reset','admin',{})).status,403);
  assert.equal((await api('/users/save','requester',{})).status,403);
  assert.equal((await api('/payment-requests','requester',{requesterId:'admin',amount:10})).status,403);
  assert.equal((await api('/treasury/manual-payment','requester',{amount:10})).status,403);
  assert.equal((await api('/advance-requests','requester',{amount:-1})).status,400);
});
test('requester creates a persisted request; state and mutation responses hide other users financial records', async () => {
  const first = await api('/advance-requests','requester',{ amount:10000, reason:'Synthetic journey' });
  assert.equal(first.status,200,JSON.stringify(first.data));
  requestId = JSON.parse(readStore()).advanceRequests[0].id;
  const other = await api('/advance-requests','other',{ amount:20000, reason:'Other private record' });
  assert.equal(other.status,200);
  const state = await api('/state','requester');
  assert.ok(state.data.advanceRequests.length>=1);
  assert.ok(state.data.advanceRequests.every((r:any)=>r.requesterId==='requester'));
  assert.ok(state.data.advanceRequests.some((r:any)=>r.id===requestId));
  assert.equal(state.data.companyBankAccounts.length,0);
  assert.equal(state.data.securityAuditLogs.length,0);
  assert.ok(!JSON.stringify(state.data).includes('passwordHash'));
  assert.ok(!JSON.stringify(state.data).includes(tokens.admin));
  assert.ok(!JSON.stringify(other.data).includes(requestId));
});
test('scoped approver sees assigned records, cannot approve foreign ones, honors limits', async () => {
  const state = await api('/state','approver');
  assert.ok(state.data.advanceRequests.some((r:any)=>r.id===requestId));
  const db = JSON.parse(readStore());
  const subordinateIds=new Set(db.users.filter((u:any)=>u.supervisorId==='approver').map((u:any)=>u.id));
  assert.ok(state.data.advanceRequests.every((r:any)=>r.supervisorId==='approver'||subordinateIds.has(r.requesterId)));
  const foreignId = db.advanceRequests.find((r:any)=>r.requesterId==='other').id;
  assert.equal((await api('/review/row-action','approver',{itemType:'ADVANCE',requestId:foreignId,action:'APPROVE'})).status,403);
  assert.equal((await api('/review/row-action','approver',{itemType:'ADVANCE',requestId,action:'UPDATE_AND_APPROVE',newAmount:2000000})).status,403);
  assert.equal((await api('/review/row-action','requester',{itemType:'ADVANCE',requestId,action:'APPROVE'})).status,403);
});
test('return, owner correction, resubmit, approver and accounting approval form a complete API journey', async () => {
  assert.equal((await api('/review/row-action','approver',{itemType:'ADVANCE',requestId,action:'RETURN_FOR_REVISION',returnReason:'Complete test description'})).status,200);
  assert.equal((await api('/requests/resubmit','other',{itemType:'ADVANCE',requestId,amount:12000})).status,403);
  assert.equal((await api('/requests/resubmit','requester',{itemType:'ADVANCE',requestId,amount:12000,description:'Corrected'})).status,200);
  const sent = await api('/state','approver');
  assert.equal(sent.data.advanceRequests.find((r:any)=>r.id===requestId).status,'Pending_Approver');
  assert.equal((await api('/review/row-action','accounting',{itemType:'ADVANCE',requestId,action:'APPROVE'})).status,403);
  assert.equal((await api('/review/row-action','approver',{itemType:'ADVANCE',requestId,action:'APPROVE'})).status,200);
  assert.equal((await api('/review/row-action','approver',{itemType:'ADVANCE',requestId,action:'APPROVE'})).status,403);
  assert.equal((await api('/review/row-action','accounting',{itemType:'ADVANCE',requestId,action:'APPROVE'})).status,200);
  const persisted = JSON.parse(readStore()).advanceRequests.find((r:any)=>r.id===requestId);
  assert.equal(persisted.status,'Pending_Treasury');
  assert.equal(persisted.requesterId,'requester');
  assert.ok(persisted.auditHistory.length>=4);
});
test('forced password change denies business access then unlocks it after valid change', async () => {
  assert.equal((await api('/advance-requests','forced',{amount:10})).status,403);
  assert.equal((await api('/state','forced')).data.advanceRequests.length,0);
  assert.equal((await api('/auth/change-password','forced',{currentPassword:password,newPassword:'Ab12',confirmPassword:'Ab12'})).status,400);
  assert.equal((await api('/auth/change-password','forced',{currentPassword:password,newPassword:'Ab123',confirmPassword:'Ab123'})).status,200);
  assert.equal((await api('/advance-requests','forced',{amount:10})).status,200);
});

test('admin create, edit and reset accept five characters, reject four and retain unrelated credentials', async () => {
  const adminBefore=JSON.parse(readStore()).users.find((u:any)=>u.id==='admin');
  const account={name:'Synthetic password boundary',personnelCode:'password-boundary',department:'TEST',company:'TEST',role:'REQUESTER'};
  assert.equal((await api('/users/save','admin',{...account,password:'Ab12'})).status,400);
  assert.equal((await api('/users/save','admin',{...account,password:'Ab123'})).status,200);
  const created=JSON.parse(readStore()).users.find((u:any)=>u.personnelCode===account.personnelCode);
  assert.ok(created);
  assert.equal((await api('/users/save','admin',{...account,id:created.id,password:'Cd45'})).status,400);
  assert.equal((await api('/users/save','admin',{...account,id:created.id,password:'Cd456'})).status,200);
  assert.equal((await api('/users/reset-password','admin',{targetUserId:created.id,tempPassword:'Ef78'})).status,400);
  assert.equal((await api('/users/reset-password','admin',{targetUserId:created.id,tempPassword:'Ef789'})).status,200);
  const after=JSON.parse(readStore());
  const adminAfter=after.users.find((u:any)=>u.id==='admin');
  assert.equal(adminAfter.passwordHash,adminBefore.passwordHash);
  assert.equal(adminAfter.passwordSalt,adminBefore.passwordSalt);
  assert.ok(!after.users.find((u:any)=>u.id===created.id).password);
});
test('simultaneous creations persist all records without lost updates or duplicate IDs', async () => {
  const before = JSON.parse(readStore()).advanceRequests.length;
  const results = await Promise.all(Array.from({length:8},(_,i)=>api('/advance-requests','requester',{amount:100+i,reason:'Concurrent synthetic request'})));
  assert.ok(results.every(r=>r.status===200));
  const db = JSON.parse(readStore());
  assert.equal(db.advanceRequests.length,before+8);
  assert.equal(new Set(db.advanceRequests.map((r:any)=>r.id)).size,db.advanceRequests.length);
  const backupFile=fs.readdirSync(path.join(root!,'backups')).find(f=>f.endsWith(sqlite?'.sqlite':'.json'));assert.ok(backupFile);
  if(sqlite){const saved=new SqliteRecords<any>(path.join(root!,'backups',backupFile!),false,true);try{assert.ok(Array.isArray(saved.read().users));}finally{saved.close();}}
});
test('zero approval and payment limits deny actions; removed attachment permission strips files', () => {
  const viewer:any = users.find(u=>u.id==='approver');
  const row = {id:'unit',requesterId:'requester',supervisorId:viewer.id,status:'Pending_Approver',amount:100,attachments:[{url:'private-file'}]};
  const db:any = {...fixture, advanceRequests:[row]};
  const auth:any = {effectivePermissions:getDefaultPermissionsForRole('APPROVER'),effectiveAccessScope:'ASSIGNED_AND_SUBORDINATES',effectiveApprovalLimitRial:0,effectivePaymentLimitRial:0};
  assert.equal(authorizeRequest({path:'/review/row-action',method:'POST',body:{requestId:'unit',itemType:'ADVANCE',action:'APPROVE'}},viewer,db,auth)?.status,403);
  auth.effectivePermissions.canExecutePayment=true;
  assert.equal(authorizeRequest({path:'/treasury/execute-payment',method:'POST',body:{}},viewer,db,auth)?.status,403);
  auth.effectivePermissions.canViewAttachments=false;
  assert.ok(!JSON.stringify(scopeState(db,viewer,auth)).includes('private-file'));
});
test('treasury cannot skip accounting or duplicate a row; concurrent settlement records one payment only', async () => {
  const bank = await api('/treasury/bank-accounts/save','admin',{account:{bankName:'بانک آزمون',accountTitle:'SYNTHETIC',accountNumber:'000000001',companyName:'TEST',isActive:true}});
  assert.equal(bank.status,200,JSON.stringify(bank.data));
  const sourceBankAccountId=bank.data.state.companyBankAccounts[0].id;
  const pending=JSON.parse(readStore()).advanceRequests.find((r:any)=>r.requesterId==='other');
  assert.equal((await api('/treasury/execute-payment','treasury',{sourceBankAccountId,items:[{type:'ADVANCE',id:pending.id}]})).status,403);
  const payload={sourceBankAccountId,items:[{type:'ADVANCE',id:requestId}],idempotencyKey:'synthetic-payment-1',bankRefNumber:'TEST-NO-BANK-TRANSFER',dateJalali:'1405/07/29'};
  assert.equal((await api('/treasury/execute-payment','treasury',{...payload,items:[...payload.items,...payload.items]})).status,400);
  const results=await Promise.all([api('/treasury/execute-payment','treasury',payload),api('/treasury/execute-payment','treasury',payload)]);
  assert.equal(results.filter(r=>r.status===200).length,1,JSON.stringify(results.map(r=>({status:r.status,error:r.data.error}))));
  const db=JSON.parse(readStore());const row=db.advanceRequests.find((r:any)=>r.id===requestId);
  assert.equal(row.status,'Paid');assert.equal(row.paidAmountSoFar,12000);assert.equal(row.paymentHistory.length,1);
});
test('deactivating a user immediately invalidates an existing session', async()=>{
  const db=JSON.parse(readStore());db.users.find((u:any)=>u.id==='other').isActive=false;writeStore(JSON.stringify(db));
  assert.equal((await api('/state','other')).status,401);
});

test('a daily cover cannot name another user as its closing actor',async()=>{
  const before=JSON.parse(readStore()).dailyCovers.length;
  assert.equal((await api('/treasury/daily-cover','treasury',{date:'1405/07/29',bankName:'Synthetic',totalIn:0,bankFee:0,note:'synthetic actor guard',closedByUserId:'admin'})).status,403);
  assert.equal(JSON.parse(readStore()).dailyCovers.length,before);
});

test('password reset cannot resolve another users recovery request or partially change credentials',async()=>{
  const before=readStore();try{const db=JSON.parse(before);db.passwordRecoveryRequests.push({id:'SYN-UNRELATED-RECOVERY',userId:'other',personnelCode:'other',status:'Pending',createdAt:'TEST',phone:'',note:'TEST'});writeStore(JSON.stringify(db));
    const hash=db.users.find((u:any)=>u.id==='requester').passwordHash,sessions=JSON.stringify(db.sessions);
    const reply=await api('/users/reset-password','admin',{targetUserId:'requester',recoveryRequestId:'SYN-UNRELATED-RECOVERY',tempPassword:'SYN-denied-password'});assert.equal(reply.status,400);
    const after=JSON.parse(readStore());assert.ok(after.users.find((u:any)=>u.id==='requester').passwordHash===hash,'credentials unchanged');assert.ok(JSON.stringify(after.sessions)===sessions,'sessions unchanged');assert.equal(after.passwordRecoveryRequests.find((r:any)=>r.id==='SYN-UNRELATED-RECOVERY').status,'Pending');
  }finally{writeStore(before);}
});

test('real API enforces company scope, role union, empty revocation and authorized cross-company payment',async()=>{
  const before=readStore();try{
    const db=JSON.parse(before),salt=crypto.randomBytes(16).toString('hex'),id='SYN-COMPANY-VIEWER';
    db.users.push({id,name:'TEST company scope',personnelCode:id,role:'SYN_COMP_A',company:'TEST-A',department:'TEST',phone:'09000000003',isActive:true,mustChangePassword:false,additionalRoles:[],passwordSalt:salt,passwordHash:crypto.scryptSync(password,salt,64).toString('hex')});
    db.users.find((u:any)=>u.id==='requester').phone='09000000002';db.smsConfig={...db.smsConfig,enabled:true,events:{sendOnPaymentExecuted:true}};
    for(const [suffix,name] of [['A','TEST-A'],['B','TEST-B']]){
      db.companies.push({id:'SYN-COMP-'+suffix,name,code:'SYN-COMP-'+suffix,isActive:true});
      db.roleConfigs.push({role:'SYN_COMP_'+suffix,title:'TEST '+suffix,baseTemplateRole:'TREASURY',accessScope:'COMPANY_WIDE',allowedCompanies:[name],approvalLimitRial:1000000,paymentLimitRial:1000000,permissions:getDefaultPermissionsForRole('ADMIN')});
      db.companyBankAccounts.push({id:'SYN-BANK-'+suffix,bankName:'SYN-COVER-BANK',accountNumber:suffix==='A'?'000000001101':'000000001102',accountTitle:'TEST '+suffix,companyName:name,isActive:true});
      db.paymentRequests.push({id:'SYN-PAY-'+suffix,trackingCode:'TEST-COMP-'+suffix,requesterId:'requester',company:name,companyId:'SYN-COMP-'+suffix,department:'TEST',status:'Pending_Treasury',amount:100,initialAmount:100,approvedAmount:100,paidAmountSoFar:0,paymentHistory:[],paymentExecutions:[],auditHistory:[],attachments:[],version:1});
    }
    db.notifications.push({id:'SYN-HIDDEN-NOTICE',recipientUserId:id,requestId:'SYN-PAY-B',body:'TEST outside company',readByUserIds:[]});writeStore(JSON.stringify(db));
    const login=await api('/auth/login',undefined,{personnelCode:id,password});assert.equal(login.status,200);tokens[id]=login.data.token;
    let state=(await api('/state',id)).data;assert.ok(state.paymentRequests.some((r:any)=>r.id==='SYN-PAY-A'));assert.ok(!state.paymentRequests.some((r:any)=>r.id==='SYN-PAY-B'));assert.ok(!state.companyBankAccounts.some((r:any)=>r.id==='SYN-BANK-B'));assert.ok(!state.notifications.some((r:any)=>r.id==='SYN-HIDDEN-NOTICE'));
    assert.equal((await api('/notifications/read',id,{notificationId:'SYN-HIDDEN-NOTICE'})).status,403);
    const command={items:[{type:'PAYMENT',id:'SYN-PAY-B'}],sourceBankAccountId:'SYN-BANK-A',paymentAmount:50,idempotencyKey:'SYN-COMP-PAY',bankRefNumber:'TEST-COMPANY'};
    assert.equal((await api('/treasury/execute-payment',id,command)).status,403);
    for(const [route,body] of [['toggle-status',{accountId:'SYN-BANK-B',isActive:false}],['toggle-status',{account:{id:'SYN-BANK-A'},accountId:'SYN-BANK-B',isActive:false}],['save',{account:{id:'SYN-BANK-B',companyName:'TEST-A',bankName:'بانک ملت',accountTitle:'TEST forged',accountNumber:'000000001'}}]])assert.equal((await api('/treasury/bank-accounts/'+route,id,body)).status,403);
    assert.equal((await api('/users/toggle-status',id,{targetUserId:'requester',isActive:false})).status,403);
    assert.equal((await api('/users/reset-password',id,{id,targetUserId:'requester',tempPassword:'SYN-denied'})).status,403);
    assert.equal((await api('/users/requester',id,{id},'DELETE')).status,403);
    const defaults=JSON.parse(readStore());for(const a of defaults.companyBankAccounts)a.isDefault=a.id==='SYN-BANK-A';writeStore(JSON.stringify(defaults));const banksBefore=JSON.stringify(defaults.companyBankAccounts);
    assert.equal((await api('/treasury/bank-accounts/save',id,{account:{id:'SYN-BANK-A',companyName:'TEST-A',bankName:'بانک ملت',accountTitle:'TEST guarded default',accountNumber:'0000000011111777',isDefault:false,isActive:false}})).status,403);assert.ok(JSON.stringify(JSON.parse(readStore()).companyBankAccounts)===banksBefore,'default change cannot alter another company bank');
    const granted=JSON.parse(readStore());granted.users.find((u:any)=>u.id===id).additionalRoles=['SYN_COMP_B','REQUESTER'];granted.roleConfigs.find((r:any)=>r.role==='REQUESTER').allowedCompanies=['TEST-A'];writeStore(JSON.stringify(granted));
    state=(await api('/state',id)).data;assert.ok(state.paymentRequests.some((r:any)=>r.id==='SYN-PAY-B'));assert.ok(state.companyBankAccounts.some((r:any)=>r.id==='SYN-BANK-B'));
    const smsBefore=JSON.parse(readStore()).smsLogs.length;fs.writeFileSync(path.join(root!,'test-fail-next-commit'),'TEST');assert.equal((await api('/treasury/execute-payment',id,command)).status,500);await new Promise(r=>setTimeout(r,30));assert.equal(JSON.parse(readStore()).smsLogs.length,smsBefore,'a failed financial commit cannot trigger a payment SMS log');assert.equal(JSON.parse(readStore()).paymentRequests.find((r:any)=>r.id==='SYN-PAY-B').paidAmountSoFar,0);
    const paid=await api('/treasury/execute-payment',id,command);assert.equal(paid.status,200);assert.equal(paid.data.state.paymentRequests.find((r:any)=>r.id==='SYN-PAY-B').paidAmountSoFar,50);assert.ok(paid.data.state.receiptArchives.some((r:any)=>r.relatedPaymentIds.includes('SYN-PAY-B')));
    const mixed=await api('/treasury/execute-payment',id,{...command,items:[{type:'PAYMENT',id:'SYN-PAY-A'},{type:'PAYMENT',id:'SYN-PAY-B'}],paymentAmount:undefined,idempotencyKey:'SYN-COMP-MIXED'});assert.equal(mixed.status,200);assert.equal(mixed.data.receipt.amount,150);
    let sms:any[]=[];for(let i=0;i<30;i++){sms=JSON.parse(readStore()).smsLogs.filter((l:any)=>l.eventType==='PAYMENT_EXECUTED'&&l.relatedTrackingCode==='TEST-COMP-A');if(sms.length)break;await new Promise(r=>setTimeout(r,10));}assert.equal(sms.length,1);assert.ok(sms.every(l=>l.recipientPhone==='09000000003'),'SMS selects the user authorized for every target, not the first requester role');
    const restricted=JSON.parse(readStore());restricted.users.find((u:any)=>u.id===id).accessScope='SELF_ONLY';writeStore(JSON.stringify(restricted));const covers=restricted.dailyCovers.length,covered=restricted.paymentRequests.find((r:any)=>r.id==='SYN-PAY-A'),date=covered.paidDateJalali,bankName=covered.paidBankName;assert.ok(date&&bankName);assert.equal(restricted.paymentRequests.filter((r:any)=>r.status==='Paid'&&r.paidDateJalali===date&&r.paidBankName===bankName).length,2,'fixture must match actual persisted bank label and both paid targets');
    assert.equal((await api('/treasury/daily-cover',id,{date,bankName,totalIn:0,bankFee:0})).status,403,'cover aggregation must retain resource visibility, not company membership alone');assert.equal(JSON.parse(readStore()).dailyCovers.length,covers);delete restricted.users.find((u:any)=>u.id===id).accessScope;writeStore(JSON.stringify(restricted));
    const revoked=await api('/roles/save','admin',{role:'SYN_COMP_B',allowedCompanies:[]});assert.equal(revoked.status,200);assert.deepEqual(JSON.parse(readStore()).roleConfigs.find((r:any)=>r.role==='SYN_COMP_B').allowedCompanies,[]);
    state=(await api('/state',id)).data;assert.ok(!state.paymentRequests.some((r:any)=>r.id==='SYN-PAY-B'));assert.ok(!state.receiptArchives.some((r:any)=>r.relatedPaymentIds.includes('SYN-PAY-B')));assert.ok(!state.notifications.some((n:any)=>n.eventType==='PAYMENT_EXECUTED'&&n.requestId==='SYN-PAY-A'),'a first visible target must not disclose an aggregate mixed-company notification');assert.equal((await api('/treasury/execute-payment',id,command)).status,403);
    const saved=JSON.parse(readStore()).paymentRequests.find((r:any)=>r.id==='SYN-PAY-B');assert.equal(saved.paidAmountSoFar,100);assert.equal(saved.paymentHistory.length,2);
  }finally{writeStore(before);}
});

test('real API pages and deltas preserve records and recheck authorization without changing legacy responses',async()=>{
  const before=readStore();
  try{
    const db=JSON.parse(before);
    for(let i=0;i<550;i++)db.paymentRequests.push({id:'TEST-SYNC-'+i,trackingCode:'TEST-SYNC-'+i,requesterId:'requester',requesterName:'TEST requester',department:'TEST',company:'TEST',supervisorId:'approver',status:'Pending_Approver',version:1,amount:100,initialAmount:100,approvedAmount:100,paidAmountSoFar:0,paymentHistory:[],paymentExecutions:[],auditHistory:[],attachments:[]});
    writeStore(JSON.stringify(db));
    const client=new StateSyncClient();
    const raw=async(route:string,user='requester',body?:any,extra:Record<string,string>={})=>{
      const response=await fetch(base+'/api'+route,{method:body?'POST':'GET',headers:{'content-type':'application/json',Authorization:'Bearer '+tokens[user],...client.headers(),...extra},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,body:await response.json()};
    };
    const get=async(route:string)=>{const r=await raw(route.slice(4));if(r.status!==200)throw Object.assign(Error('TEST sync request rejected'),{syncExpired:r.body.syncExpired});return r.body;};
    const initial=await raw('/state');assert.equal(initial.status,200);assert.ok(initial.body.stateSnapshot&&!initial.body.paymentRequests);
    const cursor=initial.body.stateSnapshot.cursor,page=await raw('/state?sync='+cursor+'&collection=paymentRequests&offset=0&limit=250');assert.equal(page.status,200);assert.equal(page.body.statePage.rows.length,250);
    assert.equal((await raw('/state?sync='+cursor+'&collection=paymentRequests&offset=0&limit=250','admin')).status,409);
    assert.equal((await raw('/state?sync='+cursor+'&collection=paymentRequests&offset=0&limit=251')).status,409);
    let state=await client.accept(initial.body,get);assert.equal(state.paymentRequests.filter((r:any)=>r.id.startsWith('TEST-SYNC-')).length,550);assert.ok(!JSON.stringify(state).includes('passwordHash'));
    const made=await raw('/payment-requests','requester',{amount:12000,payeeName:'TEST incremental',description:'TEST page preservation'});assert.equal(made.status,200);assert.ok(made.body.stateDelta&&!made.body.state);assert.ok(JSON.stringify(made.body).length<20000);
    const created=await client.accept(made.body,get);state=created.state;assert.ok(state.paymentRequests.some((r:any)=>r.id===made.body.item.id));assert.equal(state.paymentRequests.filter((r:any)=>r.id.startsWith('TEST-SYNC-')).length,550);
    const current=JSON.parse(readStore());current.roleConfigs.find((r:any)=>r.role==='REQUESTER').permissions.canViewRequests=false;writeStore(JSON.stringify(current));
    assert.equal((await raw('/state?sync='+cursor+'&collection=paymentRequests&offset=0&limit=250')).status,409);
    const revoked=await raw('/state');assert.ok(revoked.body.stateSnapshot&&!revoked.body.stateDelta);assert.equal((await client.accept(revoked.body,get)).paymentRequests.length,0);
    const invalid=await fetch(base+'/api/state?sync='+cursor+'&collection=paymentRequests&offset=0&limit=250',{headers:{Authorization:'Bearer TEST-invalid','X-Treasury-State-Mode':'delta-v1'}});assert.equal(invalid.status,401);await invalid.arrayBuffer();
    // The exact legacy response contract remains available without opt-in.
    assert.ok(Array.isArray((await api('/state','admin')).data.paymentRequests));
  }finally{writeStore(before);}
});

test('forged Cloudflare headers do not reset the public login limiter',async()=>{
  let status=0;
  for(let attempt=0;attempt<22;attempt++){
    const response=await fetch(base+'/api/auth/login',{method:'POST',headers:{'content-type':'application/json','cf-connecting-ip':`198.51.100.${attempt+1}`},body:JSON.stringify({personnelCode:`synthetic-missing-${attempt}`,password:'invalid-test-password'})});
    status=response.status;await response.arrayBuffer();
  }
  assert.equal(status,429);
});
