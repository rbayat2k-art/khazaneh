import type {BankDestination,InquiryConfig,InquiryJob,InquiryOperation} from '../utils/bank-inquiry';
export type BuiltInRole = 'ADMIN' | 'REQUESTER' | 'APPROVER' | 'ACCOUNTING' | 'TREASURY';
export type Role = BuiltInRole | string;

export type RequestStatus =
  | 'Pending_Approver'
  | 'Pending_Accounting'
  | 'Pending_Treasury'
  | 'In_Payment'
  | 'Paid'
  | 'Needs_Revision'
  | 'Rejected'
  | 'Closed'
  | 'Mixed';

export type TreasurySubTab =
  | 'QUEUE'
  | 'IN_PAYMENT'
  | 'COMPLETED'
  | 'BANK_ACCOUNTS'
  | 'MANUAL'
  | 'EXTERNAL_ORDER'
  | 'BANK_INQUIRY'
  | 'COVER'
  | 'ARCHIVE';

export type ApprovalCategoryTab =
  | 'PENDING'
  | 'APPROVED_BY_ME'
  | 'RETURNED_BY_ME'
  | 'REJECTED_BY_ME'
  | 'ALL_MY_RECORDS';

export type PaymentMethodType =
  | 'IBAN_PAYA_SATNA'
  | 'ACCOUNT_TRANSFER'
  | 'CARD_TO_CARD'
  | 'IBAN'
  | 'CARD'
  | 'INTERNAL_ACCOUNT'
  | 'CUSTOM_ID'
  | 'INTERNAL'
  | 'PAYA'
  | 'SATNA'
  | 'CHECK';

export type Priority = 'Normal' | 'Urgent';

export type CoverStatus = 'Open' | 'Closed';

export const SYSTEM_BANKS = [
  'بانک ملت',
  'بانک سامان',
  'بانک تجارت',
  'بانک پاسارگاد',
  'بانک ملی ایران',
  'بانک صادرات',
  'بانک پارسیان',
  'بانک سپه',
  'بانک کشاورزی',
  'بانک مسکن',
  'بانک آینده',
  'بانک شهر',
  'بانک رفاه کارگران',
  'بانک رسالت',
  'بانک قرض‌الحسنه مهر ایران',
] as const;

export interface AttachmentFile {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string; // base64 or storage url
  uploadedAt: string;
  uploadedBy?: string;
}

/** Optional technical-correction assignment; existing approvals and financial content stay pinned. */
export interface TreasuryCorrection {
  toUserId: string;
  toName: string;
  toStage: 'REQUESTER' | 'APPROVER' | 'ACCOUNTING';
  byUserId: string;
  byName: string;
  reason: string;
  at: string;
  fromPool: 'Pending_Treasury' | 'In_Payment';
  approvedVersion: number;
  resolvedAt?: string;
}

export interface ReviewComment {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: Role;
  text: string;
  createdAt: string;
}

export interface ItemAuditEntry {
  id: string;
  action: string;
  changedBy: string;
  changedAt: string;
  actorId?: string;
  actorRole?: Role;
  stage?: 'REQUESTER' | 'APPROVER' | 'ACCOUNTING' | 'TREASURY';
  decision?: 'SUBMIT' | 'RESUBMIT' | 'EDIT_SUBMITTED' | 'DELETE_SUBMITTED' | 'APPROVE' | 'RETURN_FOR_REVISION' | 'REJECT' | 'CLOSE_REJECTED' | 'UPDATE_AMOUNT' | 'PAY';
  previousStatus?: RequestStatus;
  version?: number;
  invalidatedByVersion?: number | null;
  previousAmount?: number;
  newAmount?: number;
  reason?: string;
  comment?: string;
}

export interface SourceBankAccountSnapshot {
  id?: string;
  accountId?: string;
  accountTitle: string;
  bankName: string;
  accountHolderName?: string;
  company?: string;
  companyName?: string;
  accountNumber: string;
  cardNumber?: string;
  iban?: string;
  branchName?: string;
  branchCode?: string;
  accountType?: string;
  currency?: 'IRR';
  capturedAt?: string;
}

export interface CompanyBankAccount {
  id: string;
  accountTitle: string;
  bankName: string;
  accountHolderName?: string;
  company?: string;
  companyName?: string;
  accountNumber: string; // string to preserve leading zeros
  cardNumber?: string;   // optional, string to preserve leading zeros
  iban?: string;         // string (24 digits or IR + 24 digits)
  branchName?: string;
  branchCode?: string;
  accountType?: string;
  currency?: 'IRR';
  supportedMethods?: PaymentMethodType[];
  allowedPaymentMethods?: PaymentMethodType[];
  status?: 'ACTIVE' | 'INACTIVE';
  isActive?: boolean;
  isDefault?: boolean;
  description?: string;
  createdAt: string;
  createdBy?: string;
  updatedAt?: string | null;
  updatedBy?: string | null;
  auditHistory?: Array<{
    id: string;
    action: string;
    actorId: string;
    actorName: string;
    timestamp: string;
  }>;
}

export interface PaymentExecutionRecord {
  id: string;
  amount: number;
  paymentMethod?: PaymentMethodType;
  sourceBankAccountId: string | null;
  sourceAccountSnapshot?: SourceBankAccountSnapshot | null;
  paidBankName?: string;
  bankRefNumber?: string;
  trackingCode?: string;
  dateJalali?: string;
  paidDateJalali?: string;
  executedDateJalali?: string;
  paymentDate?: string;
  executedAt?: string;
  paidAt?: string;
  executedById?: string;
  executedByUserId?: string;
  treasuryUserId?: string;
  executedByName?: string;
  executedByUserName?: string;
  treasuryUserName?: string;
  receiptId?: string;
  receiptAttachmentName?: string;
  idempotencyKey?: string;
  note?: string;
  notes?: string;
}

export type AccessScope =
  | 'SELF_ONLY'
  | 'ASSIGNED_AND_SUBORDINATES'
  | 'DEPARTMENT'
  | 'COMPANY_WIDE';

