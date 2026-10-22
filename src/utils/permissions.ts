import type {
  Role,
  User,
  AccessScope,
  RolePermissionSet,
  RoleDefinitionConfig,
  TreasuryDatabaseState,
} from '../types/treasury';

export const SYSTEM_COMPANIES = [
  'شرکت اصلی (هلدینگ مرکزی)',
  'شرکت مهندسی و ساخت (زیرمجموعه ۱)',
  'شرکت بازرگانی و تامین (زیرمجموعه ۲)',
  'کلیه شرکت‌های گروه',
] as const;

export const SYSTEM_DEPARTMENTS = [
  'فنی و مهندسی',
  'فروش و بازرگانی',
  'عملیات و لجستیک',
  'مالی و حسابداری',
  'خزانه‌داری و پرداخت',
  'منابع انسانی',
  'فناوری اطلاعات و مدیریت',
  'مدیریت عاملی',
] as const;

export const ACCESS_SCOPE_LABELS: Record<AccessScope, { label: string; description: string }> = {
  SELF_ONLY: {
    label: 'فقط درخواست‌های خود شخص',
    description: 'مشاهده و پیگیری صرفاً درخواست‌هایی که توسط خود کاربر ثبت شده‌اند',
  },
  ASSIGNED_AND_SUBORDINATES: {
    label: 'درخواست‌های خود و ارجاع‌شده از زیرمجموعه',
    description: 'مشاهده درخواست‌های شخصی به همراه درخواست‌های نیروهای تحت سرپرستی مستقیم',
  },
  DEPARTMENT: {
    label: 'محدوده واحد سازمانی مجاز',
    description: 'مشاهده و بررسی درخواست‌های ثبت‌شده در همان واحد سازمانی کاربر',
  },
  COMPANY_WIDE: {
    label: 'کلیه واحدهای شرکت مجاز (در چارچوب مرحله کاری)',
    description: 'مشاهده درخواست‌های شرکت مجاز متناسب با مرحله کارتابل (حسابداری / خزانه / مدیریت)',
  },
};

export const PERMISSION_DEFINITIONS: Array<{
  key: keyof RolePermissionSet;
  label: string;
  category: 'مشاهده و گزارش' | 'ثبت و اقدام در گردش کار' | 'مدیریت سامانه';
  description: string;
}> = [
  {
    key: 'canViewRequests',
    label: 'مشاهده درخواست',
    category: 'مشاهده و گزارش',
    description: 'مجوز مشاهده فهرست و جزئیات درخواست‌ها در محدوده دسترسی تعیین‌شده',
  },
  {
    key: 'canViewAttachments',
    label: 'مشاهده مدارک',
    category: 'مشاهده و گزارش',
    description: 'مجوز باز کردن و دانلود پیوست‌ها، فاکتورها و فیش‌های بانکی مجاز',
  },
  {
    key: 'canExportReports',
    label: 'گزارش و خروجی',
    category: 'مشاهده و گزارش',
    description: 'مجوز دریافت خروجی اکسل و نسخه چاپ از کارتابل‌ها و گزارش‌های مجاز',
  },
  {
    key: 'canCreateRequest',
    label: 'ثبت درخواست',
    category: 'ثبت و اقدام در گردش کار',
    description: 'مجوز ثبت دستور پرداخت تکی/تجمیعی، تقاضای مساعده و ارسال مجدد موارد اصلاحی',
  },
  {
    key: 'canEditAmount',
    label: 'ویرایش مبلغ',
    category: 'ثبت و اقدام در گردش کار',
    description: 'مجوز تعدیل و اصلاح مبلغ مصوب ردیف‌ها با ثبت علت در تاریخچه ممیزی',
  },
  {
    key: 'canApprove',
    label: 'تأیید',
    category: 'ثبت و اقدام در گردش کار',
    description: 'مجوز تأیید سازمانی (سرپرست) یا تأیید نهایی مالی (حسابداری) تا سقف اختیار ریالی',
  },
  {
    key: 'canReturnForRevision',
    label: 'برگشت برای اصلاح',
    category: 'ثبت و اقدام در گردش کار',
    description: 'مجوز برگشت دادن درخواست یا ردیف به متقاضی جهت اصلاح مدارک یا اطلاعات',
  },
  {
    key: 'canExecutePayment',
    label: 'ثبت پرداخت',
    category: 'ثبت و اقدام در گردش کار',
    description: 'مجوز مدیریت صف خزانه، جابجایی مخزن در حال پرداخت و ثبت پرداخت تا سقف مجاز ریالی',
  },
  {
    key: 'canManageUsers',
    label: 'مدیریت کاربران',
    category: 'مدیریت سامانه',
    description: 'مجوز مدیریت کاربران، انتساب سرپرست، بازنشانی رمز موقت و تنظیمات نقش‌ها (بدون ایجاد خودکار مجوز مالی)',
  },
];

