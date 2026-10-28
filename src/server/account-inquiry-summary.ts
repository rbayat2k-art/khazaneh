import type{User,TreasuryDatabaseState as DB}from'../types/treasury';
import type{AccountInquirySummary}from'../types/account-inquiry';
import{inquiryCanRead,inquiryReviewer,inquiryAccountant,accountInquiryNoticeVisible,type InquiryAuth}from'./account-inquiry-policy';
export function accountInquirySummary(db:DB,user:User,resolve:InquiryAuth,enabled:boolean):AccountInquirySummary|undefined{
 if(!enabled||db.accountInquirySchemaVersion!==2||user.isActive===false||user.mustChangePassword)return;
 const p=resolve(user,db).effectivePermissions;if(!['canShowInquiryMine','canShowInquiryApproval','canShowInquiryAccounting','canShowInquiryRelease','canShowInquiryHistory','canShowInquiryCreate'].some(k=>p[k as keyof typeof p]))return;
 const summary:AccountInquirySummary={mine:0,approval:0,accounting:0,release:0,history:0,mineNew:0,historyNew:0,pending:0},pending=new Set<string>(),mineNew=new Set<string>(),historyNew=new Set<string>();
 const notices=new Set((db.notifications||[]).filter(n=>n.accountInquiryRef&&!n.readByUserIds.includes(user.id)&&accountInquiryNoticeVisible(n,user,db)).map(n=>n.accountInquiryRef!.inquiryId+':'+n.accountInquiryRef!.rowId));
 for(const q of db.accountInquiries||[]){if(!inquiryCanRead(user,q,db,resolve))continue;for(const row of q.rows){const key=q.id+':'+row.id,isMine=q.requesterId===user.id;
  if(p.canShowInquiryHistory){summary.history++;if(notices.has(key))historyNew.add(key);}
  if(isMine&&p.canShowInquiryMine){summary.mine++;if(notices.has(key)||row.status==='NEEDS_REVISION')mineNew.add(key);if(row.status==='NEEDS_REVISION'||notices.has(key))pending.add(key);}
  if(p.canShowInquiryApproval&&row.status==='PENDING_APPROVER'&&inquiryReviewer(user,q,db,resolve)){summary.approval++;pending.add(key);}
  if(p.canShowInquiryAccounting&&row.status==='PENDING_ACCOUNTING'&&inquiryAccountant(user,q,db,resolve)){summary.accounting++;pending.add(key);}
  if(p.canShowInquiryRelease&&p.canReleaseAccountInquiry&&row.status==='AWAITING_RELEASE'&&inquiryReviewer(user,q,db,resolve)){summary.release++;pending.add(key);}
  if(p.canShowInquiryHistory&&notices.has(key))pending.add(key);
 }}
 summary.mineNew=mineNew.size;summary.historyNew=historyNew.size;summary.pending=pending.size;return summary;
}