export interface RolePermissionSet {
  canManageBankInquiry?:boolean;
  canInquireBankDetails?:boolean;
  canConfirmBankOwner?:boolean;
  // 1. کارتابل درخواست‌ها و امور متقاضیان
  canViewRequests: boolean;           // مشاهده کارتابل و سوابق درخواست‌ها
  canCreateRequest: boolean;          // مجوز کلی ثبت درخواست جدید
  canAccessRequesterSection?: boolean;// نمایش منوی ثبت و پیگیری درخواست‌ها
  canCreatePaymentBatch?: boolean;    // ثبت دستور پرداخت تجمیعی
  canCreatePaymentSingle?: boolean;   // ثبت دستور پرداخت تکی
  canCreateAdvanceBatch?: boolean;    // ثبت مساعده گروهی پرسنل
  canCreateAdvanceSingle?: boolean;   // ثبت مساعده تکی حقوق
  canSubmitBatchPayment?: boolean;    // سازگاری با کلید قبلی
  canSubmitSinglePayment?: boolean;   // سازگاری با کلید قبلی
  canSubmitBatchAdvance?: boolean;    // سازگاری با کلید قبلی
  canSubmitSingleAdvance?: boolean;   // سازگاری با کلید قبلی
  canResubmitRevision?: boolean;      // اصلاح و ارسال مجدد موارد برگشتی
  canViewAttachments: boolean;        // مشاهده مدارک، فاکتورها و پیوست‌ها

  // 2. کارتابل‌های تایید و بررسی (سرپرست و حسابداری)
  canAccessApproverCartable?: boolean;    // دسترسی به کارتابل تایید سرپرست واحد
  canAccessAccountingCartable?: boolean;  // دسترسی به کارتابل بررسی مالی حسابداری
  canAccessApproverWorkspace?: boolean;   // سازگاری با کلید قبلی
  canAccessAccountingWorkspace?: boolean; // سازگاری با کلید قبلی
  canApprove: boolean;                    // تایید ردیف‌ها و اسناد مالی (در سقف مجاز)
  canEditAmount: boolean;                 // ویرایش مبلغ مصوب و ثبت یادداشت بررسی
  canReturnForRevision: boolean;          // برگشت درخواست جهت اصلاح به متقاضی

  // 3. میز کار خزانه‌داری و عملیات پرداخت
  canAccessTreasuryWorkspace?: boolean;      // دسترسی به میز کار خزانه‌داری
  canAccessTreasuryQueue?: boolean;          // زیرمنوی صف پرداخت‌های در انتظار
  canAccessTreasuryInPayment?: boolean;      // زیرمنوی مخزن در حال پرداخت
  canAccessTreasuryCompleted?: boolean;      // زیرمنوی پرداختی‌های انجام‌شده
  canAccessTreasuryBankAccounts?: boolean;   // زیرمنوی بانک‌ها و شماره‌حساب‌ها
  canAccessTreasuryManualPayment?: boolean;  // زیرمنوی ثبت پرداخت دستی و تلفنی
  canAccessTreasuryDailyCover?: boolean;     // زیرمنوی روکش روزانه بانک‌ها
  canAccessTreasuryArchive?: boolean;        // زیرمنوی بایگانی پوشه‌های روز پرداخت
  canViewTreasuryQueue?: boolean;            // سازگاری با کلید قبلی
  canExecutePayment: boolean;                // ثبت پرداخت قطعی و صدور فیش بانکی
  canManageBankAccounts?: boolean;           // سازگاری با کلید قبلی
  canCreateManualPayment?: boolean;          // سازگاری با کلید قبلی
  canCloseDailyCover?: boolean;              // سازگاری با کلید قبلی
  canViewReceiptArchive?: boolean;           // سازگاری با کلید قبلی
  canExportReports: boolean;                 // تهیه خروجی اکسل (XLSX) و گزارش چاپی
  canAccessTreasuryReports?:boolean; // گزارش جامع مستقل؛ صرفاً خواندن در شرکت‌های مجاز

  // 4. مدیریت اطلاعات پایه سازمان (منوی اطلاعات پایه)
  canManageCompanies?: boolean;           // تعریف و مدیریت شرکت‌ها و سازمان‌ها
  canManageDepartments?: boolean;         // تعریف و مدیریت واحدهای سازمانی
  canManageCostCenters?: boolean;         // تعریف و مدیریت مراکز هزینه
  canManageSmsGateway?: boolean;          // تنظیمات و تست سامانه پیامک (SMS Gateway)

  // 5. مدیریت کاربران، نقش‌ها و امنیت سامانه
  canManageUsers: boolean;                // تعریف و مدیریت کاربران و ساختار سرپرستی
  canManageRoles?: boolean;               // افزودن نقش جدید و مدیریت دسترسی نقش‌ها
  canManagePasswordRecovery?: boolean;    // بررسی درخواست‌های بازیابی رمز عبور
  canViewSecurityAudit?: boolean;         // مشاهده تاریخچه امنیتی و تغییرات دسترسی
  canHandlePasswordRecovery?: boolean;    // سازگاری با کلید قبلی
  canViewAuditLogs?: boolean;             // سازگاری با کلید قبلی
  canAccessSettings?: boolean;            // دسترسی به منوی تنظیمات حساب کاربری
}

export interface RoleDefinitionConfig {
  role: Role;
  title: string;
  description: string;
  isCustom?: boolean;
  baseTemplateRole?: BuiltInRole;
  defaultLandingSection?: 'REQUESTER' | 'APPROVER' | 'ACCOUNTING' | 'TREASURY' | 'ADMIN_PANEL' | 'SETTINGS';
  accessScope: AccessScope;
  allowedCompanies: string[];
  approvalLimitRial: number; // سقف مجاز تأیید (ریال)
  paymentLimitRial: number;  // سقف مجاز پرداخت (ریال)
  permissions: RolePermissionSet;
  updatedAt?: string;
  updatedBy?: string;
}

