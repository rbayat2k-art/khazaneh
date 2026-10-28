import type {TreasuryDatabaseState as DB,User,AppNotification} from '../types/treasury';
import type {PersonnelBalanceRequest as Balance,PersonnelBalanceSummary} from '../types/personnel-balance';
import type {EffectiveAccess} from './access-control';
import {companyPolicy} from './company-access';

export type BalanceAuth=(user:User,db:DB)=>EffectiveAccess;
export const balanceEnabled=()=>process.env.TREASURY_PERSONNEL_BALANCES_ENABLED==='true';
const active=(u:User)=>u.isActive!==false&&!u.mustChangePassword;
export function balanceCanRead(u:User,q:Balance,db:DB,resolve:BalanceAuth){
 const a=resolve(u,db),p=a.effectivePermissions;
 if(!active(u)||!p.canViewPersonnelBalances||!companyPolicy(u,db).has(q.companyId)||u.role!=='ADMIN'&&a.effectiveAccessScope==='DEPARTMENT'&&(u.company!==q.company||u.department!==q.department))return false;
 if(u.role==='ADMIN'||u.id===q.requesterId)return true;
 if(!p.canReviewPersonnelBalance||!p.canAccessAccountingCartable||!p.canViewRequests)return false;
 return a.effectiveAccessScope==='COMPANY_WIDE'||a.effectiveAccessScope==='DEPARTMENT'&&u.department===q.department&&u.company===q.company;
}
export function balanceAccountant(u:User,q:Balance,db:DB,resolve:BalanceAuth){
 const a=resolve(u,db),p=a.effectivePermissions;
 return balanceCanRead(u,q,db,resolve)&&!!p.canReviewPersonnelBalance&&!!p.canAccessAccountingCartable&&!!p.canApprove&&(u.role==='ADMIN'||a.effectiveApprovalLimitRial>0)&&u.id!==q.requesterId&&u.id!==q.personnel.userId;
}
export function balanceSummary(db:DB,u:User,resolve:BalanceAuth):PersonnelBalanceSummary|undefined{
 if(!balanceEnabled()||db.personnelBalanceSchemaVersion!==3)return;
 const list=(db.personnelBalanceRequests||[]).filter(q=>balanceCanRead(u,q,db,resolve));
 return {mine:list.filter(q=>q.requesterId===u.id).length,accounting:list.filter(q=>q.status==='PENDING_ACCOUNTING'&&balanceAccountant(u,q,db,resolve)).length,revision:list.filter(q=>q.requesterId===u.id&&q.status==='NEEDS_REVISION').length};
}
export function balanceNoticeVisible(n:Pick<AppNotification,'personnelBalanceRef'|'recipientUserId'>,u:User,db:DB,resolve?:BalanceAuth){
 const ref=n.personnelBalanceRef,q=ref&&db.personnelBalanceRequests?.find(q=>q.id===ref.requestId);
 if(!balanceEnabled()||!q||n.recipientUserId!==u.id||!active(u)||ref!.version!==q.version)return false;
 // Fresh authorization resolver is supplied by projection and delivery callers.
 if(!resolve)return false;
 return balanceCanRead(u,q,db,resolve)&&(ref!.purpose==='ACCOUNTING'?q.status==='PENDING_ACCOUNTING'&&balanceAccountant(u,q,db,resolve):q.requesterId===u.id);
}
export function balanceAccessChangeBlock(before:DB,after:DB,ids:string[],resolve:BalanceAuth){
 const blocked=new Set<string>();
 for(const q of before.personnelBalanceRequests||[]){if(!['PENDING_ACCOUNTING','NEEDS_REVISION'].includes(q.status))continue;
  for(const userId of ids){const old=before.users.find(u=>u.id===userId),next=after.users.find(u=>u.id===userId);if(!old)continue;
   const wasOwner=q.requesterId===old.id&&balanceCanRead(old,q,before,resolve),ownerLost=wasOwner&&(!next||!balanceCanRead(next,q,after,resolve)||!resolve(next,after).effectivePermissions.canRequestPersonnelBalance);
   const lastAccountantLost=q.status==='PENDING_ACCOUNTING'&&balanceAccountant(old,q,before,resolve)&&!after.users.some(u=>balanceAccountant(u,q,after,resolve));
   if(ownerLost||lastAccountantLost)blocked.add(q.id);
  }
 }
 return blocked.size?{code:'OPEN_WORK_BLOCKS_ACCESS_CHANGE',error:'ابتدا درخواست‌های باز پرداخت پرسنلی را تعیین تکلیف کنید؛ سپس اختیار یا وضعیت حساب را تغییر دهید.',openWorkCount:blocked.size}:null;
}
