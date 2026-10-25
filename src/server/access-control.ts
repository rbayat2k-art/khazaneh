import type { Request } from 'express';
import {types} from 'node:util';
import type { TreasuryDatabaseState, User, RolePermissionSet, AccessScope } from '../types/treasury';
import { getUserRoles } from '../utils/user-roles';
import { canEditSubmittedRequest } from '../utils/request-edit';
import {canDeleteSubmittedRequest,hasDeletionFinancialLinks} from '../utils/request-deletion';
import {ownsOpenRejection} from '../utils/review-rejection';
import {treasuryInput} from './treasury-input';
import {freeze} from 'immer';
import {companyPolicy} from './company-access';
import {notificationVisible,notificationQueueAllowed} from './notification-access';
import {FinancialSelectionCache,immutableScalars,immutableScalarArray} from './financial-selection';
import {correctionTarget,correctionAdmission,correctionInputError} from './treasury-correction';
import {openTreasuryCorrection} from '../utils/treasury-correction';

export type EffectiveAccess = {
  effectivePermissions: RolePermissionSet;
  effectiveAccessScope: AccessScope;
  effectiveApprovalLimitRial: number;
  effectivePaymentLimitRial: number;
};
type FinancialRow = { id: string; requesterDeletedAt?:string; requesterId?: string; department?: string; company?: string; supervisorId?: string | null; status?: string; version?: number; amount?: number; approvedAmount?: number | null; items?: any[] };
export type AccessDecision = { status: number; error: string;code?:string } | null;
const denied = (error = 'شما مجوز انجام این عملیات یا دسترسی به این اطلاعات را ندارید.'): AccessDecision => ({ status: 403, error });
const positiveRial=(value:unknown):boolean=>(typeof value==='number'||typeof value==='string'&&/^\d+$/.test(value))&&Number.isSafeInteger(Number(value))&&Number(value)>0;
const safeRialSum=(values:unknown[]):boolean=>values.every(positiveRial)&&values.reduce<bigint>((sum,value)=>sum+BigInt(Number(value)),0n)<=BigInt(Number.MAX_SAFE_INTEGER);

function reportsTo(requesterId:string|undefined,viewerId:string,findUser:(id:string|undefined)=>User|undefined):boolean {
  let owner=findUser(requesterId);const visited=new Set<string>();
  while(owner?.supervisorId&&!visited.has(owner.id)){
    if(owner.supervisorId===viewerId)return true;
    visited.add(owner.id);owner=findUser(owner.supervisorId);
  }
  return false;
}
export function canSeeRequest(row: FinancialRow, viewer: User, db: TreasuryDatabaseState, auth: EffectiveAccess,findUser=(id:string|undefined)=>db.users.find(u=>u.id===id),companyAllowed=(row:FinancialRow)=>companyPolicy(viewer,db).financial(row),subordinate?:(id:string|undefined)=>boolean): boolean {
  if(row.requesterDeletedAt)return false;
  if (viewer.role === 'ADMIN') return true;
  if(!companyAllowed(row))return false;
  if (!auth.effectivePermissions.canViewRequests) return false;
  if (row.requesterId === viewer.id) return true;
  const scope = auth.effectiveAccessScope;
  if (scope === 'COMPANY_WIDE') return true;
  if (scope === 'SELF_ONLY') return false;
  if (scope === 'DEPARTMENT') {
    const owner = findUser(row.requesterId);
    return row.department === viewer.department && (!owner?.company || owner.company === viewer.company);
  }
  if (row.supervisorId === viewer.id) return true;
  return subordinate?subordinate(row.requesterId):reportsTo(row.requesterId,viewer.id,findUser);
}

function financialTarget(db: TreasuryDatabaseState, id: string, kind?: string, batchId?: string): FinancialRow | undefined {
  if (kind === 'BATCH_ITEM') return db.batchPayments.find(r => !r.requesterDeletedAt && r.id === (batchId || id));
  const pools = kind === 'ADVANCE' ? [db.advanceRequests] : kind === 'PAYMENT' ? [db.paymentRequests] : kind === 'BATCH' ? [db.batchPayments] : [db.advanceRequests, db.paymentRequests, db.batchPayments];
  return pools.flat().find(r => !r.requesterDeletedAt && r.id === id);
}

/** Shared by in-app notice writes and SMS delivery; the audience alone is not authority. */
export function canSeeNotificationTarget(id:string,viewer:User,db:TreasuryDatabaseState,auth:EffectiveAccess):boolean {
  const row=financialTarget(db,id)||db.batchPayments.find(b=>b.items.some(item=>item.id===id));
  if(row)return canSeeRequest(row,viewer,db,auth);
  const manual=db.manualPayments.find(r=>r.id===id),p=auth.effectivePermissions;
  return Boolean(manual&&companyPolicy(viewer,db).manual(manual)&&(manual.createdById===viewer.id||p.canAccessTreasuryWorkspace||p.canViewTreasuryQueue));
}