export function getDefaultPermissionsForRole(
  roleKey: string,
  baseTemplate?: BuiltInRole
): RolePermissionSet {
  const target = (baseTemplate || roleKey || 'REQUESTER').toUpperCase();
  if (target === 'ADMIN') {
    return {
      canViewRequests: true,
      canCreateRequest: true,
      canAccessRequesterSection: true,
      canCreatePaymentBatch: true,
      canCreatePaymentSingle: true,
      canCreateAdvanceBatch: true,
      canCreateAdvanceSingle: true,
      canSubmitBatchPayment: true,
      canSubmitSinglePayment: true,
      canSubmitBatchAdvance: true,
      canSubmitSingleAdvance: true,
      canResubmitRevision: true,
      canViewAttachments: true,
      canAccessApproverCartable: true,
      canAccessAccountingCartable: true,
      canAccessApproverWorkspace: true,
      canAccessAccountingWorkspace: true,
      canApprove: true,
      canEditAmount: true,
      canReturnForRevision: true,
      canAccessTreasuryWorkspace: true,
      canAccessTreasuryQueue: true,
      canAccessTreasuryInPayment: true,
      canAccessTreasuryCompleted: true,
      canAccessTreasuryBankAccounts: true,
      canAccessTreasuryManualPayment: true,
      canAccessTreasuryDailyCover: true,
      canAccessTreasuryArchive: true,
      canViewTreasuryQueue: true,
      canExecutePayment: true,
      canManageBankAccounts: true,
      canCreateManualPayment: true,
      canCloseDailyCover: true,
      canViewReceiptArchive: true,
      canExportReports: true,
      canAccessTreasuryReports: ['ADMIN','ACCOUNTING','TREASURY'].includes(roleKey),
      canManageCompanies: true,
      canManageDepartments: true,
      canManageCostCenters: true,
      canManageSmsGateway: true,
      canManageUsers: true,
      canManageRoles: true,
      canManagePasswordRecovery: true,
      canViewSecurityAudit: true,
      canHandlePasswordRecovery: true,
      canViewAuditLogs: true,
      canAccessSettings: true,
    };
  }
  if (target === 'APPROVER') {
    return {
      canViewRequests: true,
      canCreateRequest: true,
      canAccessRequesterSection: true,
      canCreatePaymentBatch: true,
      canCreatePaymentSingle: true,
      canCreateAdvanceBatch: true,
      canCreateAdvanceSingle: true,
      canSubmitBatchPayment: true,
      canSubmitSinglePayment: true,
      canSubmitBatchAdvance: true,
      canSubmitSingleAdvance: true,
      canResubmitRevision: true,
      canViewAttachments: true,
      canAccessApproverCartable: true,
      canAccessAccountingCartable: false,
      canAccessApproverWorkspace: true,
      canAccessAccountingWorkspace: false,
      canApprove: true,
      canEditAmount: true,
      canReturnForRevision: true,
      canAccessTreasuryWorkspace: false,
      canAccessTreasuryQueue: false,
      canAccessTreasuryInPayment: false,
      canAccessTreasuryCompleted: false,
      canAccessTreasuryBankAccounts: false,
      canAccessTreasuryManualPayment: false,
      canAccessTreasuryDailyCover: false,
      canAccessTreasuryArchive: false,
      canViewTreasuryQueue: false,
      canExecutePayment: false,
      canManageBankAccounts: false,
      canCreateManualPayment: false,
      canCloseDailyCover: false,
      canViewReceiptArchive: false,
      canExportReports: true,
      canAccessTreasuryReports: ['ADMIN','ACCOUNTING','TREASURY'].includes(roleKey),
      canManageCompanies: false,
      canManageDepartments: false,
      canManageCostCenters: false,
      canManageSmsGateway: false,
      canManageUsers: false,
      canManageRoles: false,
      canManagePasswordRecovery: false,
      canViewSecurityAudit: false,
      canHandlePasswordRecovery: false,
      canViewAuditLogs: false,
      canAccessSettings: true,
    };
  }
  if (target === 'ACCOUNTING') {
    return {
      canViewRequests: true,
      canCreateRequest: true,
      canAccessRequesterSection: true,
      canCreatePaymentBatch: true,
      canCreatePaymentSingle: true,
      canCreateAdvanceBatch: true,
      canCreateAdvanceSingle: true,
      canSubmitBatchPayment: true,
      canSubmitSinglePayment: true,
      canSubmitBatchAdvance: true,
      canSubmitSingleAdvance: true,
      canResubmitRevision: true,
      canViewAttachments: true,
      canAccessApproverCartable: false,
      canAccessAccountingCartable: true,
      canAccessApproverWorkspace: false,
      canAccessAccountingWorkspace: true,
      canApprove: true,
      canEditAmount: true,
      canReturnForRevision: true,
      canAccessTreasuryWorkspace: false,
      canAccessTreasuryQueue: false,
      canAccessTreasuryInPayment: false,
      canAccessTreasuryCompleted: false,
      canAccessTreasuryBankAccounts: false,
      canAccessTreasuryManualPayment: false,
      canAccessTreasuryDailyCover: false,
      canAccessTreasuryArchive: true,
      canViewTreasuryQueue: true,
      canExecutePayment: false,
      canManageBankAccounts: false,
      canCreateManualPayment: false,
      canCloseDailyCover: false,
      canViewReceiptArchive: true,
      canExportReports: true,
      canAccessTreasuryReports: ['ADMIN','ACCOUNTING','TREASURY'].includes(roleKey),
      canManageCompanies: false,
      canManageDepartments: false,
      canManageCostCenters: true,
      canManageSmsGateway: false,
      canManageUsers: false,
      canManageRoles: false,
      canManagePasswordRecovery: false,
      canViewSecurityAudit: false,
      canHandlePasswordRecovery: false,
      canViewAuditLogs: false,
      canAccessSettings: true,
    };
  }
  if (target === 'TREASURY') {
    return {
      canViewRequests: true,
      canCreateRequest: true,
      canAccessRequesterSection: true,
      canCreatePaymentBatch: true,
      canCreatePaymentSingle: true,
      canCreateAdvanceBatch: true,
      canCreateAdvanceSingle: true,
      canSubmitBatchPayment: true,
      canSubmitSinglePayment: true,
      canSubmitBatchAdvance: true,
      canSubmitSingleAdvance: true,
      canResubmitRevision: true,
      canViewAttachments: true,
      canAccessApproverCartable: false,
      canAccessAccountingCartable: false,
      canAccessApproverWorkspace: false,
      canAccessAccountingWorkspace: false,
      canApprove: false,
      canEditAmount: false,
      canReturnForRevision: false,
      canAccessTreasuryWorkspace: true,
      canAccessTreasuryQueue: true,
      canAccessTreasuryInPayment: true,
      canAccessTreasuryCompleted: true,
      canAccessTreasuryBankAccounts: true,
      canAccessTreasuryManualPayment: true,
      canAccessTreasuryDailyCover: true,
      canAccessTreasuryArchive: true,
      canViewTreasuryQueue: true,
      canExecutePayment: true,
      canManageBankAccounts: true,
      canCreateManualPayment: true,
      canCloseDailyCover: true,
      canViewReceiptArchive: true,
      canExportReports: true,
      canAccessTreasuryReports: ['ADMIN','ACCOUNTING','TREASURY'].includes(roleKey),
      canManageCompanies: false,
      canManageDepartments: false,
      canManageCostCenters: false,
      canManageSmsGateway: false,
      canManageUsers: false,
      canManageRoles: false,
      canManagePasswordRecovery: false,
      canViewSecurityAudit: false,
      canHandlePasswordRecovery: false,
      canViewAuditLogs: false,
      canAccessSettings: true,
    };
  }
  // Default: REQUESTER
  return {
    canViewRequests: true,
    canCreateRequest: true,
    canAccessRequesterSection: true,
    canCreatePaymentBatch: true,
    canCreatePaymentSingle: true,
    canCreateAdvanceBatch: true,
    canCreateAdvanceSingle: true,
    canSubmitBatchPayment: true,
    canSubmitSinglePayment: true,
    canSubmitBatchAdvance: true,
    canSubmitSingleAdvance: true,
    canResubmitRevision: true,
    canViewAttachments: true,
    canAccessApproverCartable: false,
    canAccessAccountingCartable: false,
    canAccessApproverWorkspace: false,
    canAccessAccountingWorkspace: false,
    canApprove: false,
    canEditAmount: false,
    canReturnForRevision: false,
    canAccessTreasuryWorkspace: false,
    canAccessTreasuryQueue: false,
    canAccessTreasuryInPayment: false,
    canAccessTreasuryCompleted: false,
    canAccessTreasuryBankAccounts: false,
    canAccessTreasuryManualPayment: false,
    canAccessTreasuryDailyCover: false,
    canAccessTreasuryArchive: false,
    canViewTreasuryQueue: false,
    canExecutePayment: false,
    canManageBankAccounts: false,
    canCreateManualPayment: false,
    canCloseDailyCover: false,
    canViewReceiptArchive: false,
    canExportReports: false,
      canAccessTreasuryReports: ['ADMIN','ACCOUNTING','TREASURY'].includes(roleKey),
    canManageCompanies: false,
    canManageDepartments: false,
    canManageCostCenters: false,
    canManageSmsGateway: false,
    canManageUsers: false,
    canManageRoles: false,
    canManagePasswordRecovery: false,
    canViewSecurityAudit: false,
    canHandlePasswordRecovery: false,
    canViewAuditLogs: false,
    canAccessSettings: true,
  };
}