export function getDefaultRoleConfigs(): RoleDefinitionConfig[] {
  return [
    {
      role: 'REQUESTER',
      title: 'درخواست‌کننده (کارمند)',
      description: 'ثبت درخواست‌های پرداخت و مساعده و پیگیری وضعیت یا اصلاح موارد برگشتی شخصی',
      accessScope: 'SELF_ONLY',
      allowedCompanies: ['شرکت اصلی (هلدینگ مرکزی)'],
      approvalLimitRial: 0,
      paymentLimitRial: 0,
      permissions: {
        canViewRequests: true,
        canCreateRequest: true,
        canEditAmount: false,
        canApprove: false,
        canReturnForRevision: false,
        canExecutePayment: false,
        canViewAttachments: true,
        canExportReports: false,
        canManageUsers: false,
      },
    },
    {
      role: 'APPROVER',
      title: 'سرپرست و تأییدکننده واحد',
      description: 'بررسی و تأیید یا برگشت درخواست‌های ارجاع‌شده از نیروهای تحت سرپرستی مستقیم تا سقف مجاز',
      accessScope: 'ASSIGNED_AND_SUBORDINATES',
      allowedCompanies: ['شرکت اصلی (هلدینگ مرکزی)'],
      approvalLimitRial: 5000000000, // ۵ میلیارد ریال سقف پیش‌فرض قابل تنظیم
      paymentLimitRial: 0,
      permissions: {
        canViewRequests: true,
        canCreateRequest: true,
        canEditAmount: true,
        canApprove: true,
        canReturnForRevision: true,
        canExecutePayment: false,
        canViewAttachments: true,
        canExportReports: true,
        canManageUsers: false,
      },
    },
    {
      role: 'ACCOUNTING',
      title: 'کارشناس و تأییدکننده مالی حسابداری',
      description: 'کنترل اسناد مثبته، تطبیق مالی، ویرایش مبلغ مصوب و تأیید نهایی جهت ارسال به صف خزانه',
      accessScope: 'COMPANY_WIDE',
      allowedCompanies: ['کلیه شرکت‌های گروه'],
      approvalLimitRial: 20000000000, // ۲۰ میلیارد ریال سقف پیش‌فرض قابل تنظیم
      paymentLimitRial: 0,
      permissions: {
        canViewRequests: true,
        canCreateRequest: true,
        canEditAmount: true,
        canApprove: true,
        canReturnForRevision: true,
        canExecutePayment: false,
        canViewAttachments: true,
        canExportReports: true,
        canManageUsers: false,
      },
    },
    {
      role: 'TREASURY',
      title: 'خزانه‌دار و مسئول عملیات پرداخت',
      description: 'مدیریت صف پرداخت، مخزن در حال پرداخت، ثبت پرداخت انجام‌شده، روکش روزانه و بایگانی فیش‌ها',
      accessScope: 'COMPANY_WIDE',
      allowedCompanies: ['کلیه شرکت‌های گروه'],
      approvalLimitRial: 0,
      paymentLimitRial: 50000000000, // ۵۰ میلیارد ریال سقف پیش‌فرض اجرای پرداخت قابل تنظیم
      permissions: {
        canViewRequests: true,
        canCreateRequest: true,
        canEditAmount: false,
        canApprove: false,
        canReturnForRevision: false,
        canExecutePayment: true,
        canViewAttachments: true,
        canExportReports: true,
        canManageUsers: false,
      },
    },
    {
      role: 'ADMIN',
      title: 'مدیر سامانه (ادمین)',
      description: 'مدیریت کاربران، نقش‌ها، سرپرستان و تنظیمات سازمانی. مجوزهای مالی جداگانه و با سقف مشخص کنترل می‌شوند.',
      accessScope: 'COMPANY_WIDE',
      allowedCompanies: ['کلیه شرکت‌های گروه'],
      approvalLimitRial: 50000000000,
      paymentLimitRial: 50000000000,
      permissions: {
        canViewRequests: true,
        canCreateRequest: true,
        canEditAmount: true,
        canApprove: true,
        canReturnForRevision: true,
        canExecutePayment: true,
        canViewAttachments: true,
        canExportReports: true,
        canManageUsers: true,
      },
    },
  ];
}