/** Every actor comes from the authenticated session, never from a caller-supplied ID. */
export function authorizeRequest(req: Pick<Request, 'path' | 'method' | 'body'>, viewer: User, db: TreasuryDatabaseState, auth: EffectiveAccess): AccessDecision {
  const p = auth.effectivePermissions;
  const route = req.path;
  const body = req.body || {};
  if (route === '/reset') return denied('بازنشانی اطلاعات در نسخه آنلاین غیرفعال است.');
  if (viewer.mustChangePassword && !['/state', '/auth/me', '/auth/change-password', '/auth/logout'].includes(route)) {
    return denied('پیش از انجام عملیات، رمز عبور موقت خود را تغییر دهید.');
  }
  const actors: Record<string, string[]> = {
    '/notifications/read': ['userId'], '/auth/preferences': ['userId'], '/auth/change-password': ['userId'],
    '/auth/logout-other-sessions': ['userId'], '/advance-requests': ['requesterId'], '/payment-requests': ['requesterId'],
    '/batch-payments': ['requesterId'], '/requests/resubmit': ['requesterId'], '/requests/edit-submitted':['requesterId'], '/requests/delete-submitted':['requesterId'], '/review/row-action': ['reviewerId'],
    '/review/bulk-action': ['reviewerId'], '/approver/review': ['approverId'], '/accounting/review': ['accountingId'],
  };
  let actorFields = actors[route] || [];
  if (route.startsWith('/users/') || route.startsWith('/roles/') || route.startsWith('/master-data/') || route.startsWith('/sms/')) actorFields = ['actorId', 'actorUserId'];
  if (route.startsWith('/treasury/')) actorFields = ['treasuryUserId', 'actorId', 'actorUserId'];
  if (route === '/treasury/daily-cover') actorFields = [...actorFields,'closedByUserId'];
  for (const field of actorFields) {
    if (body[field] !== undefined && body[field] !== viewer.id) return denied('هویت اقدام‌کننده با نشست واردشده مطابقت ندارد.');
    body[field] = viewer.id;
  }
  const requires: Record<string, keyof RolePermissionSet> = {
    '/reports/treasury':'canAccessTreasuryReports', '/reports/treasury/export':'canAccessTreasuryReports',
    '/users/save': 'canManageUsers', '/users/toggle-status': 'canManageUsers', '/users/reset-password': 'canManagePasswordRecovery',
    '/roles/save': 'canManageRoles', '/roles/delete': 'canManageRoles', '/roles/reset-defaults': 'canManageRoles',
    '/advance-requests': 'canSubmitSingleAdvance', '/payment-requests': 'canSubmitSinglePayment',
    '/requests/resubmit': 'canResubmitRevision',
    '/treasury/return-for-correction': 'canExecutePayment',
    '/requests/edit-submitted': 'canCreateRequest',
    '/requests/delete-submitted': 'canCreateRequest',
    '/treasury/move-pool': 'canExecutePayment', '/treasury/execute-payment': 'canExecutePayment',
    '/treasury/manual-payment': 'canCreateManualPayment', '/treasury/daily-cover': 'canCloseDailyCover',
    '/treasury/external-order':'canCreateManualPayment',
    '/bank-inquiry/config':'canManageBankInquiry',
    '/bank-inquiry/credential':'canManageBankInquiry',
    '/bank-inquiry/connections':'canManageBankInquiry',
    '/bank-inquiry/credits':'canManageBankInquiry',
    '/bank-inquiry/enqueue':'canInquireBankDetails',
    '/bank-inquiry/complete-card':'canInquireBankDetails',
    '/bank-inquiry/confirm-owner':'canConfirmBankOwner',
    '/bank-inquiry/result':'canInquireBankDetails',
    '/treasury/bank-accounts/save': 'canManageBankAccounts', '/treasury/bank-accounts/toggle-status': 'canManageBankAccounts',
    '/treasury/bank-accounts/import-preview':'canManageBankAccounts', '/treasury/bank-accounts/import':'canManageBankAccounts',
    '/treasury/bank-accounts/set-default': 'canManageBankAccounts', '/sms/config': 'canManageSmsGateway', '/sms/test': 'canManageSmsGateway',
  };
  let permission:keyof RolePermissionSet|undefined = requires[route];
  if(route==='/bank-inquiry/config'&&req.method==='GET')permission=undefined;
  if (route.startsWith('/users/') && req.method === 'DELETE') permission = 'canManageUsers';
  if (route.startsWith('/master-data/companies/')) permission = 'canManageCompanies';
  if (route.startsWith('/master-data/departments/')) permission = 'canManageDepartments';
  if (route.startsWith('/master-data/cost-centers/')) permission = 'canManageCostCenters';
  if (permission && !p[permission]) return denied();
  if(route==='/reports/treasury/export'&&!p.canExportReports)return denied();
  if(route==='/treasury/return-for-correction'||route==='/requests/resubmit'&&openTreasuryCorrection(correctionTarget(db,body).row||{})){
    const inputError=correctionInputError(body,route==='/treasury/return-for-correction');if(inputError)return inputError;
    const {row,parent}=correctionTarget(db,body);
    if(!row||!parent)return {status:404,error:'درخواست یا ردیف یافت نشد.'};
    if(!canSeeRequest(parent as any,viewer,db,auth))return denied();
    if(body.newAttachments?.length&&!p.canViewAttachments)return denied('مجوز پیوست غیرفعال است.');
    return correctionAdmission(body,route==='/treasury/return-for-correction',row,parent,viewer,auth,db);
  }
  const company=companyPolicy(viewer,db);
  if(route==='/treasury/external-order'&&(!p.canCreateRequest||!p.canSubmitSinglePayment))return denied();
  if(route==='/treasury/manual-payment'&&(!p.canViewAttachments||body.createdById!==undefined&&body.createdById!==viewer.id))return denied();
  if(viewer.role!=='ADMIN'){
    if(['/advance-requests','/payment-requests','/batch-payments','/treasury/external-order'].includes(route)&&!company.has(viewer.company))return denied();
    if(['/treasury/execute-payment','/treasury/manual-payment'].includes(route)&&!company.bank(body.sourceBankAccountId))return denied();
    if(route.startsWith('/treasury/bank-accounts/')){
      const payload=body.account||body,id=route.endsWith('/save')?payload.id:body.accountId,account=id?(db.companyBankAccounts||[]).find(r=>r.id===id):undefined;
      if(id&&!company.entity(account))return denied();
      if(route.endsWith('/save')&&!company.has(payload.companyName||payload.company||'هلدینگ مرکزی آریا'))return denied();
      if(['/import','/import-preview'].some(suffix=>route.endsWith(suffix))&&(!Array.isArray(body.rows)||body.rows.some((r:any)=>!company.has(r?.values?.companyName))))return denied();
      // Default-bank changes touch other companies' default flags too.
      const changesBank=route.endsWith('/save')||route.endsWith('/toggle-status');
      const noActiveDefault=!(db.companyBankAccounts||[]).some(a=>a.isDefault&&a.isActive!==false&&a.status!=='INACTIVE');
      if((route.endsWith('/set-default')||Boolean(payload.isDefault)||changesBank&&(account?.isDefault||noActiveDefault)||body.rows?.some((r:any)=>r?.values?.isDefault==='بله'))&&!company.all)return denied();
    }
    if(route.startsWith('/users/')){
      const id=req.method==='DELETE'?route.slice('/users/'.length):route==='/users/save'?body.id:body.targetUserId,target=db.users.find(u=>u.id===id);
      if(id&&(!target||!company.entity(target)))return denied();
      if(route==='/users/save'&&(!company.has(body.company||target?.company||'هلدینگ مرکزی آریا')||![body.role||target?.role,...(body.additionalRoles||target?.additionalRoles||[])].every(company.role)))return denied();
    }
    if(route.startsWith('/roles/')){
      if(route.endsWith('/reset-defaults')&&!company.all)return denied();
      if(body.role&&db.roleConfigs?.some(r=>r.role===body.role)&&!company.role(body.role))return denied();
      if(body.allowedCompanies!==undefined&&(!Array.isArray(body.allowedCompanies)||!body.allowedCompanies.every(company.has)))return denied();
    }
    if(route.startsWith('/master-data/')){
      const kind=route.split('/')[2],pool=kind==='companies'?db.companies:kind==='departments'?db.departments:db.costCenters;
      const target=body.id?pool?.find(r=>r.id===body.id):undefined;
      if(body.id&&!(kind==='companies'?company.has(target?.id)||company.has(target?.name):company.entity(target)))return denied();
      if(kind==='companies'&&(!body.id||body.name&&body.name!==target?.name||body.isDefault===true)&&!company.all)return denied();
      if(kind==='companies'&&target&&'isDefault' in target&&target.isDefault&&!route.endsWith('/save')&&!company.all)return denied();
      if(kind!=='companies'&&route.endsWith('/save')&&!company.has(body.companyId))return denied();
      if(Array.isArray(body.rows)&&body.rows.some((r:any)=>!company.has(r.companyId)))return denied();
      const deptIds=[body.departmentId,...(Array.isArray(body.rows)?body.rows.map((r:any)=>r?.departmentId):[])].filter(Boolean);
      if(deptIds.some(id=>!company.entity(db.departments?.find(d=>d.id===id))))return denied();
    }
    if(route.startsWith('/sms/')&&!company.all)return denied();
  }
  if (['/advance-requests', '/payment-requests', '/batch-payments'].includes(route) && !p.canCreateRequest) return denied();
  if (['/advance-requests', '/payment-requests', '/treasury/manual-payment', '/requests/resubmit'].includes(route) && body.amount !== undefined && !positiveRial(body.amount)) return { status: 400, error: 'مبلغ باید عدد صحیح مثبت به ریال باشد.' };
  if(route==='/requests/edit-submitted'&&body.changes?.amount!==undefined&&!positiveRial(body.changes.amount))return {status:400,error:'مبلغ باید عدد صحیح مثبت به ریال باشد.'};
  if(route==='/review/row-action'&&body.newAmount!==undefined&&!positiveRial(body.newAmount))return {status:400,error:'مبلغ باید عدد صحیح مثبت به ریال باشد.'};
  if (route === '/batch-payments' && (!Array.isArray(body.items) || body.items.length === 0 || !safeRialSum(body.items.map((item:any)=>item?.amount)))) return { status: 400, error: 'ردیف‌ها و جمع پرداخت باید مبلغ صحیح مثبت و در محدوده دقت مجاز باشند.' };
  if (route === '/batch-payments' && !(body.batchType === 'ADVANCE' ? p.canSubmitBatchAdvance : p.canSubmitBatchPayment)) return denied();
  if (route === '/approver/review' && !p.canAccessApproverCartable) return denied();
  if (route === '/accounting/review' && !p.canAccessAccountingCartable) return denied();
  if (route.startsWith('/review/') && !(p.canAccessApproverCartable || p.canAccessAccountingCartable)) return denied();
  if(['/review/row-action','/review/bulk-action','/approver/review','/accounting/review'].includes(route)){
    if(body.costCenter!==undefined||Array.isArray(body.items)&&body.items.some((it:any)=>it?.newCostCenterId!==undefined||it?.costCenter!==undefined))return {status:400,error:'مرکز هزینه فقط از مسیر ویرایش ردیف صریح قابل تغییر است.'};
    if(body.newCostCenterId!==undefined){if(route!=='/review/row-action'||!['UPDATE_AMOUNT_COMMENT','UPDATE_AND_APPROVE'].includes(body.action)||!['PAYMENT','BATCH_ITEM'].includes(body.itemType))return {status:400,error:'مرکز هزینه فقط در ویرایش درخواست پرداخت مجاز است.'};if(!p.canEditAmount)return denied('مجوز ویرایش مشخصات کنترل مالی فعال نیست.');if(!Number.isSafeInteger(body.expectedVersion))return {status:400,error:'نسخهٔ معتبر ردیف برای ویرایش مرکز هزینه الزامی است.'};}
  }
  if (['/approver/review','/accounting/review'].includes(route) && !['APPROVE','RETURN','RETURN_FOR_REVISION'].includes(body.action)) return denied('عملیات این مسیر بررسی معتبر نیست؛ برای رد درخواست از فرمان ردیفی فعلی استفاده کنید.');
  if (route === '/review/bulk-action' && !['APPROVE','RETURN_FOR_REVISION','REJECT'].includes(body.action)) return denied('عملیات گروهی بررسی معتبر نیست.');
  if(route.startsWith('/review/')&&['REJECT','CLOSE_REJECTED'].includes(body.action)){
    const inputs=route==='/review/row-action'?[body]:body.items;
    if(!Array.isArray(inputs)||!inputs.length||inputs.length>200||inputs.some(input=>!input||!['BATCH_ITEM','PAYMENT','ADVANCE'].includes(input.itemType)||typeof input.requestId!=='string'||!input.requestId||(input.itemType==='BATCH_ITEM'?typeof input.rowId!=='string'||!input.rowId:input.rowId!==undefined)))return {status:400,error:'هدف تصمیم باید صریح باشد؛ ردیف فرعی فقط برای درخواست گروهی مجاز است.'};
  }
  if(route.startsWith('/review/')&&['REJECT','CLOSE_REJECTED'].includes(body.action)&&(!body.returnReason||typeof body.returnReason!=='string'||!body.returnReason.trim()||body.returnReason.length>4000))return {status:400,error:'ذکر علت معتبر برای رد یا بستن درخواست الزامی است.'};
  if(route==='/review/row-action'&&!['UPDATE_AMOUNT_COMMENT','UPDATE_AND_APPROVE'].includes(body.action)&&['newAmount','approvedAmount','amountChangeReason'].some(key=>body[key]!==undefined))return {status:400,error:'اطلاعات ویرایش مبلغ فقط در عملیات ویرایش دارای دلیل مجاز است.'};
  if(route==='/review/row-action'&&body.approvedAmount!==undefined)return {status:400,error:'برای ویرایش مبلغ از فیلد مصوب مسیر ویرایش استفاده کنید.'};
  if (['/treasury/execute-payment', '/treasury/manual-payment'].includes(route) && viewer.role !== 'ADMIN' && auth.effectivePaymentLimitRial <= 0) return denied('سقف اختیار پرداخت شما صفر است.');
  if(['/treasury/execute-payment','/treasury/move-pool'].includes(route)){
    const parsed=treasuryInput(body,db,route==='/treasury/execute-payment');if(parsed.error)return {status:parsed.status||400,error:parsed.error,code:parsed.code};
    body.items=parsed.items;
    if(route==='/treasury/move-pool'&&!['QUEUE','IN_PAYMENT'].includes(body.targetPool))return {status:400,error:'مخزن مقصد معتبر نیست.'};
  }
  if (route === '/treasury/manual-payment' && viewer.role !== 'ADMIN' && Number(body.amount) > auth.effectivePaymentLimitRial) return denied('مبلغ خارج از سقف اختیار پرداخت شماست.');

  if (route.startsWith('/review/') && p.canAccessApproverCartable && p.canAccessAccountingCartable && !['APPROVER','ACCOUNTING'].includes(body.reviewStage)) return {status:409,error:'مرحله بررسی مشخص نیست؛ کارتابل را تازه‌سازی و دوباره اقدام کنید.'};
  const targets: Array<{ row: FinancialRow; item?: any; expectedVersion?: number;expectedStatus?:string }> = [];
  if(route==='/requests/delete-submitted'&&(!['PAYMENT','ADVANCE','BATCH_ITEM'].includes(body.itemType)||typeof body.requestId!=='string'||!body.requestId||(body.itemType==='BATCH_ITEM'?typeof body.rowId!=='string'||!body.rowId:body.rowId!==undefined)||Object.keys(body).some(k=>!['requesterId','itemType','requestId','rowId','expectedVersion'].includes(k))))return {status:400,error:'هدف حذف درخواست معتبر نیست.'};
  if (body.requestId && ['/requests/delete-submitted','/requests/edit-submitted','/requests/resubmit', '/review/row-action', '/approver/review', '/accounting/review'].includes(route)) {
    const legacyReview = ['/approver/review','/accounting/review'].includes(route);
    if (legacyReview && (body.itemType !== undefined || body.rowId !== undefined)) return {status:409,error:'نوع هدف بررسی ناسازگار است؛ کارتابل را تازه‌سازی کنید.'};
    const row = financialTarget(db, body.requestId, legacyReview ? body.requestType : body.itemType || body.requestType);
    if (!row) return { status: 404, error: 'درخواست یافت نشد.' };
    const item = body.itemType === 'BATCH_ITEM' ? row.items?.find(it => it.id === body.rowId) : undefined;
    if (body.itemType === 'BATCH_ITEM' && !item) return { status: 404, error: 'ردیف یافت نشد.' };
    targets.push({ row, item, expectedVersion: body.expectedVersion,expectedStatus:body.expectedStatus });
  }
  if (Array.isArray(body.items) && (route.startsWith('/review/') || route.startsWith('/treasury/'))) {
    const seen = new Set<string>();
    for (const target of body.items) {
      const kind = target.itemType || target.type;
      const key = `${target.batchId || target.requestId || ''}:${target.rowId || target.id || ''}:${kind}`;
      if (seen.has(key)) return { status: 400, error: 'یک ردیف در عملیات بیش از یک بار تکرار شده است.' };
      seen.add(key);
      const row = financialTarget(db, target.requestId || target.id, kind, target.batchId);
      if (!row) return { status: 404, error: 'یکی از درخواست‌ها یافت نشد.' };
      const item = kind === 'BATCH_ITEM' ? row.items?.find(it => it.id === (target.rowId || target.id)) : undefined;
      if (kind === 'BATCH_ITEM' && !item) return { status: 404, error: 'ردیف یافت نشد.' };
      targets.push({ row, item, expectedVersion: target.expectedVersion,expectedStatus:target.expectedStatus });
    }
  }
  if(route.startsWith('/review/')&&['REJECT','CLOSE_REJECTED'].includes(body.action)&&(!targets.length||targets.some(({row,item})=>row.items&&!item)))return {status:400,error:'رد یا بستن فقط روی ردیف صریح درخواست مجاز است.'};
  if(route.startsWith('/review/')&&['REJECT','CLOSE_REJECTED'].includes(body.action)&&new Set(targets.map(({row,item})=>item||row)).size!==targets.length)return {status:400,error:'یک هدف واقعی بیش از یک بار انتخاب شده است.'};
  for (const { row, item, expectedVersion,expectedStatus } of targets) {
    if (!canSeeRequest(row, viewer, db, auth,undefined,company.financial)) return denied();
    const replacement=route==='/requests/edit-submitted'?body.changes?.amount:route==='/requests/resubmit'?body.amount:route==='/review/row-action'?body.newAmount:undefined;
    if(item&&replacement!==undefined&&!safeRialSum(row.items!.map(it=>it.id===item.id?replacement:it.approvedAmount??it.amount)))return {status:400,error:'جمع مبلغ گروه خارج از محدوده دقت مجاز است.'};
    if (['/requests/edit-submitted','/requests/delete-submitted'].includes(route)) {
      if (row.requesterId!==viewer.id) return denied('فقط ثبت‌کننده می‌تواند درخواست را ویرایش کند.');
      const permitted=body.itemType==='BATCH_ITEM' ? ('batchType' in row && (row as any).batchType==='ADVANCE' ? p.canSubmitBatchAdvance : p.canSubmitBatchPayment) : body.itemType==='ADVANCE' ? p.canSubmitSingleAdvance : p.canSubmitSinglePayment;
      if (!permitted) return denied();
      if (body.changes?.attachments!==undefined&&!p.canViewAttachments) return denied('مجوز دسترسی به پیوست‌ها غیرفعال است.');
      const deleting=route==='/requests/delete-submitted';
      if (!(deleting?canDeleteSubmittedRequest:canEditSubmittedRequest)((item||row) as any,row.supervisorId,row.requesterId!) || deleting&&hasDeletionFinancialLinks(db,item?.id||row.id)) return {status:409,error:'رسیدگی به این درخواست شروع شده یا سابقهٔ مالی متصل دارد؛ حذف یا ویرایش مستقیم دیگر مجاز نیست.'};
      if (!Number.isSafeInteger(expectedVersion)||expectedVersion!==(item?.version||row.version||1)) return {status:409,error:'نسخه درخواست تغییر کرده است؛ ابتدا کارتابل را تازه‌سازی کنید.'};
    }
    if (['/treasury/execute-payment', '/treasury/move-pool'].includes(route)) {
      const states = item ? [item] : row.items ? row.items.filter(it => it.status !== 'Paid') : [row];
      if (!states.length || states.some(state => !['Pending_Treasury', 'In_Payment'].includes(state.status || row.status || ''))) return denied('فقط درخواست دارای تأیید نهایی مالی و مانده پرداخت‌نشده قابل اقدام در خزانه است.');
    }
    if (route === '/requests/resubmit' && row.requesterId !== viewer.id) return denied('فقط ثبت‌کننده درخواست می‌تواند آن را اصلاح و ارسال مجدد کند.');
    if (route.startsWith('/review/') || route === '/approver/review' || route === '/accounting/review') {
      if (row.requesterId === viewer.id && viewer.role !== 'ADMIN') return denied('تأیید درخواست خود مجاز نیست.');
      const state = item || row;
      const actualStatus=state.status||row.status;
      const rejectionAction=['REJECT','CLOSE_REJECTED'].includes(body.action)||actualStatus==='Rejected';
      if(rejectionAction){
        const allowed=['reviewerId','reviewStage','expectedVersion','expectedStatus','itemType','requestId','rowId','action','returnReason','comment','items'];
        if(Object.keys(body).some(key=>!allowed.includes(key)))return {status:400,error:'در رد یا تعیین تکلیف ردشده فقط تصمیم و علت ثبت می‌شود؛ اطلاعات مالی و پیوست تغییر نمی‌کند.'};
        if(!Number.isSafeInteger(expectedVersion)||expectedVersion!==(state.version||1)||expectedStatus!==actualStatus)return {status:409,error:'وضعیت یا نسخه درخواست تغییر کرده است؛ فهرست را تازه‌سازی کنید.'};
        if(body.newAmount!==undefined||body.approvedAmount!==undefined)return {status:400,error:'در رد یا تعیین تکلیف ردشده مبلغ تغییر نمی‌کند.'};
      }else if(expectedStatus!==undefined&&expectedStatus!==actualStatus)return {status:409,error:'وضعیت درخواست تغییر کرده است؛ فهرست را تازه‌سازی کنید.'};
      if(actualStatus==='Rejected'){
        if(route!=='/review/row-action'||!['APPROVE','CLOSE_REJECTED'].includes(body.action))return denied('ردشده فقط از مخزن همان بررسی‌کننده قابل تعیین تکلیف است.');
        if((state as any).reviewRejection?.stage!==body.reviewStage)return {status:409,error:'مرحلهٔ رد درخواست با کارتابل جاری مطابقت ندارد.'};
        if(!ownsOpenRejection(state as any,viewer.id,body.reviewStage))return denied('فقط شخص ردکننده با مجوز جاری می‌تواند این مورد را تعیین تکلیف کند.');
      }else if(body.action==='CLOSE_REJECTED')return denied('فقط درخواست ردشدهٔ باز قابل بستن است.');
      const status=actualStatus==='Rejected'?(body.reviewStage==='APPROVER'?'Pending_Approver':'Pending_Accounting'):actualStatus;
      if(!item&&row.items?.some(it=>['Rejected','Closed','Mixed'].includes(it.status)))return denied('گروه دارای ردیف ردشده یا بسته باید به‌صورت ردیفی بررسی شود.');
      if ((state as any).requesterEditedAt && expectedVersion===undefined) return {status:409,error:'برای بررسی درخواست ویرایش‌شده، نسخه فعلی لازم است؛ کارتابل را تازه‌سازی کنید.'};
      if (!item && row.items && row.items.some(it=>it.status===status&&it.requesterEditedAt&&body.expectedItemVersions?.[it.id]!==it.version)) return {status:409,error:'نسخه ردیف ویرایش‌شده گروه تغییر کرده است؛ فهرست را تازه‌سازی کنید.'};
      if (expectedVersion !== undefined && (!Number.isSafeInteger(expectedVersion) || expectedVersion !== (state.version || 1))) return {status:409,error:'نسخه درخواست تغییر کرده است؛ کارتابل را تازه‌سازی کنید.'};
      if (body.reviewStage !== undefined && status !== (body.reviewStage === 'APPROVER' ? 'Pending_Approver' : body.reviewStage === 'ACCOUNTING' ? 'Pending_Accounting' : 'invalid')) return {status:409,error:'مرحله درخواست تغییر کرده است؛ کارتابل را تازه‌سازی کنید.'};
      if (route === '/approver/review' && status !== 'Pending_Approver') return denied('درخواست در مرحله سرپرست نیست.');
      if (route === '/accounting/review' && status !== 'Pending_Accounting') return denied('درخواست در مرحله حسابداری نیست.');
      if (status === 'Pending_Approver' && row.supervisorId && row.supervisorId !== viewer.id && viewer.role !== 'ADMIN') return denied('این درخواست به سرپرست دیگری ارجاع شده است.');
      if (status === 'Pending_Approver' && !p.canAccessApproverCartable) return denied();
      if (status === 'Pending_Accounting' && !p.canAccessAccountingCartable) return denied();
      if (!['Pending_Approver', 'Pending_Accounting'].includes(status || '')) return denied('این درخواست در مرحله مجاز بررسی نیست.');
      if (body.action === 'APPROVE' || body.action === 'UPDATE_AND_APPROVE') {
        if (!p.canApprove) return denied();
        const amount = Number(body.newAmount ?? body.approvedAmount ?? state.approvedAmount ?? state.amount ?? row.amount ?? 0);
        if (viewer.role !== 'ADMIN' && (auth.effectiveApprovalLimitRial <= 0 || amount > auth.effectiveApprovalLimitRial)) return denied('مبلغ خارج از سقف اختیار تأیید شماست.');
        if (!item && row.items && viewer.role !== 'ADMIN' && row.items.some(it => it.status === status && Number(it.approvedAmount ?? it.amount) > auth.effectiveApprovalLimitRial)) return denied('یکی از ردیف‌های گروه خارج از سقف اختیار تأیید شماست.');
      }
      if ((body.newAmount !== undefined || body.approvedAmount !== undefined) && !p.canEditAmount) return denied();
      if (['RETURN_FOR_REVISION', 'RETURN', 'REJECT','CLOSE_REJECTED'].includes(body.action) && !p.canReturnForRevision) return denied();
    }
  }
  if (route === '/requests/resubmit' && targets.some(({ row, item }) => (item?.status || row.status) !== 'Needs_Revision')) return denied('فقط درخواست برگشت‌خورده قابل اصلاح و ارسال مجدد است.');
  if (['/review/row-action', '/review/bulk-action', '/approver/review', '/accounting/review'].includes(route) && !['APPROVE', 'UPDATE_AND_APPROVE', 'UPDATE_AMOUNT_COMMENT', 'RETURN_FOR_REVISION', 'RETURN', 'REJECT','CLOSE_REJECTED'].includes(body.action)) return denied('عملیات بررسی معتبر نیست.');
  if(['/approver/review','/accounting/review'].includes(route)&&(['UPDATE_AMOUNT_COMMENT','UPDATE_AND_APPROVE'].includes(body.action)||body.approvedAmount!==undefined||body.newAmount!==undefined))return {status:400,error:'ویرایش مبلغ فقط از مسیر ویرایش ردیف با دلیل الزامی مجاز است.'};
  if(route==='/review/bulk-action'&&(['newAmount','approvedAmount','amountChangeReason'].some(k=>body[k]!==undefined)||body.items?.some((item:any)=>['newAmount','approvedAmount','amountChangeReason'].some(k=>item[k]!==undefined))))return {status:400,error:'تغییر مبلغ باید به‌صورت ردیفی و با دلیل ثبت شود.'};
  return null;
}