export function normalizeRolePermissionSet(
  perms: Partial<RolePermissionSet> | undefined,
  roleKey: string,
  baseTemplate?: BuiltInRole
): RolePermissionSet {
  const defaults = {...getDefaultPermissionsForRole(roleKey, baseTemplate),canManageBankInquiry:roleKey==='ADMIN',canInquireBankDetails:roleKey==='ADMIN',canConfirmBankOwner:roleKey==='ADMIN'};
  if (!perms) return defaults;
  return {
    ...defaults,
    ...perms,
    canAccessTreasuryReports:perms.canAccessTreasuryReports===undefined?defaults.canAccessTreasuryReports:perms.canAccessTreasuryReports===true,
    canAccessRequesterSection:
      perms.canAccessRequesterSection ??
      perms.canCreateRequest ??
      perms.canViewRequests ??
      defaults.canAccessRequesterSection,
    canCreatePaymentBatch:
      perms.canCreatePaymentBatch ??
      perms.canSubmitBatchPayment ??
      perms.canCreateRequest ??
      defaults.canCreatePaymentBatch,
    canCreatePaymentSingle:
      perms.canCreatePaymentSingle ??
      perms.canSubmitSinglePayment ??
      perms.canCreateRequest ??
      defaults.canCreatePaymentSingle,
    canCreateAdvanceBatch:
      perms.canCreateAdvanceBatch ??
      perms.canSubmitBatchAdvance ??
      perms.canCreateRequest ??
      defaults.canCreateAdvanceBatch,
    canCreateAdvanceSingle:
      perms.canCreateAdvanceSingle ??
      perms.canSubmitSingleAdvance ??
      perms.canCreateRequest ??
      defaults.canCreateAdvanceSingle,
    canSubmitBatchPayment:
      perms.canSubmitBatchPayment ??
      perms.canCreatePaymentBatch ??
      perms.canCreateRequest ??
      defaults.canSubmitBatchPayment,
    canSubmitSinglePayment:
      perms.canSubmitSinglePayment ??
      perms.canCreatePaymentSingle ??
      perms.canCreateRequest ??
      defaults.canSubmitSinglePayment,
    canSubmitBatchAdvance:
      perms.canSubmitBatchAdvance ??
      perms.canCreateAdvanceBatch ??
      perms.canCreateRequest ??
      defaults.canSubmitBatchAdvance,
    canSubmitSingleAdvance:
      perms.canSubmitSingleAdvance ??
      perms.canCreateAdvanceSingle ??
      perms.canCreateRequest ??
      defaults.canSubmitSingleAdvance,
    canResubmitRevision:
      perms.canResubmitRevision ?? perms.canCreateRequest ?? defaults.canResubmitRevision,
    canAccessApproverCartable:
      perms.canAccessApproverCartable ??
      perms.canAccessApproverWorkspace ??
      defaults.canAccessApproverCartable,
    canAccessAccountingCartable:
      perms.canAccessAccountingCartable ??
      perms.canAccessAccountingWorkspace ??
      defaults.canAccessAccountingCartable,
    canAccessApproverWorkspace:
      perms.canAccessApproverWorkspace ??
      perms.canAccessApproverCartable ??
      defaults.canAccessApproverWorkspace,
    canAccessAccountingWorkspace:
      perms.canAccessAccountingWorkspace ??
      perms.canAccessAccountingCartable ??
      defaults.canAccessAccountingWorkspace,
    canAccessTreasuryWorkspace:
      perms.canAccessTreasuryWorkspace ??
      perms.canAccessTreasuryQueue ??
      perms.canExecutePayment ??
      defaults.canAccessTreasuryWorkspace,
    canAccessTreasuryQueue:
      perms.canAccessTreasuryQueue ??
      perms.canViewTreasuryQueue ??
      perms.canExecutePayment ??
      defaults.canAccessTreasuryQueue,
    canAccessTreasuryInPayment:
      perms.canAccessTreasuryInPayment ??
      perms.canViewTreasuryQueue ??
      perms.canExecutePayment ??
      defaults.canAccessTreasuryInPayment,
    canAccessTreasuryCompleted:
      perms.canAccessTreasuryCompleted ??
      perms.canViewTreasuryQueue ??
      perms.canExecutePayment ??
      defaults.canAccessTreasuryCompleted,
    canAccessTreasuryBankAccounts:
      perms.canAccessTreasuryBankAccounts ??
      perms.canManageBankAccounts ??
      defaults.canAccessTreasuryBankAccounts,
    canAccessTreasuryManualPayment:
      perms.canAccessTreasuryManualPayment ??
      perms.canCreateManualPayment ??
      perms.canExecutePayment ??
      defaults.canAccessTreasuryManualPayment,
    canAccessTreasuryDailyCover:
      perms.canAccessTreasuryDailyCover ??
      perms.canCloseDailyCover ??
      perms.canExecutePayment ??
      defaults.canAccessTreasuryDailyCover,
    canAccessTreasuryArchive:
      perms.canAccessTreasuryArchive ??
      perms.canViewReceiptArchive ??
      perms.canExecutePayment ??
      defaults.canAccessTreasuryArchive,
    canManageBankInquiry:perms.canManageBankInquiry??defaults.canManageBankInquiry,
    canInquireBankDetails:perms.canInquireBankDetails??defaults.canInquireBankDetails,
    canConfirmBankOwner:perms.canConfirmBankOwner??defaults.canConfirmBankOwner,
    canManageCompanies:
      perms.canManageCompanies ?? perms.canManageUsers ?? defaults.canManageCompanies,
    canManageDepartments:
      perms.canManageDepartments ?? perms.canManageUsers ?? defaults.canManageDepartments,
    canManageCostCenters:
      perms.canManageCostCenters ?? perms.canManageUsers ?? defaults.canManageCostCenters,
    canManageSmsGateway:
      perms.canManageSmsGateway ?? perms.canManageUsers ?? defaults.canManageSmsGateway,
    canManageRoles:
      perms.canManageRoles ?? perms.canManageUsers ?? defaults.canManageRoles,
    canManagePasswordRecovery:
      perms.canManagePasswordRecovery ??
      perms.canHandlePasswordRecovery ??
      perms.canManageUsers ??
      defaults.canManagePasswordRecovery,
    canViewSecurityAudit:
      perms.canViewSecurityAudit ??
      perms.canViewAuditLogs ??
      perms.canManageUsers ??
      defaults.canViewSecurityAudit,
    canAccessSettings: perms.canAccessSettings ?? defaults.canAccessSettings ?? true,
  };
}

