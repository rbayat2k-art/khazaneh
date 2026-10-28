import {advanceApprovalChain} from './request-approval-chain';
import type {AdvanceRequest,PaymentRequest,BatchItem,ReviewStage,User} from '../types/treasury';
export type ReviewRow=AdvanceRequest|PaymentRequest|BatchItem;
export function rejectionEventId(row:Pick<ReviewRow,'reviewRejection'|'auditHistory'>):string|undefined{
 const rejection=row.reviewRejection;
 return rejection?.id||[...(row.auditHistory||[])].reverse().find(e=>e.decision==='REJECT'&&e.stage===rejection?.stage&&e.actorId===rejection?.byUserId)?.id;
}
export function ownsOpenRejection(row:Pick<ReviewRow,'status'|'reviewRejection'>,userId:string,stage:ReviewStage):boolean{
  const rejected=row.reviewRejection;
  return row.status==='Rejected'&&!!rejected&&rejected.byUserId===userId&&rejected.stage===stage&&!!rejected.reason&&!!rejected.at&&!rejected.resolvedAt&&!rejected.closedAt;
}
export function rejectionDescription(row:Pick<ReviewRow,'status'|'reviewRejection'>):string{
  const rejected=row.reviewRejection;if(!rejected||!['Rejected','Closed'].includes(row.status||''))return '';
  return row.status==='Closed'?`بسته‌شده؛ علت: ${rejected.closeReason||''}`:`ردشده توسط ${rejected.byName} (${rejected.stage==='APPROVER'?'سرپرست':'حسابداری'})؛ علت: ${rejected.reason}`;
}
/** Content version is unchanged: these decisions do not edit the approved financial content. */
export function applyRejectionDecision(row:ReviewRow,action:'REJECT'|'CLOSE_REJECTED'|'APPROVE',stage:ReviewStage,actor:Pick<User,'id'|'name'|'role'>,reason:string,at:string):void{
  row.reviewStartedAt ||= new Date().toISOString();
  if(action==='REJECT'){
    row.status='Rejected';row.reviewRejection={id:crypto.randomUUID(),byUserId:actor.id,byName:actor.name,stage,reason,at};
  }else if(action==='CLOSE_REJECTED'){
    row.status='Closed';row.reviewRejection={...row.reviewRejection!,closedAt:at,closeReason:reason};
  }else{
    row.reviewRejection={...row.reviewRejection!,resolvedAt:at};
    row.status=stage==='APPROVER'?'Pending_Accounting':'Pending_Treasury';
    row.approvedAmount ??=row.amount;row.invalidatedPriorApproval=false;
    if(stage==='APPROVER')Object.assign(row,{approverId:actor.id,approverName:actor.name,approverNote:'تأیید مجدد پس از رد درخواست',approvedBySupervisorUserId:actor.id,approvedBySupervisorName:actor.name,approvedBySupervisorAt:at,approvedByApproverAt:at,approverDecidedAt:at,approverApprovedVersion:row.version||1,approverDecisionVersion:row.version||1});
    else Object.assign(row,{accountingId:actor.id,accountingName:actor.name,accountingNote:'تأیید مجدد پس از رد درخواست',approvedByAccountingUserId:actor.id,approvedByAccountingName:actor.name,approvedByAccountingAt:at,accountingDecidedAt:at,accountingApprovedVersion:row.version||1,accountingDecisionVersion:row.version||1});
  }
  if(action==='APPROVE'&&stage==='APPROVER'&&row.approvalChain)advanceApprovalChain(row,actor,at);
  (row.auditHistory||=[]).push({id:crypto.randomUUID(),actorId:actor.id,actorRole:actor.role,stage,decision:action,version:row.version||1,action:action==='REJECT'?'رد درخواست':action==='CLOSE_REJECTED'?'بستن نهایی درخواست ردشده':'تأیید مجدد پس از رد درخواست',changedBy:actor.name,changedAt:at,...(reason?{reason}:{})});
}
