import type {AppNotification,TreasuryDatabaseState,User,RolePermissionSet} from '../types/treasury';
import {notificationAddressed} from '../utils/notification-audience';
import {isDeletedNotificationTarget} from '../utils/request-deletion';

/** Queue membership is not authority to open the stage's workspace. */
export function notificationQueueAllowed(n:Pick<AppNotification,'recipientRole'|'eventType'|'targetSection'>,p:Partial<RolePermissionSet>):boolean{
 if(!['REQUEST_SUBMITTED','REQUEST_RESUBMITTED','APPROVED_SUPERVISOR','FINAL_APPROVED_ACCOUNTING'].includes(n.eventType))return true;
 const stage=n.targetSection==='REQUESTER'?'REQUESTER':n.recipientRole||n.targetSection;
 return stage==='ACCOUNTING'?p.canAccessAccountingCartable===true:stage==='TREASURY'?p.canAccessTreasuryWorkspace===true||p.canViewTreasuryQueue===true:stage==='APPROVER'?p.canAccessApproverCartable===true:true;
}

/** An audience role never bypasses record visibility, including every receipt child. */
export function notificationVisible(n:Pick<AppNotification,'eventType'|'requestId'|'rowId'|'recipientUserId'|'recipientRole'|'receiptId'|'relatedPaymentIds'>,viewer:User,db:TreasuryDatabaseState,visible:(id:string)=>boolean,adminObservation=true):boolean{
  if(isDeletedNotificationTarget(n,db))return false;
  if(viewer.isActive===false||viewer.mustChangePassword)return false;
  if(viewer.role==='ADMIN'&&adminObservation)return true;
  if(!notificationAddressed(n,viewer))return false;
  if(n.eventType==='PAYMENT_EXECUTED'){
    // Old notices contain only the first target, which cannot prove visibility
    // of their aggregated amount. Keep them archived; fail closed for non-admin.
    const receipt=n.receiptId?db.receiptArchives.find(r=>r.id===n.receiptId):undefined;
    const targets=n.relatedPaymentIds||receipt?.relatedPaymentIds;
    return Boolean(receipt?.relatedPaymentIds?.length&&targets?.length&&targets.every(id=>receipt.relatedPaymentIds.includes(id)&&!isDeletedNotificationTarget({requestId:id},db)&&visible(id)));
  }
  return Boolean(n.requestId&&visible(n.requestId));
}
/** Observation grants never select a phone, desktop alert or personal notification. */
export function notificationDeliveryEligible(n:Parameters<typeof notificationVisible>[0],viewer:User,db:TreasuryDatabaseState,visible:(id:string)=>boolean):boolean{
 return notificationAddressed(n,viewer)&&notificationVisible(n,viewer,db,visible,false);
}