const SCOPE_PRIORITY: Record<AccessScope, number> = {
  SELF_ONLY: 1,
  ASSIGNED_AND_SUBORDINATES: 2,
  DEPARTMENT: 3,
  COMPANY_WIDE: 4,
};

export function resolveUserEffectivePermissions(
  user: User,
  roleConfigs?: RoleDefinitionConfig[]
): {
  permissions: RolePermissionSet;
  accessScope: AccessScope;
  approvalLimitRial: number;
  paymentLimitRial: number;
  allRoles: Role[];
} {
  const configs = roleConfigs && roleConfigs.length > 0 ? roleConfigs : getDefaultRoleConfigs();
  const allRoles: Role[] = Array.from(
    new Set([user.role, ...(user.additionalRoles || [])].filter(Boolean))
  );

  const combinedPermissions: RolePermissionSet = {
    canViewRequests: false,
    canCreateRequest: false,
    canEditAmount: false,
    canApprove: false,
    canReturnForRevision: false,
    canExecutePayment: false,
    canViewAttachments: false,
    canExportReports: false,
    canManageUsers: false,
  };

  let bestScope: AccessScope = 'SELF_ONLY';
  let maxRoleApprovalLimit = 0;
  let maxRolePaymentLimit = 0;

  for (const r of allRoles) {
    const cfg = configs.find((c) => c.role === r) || getDefaultRoleConfigs().find((c) => c.role === r);
    if (!cfg) continue;

    for (const k of Object.keys(combinedPermissions) as Array<keyof RolePermissionSet>) {
      if (cfg.permissions[k]) {
        combinedPermissions[k] = true;
      }
    }

    if (SCOPE_PRIORITY[cfg.accessScope] > SCOPE_PRIORITY[bestScope]) {
      bestScope = cfg.accessScope;
    }
    if (cfg.approvalLimitRial > maxRoleApprovalLimit) {
      maxRoleApprovalLimit = cfg.approvalLimitRial;
    }
    if (cfg.paymentLimitRial > maxRolePaymentLimit) {
      maxRolePaymentLimit = cfg.paymentLimitRial;
    }
  }

  // Apply explicit user custom permission overrides if defined
  if (user.customPermissions) {
    for (const k of Object.keys(user.customPermissions) as Array<keyof RolePermissionSet>) {
      const val = user.customPermissions[k];
      if (typeof val === 'boolean') {
        combinedPermissions[k] = val;
      }
    }
  }

  // Apply explicit user accessScope override if defined
  const finalScope: AccessScope = user.accessScope || bestScope;

  // Apply explicit user financial limits (undefined/null falls back to role config limit; explicit 0 means 0 authority)
  const finalApprovalLimit =
    user.financialApprovalLimit !== undefined && user.financialApprovalLimit !== null
      ? Number(user.financialApprovalLimit)
      : maxRoleApprovalLimit;

  const finalPaymentLimit =
    user.paymentExecutionLimit !== undefined && user.paymentExecutionLimit !== null
      ? Number(user.paymentExecutionLimit)
      : maxRolePaymentLimit;

  return {
    permissions: combinedPermissions,
    accessScope: finalScope,
    approvalLimitRial: combinedPermissions.canApprove ? Math.max(0, finalApprovalLimit) : 0,
    paymentLimitRial: combinedPermissions.canExecutePayment ? Math.max(0, finalPaymentLimit) : 0,
    allRoles,
  };
}