export interface UserPersonalPreferences {
  defaultSection?: 'REQUESTER' | 'APPROVER' | 'ACCOUNTING' | 'TREASURY' | 'ADMIN_PANEL' | 'SETTINGS';
  tablePageSize?: number;
  notifyOnSubmit?: boolean;
  notifyOnRevision?: boolean;
  notifyOnApproval?: boolean;
  notifyOnPayment?: boolean;
  desktopPushEnabled?: boolean;
}

export interface OrganizationCompany {
  id: string;
  code: string; // string to preserve leading zeros e.g. "01"
  name: string;
  nationalId?: string; // شناسه ملی / ثبتی (string)
  description?: string;
  isActive: boolean;
  isDefault?: boolean;
  createdAt: string;
  updatedAt?: string | null;
}

export interface OrganizationalDepartment {
  id: string;
  code: string; // string to preserve leading zeros e.g. "0101"
  name: string;
  companyId: string;
  companyName: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string | null;
}

export interface CostCenterItem {
  id: string;
  code: string; // string to preserve leading zeros e.g. "CC-0101"
  name: string;
  companyId: string;
  companyName: string;
  departmentId?: string | null;
  departmentName?: string | null;
  budgetLimitRial?: number | null;
  budgetCategory?: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string | null;
}

export type SmsGatewayProvider =
  | 'KAVENEGAR'
  | 'MELIPAYAMAK'
  | 'FARAZSMS'
  | 'FARAZ_SMS'
  | 'SMSIR'
  | 'CUSTOM_REST';

export type SmsProviderType = SmsGatewayProvider;

export interface SmsEventTriggers {
  sendOtpOnRecovery: boolean;
  sendOnAdminPasswordReset?: boolean;
  sendOnPasswordReset?: boolean;
  sendOnRequestSubmitted?: boolean;
  sendOnPendingApproval?: boolean;
  sendOnReturnedForRevision?: boolean;
  sendOnRevisionOrReject?: boolean;
  sendOnFinalApproval?: boolean;
  sendOnPaymentExecuted: boolean;
}

