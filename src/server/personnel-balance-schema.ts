import type {TreasuryDatabaseState as DB} from '../types/treasury';
import {PERSONNEL_BALANCE_PERMISSIONS} from '../types/personnel-balance';

const positive=(n:unknown)=>typeof n==='number'&&Number.isSafeInteger(n)&&n>0;
function validate(db:DB,version:1|2|3){
 if(!Array.isArray(db.personnelBalanceRequests)||!Array.isArray(db.personnelBalanceOperations))throw Error('Incomplete personnel balance schema');
 const ids=new Set(db.personnelBalanceRequests.map(q=>q.id));
 if(ids.size!==db.personnelBalanceRequests.length)throw Error('Duplicate personnel balance identity');
 for(const q of db.personnelBalanceRequests){
  if(version<3&&(Object.hasOwn(q,'requestedAmount')||q.audit?.some(a=>['requestedAmountChange','requestedAmount','approvedAmount'].some(k=>Object.hasOwn(a,k)))))throw Error('Older personnel balance contains newer amount data');
  if(version===3){
   if(q.requestedAmount!==undefined&&!positive(q.requestedAmount))throw Error('Invalid personnel requested amount');
   for(const a of q.audit||[]){if(a.requestedAmountChange&&[a.requestedAmountChange.before,a.requestedAmountChange.after].some(n=>n!==null&&!positive(n))||a.requestedAmount!==undefined&&!positive(a.requestedAmount)||a.approvedAmount!==undefined&&!positive(a.approvedAmount))throw Error('Invalid personnel requested amount audit');}
   const latest=q.audit?.filter(a=>a.requestedAmountChange).at(-1)?.requestedAmountChange;if(latest&&latest.after!==(q.requestedAmount??null))throw Error('Personnel requested amount audit mismatch');
  }
  if(!Number.isSafeInteger(q.version)||q.version<1||!['PENDING_ACCOUNTING','NEEDS_REVISION','REJECTED','CANCELLED','FORWARDED'].includes(q.status))throw Error('Invalid personnel balance state');
  if(q.status==='FORWARDED'&&!q.financial||q.financial&&q.status!=='FORWARDED')throw Error('Personnel balance financial state mismatch');
  if(q.financial){
   const f=q.financial,p=db.paymentRequests.find(p=>p.id===f.requestId&&p.personnelBalanceRef?.requestId===q.id);
   if(!p||p.initialAmount!==(version===1?f.amount:f.initialAmount)||version>=2&&(p.amount!==f.amount||(p.approvedAmount??p.amount)!==f.amount||!Number.isSafeInteger(f.initialAmount)||Number(f.initialAmount)<=0))throw Error('Personnel balance financial link mismatch');
   if(version===3?p.personnelBalanceRef?.requestedAmount!==q.requestedAmount:Object.hasOwn(p.personnelBalanceRef!,'requestedAmount'))throw Error('Personnel requested amount source mismatch');
  }
  if(version>=2){
   if(!Array.isArray(q.accountingRevisions))throw Error('Missing personnel balance revision history');
   for(const r of q.accountingRevisions){
    if(!r.id||!r.actorId||!r.reason?.trim()||r.requestVersionAfter!==r.requestVersionBefore+1||r.paymentVersionAfter!==r.paymentVersionBefore+1||[r.before,r.after].some(v=>!v||!Number.isSafeInteger(v.amount)||v.amount<=0||['costCenter','payeeName','accountOrCard','iban','bankName','note'].some(k=>typeof v[k as keyof typeof v]!=='string')))throw Error('Invalid personnel balance revision');
   }
   if(q.accountingRevisions.length&&(!q.financial||q.accountingRevisions[0].before.amount!==q.financial.initialAmount||q.accountingRevisions.at(-1)!.after.amount!==q.financial.amount))throw Error('Personnel balance revision amount mismatch');
  }
 }
 for(const p of db.paymentRequests)if(p.personnelBalanceRef&&!db.personnelBalanceRequests.some(q=>q.id===p.personnelBalanceRef!.requestId&&q.financial?.requestId===p.id))throw Error('Orphan personnel balance payment');
}

/** Version 3 adds optional requester amounts; existing rows remain undeclared.
 * Startup holds the exclusive writer lease and commits this retaining migration
 * with the existing atomic save. Older writers must not read newer schemas. */
export function initializePersonnelBalances(db:DB,enabled:boolean){
 const version=db.personnelBalanceSchemaVersion;
 if(version!==undefined&&version!==1&&version!==2&&version!==3)throw Error('Unsupported personnel balance schema');
 if(version!==undefined){
  validate(db,version);
  if(version===3||!enabled)return false;
  if(version===1&&db.personnelBalanceRequests!.some(q=>Object.hasOwn(q,'accountingRevisions')||q.financial&&Object.hasOwn(q.financial,'initialAmount')))throw Error('Version-1 personnel balance contains newer revision data');
  const rows=version===1?db.personnelBalanceRequests!.map(q=>({...q,accountingRevisions:[],...(q.financial?{financial:{...q.financial,initialAmount:q.financial.amount}}:{})})):db.personnelBalanceRequests!;
  validate({...db,personnelBalanceSchemaVersion:3,personnelBalanceRequests:rows},3);
  db.personnelBalanceRequests=rows;db.personnelBalanceSchemaVersion=3;return true;
 }
 if(!enabled)return false;
 if(db.personnelBalanceRequests?.length||db.personnelBalanceOperations?.length||db.paymentRequests.some(p=>p.personnelBalanceRef))throw Error('Unversioned personnel balance data');
 db.personnelBalanceSchemaVersion=3;db.personnelBalanceRequests=[];db.personnelBalanceOperations=[];db.personnelBalanceReadOnly=false;
 for(const role of db.roleConfigs||[])for(const key of PERSONNEL_BALANCE_PERMISSIONS)if(role.permissions[key]===undefined)role.permissions[key]=role.role==='ADMIN';
 return true;
}
