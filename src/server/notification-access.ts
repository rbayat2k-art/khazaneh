import {balanceNoticeVisible,type BalanceAuth} from './personnel-balance-policy';
import {chainNoticeCurrent} from '../utils/chain-notice-current';
import {accountInquiryNoticeVisible}from'./account-inquiry-policy';
export {chainNoticeCurrent} from '../utils/chain-notice-current';
import type {AppNotification,TreasuryDatabaseState,User,RolePermissionSet} from '../types/treasury';
import {notificationAddressed} from '../utils/notification-audience';
import {isDeletedNotificationTarget} from '../utils/request-deletion';

/** Queue membership is not authority to open the stage's workspace. */
export function notificationQueueAllowed(n:Pick<AppNotification,'recipientRole'|'eventType'|'targetSection'|'accountInquiryRef'|'personnelBalanceRef'>,p:Partial<RolePermissionSet>):boolean{
  if(n.personnelBalanceRef)return p.canViewPersonnelBalances===true&&(n.personnelBalanceRef.purpose!=='ACCOUNTING'||p.canReviewPersonnelBalance===true&&p.canAccessAccountingCartable===true&&p.canApprove===true);
  if(n.accountInquiryRef){const purpose=n.accountInquiryRef.purpose;return purpose==='APPROVE'?p.canApproveAccountInquiry===true:purpose==='RESPOND'?p.canRespondAccountInquiry===true:purpose==='RELEASE'?p.canReleaseAccountInquiry===true:!!(p.canRequestOwnAccountInquiry||p.canRequestOthersAccountInquiry||p.canRequestLinkedAccountInquiry||p.canManageAccountInquiries||p.canApproveAccountInquiry||p.canReleaseAccountInquiry||p.canRespondAccountInquiry);}
 if(!['REQUEST_SUBMITTED','REQUEST_RESUBMITTED','APPROVED_SUPERVISOR','FINAL_APPROVED_ACCOUNTING'].includes(n.eventType))return true;
 const stage=n.targetSection==='REQUESTER'?'REQUESTER':n.recipientRole||n.targetSection;
 return stage==='ACCOUNTING'?p.canAccessAccountingCartable===true:stage==='TREASURY'?p.canAccessTreasuryWorkspace===true||p.canViewTreasuryQueue===true:stage==='APPROVER'?p.canAccessApproverCartable===true:true;
}

/** An audience role never bypasses record visibility, including every receipt child. */
export function notificationVisible(n:Pick<AppNotification,'approvalChainStage'|'itemType'|'eventType'|'requestId'|'rowId'|'recipientUserId'|'recipientRole'|'receiptId'|'relatedPaymentIds'|'accountInquiryRef'|'personnelBalanceRef'>,viewer:User,db:TreasuryDatabaseState,visible:(id:string)=>boolean,adminObservation=true,resolve?:BalanceAuth):boolean{
  if(n.personnelBalanceRef)return balanceNoticeVisible(n,viewer,db,resolve);
  if(n.accountInquiryRef)return accountInquiryNoticeVisible(n,viewer,db);
  if(isDeletedNotificationTarget(n,db))return false;
  if(viewer.isActive===false||viewer.mustChangePassword)return false;
  if(viewer.role==='ADMIN'&&adminObservation)return true;
  if(!chainNoticeCurrent(n,db))return false;
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
export function notificationDeliveryEligible(n:Parameters<typeof notificationVisible>[0],viewer:User,db:TreasuryDatabaseState,visible:(id:string)=>boolean,resolve?:BalanceAuth):boolean{
 return notificationAddressed(n,viewer)&&notificationVisible(n,viewer,db,visible,false,resolve);
}