export interface SmsGatewayConfig {
  enabled: boolean;
  provider: SmsGatewayProvider;
  apiUrl: string;
  senderNumber: string;
  apiKey?: string; // server-only secret; never returned to client
  hasApiKey?: boolean;
  maskedApiKey?: string;
  username?: string;
  password?: string; // server-only secret; never returned to client
  domain?: string;
  events: SmsEventTriggers;
  lastTestedAt?: string | null;
  lastTestStatus?: 'SUCCESS' | 'FAILED' | null;
  lastTestMessage?: string | null;
  updatedAt?: string | null;
  updatedBy?: string | null;
}

export interface SmsDispatchLogEntry {
  id: string;
  eventType:
    | 'OTP_RECOVERY'
    | 'ADMIN_PASSWORD_RESET'
    | 'PASSWORD_RESET'
    | 'REQUEST_SUBMITTED'
    | 'PENDING_APPROVAL'
    | 'RETURNED_FOR_REVISION'
    | 'REVISION_OR_REJECT'
    | 'FINAL_APPROVAL'
    | 'PAYMENT_EXECUTED'
    | 'ADMIN_TEST_SMS'
    | 'ADMIN_TEST';
  recipientName: string;
  recipientPhone: string;
  messagePreview: string;
  messageSummary?: string;
  provider: SmsGatewayProvider;
  status: 'SENT' | 'FAILED' | 'SKIPPED_NOT_CONFIGURED' | 'SKIPPED_DISABLED';
  providerMessageId?: string | null;
  errorDetail?: string | null;
  errorMessage?: string | null;
  relatedTrackingCode?: string | null;
  createdAt: string;
  timestamp?: string;
}

export interface SecurityAuditLogEntry {
  id: string;
  actionType:
    | 'USER_CREATED'
    | 'USER_UPDATED'
    | 'ROLE_CHANGED'
    | 'LIMIT_CHANGED'
    | 'SUPERVISOR_CHANGED'
    | 'USER_DEACTIVATED'
    | 'USER_ACTIVATED'
    | 'PASSWORD_RESET'
    | 'PASSWORD_CHANGED'
    | 'ROLE_CONFIG_UPDATED'
    | 'PENDING_REASSIGNED'
    | '2FA_CHANGED'
    | 'LOGIN_LOCKED'
    | 'USER_LOGOUT'
    | 'OTP_RECOVERY_COMPLETED'
    | 'BANK_ACCOUNT_CREATED'
    | 'BANK_ACCOUNT_UPDATED'
    | 'BANK_ACCOUNT_STATUS_CHANGED'
    | 'MASTER_DATA_CHANGED'
    | 'SMS_CONFIG_UPDATED'
    | 'SMS_TEST_DISPATCHED';
  actorId: string;
  actorName: string;
  targetUserId?: string | null;
  targetUserName?: string | null;
  description: string;
  createdAt: string;
}

export interface PasswordRecoveryRequest {
  id: string;
  trackingCode: string;
  personnelCode: string;
  userName?: string;
  userId?: string | null;
  phone: string;
  note: string;
  status: 'Pending' | 'Resolved' | 'Rejected';
  createdAt: string;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
}

export interface UserSessionRecord {
  token: string;
  userId: string;
  createdAt: number;
  expiresAt: number;
  revoked: boolean;
  revokedReason?: string;
}

export interface User {
  id: string;
  name: string;
  personnelCode: string;
  department: string;
  company?: string;
  role: Role;
  additionalRoles?: Role[];
  password?: string;      // legacy migration only; never sent to client
  passwordHash?: string;  // server-only; never sent to client
  passwordSalt?: string;  // server-only; never sent to client
  phone?: string;
  supervisorId?: string | null;
  supervisorName?: string | null;
  isActive?: boolean;
  accessScope?: AccessScope;
  financialApprovalLimit?: number | null;
  paymentExecutionLimit?: number | null;
  customPermissions?: Partial<RolePermissionSet> | null;
  mustChangePassword?: boolean;
  twoFactorEnabled?: boolean;
  twoFactorPinHash?: string; // server-only; never sent to client
  preferences?: UserPersonalPreferences;
  // Computed server-side effective fields attached on sanitize:
  effectivePermissions?: RolePermissionSet;
  effectiveAccessScope?: AccessScope;
  effectiveApprovalLimitRial?: number;
  effectivePaymentLimitRial?: number;
}

export interface BatchItem extends BankDestination {
  treasuryCorrection?: TreasuryCorrection;
  requesterDeletedAt?: string;
  requesterDeletedBy?: string;
  reviewRejection?:ReviewRejection;
  reviewStartedAt?: string;
  requesterEditedAt?: string;
  id: string;
  itemType?: 'PAYMENT' | 'ADVANCE';
  payeeName: string;
  amount: number;
  initialAmount?: number;
  approvedAmount?: number | null;
  accountOrCard: string;
  iban: string;
  bankName: string;
  description: string;
  invoiceNumber: string;
  costCenter: string;
  requestedMonth?: string;
  status?: RequestStatus;
  version?: number;
  isResubmitted?: boolean;
  resubmittedAt?: string | null;
  invalidatedPriorApproval?: boolean;
  approverId?: string | null;
  approverName?: string | null;
  approverDecidedAt?: string | null;
  approvedByApproverAt?: string | null;
  approverApprovedVersion?: number | null;
  approverDecisionVersion?: number | null;
  approverNote?: string | null;
  approvedBySupervisorUserId?: string | null;
  approvedBySupervisorName?: string | null;
  approvedBySupervisorAt?: string | null;
  accountingId?: string | null;
  accountingName?: string | null;
  accountingDecidedAt?: string | null;
  accountingApprovedVersion?: number | null;
  accountingDecisionVersion?: number | null;
  accountingNote?: string | null;
  approvedByAccountingUserId?: string | null;
  approvedByAccountingName?: string | null;
  approvedByAccountingAt?: string | null;
  rejectionReason?: string | null;
  returnedReason?: string | null;
  returnedById?: string | null;
  returnedByUserId?: string | null;
  returnedByRole?: Role | null;
  returnedByName?: string | null;
  returnedAt?: string | null;
  inPaymentAt?: string | null;
  inPaymentBy?: string | null;
  comments?: ReviewComment[];
  auditHistory?: ItemAuditEntry[];
  attachments?: AttachmentFile[];
  paidAmountSoFar?: number;
  paidAmount?: number;
  remainingAmount?: number;
  remainingPayableAmount?: number;
  paymentExecutions?: PaymentExecutionRecord[];
  paymentHistory?: PaymentExecutionRecord[];
  sourceBankAccountId?: string | null;
  sourceAccountSnapshot?: SourceBankAccountSnapshot | null;
  paidBankName?: string | null;
  paidAt?: string | null;
  paidDateJalali?: string | null;
  receiptId?: string | null;
}

