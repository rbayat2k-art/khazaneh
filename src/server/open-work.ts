import {balanceAccessChangeBlock} from './personnel-balance-policy';
import {inquiryAccessChangeBlock}from'./account-inquiry-policy';
import {chainStepIds,currentSupervisorId} from '../utils/request-approval-chain';
import type {TreasuryDatabaseState,User} from '../types/treasury';
import {canSeeRequest,type EffectiveAccess} from './access-control';
import {companyPolicy} from './company-access';
import {openTreasuryCorrection} from '../utils/treasury-correction';
import {getUserRoles} from '../utils/user-roles';
import {rejectionEventId} from '../utils/review-rejection';
import {requestApproverError} from './request-approval-routing';
import {REQUEST_APPROVAL_TYPES} from '../utils/request-approval-routing';

export type WorkKind='CHAIN_DEPENDENCY'|'APPROVER'|'ACCOUNTING'|'TREASURY'|'TREASURY_REJECTED'|'REQUESTER_OPEN'|'REVISION'|'REJECTION'|'CORRECTION_RECIPIENT'|'CORRECTION_REFERRER';
export const workLabels:Record<WorkKind,string>={CHAIN_DEPENDENCY:'مسئولیت مسیر تأیید چندمرحله‌ای',APPROVER:'منتظر سرپرست',ACCOUNTING:'منتظر حسابداری',TREASURY:'منتظر اقدام خزانه',TREASURY_REJECTED:'رد پرداخت؛ منتظر تعیین تکلیف خزانه',REQUESTER_OPEN:'درخواست بازِ ثبت‌کننده',REVISION:'اصلاح متقاضی',REJECTION:'ردشدهٔ باز',CORRECTION_RECIPIENT:'اصلاح فنیِ ارجاع‌شده',CORRECTION_REFERRER:'منتظر بازگشت اصلاح فنی'};
export type WorkItem={itemType:'PAYMENT'|'ADVANCE'|'BATCH_ITEM';requestId:string;rowId?:string;kind:WorkKind;parent:any;row:any;stage?:'REQUESTER'|'APPROVER'|'ACCOUNTING'};
export type AuthResolver=(user:User,db:TreasuryDatabaseState)=>EffectiveAccess;

export function financialWorkRows(db:TreasuryDatabaseState):WorkItem[]{
 const rows:WorkItem[]=[];
 for(const [itemType,pool] of [['PAYMENT',db.paymentRequests],['ADVANCE',db.advanceRequests],['BATCH_ITEM',db.batchPayments]] as const){
  for(const parent of pool||[]){if(parent.requesterDeletedAt)continue;for(const row of 'items'in parent?parent.items:[parent])if(!row.requesterDeletedAt&&!['Paid','Closed'].includes(row.status||parent.status))rows.push({itemType,requestId:parent.id,...(itemType==='BATCH_ITEM'?{rowId:row.id}:{}),kind:'REVISION',parent,row});}
 }
 return rows;
}

function capabilities(work:WorkItem,user:User,db:TreasuryDatabaseState,auth:EffectiveAccess):Set<string>{
 const p=auth.effectivePermissions,result=new Set<string>();
 if(user.isActive===false||!canSeeRequest(work.kind==='CHAIN_DEPENDENCY'?{...work.parent,supervisorId:user.id}:work.parent,user,db,auth))return result;
 result.add('view');
 if(work.kind==='TREASURY_REJECTED'){if(p.canExecutePayment&&p.canRestoreTreasuryPayment)result.add('restore');if(p.canAccessTreasuryRejected)result.add('stage');return result;}
 if(work.kind==='CORRECTION_REFERRER'||work.kind==='TREASURY'){
  if(p.canExecutePayment)result.add('execute');
  if(work.kind==='TREASURY'&&(user.role==='ADMIN'||auth.effectivePaymentLimitRial>0))result.add('payment-limit');
  const remaining=Number(work.row.approvedAmount??work.row.amount)-Number(work.row.paidAmountSoFar??work.row.paidAmount??0);
  if(work.kind==='TREASURY'&&(user.role==='ADMIN'||auth.effectivePaymentLimitRial>=remaining))result.add('full-payment');
 }else if(work.kind==='REQUESTER_OPEN'||work.kind==='REVISION'||work.kind==='CORRECTION_RECIPIENT'){
  if(p.canResubmitRevision)result.add('resubmit');
  if(work.kind==='CORRECTION_RECIPIENT'&&p[work.stage==='APPROVER'?'canAccessApproverCartable':work.stage==='ACCOUNTING'?'canAccessAccountingCartable':'canAccessRequesterSection'])result.add('stage');
 }else{
  const stage=work.kind==='ACCOUNTING'?'ACCOUNTING':work.kind==='REJECTION'?work.stage:'APPROVER';
  if(p[stage==='ACCOUNTING'?'canAccessAccountingCartable':'canAccessApproverCartable'])result.add('stage');
  if(p.canApprove)result.add('approve');
  if(p.canReturnForRevision)result.add('return');
  if(user.role==='ADMIN'||auth.effectiveApprovalLimitRial>=Number(work.row.approvedAmount??work.row.amount))result.add('approval-limit');
 }
 return result;
}

