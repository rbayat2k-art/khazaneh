import {chainStateError} from '../utils/request-approval-chain';
import crypto from 'node:crypto';
import type {Request,Response} from 'express';
import type {TreasuryDatabaseState as DB,User,TreasuryPaymentRejection,AppNotification,BatchPaymentRequest} from '../types/treasury';
import type {EffectiveAccess} from './access-control';
import {canSeeRequest} from './access-control';
import {correctionTarget} from './treasury-correction';
import {hasDeletionFinancialLinks} from '../utils/request-deletion';
import {activeTreasuryRejection,treasuryRejectionEligible,treasuryRestoreEligible,type RejectionRow,type TreasuryRejectionCommand} from '../utils/treasury-rejection';
type Options={post:(path:string,h:(req:Request,res:Response)=>unknown)=>unknown;load:()=>DB;save:(d:DB)=>DB;auth:(u:User,d:DB)=>EffectiveAccess;syncBatch:(b:BatchPaymentRequest)=>void;notice:(d:DB,n:Omit<AppNotification,'id'|'createdAt'|'readByUserIds'>)=>unknown};
function fail(error:string,status=400):never{throw Object.assign(Error(error),{status});}
const canonical=(x:any):any=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
function* rows(d:DB){for(const pool of [d.advanceRequests,d.paymentRequests])for(const row of pool)yield row as RejectionRow;for(const batch of d.batchPayments)for(const row of batch.items)yield row as RejectionRow;}
export function installTreasuryRejection(o:Options){o.post('/api/treasury/rejection',(req,res)=>{try{
 const d=o.load(),u=res.locals.viewer as User,a=o.auth(u,d),b=req.body as TreasuryRejectionCommand;
 if(!u||u.isActive===false||u.mustChangePassword||!a.effectivePermissions.canExecutePayment||!a.effectivePermissions[b?.action==='RESTORE'?'canRestoreTreasuryPayment':'canRejectTreasuryPayment'])fail('مجوز جاری رد یا بازگردانی پرداخت خزانه را ندارید.',403);
 const allowed=['action','reason','operationId','targets','treasuryUserId','actorId','actorUserId'];
 if(!b||typeof b!=='object'||Array.isArray(b)||Object.keys(b).some(k=>!allowed.includes(k))||!['REJECT','RESTORE'].includes(b.action)||typeof b.reason!=='string'||!b.reason.trim()||b.reason.trim().length>4000||typeof b.operationId!=='string'||!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(b.operationId)||!Array.isArray(b.targets)||!b.targets.length||b.targets.length>100)fail('اقدام، دلیل اجباری و شناسهٔ ثابت عملیات معتبر لازم است؛ اطلاعات مالی تغییر نمی‌کند.');
 const reason=b.reason.trim(),fingerprint=crypto.createHash('sha256').update(JSON.stringify(canonical({action:b.action,reason,targets:b.targets}))).digest('hex'),selected=new Set<RejectionRow>();
 const targets=b.targets.map(t=>{if(!t||typeof t!=='object'||Array.isArray(t)||Object.keys(t).some(k=>!['itemType','requestId','rowId','expectedVersion','expectedStatus'].includes(k))||!['ADVANCE','PAYMENT','BATCH_ITEM'].includes(t.itemType)||typeof t.requestId!=='string'||!t.requestId||(t.itemType==='BATCH_ITEM'?typeof t.rowId!=='string'||!t.rowId:t.rowId!==undefined)||!Number.isSafeInteger(t.expectedVersion)||t.expectedVersion<1||typeof t.expectedStatus!=='string')fail('رد یا بازگردانی فقط برای هدف ردیفی صریح با نسخه و وضعیت جاری مجاز است.');
  const x=correctionTarget(d,t);if(!x.row||!x.parent||x.row.requesterDeletedAt)fail('ردیف انتخاب‌شده یافت نشد.',404);const chain=chainStateError(x.row);if(chain)fail(chain,409);if(selected.has(x.row))fail('یک ردیف بیش از یک بار انتخاب شده است.');selected.add(x.row);
  if(!canSeeRequest(x.parent,u,d,a))fail('درخواست در شرکت یا محدودهٔ مجاز شما نیست.',403);if(x.row.treasuryRejections?.some(r=>r.schemaVersion!==1))fail('نسخهٔ سابقهٔ رد خزانه شناخته‌شده نیست؛ اقدام متوقف شد.',409);
  return {...x,target:t,row:x.row,parent:x.parent};});
 let seen=false;for(const row of rows(d))for(const r of row.treasuryRejections||[])for(const restore of [false,true]){if((restore?r.restoreOperationId:r.operationId)!==b.operationId)continue;seen=true;if((restore?'RESTORE':'REJECT')!==b.action||(restore?r.restoredById:r.byUserId)!==u.id||(restore?r.restoreFingerprint:r.fingerprint)!==fingerprint)fail('شناسهٔ عملیات قبلاً با محتوا یا هویت دیگری استفاده شده است.',409);}
 if(seen){if(!targets.every(x=>x.row.treasuryRejections?.some(r=>(b.action==='RESTORE'?r.restoreOperationId:r.operationId)===b.operationId)))fail('نتیجهٔ قبلی کامل و همساز نیست؛ بررسی لازم است.',409);return res.json({success:true,replayed:true,state:d});}
 for(const x of targets){if((x.row.version||1)!==x.target.expectedVersion||x.row.status!==x.target.expectedStatus)fail('نسخه یا وضعیت درخواست تغییر کرده؛ فهرست را تازه‌سازی کنید.',409);
  if(!(b.action==='REJECT'?treasuryRejectionEligible(x.row):treasuryRestoreEligible(x.row))||hasDeletionFinancialLinks(d,x.row.id)||!x.batch&&hasDeletionFinancialLinks(d,x.parent.id))fail('این اقدام فقط برای ردیف کاملاً پرداخت‌نشده و بدون فیش یا سابقهٔ پرداخت مجاز است.',409);
  if(b.action==='RESTORE'&&(x.row.treasuryRejections||[]).filter(r=>!r.restoredAt).length!==1)fail('سابقهٔ رد فعال همساز نیست؛ تطبیق لازم است.',409);
 }
 const at=new Date().toISOString(),batches=new Set<BatchPaymentRequest>();
 for(const x of targets){const row=x.row,previousStatus=row.status,version=(row.version||1)+1;
  if(b.action==='REJECT'){const r:TreasuryPaymentRejection={schemaVersion:1,id:crypto.randomUUID(),operationId:b.operationId,fingerprint,byUserId:u.id,byName:u.name,at,reason,fromPool:row.status==='In_Payment'?'IN_PAYMENT':'QUEUE'};(row.treasuryRejections||=[]).push(r);row.status='Rejected_Treasury';}
  else{Object.assign(activeTreasuryRejection(row)!,{restoredAt:at,restoredById:u.id,restoredByName:u.name,restoreReason:reason,restoreOperationId:b.operationId,restoreFingerprint:fingerprint});row.status='Pending_Treasury';}
  row.version=version;row.inPaymentAt=null;row.inPaymentBy=null;
  (row.auditHistory||=[]).push({id:'treasury-rejection-'+b.operationId+'-'+row.id,action:b.action==='REJECT'?'رد پرداخت توسط خزانه؛ تأییدهای قبلی و مبلغ محفوظ':'بازگردانی رد پرداخت به صف انتظار خزانه؛ بدون تغییر مالی',actorId:u.id,actorRole:u.role,changedBy:u.name,changedAt:at,stage:'TREASURY',previousStatus,version,reason});
  if(x.batch)batches.add(x.batch);
  o.notice(d,{eventType:b.action==='REJECT'?'TREASURY_PAYMENT_REJECTED':'TREASURY_PAYMENT_RESTORED',title:b.action==='REJECT'?'پرداخت در خزانه رد شد':'پرداخت به صف انتظار خزانه بازگشت',body:reason,trackingCode:x.parent.trackingCode,requestId:x.parent.id,...(x.batch?{rowId:row.id}:{}),itemType:x.target.itemType,recipientUserId:x.parent.requesterId,recipientRole:null,actorName:u.name,targetSection:'REQUESTER'});
 }
 for(const batch of batches)o.syncBatch(batch);const committed=o.save(d);
 return res.json({success:true,state:committed});
 }catch(e:any){return res.status(e.status||500).json({error:e.status?e.message:'ثبت اقدام خزانه انجام نشد؛ نتیجه را با همان شناسهٔ عملیات پیگیری کنید.'});}});}
