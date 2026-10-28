import {chainStateError} from '../utils/request-approval-chain';
import type {TreasuryDatabaseState,User,TreasuryCorrection} from '../types/treasury';
import type {EffectiveAccess,AccessDecision} from './access-control';
import {type CorrectionRow,openTreasuryCorrection,fullyUnpaid,correctionApproverId} from '../utils/treasury-correction';
import {hasDeletionFinancialLinks} from '../utils/request-deletion';
import {bankFieldsError,normalizedBankFields} from '../utils/bank-identifiers';
import {invalidateBankInquiry} from '../utils/bank-inquiry';
export function correctionTarget(db:TreasuryDatabaseState,body:any){
 const batch=body.itemType==='BATCH_ITEM'?db.batchPayments.find(b=>!b.requesterDeletedAt&&b.id===body.requestId):undefined;
 const row:CorrectionRow|undefined=batch?batch.items.find(r=>r.id===body.rowId):body.itemType==='ADVANCE'?db.advanceRequests.find(r=>!r.requesterDeletedAt&&r.id===body.requestId):body.itemType==='PAYMENT'?db.paymentRequests.find(r=>!r.requesterDeletedAt&&r.id===body.requestId):undefined;
 return {row,parent:batch||row as TreasuryDatabaseState['paymentRequests'][number]|TreasuryDatabaseState['advanceRequests'][number]|undefined,batch};
}
const denied=(error='دسترسی جاری برای اصلاح این درخواست مجاز نیست.'):AccessDecision=>({status:403,error});
export function correctionInputError(body:any,returning:boolean):AccessDecision{
 const fields=returning?['itemType','requestId','rowId','expectedVersion','recipientStage','reason','treasuryUserId','actorId','actorUserId']:['itemType','requestId','rowId','expectedVersion','requesterId','description','accountOrCard','iban','bankName','newAttachments'];
 if(Object.keys(body).some(k=>!fields.includes(k))||!['PAYMENT','ADVANCE','BATCH_ITEM'].includes(body.itemType)||typeof body.requestId!=='string'||!body.requestId||(body.itemType==='BATCH_ITEM'?typeof body.rowId!=='string'||!body.rowId:body.rowId!==undefined))return {status:400,error:'در اصلاح فنی فقط هدف ردیفی و مشخصات فنی مجاز است؛ مبلغ، گیرنده و مرکز هزینه ثابت می‌مانند.'};
 if(returning&&(!['REQUESTER','APPROVER','ACCOUNTING'].includes(body.recipientStage)||typeof body.reason!=='string'||!body.reason.trim()||body.reason.length>4000))return {status:400,error:'گیرنده و علت عودت معتبر را وارد کنید.'};
 if(!returning&&(['description','accountOrCard','iban','bankName'].some(k=>body[k]!==undefined&&(typeof body[k]!=='string'||body[k].length>(k==='description'?4000:200)))))return {status:400,error:'مشخصات فنی معتبر نیست.'};
 return null;
}
export function correctionStageAllowed(user:User,stage:TreasuryCorrection['toStage'],auth:EffectiveAccess):boolean{
 const p=auth.effectivePermissions;
 return user.isActive!==false&&!user.mustChangePassword&&!!p.canViewRequests&&!!p.canResubmitRevision&&
  (stage==='REQUESTER'?!!p.canAccessRequesterSection:stage==='APPROVER'?!!p.canAccessApproverCartable:!!p.canAccessAccountingCartable);
}
export function correctionAdmission(body:any,returning:boolean,row:CorrectionRow,parent:any,viewer:User,auth:EffectiveAccess,db:TreasuryDatabaseState):AccessDecision{
 const chain=chainStateError(row);if(chain)return {status:409,error:chain};
 const invalid=correctionInputError(body,returning);if(invalid)return invalid;
 if(!returning&&(!openTreasuryCorrection(row)||row.treasuryCorrection!.toUserId!==viewer.id||!correctionStageAllowed(viewer,row.treasuryCorrection!.toStage,auth)))return denied('فقط گیرندهٔ ارجاع با مجوز جاری می‌تواند این اصلاح فنی را ارسال کند.');
 if(!Number.isSafeInteger(body.expectedVersion)||body.expectedVersion!==(row.version||1))return {status:409,error:'نسخه درخواست تغییر کرده است؛ فهرست را تازه‌سازی کنید.'};
 if(returning&&(!fullyUnpaid(row)||hasDeletionFinancialLinks(db,row.id)||!('items'in parent)&&hasDeletionFinancialLinks(db,parent.id)))return {status:409,error:'عودت فقط برای ردیف کاملاً پرداخت‌نشده و بدون سابقهٔ پرداخت مجاز است.'};
 if(!returning){
  // Do not create banking fields on the existing single-advance contract.
  if(body.itemType==='ADVANCE'&&['accountOrCard','iban','bankName'].some(k=>body[k]!==undefined))return {status:400,error:'این مساعده فقط توضیحات و مدارک اصلاحی دارد.'};
  const error=bankFieldsError({...row,...body},body.itemType==='PAYMENT'&&!(row as any).personnelBalanceRef||body.itemType==='BATCH_ITEM'&&parent.batchType!=='ADVANCE');if(error)return {status:400,error};
  if(row.paidAmount||row.paidAmountSoFar||row.paymentHistory?.length||row.paymentExecutions?.length||hasDeletionFinancialLinks(db,row.id))return {status:409,error:'این ردیف دارای سابقهٔ پرداخت است و از مسیر اصلاح فنی قابل اقدام نیست.'};
 }
 return null;
}
export function correctionRecipientId(parent:any,row:CorrectionRow,stage:TreasuryCorrection['toStage']):string|undefined{
 return stage==='REQUESTER'?parent.requesterId:stage==='APPROVER'?correctionApproverId(parent,row):row.approvedByAccountingUserId||undefined;
}
export function applyTreasuryReturn(row:CorrectionRow,parent:any,viewer:User,recipient:User,stage:TreasuryCorrection['toStage'],reason:string,at:string){
 const previousStatus=row.status as 'Pending_Treasury'|'In_Payment',version=row.version||1;
 row.treasuryCorrection={toUserId:recipient.id,toName:recipient.name,toStage:stage,byUserId:viewer.id,byName:viewer.name,reason,at,fromPool:previousStatus,approvedVersion:version};
 row.status='Needs_Revision';row.version=version+1;
 row.returnedReason=reason;row.returnedById=viewer.id;row.returnedByUserId=viewer.id;row.returnedByName=viewer.name;row.returnedByRole='TREASURY';row.returnedAt=at;
 row.auditHistory||=[];row.auditHistory.push({id:`treasury-return-${row.id}-${row.version}`,action:`عودت فنی خزانه به ${stage}؛ تأییدها محفوظ`,actorId:viewer.id,actorRole:viewer.role,changedBy:viewer.name,changedAt:at,stage:'TREASURY',decision:'RETURN_FOR_REVISION',previousStatus,version:row.version,reason});
}
export function applyTreasuryCorrection(row:CorrectionRow,body:any,actor:User,at:string){
 const fields=normalizedBankFields(body);
 if(body.itemType!=='ADVANCE')invalidateBankInquiry(row,fields);
 if(body.itemType!=='ADVANCE')for(const key of ['accountOrCard','iban','bankName'] as const)if(fields[key]!==undefined)(row as any)[key]=fields[key];
 if(body.description!==undefined){if(body.itemType==='ADVANCE')(row as any).reason=body.description;else (row as any).description=body.description;}
 if(body.newAttachments?.length)row.attachments=[...(row.attachments||[]),...body.newAttachments.map((f:any)=>({...f,uploadedAt:at,uploadedBy:actor.name}))];
 row.status='Pending_Treasury';row.version=(row.version||1)+1;row.treasuryCorrection!.resolvedAt=at;
 row.returnedReason=null;row.returnedById=null;row.returnedByUserId=null;row.returnedByRole=null;row.returnedByName=null;row.returnedAt=null;
 row.inPaymentAt=null;row.inPaymentBy=null;
 row.auditHistory||=[];row.auditHistory.push({id:`treasury-corrected-${row.id}-${row.version}`,action:'اصلاح فنی و ارسال مستقیم به خزانه؛ تأییدها محفوظ',actorId:actor.id,actorRole:actor.role,changedBy:actor.name,changedAt:at,stage:'TREASURY',decision:'RESUBMIT',previousStatus:'Needs_Revision',version:row.version});
}