/** Open assignments include waiting-on-another-person dependencies, not history. */
export function openWorkFor(db:TreasuryDatabaseState,user:User,auth:EffectiveAccess,rows=financialWorkRows(db)):WorkItem[]{
 const result:WorkItem[]=[],p=auth.effectivePermissions;
 for(const base of rows){const {row,parent}=base,status=row.status||parent.status;
  const add=(kind:WorkKind,stage?:WorkItem['stage'])=>result.push({...base,kind,stage});
  if(chainStepIds(row).includes(user.id)&&currentSupervisorId(parent,row)!==user.id)add('CHAIN_DEPENDENCY','APPROVER');
  if(parent.requesterId===user.id&&status!=='Needs_Revision')add('REQUESTER_OPEN');
  // Accounting can still return the request for a sensitive change requiring
  // this pinned supervisor again, even after the first approval was completed.
  if(status==='Pending_Accounting'&&currentSupervisorId(parent,row)===user.id)add('APPROVER');
  if(openTreasuryCorrection(row)){
   if(row.treasuryCorrection.toUserId===user.id)add('CORRECTION_RECIPIENT',row.treasuryCorrection.toStage);
   if(row.treasuryCorrection.byUserId===user.id)add('CORRECTION_REFERRER');
  }else if(status==='Needs_Revision'){
   if(parent.requesterId===user.id)add('REVISION');
   // A normal resubmission may require this pinned supervisor again.
   if(currentSupervisorId(parent,row)===user.id)add('APPROVER');
  }else if(status==='Rejected'&&row.reviewRejection?.byUserId===user.id&&!row.reviewRejection.resolvedAt&&!row.reviewRejection.closedAt)add('REJECTION',row.reviewRejection.stage);
  else if(status==='Pending_Approver'&&currentSupervisorId(parent,row)===user.id)add('APPROVER');
  else if(status==='Pending_Accounting'&&parent.requesterId!==user.id&&p.canAccessAccountingCartable&&p.canViewRequests&&canSeeRequest(parent,user,db,auth))add('ACCOUNTING');
  else if(['Pending_Treasury','In_Payment'].includes(status)&&p.canExecutePayment&&p.canViewRequests&&canSeeRequest(parent,user,db,auth))add('TREASURY');
  else if(status==='Rejected_Treasury'&&p.canExecutePayment&&p.canRestoreTreasuryPayment&&p.canViewRequests&&canSeeRequest(parent,user,db,auth))add('TREASURY_REJECTED');
 }
 return result;
}

export function openWorkDto(work:WorkItem){
 const {row,parent}=work;
 return {itemType:work.itemType,requestId:work.requestId,...(work.rowId?{rowId:work.rowId}:{}),kind:work.kind,label:workLabels[work.kind],trackingCode:parent.trackingCode||parent.id,status:row.status||parent.status,expectedVersion:row.version||1,stage:work.stage,ownerId:row.reviewRejection?.byUserId,rejectionId:rejectionEventId(row),correction:openTreasuryCorrection(row)?{toUserId:row.treasuryCorrection.toUserId,byUserId:row.treasuryCorrection.byUserId,toStage:row.treasuryCorrection.toStage}:undefined};
}