export interface BatchPaymentRequest {
  createdAtIso?: string; // Server registration instant; legacy date-only records stay untouched.
  requesterDeletedAt?: string;
  requesterDeletedBy?: string;
  deletedItems?: BatchItem[];
  companyId?: string;
  id: string;
  trackingCode: string;
  batchType?: 'PAYMENT' | 'ADVANCE';
  title: string;
  totalAmount: number;
  itemCount: number;
  requesterId: string;
  requesterName: string;
  requesterPersonnelCode: string;
  department: string;
  company?: string;
  supervisorId: string | null;
  supervisorName: string | null;
  approverNote: string | null;
  accountingNote: string | null;
  rejectionReason: string | null;
  returnedReason?: string | null;
  status: RequestStatus;
  inPaymentAt?: string | null;
  inPaymentBy?: string | null;
  sourceBankAccountId?: string | null;
  sourceAccountSnapshot?: SourceBankAccountSnapshot | null;
  paidBankName: string | null;
  paidAt: string | null;
  paidDateJalali: string | null;
  createdAt: string;
  attachments?: AttachmentFile[];
  items: BatchItem[];
}

export interface AdvanceRequest extends BankDestination {
  createdAtIso?: string;
  treasuryCorrection?: TreasuryCorrection;
  requesterDeletedAt?: string;
  requesterDeletedBy?: string;
  companyId?: string;
  reviewRejection?:ReviewRejection;
  reviewStartedAt?: string;
  requesterEditedAt?: string;
  id: string;
  trackingCode: string;
  requestedMonth: string;
  amount: number;
  initialAmount?: number;
  suggestedDate: string;
  reason: string;
  hasPreviousAdvance: boolean | null;
  approvedAmount: number | null;
  accountingNote: string | null;
  approverNote: string | null;
  rejectionReason: string | null;
  returnedReason?: string | null;
  returnedById?: string | null;
  returnedByUserId?: string | null;
  returnedByRole?: Role | null;
  returnedByName?: string | null;
  returnedAt?: string | null;
  status: RequestStatus;
  inPaymentAt?: string | null;
  inPaymentBy?: string | null;
  version?: number;
  isResubmitted?: boolean;
  resubmittedAt?: string | null;
  invalidatedPriorApproval?: boolean;
  approverId?: string | null;
  approverName?: string | null;
  approverDecidedAt?: string | null;
  approvedByApproverAt?: string | null;
  approverApprovedVersion?: number | null;
  approverDecisionVersion?: number | null;
  approvedBySupervisorUserId?: string | null;
  approvedBySupervisorName?: string | null;
  approvedBySupervisorAt?: string | null;
  accountingDecidedAt?: string | null;
  accountingApprovedVersion?: number | null;
  accountingDecisionVersion?: number | null;
  approvedByAccountingUserId?: string | null;
  approvedByAccountingName?: string | null;
  approvedByAccountingAt?: string | null;
  comments?: ReviewComment[];
  auditHistory?: ItemAuditEntry[];
  attachments?: AttachmentFile[];
  requesterId: string;
  requesterName: string;
  requesterPersonnelCode: string;
  department: string;
  company?: string;
  supervisorId: string | null;
  supervisorName: string | null;
  accountingId: string | null;
  accountingName: string | null;
  treasuryId: string | null;
  treasuryName: string | null;
  paidAmountSoFar?: number;
  paidAmount?: number;
  remainingAmount?: number;
  remainingPayableAmount?: number;
  paymentExecutions?: PaymentExecutionRecord[];
  paymentHistory?: PaymentExecutionRecord[];
  sourceBankAccountId?: string | null;
  sourceAccountSnapshot?: SourceBankAccountSnapshot | null;
  paidBankName: string | null;
  paidAt: string | null;
  paidDateJalali: string | null;
  dailyCoverId: string | null;
  receiptId?: string | null;
  createdAt: string;
}

