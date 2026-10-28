import type {User,RolePermissionSet} from '../types/treasury';import {getUserRoles} from './user-roles';import {supervisorCompanyAllowed} from './permission-registry';
export function supervisorSelectionIssue(user:User,company:string,department:string,roles:any[],companies:any[]):string|undefined{
 const p:Partial<RolePermissionSet>=user.effectivePermissions||{},scope=user.effectiveAccessScope||user.accessScope;
 if(user.isActive===false)return 'حساب غیرفعال است';
 if(!p.canViewRequests||!p.canAccessApproverCartable||!p.canApprove)return 'مجوز مشاهده، کارتابل سرپرست یا تأیید کامل نیست';
 if(!scope||scope==='SELF_ONLY')return 'محدوده فقط شخصی است؛ محدودهٔ زیرمجموعه‌ها را تنظیم کنید';
 if(!(Number(user.effectiveApprovalLimitRial)>0))return 'سقف تأیید مالی صفر است؛ سقف مجاز را تعیین کنید';
 if(!supervisorCompanyAllowed(user,company,roles,companies))return 'شرکت کاربر در شرکت‌های مجاز این تأییدکننده نیست';
 if(scope==='DEPARTMENT'&&(user.department!==department||user.company!==company))return 'شرکت یا واحد سازمانی متفاوت است';
}
export function supervisorCandidate(user:User,roles:any[]){return !!user.effectivePermissions?.canAccessApproverCartable||getUserRoles(user).some(key=>key==='APPROVER'||roles.some(r=>r.role===key&&(r.baseTemplateRole==='APPROVER'||r.permissions?.canAccessApproverCartable)));}