// Cached only by immutable node identity. No viewer, scope or session is cached;
// a new record or permission change still passes the normal visibility checks.
const withoutFilesCache=new WeakMap<object,any>();
function withoutFiles(value:any):any {
  if(!value||typeof value!=='object')return value;
  const immutable=Object.isFrozen(value),cached=immutable?withoutFilesCache.get(value):undefined;
  if(cached!==undefined)return cached;
  const result=Array.isArray(value)?value.map(withoutFiles):Object.fromEntries(Object.entries(value).filter(([key])=>!['attachments','fileUrl','receiptFileUrl'].includes(key)).map(([key,v])=>[key,withoutFiles(v)]));
  if(immutable){freeze(result,true);withoutFilesCache.set(value,result);}return result;
}

const financialSelections=new FinancialSelectionCache();
/** Sanitize all state responses, including state embedded in mutation responses. */
export function scopeState(state: TreasuryDatabaseState, viewer: User, auth: EffectiveAccess): TreasuryDatabaseState {
  const p = auth.effectivePermissions;
  const full = viewer.role === 'ADMIN' && !viewer.mustChangePassword;
  const company=companyPolicy(viewer,state);
  const usersById=new Map<string,User>();for(const user of state.users)if(!usersById.has(user.id))usersById.set(user.id,user);
  const findOwner=(id:string|undefined)=>id?usersById.get(id):undefined;
  // One projection only: never retain a grant between requests. Mutable/getter
  // hierarchy inputs keep the original per-row traversal. Company, permissions,
  // scope and explicit row assignment still run before this optional lookup.
  const hierarchy=new Map<string|undefined,boolean>(),stableHierarchy=!types.isProxy(viewer)&&!types.isProxy(state.users)&&!state.users.some(user=>types.isProxy(user))&&immutableScalars(viewer,['id'],['id'])&&immutableScalarArray(state.users,['id','supervisorId'],['id']);
  const subordinate=stableHierarchy?(id:string|undefined)=>{if(!hierarchy.has(id))hierarchy.set(id,reportsTo(id,viewer.id,findOwner));return hierarchy.get(id)!;}:undefined;
  const visible = (r: FinancialRow) => !viewer.mustChangePassword && canSeeRequest(r, viewer, state, auth,findOwner,company.financial,subordinate);
  // Reuse raw financial selections only for immutable rows and the exact current
  // company-wide policy. All other scopes and file redaction stay per viewer.
  const select=<T,>(rows:T[],predicate:(row:T)=>boolean):T[]=>{const selected=rows.filter(predicate);return selected.length===rows.length&&Object.isFrozen(rows)?rows:selected;};
  const passwordFlag=Object.getOwnPropertyDescriptor(viewer,'mustChangePassword');
  const stablePasswordFlag=passwordFlag?'value'in passwordFlag&&(passwordFlag.value===false||passwordFlag.value===undefined):!('mustChangePassword'in viewer);
  const policy=viewer.role!=='ADMIN'&&!viewer.mustChangePassword&&stablePasswordFlag&&Object.isFrozen(viewer)&&immutableScalars(viewer,['role'],['role'])&&Object.getOwnPropertyDescriptor(auth,'effectiveAccessScope')?.value==='COMPANY_WIDE'&&Object.getOwnPropertyDescriptor(auth,'effectivePermissions')?.value===p&&Object.getOwnPropertyDescriptor(p,'canViewRequests')?.value===true?company.financialContext():undefined;
  const advanceRequests = financialSelections.select(state.advanceRequests,policy,visible);
  const paymentRequests = financialSelections.select(state.paymentRequests,policy,visible);
  const batchPayments = financialSelections.select(state.batchPayments,policy,visible);
  const ids = financialSelections.relatedIds(advanceRequests,paymentRequests,batchPayments);
  const treasury = !viewer.mustChangePassword && (full || p.canAccessTreasuryWorkspace || p.canViewTreasuryQueue);
  const manualPayments=state.manualPayments.filter(r=>!viewer.mustChangePassword&&company.manual(r)&&(treasury||r.createdById===viewer.id));
  const manualIds=new Set(manualPayments.map(r=>r.id));
  const receiptVisible=(r:any)=>{const related=r.relatedPaymentIds||[];return full||related.length>0&&related.every((id:string)=>ids.has(id)||manualIds.has(id));};
  const coverVisible=(r:any)=>{const a=r.advanceRequestIds||[],b=r.paymentRequestIds||[],m=r.manualPaymentIds||[];return full||a.length+b.length+m.length>0&&[...a,...b].every((id:string)=>ids.has(id))&&m.every((id:string)=>manualIds.has(id));};
  const users = state.users.filter(u=>full||u.id===viewer.id||company.entity(u)).map(u => full || p.canManageUsers || u.id === viewer.id ? u : ({
    id: u.id, name: u.name, role: u.role, personnelCode: '', department: u.department, company: u.company,
    additionalRoles: u.additionalRoles, supervisorId: u.supervisorId, supervisorName: u.supervisorName, isActive: u.isActive,
  } as User));
  const supervisorCompanyCandidates=[...new Set([...(state.companies||[]).flatMap(c=>[c.id,c.name]),...(state.roleConfigs||[]).filter(r=>getUserRoles(viewer).includes(r.role)).flatMap(r=>r.allowedCompanies||[]),viewer.company].filter((v):v is string=>typeof v==='string'&&!!v.trim()))];
  const managedUsers=!full&&p.canManageUsers?users.map(u=>{const supCompany=companyPolicy(u,state);return {...u,supervisorAllowedCompanies:supervisorCompanyCandidates.filter(value=>company.has(value)&&supCompany.has(value))};}):users;
  const scoped: TreasuryDatabaseState = {
    ...state, users:managedUsers, advanceRequests, paymentRequests, batchPayments,
    roleConfigs:state.roleConfigs?.filter(r=>full||getUserRoles(viewer).includes(r.role)||(p.canManageUsers||p.canManageRoles)&&company.role(r.role)),
    companies:(state.companies||[]).filter(c=>full||company.has(c.id)||company.has(c.name)),
    departments:(state.departments||[]).filter(r=>full||company.entity(r)),costCenters:(state.costCenters||[]).filter(r=>full||company.entity(r)),
    manualPayments,dailyCovers:treasury?state.dailyCovers.filter(coverVisible):[],
    receiptArchives: !viewer.mustChangePassword && (p.canViewReceiptArchive || p.canViewAttachments)
      ? (full||financialSelections.allRelatedVisible(state.receiptArchives,ids)?state.receiptArchives:select(state.receiptArchives,receiptVisible)) : [],
    companyBankAccounts: !viewer.mustChangePassword && (full || p.canAccessTreasuryBankAccounts || p.canManageBankAccounts) ? (state.companyBankAccounts||[]).filter(r=>company.entity(r)) : [],
    notifications: (state.notifications || []).filter(n => notificationQueueAllowed(n,p)&&notificationVisible(n,viewer,state,id=>ids.has(id)||manualIds.has(id))),
    securityAuditLogs: !viewer.mustChangePassword && (full || p.canViewSecurityAudit&&company.all) ? state.securityAuditLogs : [],
    passwordRecoveryRequests: !viewer.mustChangePassword && (full || p.canManagePasswordRecovery) ? (state.passwordRecoveryRequests||[]).filter(r=>full||company.entity(state.users.find(u=>u.id===r.userId))) : [],
    smsLogs: !viewer.mustChangePassword && (full || p.canManageSmsGateway&&company.all) ? state.smsLogs : [],
    smsConfig: !viewer.mustChangePassword && (full || p.canManageSmsGateway&&company.all) ? state.smsConfig : undefined,
    bankInquiryJobs:undefined,
    bankInquiryOperations:undefined,
    bankInquiryConfig:!viewer.mustChangePassword&&(full||p.canManageBankInquiry&&company.all)?state.bankInquiryConfig:undefined,
  };
  if (!p.canViewAttachments || viewer.mustChangePassword) {
    return withoutFiles(scoped);
  }
  return scoped;
}