export interface PaymentRequest extends BankDestination {
  entryOperation?: {key:string;fingerprint:string};
  externalOrder?: {orderedBy:string;origin:'PHONE_OR_WRITTEN'};
  createdAtIso?: string;
  treasuryCorrection?: TreasuryCorrection;
  requesterDeletedAt?: string;
  requesterDeletedBy?: string;
  companyId?: string;
  reviewRejection?:ReviewRejection;
  reviewStartedAt?: string;
  requesterEditedAt?: string;
  id: string;
  trackingCode: string;
  dueDate: string;
  priority: Priority;
  costCenter: string;
  description: string;
  amount: number;
  initialAmount?: number;
  approvedAmount?: number | null;
  payeeName: string;
  accountOrCard: string;
  iban: string;
  bankName: string;
  invoiceNumber: string;
  batchId?: string | null;
  batchTitle?: string | null;
  accountingNote: string | null;
  approverNote: string | null;
  rejectionReason: string | null;
  returnedReason?: string | null;
  returnedById?: string | null;
  returnedByUserId?: string | null;
  returnedByRole?: Role | null;
  returnedByName?: string | null;
  returnedAt?: string | null;
  status: RequestStatus;
  inPaymentAt?: string | null;
  inPaymentBy?: string | null;
  version?: number;
  isResubmitted?: boolean;
  resubmittedAt?: string | null;
  invalidatedPriorApproval?: boolean;
  approverId?: string | null;
  approverName?: string | null;
  approverDecidedAt?: string | null;
  approvedByApproverAt?: string | null;
  approverApprovedVersion?: number | null;
  approverDecisionVersion?: number | null;
  approvedBySupervisorUserId?: string | null;
  approvedBySupervisorName?: string | null;
  approvedBySupervisorAt?: string | null;
  accountingDecidedAt?: string | null;
  accountingApprovedVersion?: number | null;
  accountingDecisionVersion?: number | null;
  approvedByAccountingUserId?: string | null;
  approvedByAccountingName?: string | null;
  approvedByAccountingAt?: string | null;
  comments?: ReviewComment[];
  auditHistory?: ItemAuditEntry[];
  attachments?: AttachmentFile[];
  requesterId: string;
  requesterName: string;
  requesterPersonnelCode: string;
  department: string;
  company?: string;
  supervisorId: string | null;
  supervisorName: string | null;
  accountingId: string | null;
  accountingName: string | null;
  treasuryId: string | null;
  treasuryName: string | null;
  paidAmountSoFar?: number;
  paidAmount?: number;
  remainingAmount?: number;
  remainingPayableAmount?: number;
  paymentExecutions?: PaymentExecutionRecord[];
  paymentHistory?: PaymentExecutionRecord[];
  sourceBankAccountId?: string | null;
  sourceAccountSnapshot?: SourceBankAccountSnapshot | null;
  paidBankName: string | null;
  paidAt: string | null;
  paidDateJalali: string | null;
  receiptId?: string | null;
  dailyCoverId: string | null;
  createdAt: string;
}

export interface ManualPayment {
  entryOperation?: {key:string;fingerprint:string};
  createdAtIso?: string;
  id: string;
  trackingCode: string;
  amount: number;
  payee: string;
  description: string;
  bankName: string;
  sourceBankAccountId?: string | null;
  sourceAccountSnapshot?: SourceBankAccountSnapshot | null;
  date: string;
  orderedBy: string;
  createdById: string;
  createdByName: string;
  dailyCoverId: string | null;
  createdAt: string;
}

export interface DailyCover {
  id: string;
  coverNumber: string;
  date: string;
  bankName: string;
  totalIn: number;
  totalOut: number;
  bankFee: number;
  note: string;
  status: CoverStatus;
  closedBy: string | null;
  closedAt: string | null;
  advanceRequestIds: string[];
  paymentRequestIds: string[];
  manualPaymentIds: string[];
}

export interface ReceiptArchive {
  id: string;
  fileUrl: string;
  fileName: string;
  bankRefNumber: string;
  paymentType: 'ADVANCE' | 'PAYMENT' | 'BATCH' | 'MANUAL';
  paymentMethod?: PaymentMethodType;
  relatedPaymentIds: string[];
  relatedTrackingCodes: string[];
  amount: number;
  bankName: string;
  sourceBankAccountId?: string | null;
  sourceAccountSnapshot?: SourceBankAccountSnapshot | null;
  uploadedBy: string;
  uploadedAt: string;
  dateJalali: string;
}

export type NotificationEventType =
  | 'REQUEST_SUBMITTED'
  | 'REQUEST_RESUBMITTED'
  | 'APPROVED_SUPERVISOR'
  | 'FINAL_APPROVED_ACCOUNTING'
  | 'RETURNED_FOR_REVISION'
  | 'REQUEST_REJECTED'
  | 'REQUEST_CLOSED'
  | 'AMOUNT_MODIFIED'
  | 'PAYMENT_EXECUTED';

export interface AppNotification {
  receiptId?: string;
  /** Server-authored subset of the receipt, for this recipient's own payment summary. */
  relatedPaymentIds?: string[];
  id: string;
  eventType: NotificationEventType;
  title: string;
  body: string;
  trackingCode: string;
  requestId: string;
  rowId?: string | null;
  itemType: 'BATCH_ITEM' | 'PAYMENT' | 'ADVANCE' | 'BATCH';
  recipientUserId?: string | null;
  recipientRole?: Role | null;
  actorName: string;
  createdAt: string;
  readByUserIds: string[];
  targetSection: 'REQUESTER' | 'APPROVER' | 'ACCOUNTING' | 'TREASURY';
}

export interface TreasuryDatabaseState {
  bankInquiryConfig?:InquiryConfig;
  bankInquiryJobs?:InquiryJob[];
  bankInquiryOperations?:InquiryOperation[];
  users: User[];
  roleConfigs?: RoleDefinitionConfig[];
  companies?: OrganizationCompany[];
  departments?: OrganizationalDepartment[];
  costCenters?: CostCenterItem[];
  masterDataCodeSequences?: Partial<Record<MasterDataKind, number>>;
  smsConfig?: SmsGatewayConfig;
  smsLogs?: SmsDispatchLogEntry[];
  securityAuditLogs?: SecurityAuditLogEntry[];
  passwordRecoveryRequests?: PasswordRecoveryRequest[];
  sessions?: UserSessionRecord[];
  companyBankAccounts?: CompanyBankAccount[];
  advanceRequests: AdvanceRequest[];
  paymentRequests: PaymentRequest[];
  batchPayments: BatchPaymentRequest[];
  manualPayments: ManualPayment[];
  dailyCovers: DailyCover[];
  receiptArchives: ReceiptArchive[];
  notifications?: AppNotification[];
}

export type MasterDataKind = 'companies' | 'departments' | 'cost-centers';
export type BulkMasterDataKind = Exclude<MasterDataKind,'companies'>;
export type BulkMasterDataRow = {name:string;companyId:string;departmentId?:string|null;description?:string;budgetCategory?:string};
export type ReviewStage='APPROVER'|'ACCOUNTING';
export type ReviewRejection={byUserId:string;byName:string;stage:ReviewStage;reason:string;at:string;resolvedAt?:string;closedAt?:string;closeReason?:string};
