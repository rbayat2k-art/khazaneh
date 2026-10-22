import type {AppNotification,TreasuryDatabaseState,User} from '../types/treasury';
import {getUserRoles} from '../utils/user-roles';

/** An audience role never bypasses record visibility, including every receipt child. */
export function notificationVisible(n:Pick<AppNotification,'eventType'|'requestId'|'recipientUserId'|'recipientRole'|'receiptId'>,viewer:User,db:TreasuryDatabaseState,visible:(id:string)=>boolean):boolean{
  if(viewer.isActive===false||viewer.mustChangePassword)return false;
  if(viewer.role==='ADMIN')return true;
  if(n.recipientUserId?n.recipientUserId!==viewer.id:!n.recipientRole||!getUserRoles(viewer).includes(n.recipientRole))return false;
  if(n.eventType==='PAYMENT_EXECUTED'){
    // Old notices contain only the first target, which cannot prove visibility
    // of their aggregated amount. Keep them archived; fail closed for non-admin.
    const receipt=n.receiptId?db.receiptArchives.find(r=>r.id===n.receiptId):undefined;
    return Boolean(receipt?.relatedPaymentIds?.length&&receipt.relatedPaymentIds.every(visible));
  }
  return Boolean(n.requestId&&visible(n.requestId));
}
