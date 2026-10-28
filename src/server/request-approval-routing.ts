import type {RequestApprovalType,RequestApprovers,TreasuryDatabaseState,User} from '../types/treasury';
import type {AuthResolver} from './open-work';
import {companyPolicy} from './company-access';
import {hasSupervisorPermissions} from '../utils/user-roles';
import {parseRequestApprovers,requestApproverId,isDirectAccountingRoute} from '../utils/request-approval-routing';

export function requestApproverError(owner:User,approver:User|undefined,db:TreasuryDatabaseState,resolve:AuthResolver):string|undefined{
 if(!approver||approver.isActive===false)return 'تأییدکننده انتخاب‌شده معتبر یا فعال نیست.';
 if(approver.id===owner.id)return 'تأییدکننده اختصاصی نمی‌تواند خودِ ثبت‌کننده باشد؛ خودتأییدی اضافه نشده است.';
 const auth=resolve(approver,db);
 if(!hasSupervisorPermissions(auth.effectivePermissions,auth.effectiveAccessScope,auth.effectiveApprovalLimitRial))return 'تأییدکننده باید مجوز مشاهده، کارتابل سرپرست، تأیید و سقف مثبت معتبر داشته باشد.';
 if(!companyPolicy(approver,db).has(owner.company))return 'شرکت کاربر در شرکت‌های مجاز تأییدکننده نیست.';
 if(auth.effectiveAccessScope==='DEPARTMENT'&&(approver.company!==owner.company||approver.department!==owner.department))return 'محدودهٔ واحد سازمانی تأییدکننده با شرکت و واحد کاربر سازگار نیست.';
}
export function requestApproversError(owner:User,routes:RequestApprovers,db:TreasuryDatabaseState,resolve:AuthResolver){for(const route of Object.values(routes)){if(isDirectAccountingRoute(route))continue;if(typeof route!=='string')return 'ساختار مسیر تأیید معتبر نیست.';const error=requestApproverError(owner,db.users.find(u=>u.id===route),db,resolve);if(error)return error;}}
/** Only initial submission resolves profile routing. Revisions use the pinned record. */
export function initialRequestApprover(owner:User,type:RequestApprovalType,db:TreasuryDatabaseState,resolve:AuthResolver):{id:string|null;user?:User;error?:string}{
 if(owner.requestApprovers!==undefined){const parsed=parseRequestApprovers(owner.requestApprovers);if(parsed.error)return {id:null,error:parsed.error};}
 const id=requestApproverId(owner,type);if(!id)return {id:null};const user=db.users.find(u=>u.id===id);
 // Explicit routes are new authority-bearing references, never an implicit fallback.
 if(owner.requestApprovers?.[type]){const error=requestApproverError(owner,user,db,resolve);if(error)return {id,error};}
 return {id,user};
}
