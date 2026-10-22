import type { AdvanceRequest, AttachmentFile, BatchItem, PaymentRequest } from '../types/treasury';
import {bankFieldsError,normalizedBankFields} from './bank-identifiers';

export type SubmittedEditKind = 'ADVANCE' | 'PAYMENT' | 'BATCH_ITEM';
export type EditableRequestRow = AdvanceRequest | PaymentRequest | BatchItem;
export type SubmittedRequestChanges = {
  amount?: number; description?: string; payeeName?: string; accountOrCard?: string;
  iban?: string; bankName?: string; invoiceNumber?: string; costCenter?: string;
  requestedMonth?: string; suggestedDate?: string; dueDate?: string;
  priority?: 'Normal' | 'Urgent'; attachments?: AttachmentFile[];
};
export type SubmittedRequestEdit = {
  requesterId: string; itemType: SubmittedEditKind; requestId: string; rowId?: string;
  expectedVersion: number; changes: SubmittedRequestChanges;
};

/** Read-only projection used by both the server and requester UI. Unknown history fails closed. */
export function canEditSubmittedRequest(row: EditableRequestRow, supervisorId: string | null | undefined, requesterId: string): boolean {
  if (row.status !== (supervisorId ? 'Pending_Approver' : 'Pending_Accounting')) return false;
  if (row.reviewStartedAt || row.isResubmitted || row.invalidatedPriorApproval || row.comments?.length) return false;
  const markers = ['approverId','approverName','approverNote','approverDecidedAt','approvedByApproverAt','approverApprovedVersion','approverDecisionVersion','approvedBySupervisorUserId','approvedBySupervisorAt','accountingId','accountingName','accountingNote','accountingDecidedAt','approvedByAccountingUserId','approvedByAccountingAt','returnedReason','returnedById','returnedByUserId','returnedByRole','returnedAt','rejectionReason','paidAt','paidAmountSoFar','paidAmount','inPaymentAt'];
  if (markers.some(key => Boolean((row as any)[key]))) return false;
  if (!row.auditHistory?.length) return false;
  return row.auditHistory.every(entry => (!entry.stage || entry.stage === 'REQUESTER') && (
    ((entry.decision === 'SUBMIT' || entry.decision === 'EDIT_SUBMITTED') && entry.actorId === requesterId && entry.stage === 'REQUESTER') || (!entry.decision && ['ثبت اولیه درخواست مساعده','ثبت اولیه دستور پرداخت','ثبت اولیه دستور پرداخت تکی','ثبت اولیه ردیف در گروه'].includes(entry.action))
  ));
}

/** First accepted reviewer action, not a GET/view. Persisted in the same write as its outcome. */
export function markReviewStarted(row: EditableRequestRow): void {
  row.reviewStartedAt ||= new Date().toISOString();
}

export function validateSubmittedChanges(changes: unknown, kind: SubmittedEditKind, row: EditableRequestRow): string | null {
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) return 'اطلاعات ویرایش معتبر نیست.';
  const common=['amount','description','attachments'];
  const fields=kind === 'ADVANCE' ? [...common,'requestedMonth','suggestedDate'] : [...common,'payeeName','accountOrCard','iban','bankName','invoiceNumber','costCenter',...(kind === 'PAYMENT' ? ['dueDate','priority'] : ['requestedMonth'])];
  const entries=Object.entries(changes);
  if (!entries.length || entries.some(([key])=>!fields.includes(key))) return 'فقط اطلاعات فرم قابل ویرایش است؛ وضعیت و ارجاع تغییر نمی‌کند.';
  for (const [key,value] of entries) {
    if (key === 'amount') {if (!Number.isSafeInteger(value) || Number(value)<=0) return 'مبلغ باید عدد صحیح مثبت به ریال باشد.';}
    else if (key === 'priority') {if (!['Normal','Urgent'].includes(String(value))) return 'اولویت معتبر نیست.';}
    else if (key === 'attachments') {
      if (!Array.isArray(value) || value.length>50 || new Set(value.map(f=>f?.id)).size!==value.length) return 'فهرست پیوست‌ها معتبر نیست.';
      for(const file of value){
        if (!file || typeof file.id!=='string' || typeof file.name!=='string' || typeof file.url!=='string' || typeof file.type!=='string' || !Number.isSafeInteger(file.size) || file.size<0) return 'اطلاعات پیوست معتبر نیست.';
        const prior=row.attachments?.find(f=>f.id===file.id);
        if (prior) {if(JSON.stringify(file)!==JSON.stringify(prior))return 'اطلاعات پیوست موجود قابل بازنویسی نیست.';}
        else if (Object.keys(file).some(key=>!['id','name','size','type','url','uploadedAt','uploadedBy'].includes(key)) || file.id.length>255 || file.name.length>255 || !/^data:(image\/(png|jpeg|webp|gif)|application\/pdf);base64,[a-z\d+/=\s]+$/i.test(file.url) || file.size>10*1024*1024 || file.url.length>14*1024*1024) return 'پیوست جدید باید تصویر یا PDF معتبر، حداکثر۱۰مگابایت باشد.';
      }
    } else if (typeof value!=='string' || value.length>4000 || (['description','payeeName','requestedMonth'].includes(key) && !value.trim())) return 'فیلد متنی الزامی یا قالب اطلاعات معتبر نیست.';
  }
  if(kind!=='ADVANCE')return bankFieldsError({...row,...changes as object} as SubmittedRequestChanges);
  return null;
}

export function applySubmittedChanges(row: EditableRequestRow, changes: SubmittedRequestChanges, kind: SubmittedEditKind, requesterId: string): void {
  const next=normalizedBankFields({...changes}) as Record<string,unknown>;
  if(changes.attachments)next.attachments=changes.attachments.map(file=>row.attachments?.find(prior=>prior.id===file.id)||{...file,uploadedAt:new Date().toISOString(),uploadedBy:requesterId});
  if (kind==='ADVANCE' && 'description' in next) {next.reason=next.description;delete next.description;}
  Object.assign(row,next);
  if (changes.amount!==undefined && row.approvedAmount!==undefined && row.approvedAmount!==null) row.approvedAmount=changes.amount;
  row.version=(row.version || 1)+1;
  row.requesterEditedAt=new Date().toISOString();
  row.auditHistory!.push({id:`edit-${row.id}-${row.version}`,action:'ویرایش درخواست پیش از شروع بررسی',changedBy:'متقاضی',actorId:requesterId,stage:'REQUESTER',decision:'EDIT_SUBMITTED',version:row.version,changedAt:row.requesterEditedAt});
}