/**
 * Checks if assigning `candidateSupervisorId` as the supervisor of `targetUserId`
 * creates a direct self-supervision or circular supervision chain.
 */
export function detectSupervisionCycle(
  users: User[],
  targetUserId: string | undefined,
  candidateSupervisorId: string | null | undefined
): { hasCycle: boolean; chainNames: string[] } {
  if (!candidateSupervisorId) {
    return { hasCycle: false, chainNames: [] };
  }
  if (targetUserId && targetUserId === candidateSupervisorId) {
    const selfUser = users.find((u) => u.id === targetUserId);
    return {
      hasCycle: true,
      chainNames: [selfUser?.name || targetUserId, selfUser?.name || targetUserId],
    };
  }

  const visited = new Set<string>();
  const chainNames: string[] = [];
  if (targetUserId) {
    visited.add(targetUserId);
    const tUser = users.find((u) => u.id === targetUserId);
    if (tUser) chainNames.push(tUser.name);
  }

  let currentId: string | null | undefined = candidateSupervisorId;
  while (currentId) {
    const currentObj = users.find((u) => u.id === currentId);
    if (currentObj) chainNames.push(currentObj.name);

    if (visited.has(currentId)) {
      return { hasCycle: true, chainNames };
    }
    visited.add(currentId);
    currentId = currentObj?.supervisorId || null;
  }

  return { hasCycle: false, chainNames };
}

/**
 * Counts how many pending approval tasks (`Pending_Approver`) are currently assigned to a given supervisor.
 */
export function countPendingTasksForSupervisor(
  db: Pick<TreasuryDatabaseState, 'advanceRequests' | 'paymentRequests' | 'batchPayments'>,
  supervisorId: string
): {
  advanceCount: number;
  paymentCount: number;
  batchItemCount: number;
  totalCount: number;
} {
  const advanceCount = (db.advanceRequests || []).filter(
    (a) => a.status === 'Pending_Approver' && a.supervisorId === supervisorId
  ).length;

  const paymentCount = (db.paymentRequests || []).filter(
    (p) => p.status === 'Pending_Approver' && p.supervisorId === supervisorId
  ).length;

  let batchItemCount = 0;
  for (const b of db.batchPayments || []) {
    if (b.supervisorId === supervisorId) {
      batchItemCount += (b.items || []).filter(
        (it) => (it.status || b.status) === 'Pending_Approver'
      ).length;
    }
  }

  return {
    advanceCount,
    paymentCount,
    batchItemCount,
    totalCount: advanceCount + paymentCount + batchItemCount,
  };
}

/**
 * Checks whether a user has any financial/historical footprint in the database.
 * If true, destructive deletion must be blocked in favor of deactivation (`isActive = false`).
 */
export function hasUserHistoricalFootprint(
  db: Pick<
    TreasuryDatabaseState,
    'advanceRequests' | 'paymentRequests' | 'batchPayments' | 'manualPayments' | 'receiptArchives'
  >,
  user: User
): boolean {
  const uid = user.id;
  const uname = user.name;

  if (
    (db.advanceRequests || []).some(
      (a) =>
        a.requesterId === uid ||
        a.supervisorId === uid ||
        a.accountingId === uid ||
        a.treasuryId === uid ||
        (a.auditHistory || []).some((h) => h.changedBy === uname)
    )
  ) {
    return true;
  }

  if (
    (db.paymentRequests || []).some(
      (p) =>
        p.requesterId === uid ||
        p.supervisorId === uid ||
        p.accountingId === uid ||
        p.treasuryId === uid ||
        (p.auditHistory || []).some((h) => h.changedBy === uname)
    )
  ) {
    return true;
  }

  if (
    (db.batchPayments || []).some(
      (b) =>
        b.requesterId === uid ||
        b.supervisorId === uid ||
        (b.items || []).some((it) => (it.auditHistory || []).some((h) => h.changedBy === uname))
    )
  ) {
    return true;
  }

  if ((db.manualPayments || []).some((m) => m.createdById === uid || m.createdByName === uname)) {
    return true;
  }

  if ((db.receiptArchives || []).some((r) => r.uploadedBy === uname)) {
    return true;
  }

  return false;
}