/** Called inside the single-writer turn against the actual proposed state. */
export function accessChangeBlock(before:TreasuryDatabaseState,after:TreasuryDatabaseState,ids:string[],resolve:AuthResolver){
 const balanceBlock=balanceAccessChangeBlock(before,after,ids,resolve);if(balanceBlock)return balanceBlock;
 const inquiryBlock=inquiryAccessChangeBlock(before,after,ids,resolve);if(inquiryBlock)return inquiryBlock;
 const rows=financialWorkRows(before),blocked:WorkItem[]=[],users=new Set<string>();let subordinateCount=0,configuredRouteCount=0;
 for(const id of ids){
  const old=before.users.find(u=>u.id===id),next=after.users.find(u=>u.id===id);if(!old||!next)continue;
  const oldAuth=resolve(old,before),newAuth=resolve(next,after),oldRoles=getUserRoles(old),removed=oldRoles.some(r=>!getUserRoles(next).includes(r));
  for(const work of openWorkFor(before,old,oldAuth,rows)){
   const prev=capabilities(work,old,before,oldAuth),future=capabilities(work,next,after,newAuth);
   const pinned=['CHAIN_DEPENDENCY','APPROVER','REQUESTER_OPEN','REVISION','REJECTION','CORRECTION_RECIPIENT','CORRECTION_REFERRER'].includes(work.kind);
   if([...prev].some(cap=>!future.has(cap))||pinned&&(next.isActive===false&&old.isActive!==false||removed&&future.size===0)) {blocked.push(work);users.add(id);}
  }
  // Empty financial queues do not make existing subordinate routing disposable.
  for(const subordinate of before.users.filter(u=>u.supervisorId===id)){
   const oldCompany=companyPolicy(old,before).has(subordinate.company),nextCompany=companyPolicy(next,after).has(subordinate.company),n=newAuth.effectivePermissions;
   const oldCan=old.isActive!==false&&oldCompany&&oldAuth.effectivePermissions.canApprove&&oldAuth.effectivePermissions.canAccessApproverCartable;
   const nextCan=next.isActive!==false&&nextCompany&&n.canApprove&&n.canAccessApproverCartable&&n.canViewRequests&&newAuth.effectiveAccessScope!=='SELF_ONLY'&&newAuth.effectiveApprovalLimitRial>0&&(newAuth.effectiveAccessScope!=='DEPARTMENT'||next.company===subordinate.company&&next.department===subordinate.department);
   if(oldCan&&!nextCan&&after.users.some(u=>u.id===subordinate.id&&u.supervisorId===id)){subordinateCount++;users.add(id);}
  }
  for(const owner of before.users)for(const {key}of REQUEST_APPROVAL_TYPES)if(owner.requestApprovers?.[key]===id){
   const futureOwner=after.users.find(u=>u.id===owner.id);
   if(futureOwner?.requestApprovers?.[key]===id&&!requestApproverError(owner,old,before,resolve)&&requestApproverError(futureOwner,next,after,resolve)){configuredRouteCount++;users.add(id);}
  }
 }
 if(!blocked.length&&!subordinateCount&&!configuredRouteCount)return null;
 const counts:Partial<Record<WorkKind,number>>={};for(const w of blocked)counts[w.kind]=(counts[w.kind]||0)+1;
 const summary=Object.entries(counts).map(([kind,n])=>`${workLabels[kind as WorkKind]}: ${n}`).join('، ');
 return {code:'OPEN_WORK_BLOCKS_ACCESS_CHANGE',error:`تغییر دسترسی انجام نشد؛ ابتدا کارهای باز وابسته تعیین تکلیف شوند${summary?` (${summary})`:''}${subordinateCount?`؛ سرپرست ${subordinateCount} کاربر نیز باید جداگانه تعیین شود`:''}${configuredRouteCount?`؛ ${configuredRouteCount} تنظیم تأییدکنندهٔ اختصاصی نیز در فرم کاربران باید تعیین تکلیف شود`:''}. مدیر اصلی می‌تواند از «بررسی کارهای باز» موارد را مشاهده کند.`,openWorkCount:blocked.length,subordinateCount,configuredRouteCount,affectedUserCount:users.size,counts};
}
