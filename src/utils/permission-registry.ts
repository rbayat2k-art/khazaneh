import {ACCOUNT_INQUIRY_TABS}from'../types/account-inquiry';
import type {RolePermissionSet,User} from '../types/treasury';
import {getDefaultPermissionsForRole} from '../types/treasury';

export const MENU_TITLES={forms:'ثبت درخواست‌های مالی و پرسنلی',tracking:'کارتابل پیگیری درخواست‌ها',approver:'کارتابل تایید سرپرست واحد',accounting:'کارتابل بررسی مالی حسابداری',treasury:'خزانه‌داری و عملیات پرداخت',reports:'گزارش‌ها و خروجی‌ها',master:'مدیریت اطلاعات پایه',users:'مدیریت کاربران و دسترسی‌ها',settings:'تنظیمات و حساب کاربری'} as const;
export const DISPLAY_FALLBACKS={
 canShowTrackingAll:'TRACKING',canShowTrackingAdvanceSingle:'TRACKING',canShowTrackingAdvanceBatch:'TRACKING',canShowTrackingPaymentSingle:'TRACKING',canShowTrackingPaymentBatch:'TRACKING',canShowTrackingRevision:'TRACKING',
 canShowApproverPending:'canAccessApproverCartable',canShowApproverApproved:'canAccessApproverCartable',canShowApproverReturned:'canAccessApproverCartable',canShowApproverAll:'canAccessApproverCartable',canShowApproverRejected:'canAccessApproverCartable',
 canShowAccountingPending:'canAccessAccountingCartable',canShowAccountingApproved:'canAccessAccountingCartable',canShowAccountingReturned:'canAccessAccountingCartable',canShowAccountingAll:'canAccessAccountingCartable',canShowAccountingRejected:'canAccessAccountingCartable',
 canShowTreasuryInquiry:'INQUIRY',canShowExternalOrder:'EXTERNAL',
 canShowKeyboardHelp:'canAccessSettings',
} as const;
export type DisplayPermission=keyof typeof DISPLAY_FALLBACKS;
export type PermissionKey=keyof RolePermissionSet;
export type PermissionControl={key:PermissionKey;label:string;kind:'ACCESS'|'ACTION'|'DISPLAY'|'SHARED'|'COMPAT';description:string};
const c=(key:PermissionKey,label:string,kind:PermissionControl['kind']='ACCESS',description='در محدودهٔ شرکت، نقش و سقف مجاز کاربر.'):PermissionControl=>({key,label,kind,description});
export const PERMISSION_GROUPS:{id:keyof typeof MENU_TITLES;title:string;items:PermissionControl[]}[]=[
 {id:'forms',title:MENU_TITLES.forms,items:[
  c('canRequestPersonnelBalance','ثبت پرداخت پرسنلی با مبلغ اعلامی اختیاری و تأیید حسابداری','ACTION'),c('canShowInquiryCreate','فرم ثبت استعلام شخصی یا گروهی','DISPLAY'),c('canRequestOwnAccountInquiry','ثبت استعلام حساب خود','ACTION'),c('canRequestOthersAccountInquiry','ثبت استعلام پرسنل و تأمین‌کنندگان مجاز','ACTION'),c('canConvertAccountInquiry','ساخت درخواست مالی از پاسخ مجاز استعلام','ACTION','همراه با مجوز عادی ثبت نوع مالی؛ هر ردیف یک هدف مالی.'),
  c('canAccessRequesterSection','نمایش مستقل منوی ثبت درخواست‌ها','DISPLAY','فرم‌های فعال نیز این منو را نمایش می‌دهند؛ برای بستن کامل، نمایش چهار فرم را هم خاموش کنید.'),
  c('canCreateAdvanceSingle','زیرمنوی مساعده حقوق تکی — نمایش فرم','DISPLAY'),c('canSubmitSingleAdvance','ثبت مساعده حقوق تکی','ACTION'),
  c('canCreateAdvanceBatch','زیرمنوی مساعده گروهی پرسنل — نمایش فرم','DISPLAY'),c('canSubmitBatchAdvance','ثبت مساعده گروهی پرسنل','ACTION'),
  c('canCreatePaymentSingle','زیرمنوی دستور پرداخت تکی — نمایش فرم','DISPLAY'),c('canSubmitSinglePayment','ثبت دستور پرداخت تکی','ACTION'),
  c('canCreatePaymentBatch','زیرمنوی دستور پرداخت گروهی (تجمیعی) — نمایش فرم','DISPLAY'),c('canSubmitBatchPayment','ثبت دستور پرداخت گروهی (تجمیعی)','ACTION'),
  c('canCreateRequest','مجوز کلی ثبت و ویرایش درخواست‌های دست‌نخورده','ACTION','پیش‌نیاز ثبت هر چهار نوع؛ ویرایش/حذف فقط برای مالک و قبل از رسیدگی، طبق قواعد موجود.'),
 ]},
 {id:'tracking',title:MENU_TITLES.tracking,items:[
  c('canViewPersonnelBalances','مشاهده و پیگیری پرداخت پرسنلی مجاز','ACCESS','پیش‌نیاز مشاهده فرم ثبت و تعیین مبلغ همین بخش؛ شرکت و مالکیت در سرور کنترل می‌شود.'),c('canShowInquiryMine','پیگیری استعلام‌های من','DISPLAY'),c('canShowInquiryHistory','سوابق استعلام‌ها و مکاتبات مجاز','DISPLAY'),
  c('canShowTrackingAll','همه درخواست‌ها و سوابق من','DISPLAY'),c('canShowTrackingAdvanceSingle','پیگیری مساعده تکی','DISPLAY'),c('canShowTrackingAdvanceBatch','پیگیری مساعده گروهی','DISPLAY'),c('canShowTrackingPaymentSingle','پیگیری درخواست پرداخت تکی','DISPLAY'),c('canShowTrackingPaymentBatch','پیگیری درخواست پرداخت گروهی','DISPLAY'),c('canShowTrackingRevision','نیازمند اصلاح و بازنگری','DISPLAY'),
  c('canResubmitRevision','اصلاح و ارسال مجدد درخواست برگشتی','ACTION','فقط مالک یا گیرندهٔ اصلاح فنی مجاز و در وضعیت/نسخهٔ معتبر.'),c('canViewRequests','مشاهده درخواست‌ها در کارتابل‌های مجاز','SHARED','پیش‌نیاز ردیف‌ها و جزئیات در همه کارتابل‌ها؛ فقط شرکت‌ها و رکوردهای مجاز.'),
 ]},
 {id:'approver',title:MENU_TITLES.approver,items:[
  c('canShowInquiryApproval','تأیید و ارجاع استعلام به حسابداری — نمایش','DISPLAY'),c('canShowInquiryRelease','بررسی پاسخ و اجازه نمایش — نمایش','DISPLAY'),c('canApproveAccountInquiry','تأیید و ارجاع استعلام مستقل','ACTION'),c('canReleaseAccountInquiry','اجازه نمایش نسخه پاسخ به متقاضی','ACTION'),c('canRequestLinkedAccountInquiry','استعلام خصوصی از حسابداری هنگام بررسی مالی','ACTION'),
  c('canAccessApproverCartable','نمایش منوی کارتابل تأیید سرپرست واحد','ACCESS','دسترسی اصلی مرحلهٔ سرپرست؛ مشاهده ردیف و اقدام، مجوز و سقف مستقل می‌خواهند.'),
  c('canShowApproverPending','در انتظار تأیید من','DISPLAY'),c('canShowApproverApproved','تأییدشده توسط من','DISPLAY'),c('canShowApproverReturned','برگشت‌داده‌شده برای اصلاح','DISPLAY'),c('canShowApproverAll','همه سوابق من','DISPLAY'),c('canShowApproverRejected','ردشده توسط من','DISPLAY'),
  c('canApprove','مجوز تأیید درخواست‌ها (تکی و گروهی)','SHARED','مشترک با حسابداری؛ فقط مرحله/ارجاع جاری و سقف معتبر.'),c('canEditAmount','مجوز ویرایش و تعدیل مبلغ مصوب','SHARED','مشترک با حسابداری؛ دلیل اجباری. اصلاح مرکز هزینه طبق قرارداد همان مرحله.'),c('canReturnForRevision','مجوز برگشت درخواست برای اصلاح یا رد','SHARED','مشترک با حسابداری؛ برگشت، رد و بستن ردشده با علت و مالکیت مرحلهٔ خود.'),
 ]},
 {id:'accounting',title:MENU_TITLES.accounting,items:[
  c('canReviewPersonnelBalance','بررسی و تأیید پرداخت پرسنلی و ارسال به خزانه','ACTION','نیازمند مشاهده همین بخش، کارتابل حسابداری، تأیید و سقف جاری؛ خودتأییدی ممنوع.'),c('canShowInquiryAccounting','پاسخ‌گویی مانده و صورت‌حساب — نمایش','DISPLAY'),c('canRespondAccountInquiry','پاسخ حسابداری به استعلام دیگران','ACTION'),
  c('canAccessAccountingCartable','زیرمنوی کارتابل بررسی مالی حسابداری','ACCESS'),c('canShowAccountingPending','در انتظار تأیید من','DISPLAY'),c('canShowAccountingApproved','تأییدشده توسط من','DISPLAY'),c('canShowAccountingReturned','برگشت‌داده‌شده برای اصلاح','DISPLAY'),c('canShowAccountingAll','همه سوابق من','DISPLAY'),c('canShowAccountingRejected','ردشده توسط من','DISPLAY'),
 ]},
 {id:'treasury',title:MENU_TITLES.treasury,items:[
  c('canAccessTreasuryQueue','صف انتظار پرداخت'),c('canAccessTreasuryInPayment','مخزن در حال پرداخت'),c('canAccessTreasuryRejected','پرداخت‌های ردشده خزانه'),c('canAccessTreasuryCompleted','پرداختی‌های انجام‌شده'),
  c('canRejectTreasuryPayment','رد پرداخت خزانه با دلیل','ACTION','فقط ردیف کاملاً پرداخت‌نشده؛ مبلغ و تأییدهای قبلی محفوظ می‌مانند.'),c('canRestoreTreasuryPayment','بازگردانی رد پرداخت به صف انتظار با دلیل','ACTION','فقط رد خزانه؛ رد سرپرست یا حسابداری از این مسیر باز نمی‌شود.'),
  c('canShowTreasuryInquiry','تکمیل و استعلام شبا — نمایش زیرمنو','DISPLAY'),c('canInquireBankDetails','استعلام شبا، تکمیل کارت مفقود و تلاش مجدد','ACTION'),c('canConfirmBankOwner','تأیید و اصلاح نام بانکی با دلیل','ACTION'),
  c('canAccessTreasuryBankAccounts','بانک‌ها و شماره‌حساب‌ها — دسترسی به بخش'),c('canManageBankAccounts','تعریف، ویرایش و ورود گروهی حساب‌های بانکی','ACTION'),
  c('canAccessTreasuryManualPayment','ثبت پرداخت انجام‌شده — دسترسی به بخش'),c('canShowExternalOrder','ثبت دستور پرداخت خارج سامانه — نمایش زیرمنو','DISPLAY'),c('canCreateManualPayment','ثبت پرداخت انجام‌شده و دستور خارج سامانه','ACTION','پرداخت انجام‌شده فیش واقعی می‌خواهد؛ دستور ناپرداخته با مجوز ثبت، ابتدا حسابداری می‌رود.'),
  c('canAccessTreasuryDailyCover','روکش روزانه — دسترسی به بخش'),c('canCloseDailyCover','بستن روکش روزانه','ACTION'),c('canAccessTreasuryArchive','بایگانی فیش‌ها — دسترسی به بخش'),c('canViewReceiptArchive','مشاهده فیش‌های بایگانی','ACTION'),
  c('canExecutePayment','مجوز قطعی‌سازی پرداخت و صدور رسید خزانه','ACTION','انتقال صف/مخزن، پرداخت تکی/گروهی/جزئی و عودت فنی با کنترل مانده، مرحله، مجوز و سقف فعلی.'),
  c('canAccessTreasuryWorkspace','مشاهده سوابق و اعلان‌های خزانه','COMPAT','مجوز داده/اعلان است، نه صرفاً نمایش منو؛ با مجوز قدیمی بعدی رابطهٔ «یا» دارد.'),c('canViewTreasuryQueue','مشاهده سوابق و اعلان‌های خزانه — مجوز قدیمی','COMPAT','مقدار قبلی حفظ می‌شود؛ برای لغو کامل این مشاهده، هر دو گزینهٔ سوابق و اعلان خزانه را خاموش کنید.'),
 ]},
 {id:'reports',title:MENU_TITLES.reports,items:[c('canAccessTreasuryReports','گزارش جامع درخواست‌ها و پرداخت‌ها'),c('canExportReports','گزارش‌گیری و خروجی اکسل (XLSX) و چاپ','ACTION','خروجی فقط دادهٔ مجاز؛ دیدن منوی گزارش جای مجوز خروجی را نمی‌گیرد.')]},
 {id:'master',title:MENU_TITLES.master,items:[c('canManageCompanies','تعریف شرکت‌ها و سازمان‌ها'),c('canManageDepartments','تعریف واحدهای سازمانی'),c('canManageCostCenters','تعریف مراکز هزینه'),c('canManageBankInquiry','تنظیمات استعلام کارت و شبا','ACTION','اتصال‌ها، کلیدها، شرکت‌ها، سقف مصرف و اعتبار؛ مستقل از ابزار استعلام خزانه.'),c('canManageSmsGateway','سامانه پیامک و اطلاع‌رسانی','ACTION')]},
 {id:'users',title:MENU_TITLES.users,items:[c('canManagePersonnelBalances','لغو موردی درخواست اولیه پرداخت پرسنلی با دلیل؛ فقط مدیر اصلی','ACTION'),c('canManageAccountInquiries','تعیین تکلیف موردی و حالت امن استعلام؛ فقط مدیر اصلی','ACTION'),c('canManageUsers','فهرست و مدیریت کاربران','ACTION'),c('canManageRoles','مدیریت نقش‌ها و حدود اختیار','ACTION'),c('canManagePasswordRecovery','درخواست‌های بازیابی رمز عبور','ACTION'),c('canViewSecurityAudit','تاریخچه امنیتی و تغییرات دسترسی')]},
 {id:'settings',title:MENU_TITLES.settings,items:[c('canAccessSettings','دسترسی به منوی تنظیمات و حساب کاربری','DISPLAY','این گزینه نمایش منو را کنترل می‌کند؛ تغییر رمز و مدیریت نشست خود شخص قفل نمی‌شود.'),c('canShowKeyboardHelp','نمایش راهنمای کلیدهای میانبر','DISPLAY'),c('canViewAttachments','مشاهده و دانلود مدارک و پیوست‌ها','SHARED','مدارک، فاکتور و فیش فقط در رکوردهای مجاز همهٔ بخش‌ها.')]},
];
export const PERMISSION_CONTROLS=PERMISSION_GROUPS.flatMap(g=>g.items);
export const TRUE_LEGACY_KEYS=['canAccessApproverWorkspace','canAccessAccountingWorkspace','canHandlePasswordRecovery','canViewAuditLogs'] as const;
export const KNOWN_PERMISSION_KEYS=new Set<string>([...PERMISSION_CONTROLS.map(i=>i.key),...TRUE_LEGACY_KEYS]);
export function permissionValue(p:Partial<RolePermissionSet>,key:PermissionKey):boolean {
 if(p[key]!==undefined)return p[key]===true;
 const fallback=DISPLAY_FALLBACKS[key as DisplayPermission];
 if(fallback==='TRACKING')return Boolean(p.canAccessRequesterSection||p.canViewRequests!==false);
 if(fallback==='INQUIRY')return Boolean(p.canInquireBankDetails||p.canConfirmBankOwner);
 if(fallback==='EXTERNAL')return Boolean(p.canAccessTreasuryManualPayment!==false&&p.canCreateRequest&&p.canSubmitSinglePayment);
 return fallback? p[fallback]===true:false;
}
export function permissionPreset(p:RolePermissionSet,all:boolean):RolePermissionSet {
 const next={...p};for(const item of PERMISSION_CONTROLS)next[item.key]=all;
 if(!all){next.canViewRequests=true;next.canViewAttachments=true;next.canAccessSettings=true;next.canShowTrackingAll=true;}
 return next;
}
export const permissionCount=(p:RolePermissionSet,admin=false)=>PERMISSION_CONTROLS.filter(i=>permissionValue(admin?{...p,...getDefaultPermissionsForRole('ADMIN')}:p,i.key)).length;
export function permissionPatchError(p:unknown,existing?:Partial<RolePermissionSet>):string|undefined {
 if(!p||typeof p!=='object'||Array.isArray(p))return 'ساختار مجوزها معتبر نیست.';
 // Retain an opaque, already stored boolean from an old client, never add/change it.
 if(Object.entries(p).some(([k,v])=>typeof v!=='boolean'||!KNOWN_PERMISSION_KEYS.has(k)&&(!existing||!Object.hasOwn(existing,k)||(existing as Record<string,unknown>)[k]!==v)))return 'نام مجوز یا مقدار آن معتبر نیست؛ هر مجوز باید روشن یا خاموش باشد.';
}
export type PortalSection='PERSONNEL_BALANCES'|'ACCOUNT_INQUIRIES'|'REQUESTER'|'APPROVER'|'ACCOUNTING'|'TREASURY'|'REPORTS'|'ADMIN_PANEL'|'SETTINGS';
export type MenuEntry={id:string;section:PortalSection;tab:string;filter?:string;permission:PermissionKey;requires?:PermissionKey[]};
export const MENU_ENTRIES:MenuEntry[]=[
 {id:'PERSONNEL_BALANCES_CREATE',section:'PERSONNEL_BALANCES',tab:'CREATE',permission:'canViewPersonnelBalances',requires:['canRequestPersonnelBalance']},
 {id:'PERSONNEL_BALANCES_MINE',section:'PERSONNEL_BALANCES',tab:'MINE',permission:'canViewPersonnelBalances'},
 {id:'PERSONNEL_BALANCES_ACCOUNTING',section:'PERSONNEL_BALANCES',tab:'ACCOUNTING',permission:'canViewPersonnelBalances',requires:['canReviewPersonnelBalance','canAccessAccountingCartable','canApprove']},
 ...ACCOUNT_INQUIRY_TABS.map(t=>({id:'ACCOUNT_INQUIRIES_'+t.key,section:'ACCOUNT_INQUIRIES' as const,tab:t.key,permission:t.permission,requires:(t.key==='APPROVAL'?['canApproveAccountInquiry']:t.key==='ACCOUNTING'?['canRespondAccountInquiry']:t.key==='RELEASE'?['canReleaseAccountInquiry']:[]) as PermissionKey[]})),
 {id:'TREASURY_REJECTED',section:'TREASURY',tab:'REJECTED',permission:'canAccessTreasuryRejected'},
 ...[['ADVANCE_SINGLE','canCreateAdvanceSingle'],['ADVANCE_BATCH','canCreateAdvanceBatch'],['PAYMENT_SINGLE','canCreatePaymentSingle'],['PAYMENT_BATCH','canCreatePaymentBatch']].map(([tab,permission])=>({id:'FORM_'+tab,section:'REQUESTER' as const,tab,permission:permission as PermissionKey})),
 ...[['ALL','canShowTrackingAll'],['ADVANCE_SINGLE','canShowTrackingAdvanceSingle'],['ADVANCE_BATCH','canShowTrackingAdvanceBatch'],['PAYMENT_SINGLE','canShowTrackingPaymentSingle'],['PAYMENT_BATCH','canShowTrackingPaymentBatch'],['NEEDS_REVISION','canShowTrackingRevision']].map(([filter,permission])=>({id:'TRACK_'+filter,section:'REQUESTER' as const,tab:'CARTABLE',filter,permission:permission as PermissionKey})),
 ...(['APPROVER','ACCOUNTING'] as const).flatMap(section=>[['PENDING','Pending'],['APPROVED_BY_ME','Approved'],['RETURNED_BY_ME','Returned'],['ALL_MY_RECORDS','All'],['REJECTED_BY_ME','Rejected']].map(([tab,suffix])=>({id:section+'_'+tab,section,tab,permission:('canShow'+(section==='APPROVER'?'Approver':'Accounting')+suffix) as PermissionKey,requires:[section==='APPROVER'?'canAccessApproverCartable':'canAccessAccountingCartable'] as PermissionKey[]}))),
 ...[['QUEUE','canAccessTreasuryQueue'],['IN_PAYMENT','canAccessTreasuryInPayment'],['COMPLETED','canAccessTreasuryCompleted'],['BANK_INQUIRY','canShowTreasuryInquiry'],['BANK_ACCOUNTS','canAccessTreasuryBankAccounts'],['MANUAL','canAccessTreasuryManualPayment'],['EXTERNAL_ORDER','canShowExternalOrder'],['COVER','canAccessTreasuryDailyCover'],['ARCHIVE','canAccessTreasuryArchive']].map(([tab,permission])=>({id:'TREASURY_'+tab,section:'TREASURY' as const,tab,permission:permission as PermissionKey})),
 ...[['MASTER_COMPANIES','canManageCompanies'],['MASTER_DEPARTMENTS','canManageDepartments'],['MASTER_COST_CENTERS','canManageCostCenters'],['BANK_INQUIRY','canManageBankInquiry'],['SMS_GATEWAY','canManageSmsGateway'],['USERS','canManageUsers'],['ROLES','canManageRoles'],['RECOVERY','canManagePasswordRecovery'],['AUDIT','canViewSecurityAudit']].map(([tab,permission])=>({id:'ADMIN_'+tab,section:'ADMIN_PANEL' as const,tab,permission:permission as PermissionKey})),
 {id:'REPORTS',section:'REPORTS',tab:'REPORTS',permission:'canAccessTreasuryReports'},{id:'SETTINGS',section:'SETTINGS',tab:'SETTINGS',permission:'canAccessSettings'},
];
export function menuVisible(p:Partial<RolePermissionSet>,id:string):boolean {
 const e=MENU_ENTRIES.find(e=>e.id===id);if(!e)return false;
 if(!permissionValue(p,e.permission)||e.requires?.some(k=>!permissionValue(p,k)))return false;
 if(id==='TREASURY_BANK_INQUIRY')return Boolean(p.canInquireBankDetails||p.canConfirmBankOwner);
 if(id==='TREASURY_EXTERNAL_ORDER')return Boolean(p.canAccessTreasuryManualPayment&&p.canCreateRequest&&p.canSubmitSinglePayment);
 return true;
}
export const visibleMenus=(p:Partial<RolePermissionSet>,section:PortalSection)=>MENU_ENTRIES.filter(e=>e.section===section&&menuVisible(p,e.id));
export function withNavigationPermissions(p:RolePermissionSet):RolePermissionSet {
 const next={...p};for(const key of Object.keys(DISPLAY_FALLBACKS) as DisplayPermission[])next[key]=permissionValue(p,key);return next;
}
export function effectiveNavigationPermissions(p:RolePermissionSet,roles:RolePermissionSet[],custom:Partial<RolePermissionSet>={}):RolePermissionSet {
 const next={...p};for(const key of Object.keys(DISPLAY_FALLBACKS) as DisplayPermission[]){
  if(custom[key]!==undefined)next[key]=custom[key]===true;
  else if(roles.some(r=>r[key]===true))next[key]=true;
  // Fully legacy roles retain composite effective fallbacks. Once configured,
  // an unrelated role with no access must not resurrect an explicitly hidden tab.
  else if(roles.every(r=>r[key]===undefined))next[key]=permissionValue({...p,[key]:undefined},key);
  else next[key]=roles.some(r=>r[key]===undefined&&permissionValue(r,key));
 }return next;
}
export const selectedMenuId=(section:PortalSection,tab:string,filter='ALL')=>section==='REQUESTER'?(tab==='CARTABLE'?'TRACK_'+filter:'FORM_'+tab):section==='ADMIN_PANEL'?'ADMIN_'+tab:section==='REPORTS'||section==='SETTINGS'?section:section+'_'+tab;
export function supervisorCompanyAllowed(user:User,company:string,roleConfigs:{role:string;allowedCompanies:string[]}[],companies:{id:string;name:string}[]):boolean {
 if(user.role==='ADMIN')return true;
 if(user.supervisorAllowedCompanies!==undefined)return user.supervisorAllowedCompanies.includes(company.trim());
 const roles=new Set([user.role,...(user.additionalRoles||[])]),allowed=new Set(roleConfigs.filter(r=>roles.has(r.role)).flatMap(r=>r.allowedCompanies||[]).map(s=>s.trim()));
 for(const c of companies)if(allowed.has(c.id)||allowed.has(c.name)){allowed.add(c.id);allowed.add(c.name);}return !!company&&allowed.has(company.trim());
}
