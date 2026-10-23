import type {AppNotification,TreasuryDatabaseState,ReceiptArchive} from '../types/treasury';
export type NotificationDraft=Omit<AppNotification,'id'|'createdAt'|'readByUserIds'>;
// A supported 200-row review produces up to 400 distinct notices in one commit.
export const NOTIFICATION_RETENTION=1000;
export function reviewedNotification(parent:any,row:any,itemType:AppNotification['itemType'],action:string,actorName:string,reason:string):NotificationDraft{
 const returned=action==='RETURN_FOR_REVISION',treasury=row.status==='Pending_Treasury';
 return {eventType:returned?'RETURNED_FOR_REVISION':treasury?'FINAL_APPROVED_ACCOUNTING':'APPROVED_SUPERVISOR',title:returned?'بازگشت درخواست برای اصلاح':treasury?'تأیید نهایی؛ آماده خزانه':'تأیید سرپرست؛ آماده حسابداری',body:returned?reason:'درخواست به مرحله بعد فرستاده شد.',trackingCode:parent.trackingCode,requestId:parent.id,rowId:itemType==='BATCH_ITEM'?row.id:undefined,itemType,recipientUserId:parent.requesterId,recipientRole:returned?null:treasury?'TREASURY':'ACCOUNTING',actorName,targetSection:returned?'REQUESTER':treasury?'TREASURY':'ACCOUNTING'};
}
/** Legacy mixed person/next-role drafts represent two separate audiences, never a public OR. */
export function notificationAudiences(payload:NotificationDraft):NotificationDraft[]{
 if(payload.recipientUserId&&['APPROVED_SUPERVISOR','FINAL_APPROVED_ACCOUNTING'].includes(payload.eventType)&&['ACCOUNTING','TREASURY'].includes(payload.recipientRole||''))return [
  {...payload,recipientUserId:null},
  {...payload,recipientRole:null,targetSection:'REQUESTER'},
 ];
 return [payload];
}
export function paymentNotificationDrafts(db:TreasuryDatabaseState,receipt:ReceiptArchive,actorName:string):NotificationDraft[]{
 const targets=new Map<string,{parent:any;row:any;kind:AppNotification['itemType']}>();
 for(const row of db.paymentRequests)targets.set(row.id,{parent:row,row,kind:'PAYMENT'});
 for(const row of db.advanceRequests)targets.set(row.id,{parent:row,row,kind:'ADVANCE'});
 for(const parent of db.batchPayments)for(const row of parent.items)targets.set(row.id,{parent,row,kind:'BATCH_ITEM'});
 const owners=new Map<string,{recipientUserId:string;ids:string[];amount:number;first:{parent:any;row:any;kind:AppNotification['itemType']}}>();
 for(const id of receipt.relatedPaymentIds){const t=targets.get(id);if(!t?.parent.requesterId)continue;const entries=(t.row.paymentHistory||t.row.paymentExecutions||[]).filter((e:any)=>e.receiptId===receipt.id);if(entries.length!==1||!Number.isSafeInteger(entries[0].amount)||entries[0].amount<=0)throw Error('Payment notification requires its exact committed execution.');const key=JSON.stringify([t.parent.requesterId,t.parent.companyId||t.parent.company||'']),owner=owners.get(key)||{recipientUserId:t.parent.requesterId,ids:[] as string[],amount:0,first:t};owner.ids.push(id);owner.amount+=entries[0].amount;if(!Number.isSafeInteger(owner.amount))throw Error('Invalid notification sum.');owners.set(key,owner);}
 return [...owners.values()].map(({recipientUserId,ids,amount,first:t})=>({eventType:'PAYMENT_EXECUTED',receiptId:receipt.id,relatedPaymentIds:ids,title:`ثبت پرداخت خزانه (${t.parent.trackingCode})`,body:`مبلغ ${amount.toLocaleString('fa-IR')} ریال بابت ${ids.length} درخواست / ردیف شما ثبت شد. تاریخ پرداخت: ${receipt.dateJalali}.`,trackingCode:t.parent.trackingCode,requestId:t.parent.id,rowId:t.kind==='BATCH_ITEM'?t.row.id:undefined,itemType:t.kind,recipientUserId,actorName,targetSection:'REQUESTER'}));
}
