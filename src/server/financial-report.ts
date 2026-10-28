import type {TreasuryDatabaseState,User} from '../types/treasury';import type {EffectiveAccess} from './access-control';import {companyPolicy} from './company-access';
import {manualCompanyIdentity} from '../utils/manual-company';
/** A cooperative report never delivers data that became inaccessible while yielding. */
export function reportSourceStillVisible(before:TreasuryDatabaseState,current:TreasuryDatabaseState):boolean{
 for(const name of ['paymentRequests','advanceRequests','manualPayments'] as const){const ids=new Set(current[name].map(r=>r.id));if(before[name].some(r=>!ids.has(r.id)))return false;}
 const batches=new Map(current.batchPayments.map(b=>[b.id,new Set(b.items.map(r=>r.id))]));return before.batchPayments.every(b=>batches.has(b.id)&&b.items.every(r=>batches.get(b.id)!.has(r.id)));
}
/** Owner-approved report-only manual read grant; never enables workspace/commands or alters /state. */
export function financialReportState(safe:TreasuryDatabaseState,scoped:TreasuryDatabaseState,viewer:User,auth:EffectiveAccess):TreasuryDatabaseState{
 if(viewer.mustChangePassword||!auth.effectivePermissions.canAccessTreasuryReports)throw Object.assign(Error('مجوز گزارش فعال نیست.'),{status:403});
 const company=companyPolicy(viewer,safe),users=new Map(safe.users.map(u=>[u.id,u])),manualPayments=safe.manualPayments.filter(r=>company.manual(r)&&(viewer.role==='ADMIN'||auth.effectiveAccessScope==='COMPANY_WIDE'||r.createdById===viewer.id||auth.effectiveAccessScope==='DEPARTMENT'&&users.get(r.createdById)?.department===viewer.department&&users.get(r.createdById)?.company===viewer.company));
 const ids=new Set([...scoped.paymentRequests,...scoped.advanceRequests,...scoped.batchPayments,...scoped.batchPayments.flatMap(b=>b.items.filter(i=>!i.requesterDeletedAt)),...manualPayments].map(r=>r.id)),canFiles=auth.effectivePermissions.canViewAttachments||auth.effectivePermissions.canViewReceiptArchive;
 return {...scoped,manualPayments:manualPayments.map(r=>{const account=(safe.companyBankAccounts||[]).find(a=>a.id===r.sourceBankAccountId),snapshot=r.sourceAccountSnapshot as any;return {...r,...(manualCompanyIdentity(r)||{companyId:(account as any)?.companyId||snapshot?.companyId,company:account?.companyName||snapshot?.company||snapshot?.companyName||users.get(r.createdById)?.company||''})};}),companyBankAccounts:(safe.companyBankAccounts||[]).filter(a=>company.entity(a)),receiptArchives:canFiles?safe.receiptArchives.filter(r=>r.relatedPaymentIds?.length&&r.relatedPaymentIds.every(id=>ids.has(id))):[]};
}
