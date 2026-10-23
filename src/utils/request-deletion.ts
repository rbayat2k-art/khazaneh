import type {BatchPaymentRequest,TreasuryDatabaseState,User} from '../types/treasury';
import {canEditSubmittedRequest,type EditableRequestRow,type SubmittedRequestEdit} from './request-edit';
export type SubmittedRequestDelete=Omit<SubmittedRequestEdit,'changes'>;
export function canDeleteSubmittedRequest(row:EditableRequestRow,supervisorId:string|null|undefined,requesterId:string):boolean{
  return !row.requesterDeletedAt&&canEditSubmittedRequest(row,supervisorId,requesterId)&&
    !['receiptId','sourceBankAccountId','sourceAccountSnapshot','paidDateJalali','paidBankName'].some(key=>Boolean((row as any)[key]))&&
    !row.paymentHistory?.length&&!row.paymentExecutions?.length;
}
export function markRequesterDeleted(row:EditableRequestRow,actor:Pick<User,'id'|'role'>,at:string):void{
  const previousStatus=row.status;row.requesterDeletedAt=at;row.requesterDeletedBy=actor.id;row.status='Closed';row.version=(row.version||1)+1;
  row.auditHistory!.push({id:`delete-${row.id}-${row.version}`,action:'حذف درخواست توسط ثبت‌کننده پیش از رسیدگی',changedBy:'متقاضی',actorId:actor.id,actorRole:actor.role,stage:'REQUESTER',decision:'DELETE_SUBMITTED',version:row.version,previousStatus,changedAt:at});
}
/** Private archive never travels in direct batch replies or public state. */
export function publicBatch(batch:BatchPaymentRequest):BatchPaymentRequest{
  if(!Object.hasOwn(batch,'deletedItems'))return batch;
  const {deletedItems:_private,...active}=batch;return active;
}
/** Called once per immutable revision by the existing response sanitizer/cache. */
type RetainedIds={deleted:ReadonlySet<string>;changedGroups:ReadonlySet<string>};
const deletedIds=new WeakMap<TreasuryDatabaseState,RetainedIds>();
function retainedIds(db:TreasuryDatabaseState):RetainedIds{
  const cached=deletedIds.get(db);if(cached)return cached;const deleted=new Set<string>(),changedGroups=new Set<string>();
  for(const pool of [db.advanceRequests,db.paymentRequests,db.batchPayments])for(const row of pool)if(row.requesterDeletedAt)deleted.add(row.id);
  for(const batch of db.batchPayments)if(batch.deletedItems?.length){changedGroups.add(batch.id);for(const row of batch.deletedItems)deleted.add(row.id);}
  const result={deleted,changedGroups};if(Object.isFrozen(db))deletedIds.set(db,result);return result;
}
export function isDeletedNotificationTarget(n:{eventType?:string;requestId?:string;rowId?:string|null},db:TreasuryDatabaseState):boolean{
  const {deleted,changedGroups}=retainedIds(db);return deleted.has(n.requestId||'')||deleted.has(n.rowId||'')||n.eventType==='REQUEST_SUBMITTED'&&!n.rowId&&changedGroups.has(n.requestId||'');
}
export function activeRequestProjection(db:TreasuryDatabaseState):TreasuryDatabaseState{
  const {deleted,changedGroups}=retainedIds(db);
  if(!deleted.size&&!db.batchPayments.some(b=>Object.hasOwn(b,'deletedItems')))return db;
  return {...db,advanceRequests:db.advanceRequests.filter(r=>!r.requesterDeletedAt),paymentRequests:db.paymentRequests.filter(r=>!r.requesterDeletedAt),batchPayments:db.batchPayments.filter(r=>!r.requesterDeletedAt).map(publicBatch),notifications:(db.notifications||[]).filter(n=>!deleted.has(n.requestId||'')&&!deleted.has(n.rowId||'')&&!(n.eventType==='REQUEST_SUBMITTED'&&!n.rowId&&changedGroups.has(n.requestId||'')))};
}
export function hasDeletionFinancialLinks(db:TreasuryDatabaseState,id:string):boolean{
  return db.receiptArchives.some(r=>r.relatedPaymentIds?.includes(id))||db.dailyCovers.some(r=>r.advanceRequestIds?.includes(id)||r.paymentRequestIds?.includes(id));
}
