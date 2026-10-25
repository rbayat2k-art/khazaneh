import {RialInput} from './RialInput';
import React, { useState, useMemo, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Edit,
  Shield,
  Phone,
  Save,
  X,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  Ban,
  AlertCircle,
  Lock,
  ArrowLeftRight,
  Plus,
  RotateCcw,
  Trash2,
  CreditCard,
  ShieldCheck,
  Landmark,
  Database,
  UserCheck,
  Settings,
  Sparkles,
  CheckSquare,
} from 'lucide-react';
import {
  type User,
  type Role,
  type BuiltInRole,
  type AccessScope,
  type RoleDefinitionConfig,
  type RolePermissionSet,
  type SecurityAuditLogEntry,
  type PasswordRecoveryRequest,
  type OrganizationCompany,
  type OrganizationalDepartment,
  type CostCenterItem,
  type MasterDataKind,
  type BulkMasterDataKind,
  type BulkMasterDataRow,
  type SmsGatewayConfig,
  type SmsDispatchLogEntry,
  getDefaultPermissionsForRole,
  normalizeRolePermissionSet,
} from '../types/treasury';
import {
  useSortableTable,
  getRoleLabel,
  normalizePersianText,
  formatRial,
} from '../utils/sorting';
import { SortableHeader } from './SortableHeader';
import { AdminMasterDataAndSmsSection } from './AdminMasterDataAndSmsSection';
import { getUserRoles, hasSupervisorPermissions } from '../utils/user-roles';
import {PermissionSettings} from './PermissionSettings';
import {RoleCompanyAccess} from './RoleCompanyAccess';
import {permissionCount,supervisorCompanyAllowed} from '../utils/permission-registry';

export type AdminSubTab =
  | 'USERS'
  | 'ROLES'
  | 'RECOVERY'
  | 'AUDIT'
  | 'SMS_GATEWAY'
  | 'BANK_INQUIRY'
  | 'MASTER_COMPANIES'
  | 'MASTER_DEPARTMENTS'
  | 'MASTER_COST_CENTERS';

interface AdminPortalViewProps {
  currentUser: User;
  activeSubTab?: AdminSubTab;
  users: User[];
  roleConfigs: RoleDefinitionConfig[];
  securityAuditLogs: SecurityAuditLogEntry[];
  passwordRecoveryRequests: PasswordRecoveryRequest[];
  companies: OrganizationCompany[];
  departments: OrganizationalDepartment[];
  costCenters: CostCenterItem[];
  masterDataCodeSequences?:Partial<Record<MasterDataKind,number>>;
  onBulkCreateMasterData:(kind:BulkMasterDataKind,rows:BulkMasterDataRow[])=>Promise<{ok:boolean;error?:string}>;
  smsConfig?: SmsGatewayConfig;
  smsLogs: SmsDispatchLogEntry[];
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  onSaveUser: (userData: Partial<User> & { replacementSupervisorId?: string }) => Promise<{
    ok: boolean;
    error?: string;
    requiresReplacementSupervisor?: boolean;
    pendingCount?: number;
  }>;
  onResetUserPassword: (payload: {
    targetUserId: string;
    tempPassword: string;
    mustChangePassword: boolean;
    recoveryRequestId?: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  onToggleUserStatus: (payload: {
    targetUserId: string;
    isActive: boolean;
    replacementSupervisorId?: string;
  }) => Promise<{
    ok: boolean;
    error?: string;
    requiresReplacementSupervisor?: boolean;
    pendingCount?: number;
  }>;
  onSaveRoleConfig: (config: Partial<RoleDefinitionConfig> & { role: Role; expectedAllowedCompanies?:string[] }) => Promise<{
    ok: boolean;
    error?: string;
  }>;
  onDeleteRoleConfig?: (role: Role) => Promise<{
    ok: boolean;
    error?: string;
  }>;
  onResetRoleDefaults?: (role?: Role) => Promise<{
    ok: boolean;
    error?: string;
  }>;
  onSaveCompany: (payload: Partial<OrganizationCompany>) => Promise<{ ok: boolean; error?: string }>;
  onToggleCompanyStatus: (id: string, isActive: boolean) => Promise<{ ok: boolean; error?: string }>;
  onDeleteCompany: (id: string) => Promise<{ ok: boolean; error?: string }>;
  onSaveDepartment: (payload: Partial<OrganizationalDepartment>) => Promise<{ ok: boolean; error?: string }>;
  onToggleDepartmentStatus: (id: string, isActive: boolean) => Promise<{ ok: boolean; error?: string }>;
  onDeleteDepartment: (id: string) => Promise<{ ok: boolean; error?: string }>;
  onSaveCostCenter: (payload: Partial<CostCenterItem>) => Promise<{ ok: boolean; error?: string }>;
  onToggleCostCenterStatus: (id: string, isActive: boolean) => Promise<{ ok: boolean; error?: string }>;
  onDeleteCostCenter: (id: string) => Promise<{ ok: boolean; error?: string }>;
  onSaveSmsConfig: (payload: Partial<SmsGatewayConfig> & { clearSecrets?: boolean }) => Promise<{
    ok: boolean;
    error?: string;
  }>;
  onTestSmsDispatch: (payload: { recipientPhone: string; testMessage?: string }) => Promise<{
    ok: boolean;
    status?: string;
    error?: string;
    providerResponse?: string;
  }>;
}

export function getAccessScopeLabel(scope?: AccessScope): string {
  switch (scope) {
    case 'SELF_ONLY':
      return 'فقط درخواست‌های خود شخص';
    case 'ASSIGNED_AND_SUBORDINATES':
      return 'درخواست‌های ارجاع‌شده و زیرمجموعه مستقیم';
    case 'DEPARTMENT':
      return 'درخواست‌های واحد سازمانی مجاز';
    case 'COMPANY_WIDE':
      return 'کلیه درخواست‌های شرکت مجاز';
    default:
      return 'مطابق پیش‌فرض نقش';
  }
}

export const AdminPortalView: React.FC<AdminPortalViewProps> = ({
  currentUser,
  activeSubTab = 'USERS',
  users,
  roleConfigs,
  securityAuditLogs,
  passwordRecoveryRequests,
  companies,
  departments,
  costCenters,
  masterDataCodeSequences,
  onBulkCreateMasterData,
  smsConfig,
  smsLogs,
  searchInputRef,
  onSaveUser,
  onResetUserPassword,
  onToggleUserStatus,
  onSaveRoleConfig,
  onDeleteRoleConfig,
  onResetRoleDefaults,
  onSaveCompany,
  onToggleCompanyStatus,
  onDeleteCompany,
  onSaveDepartment,
  onToggleDepartmentStatus,
  onDeleteDepartment,
  onSaveCostCenter,
  onToggleCostCenterStatus,
  onDeleteCostCenter,
  onSaveSmsConfig,
  onTestSmsDispatch,
}) => {
  const [activeAdminTab, setActiveAdminTab] = useState<AdminSubTab>(activeSubTab);

  useEffect(() => {
    setActiveAdminTab(activeSubTab);
  }, [activeSubTab]);

  const activeCompanyNames = useMemo(() => {
    const active = companies.filter((c) => c.isActive !== false).map((c) => c.name);
    return active;
  }, [companies]);

  const activeDepartmentNames = useMemo(() => {
    const active = departments.filter((d) => d.isActive !== false).map((d) => d.name);
    return Array.from(new Set(active));
  }, [departments]);

  // Search & Filter states for Users table
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [deptFilter, setDeptFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Create / Edit User Form State
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [personnelCode, setPersonnelCode] = useState('');
  const [department, setDepartment] = useState(() => activeDepartmentNames[0] || '');
  const [company, setCompany] = useState(() => activeCompanyNames[0] || '');
  useEffect(() => { if (!company && activeCompanyNames[0]) setCompany(activeCompanyNames[0] || ''); }, [company, activeCompanyNames]);
  useEffect(() => { if (!department && activeDepartmentNames[0]) setDepartment(activeDepartmentNames[0] || ''); }, [department, activeDepartmentNames]);
  const [role, setRole] = useState<Role>('REQUESTER');
  const [additionalRoles, setAdditionalRoles] = useState<Role[]>([]);
  const formRoles = getUserRoles({role,additionalRoles});
  const [initialPassword, setInitialPassword] = useState('');
  const [showInitialPassword, setShowInitialPassword] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(true);
  const [phone, setPhone] = useState('');
  const [supervisorId, setSupervisorId] = useState<string>('');
  const [isActive, setIsActive] = useState<boolean>(true);
  const [accessScope, setAccessScope] = useState<AccessScope>('SELF_ONLY');
  const [financialApprovalLimit, setFinancialApprovalLimit] = useState<string>('');
  const [paymentExecutionLimit, setPaymentExecutionLimit] = useState<string>('');
  const [replacementSupervisorId, setReplacementSupervisorId] = useState<string>('');
  const [needsReplacementPrompt, setNeedsReplacementPrompt] = useState<{
    pendingCount: number;
    mode: 'FORM' | 'TOGGLE';
    targetUser?: User;
  } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSavingUser, setIsSavingUser] = useState(false);

  // Password Reset Modal State
  const [resetTargetUser, setResetTargetUser] = useState<User | null>(null);
  const [resetRecoveryId, setResetRecoveryId] = useState<string | undefined>(undefined);
  const [tempPassword, setTempPassword] = useState('');
  const [showTempPassword, setShowTempPassword] = useState(false);
  const [forceChangeOnLogin, setForceChangeOnLogin] = useState(true);
  const [resetError, setResetError] = useState<string | null>(null);
  const [isResettingPass, setIsResettingPass] = useState(false);

  // Role & Access Management State
  const [selectedRoleKey, setSelectedRoleKey] = useState<Role>('APPROVER');
  const activeRoleConfig = useMemo(
    () => roleConfigs.find((r) => r.role === selectedRoleKey) || roleConfigs[0],
    [roleConfigs, selectedRoleKey]
  );

  const [roleTitleDraft, setRoleTitleDraft] = useState<string>(activeRoleConfig?.title || '');
  const [roleDescDraft, setRoleDescDraft] = useState<string>(activeRoleConfig?.description || '');
  const [roleCompaniesDraft,setRoleCompaniesDraft]=useState<string[]>(()=>[...(activeRoleConfig?.allowedCompanies||[])]);
  const [roleLandingDraft, setRoleLandingDraft] = useState<
    'REQUESTER' | 'APPROVER' | 'ACCOUNTING' | 'TREASURY' | 'ADMIN_PANEL' | 'SETTINGS'
  >(activeRoleConfig?.defaultLandingSection || 'REQUESTER');
  const [roleScopeDraft, setRoleScopeDraft] = useState<AccessScope>(
    activeRoleConfig?.accessScope || 'ASSIGNED_AND_SUBORDINATES'
  );
  const [roleApprovalLimitDraft, setRoleApprovalLimitDraft] = useState<string>(
    String(activeRoleConfig?.approvalLimitRial ?? 0)
  );
  const [rolePaymentLimitDraft, setRolePaymentLimitDraft] = useState<string>(
    String(activeRoleConfig?.paymentLimitRial ?? 0)
  );
  const [rolePermsDraft, setRolePermsDraft] = useState<RolePermissionSet>(() =>
    normalizeRolePermissionSet(activeRoleConfig?.permissions, activeRoleConfig?.role || 'REQUESTER')
  );
  const [isSavingRole, setIsSavingRole] = useState(false);
  const [roleSaveError, setRoleSaveError] = useState<string | null>(null);

  // Add New Custom Role Form State
  const [showNewRoleForm, setShowNewRoleForm] = useState(false);
  const [newRoleTitle, setNewRoleTitle] = useState('');
  const [newRoleCode, setNewRoleCode] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [newRoleTemplate, setNewRoleTemplate] = useState<BuiltInRole | 'MINIMAL'>('REQUESTER');
  const [isCreatingNewRole, setIsCreatingNewRole] = useState(false);

  // Polling recreates DTO objects; identical server state must not erase unsaved edits.
  const activeRoleConfigRevision = JSON.stringify(activeRoleConfig);
  useEffect(() => {
    if (!activeRoleConfig) return;
    setRoleTitleDraft(activeRoleConfig.title || '');
    setRoleDescDraft(activeRoleConfig.description || '');
    setRoleCompaniesDraft([...(activeRoleConfig.allowedCompanies||[])]);
    setRoleLandingDraft(activeRoleConfig.defaultLandingSection || 'REQUESTER');
    setRoleScopeDraft(activeRoleConfig.accessScope);
    setRoleApprovalLimitDraft(String(activeRoleConfig.approvalLimitRial ?? 0));
    setRolePaymentLimitDraft(String(activeRoleConfig.paymentLimitRial ?? 0));
    setRolePermsDraft(
      normalizeRolePermissionSet(activeRoleConfig.permissions, activeRoleConfig.role)
    );
  }, [activeRoleConfigRevision]);

  const handleSelectRoleCard = (r: RoleDefinitionConfig) => {
    setSelectedRoleKey(r.role);
    setRoleTitleDraft(r.title || '');
    setRoleDescDraft(r.description || '');
    setRoleCompaniesDraft([...(r.allowedCompanies||[])]);
    setRoleLandingDraft(r.defaultLandingSection || 'REQUESTER');
    setRoleScopeDraft(r.accessScope);
    setRoleApprovalLimitDraft(String(r.approvalLimitRial ?? 0));
    setRolePaymentLimitDraft(String(r.paymentLimitRial ?? 0));
    setRolePermsDraft(normalizeRolePermissionSet(r.permissions, r.role));
    setRoleSaveError(null);
  };

  // Eligible supervisors (include any active user whose role or effective permissions allow approval)
  const eligibleSupervisors = useMemo(
    () =>
      users.filter((u) => {
        if (u.id === editingUserId || u.isActive === false) return false;
        return hasSupervisorPermissions(u.effectivePermissions || {}, u.effectiveAccessScope || u.accessScope, u.effectiveApprovalLimitRial) && supervisorCompanyAllowed(u,company,roleConfigs,companies) && ((u.effectiveAccessScope || u.accessScope) !== 'DEPARTMENT' || (u.department === department && u.company === company));
      }),
    [users, editingUserId, roleConfigs, companies, department, company]
  );

  const eligibleReplacementApprovers = useMemo(() => {
    const excludeId = needsReplacementPrompt?.targetUser?.id || editingUserId;
    return users.filter((u) => {
      if (u.id === excludeId || u.isActive === false) return false;
      return hasSupervisorPermissions(u.effectivePermissions || {}, u.effectiveAccessScope || u.accessScope, u.effectiveApprovalLimitRial);
    });
  }, [users, needsReplacementPrompt, editingUserId, roleConfigs]);

  const filteredUsers = useMemo(() => {
    const q = normalizePersianText(searchQuery);
    return users.filter((u) => {
      if (roleFilter !== 'ALL' && !getUserRoles(u).includes(roleFilter)) return false;
      if (deptFilter !== 'ALL' && u.department !== deptFilter) return false;
      const activeFlag = u.isActive !== false;
      if (statusFilter === 'ACTIVE' && !activeFlag) return false;
      if (statusFilter === 'INACTIVE' && activeFlag) return false;
      if (!q) return true;
      return (
        normalizePersianText(u.name).includes(q) ||
        normalizePersianText(u.personnelCode).includes(q) ||
        normalizePersianText(u.department).includes(q) ||
        normalizePersianText(u.phone || '').includes(q) ||
        getUserRoles(u).some(r => normalizePersianText(getRoleLabel(r, roleConfigs)).includes(q))
      );
    });
  }, [users, searchQuery, roleFilter, deptFilter, statusFilter, roleConfigs]);

  const { sortedItems: sortedUsers, sortConfig, handleSort } = useSortableTable(
    filteredUsers,
    'name',
    'text',
    'asc'
  );

  const pendingRecoveryCount = useMemo(
    () => passwordRecoveryRequests.filter((r) => r.status === 'Pending').length,
    [passwordRecoveryRequests]
  );

  const resetUserForm = () => {
    setEditingUserId(null);
    setName('');
    setPersonnelCode('');
    setDepartment(activeDepartmentNames[0] || '');
    setCompany(activeCompanyNames[0] || '');
    setRole('REQUESTER');
    setAdditionalRoles([]);
    setInitialPassword('');
    setShowInitialPassword(false);
    setMustChangePassword(true);
    setPhone('');
    setSupervisorId('');
    setIsActive(true);
    setAccessScope('SELF_ONLY');
    setFinancialApprovalLimit('');
    setPaymentExecutionLimit('');
    setReplacementSupervisorId('');
    setNeedsReplacementPrompt(null);
    setFormError(null);
  };

  const handleEditClick = (u: User) => {
    setEditingUserId(u.id);
    setName(u.name);
    setPersonnelCode(String(u.personnelCode || ''));
    setDepartment(u.department);
    setCompany(u.company || activeCompanyNames[0]);
    setRole(u.role);
    setAdditionalRoles(getUserRoles(u).slice(1));
    // Never load or display existing password in edit mode
    setInitialPassword('');
    setShowInitialPassword(false);
    setPhone(String(u.phone || ''));
    setSupervisorId(u.supervisorId || '');
    setIsActive(u.isActive !== false);
    setAccessScope(u.accessScope || u.effectiveAccessScope || 'SELF_ONLY');
    setFinancialApprovalLimit(
      u.financialApprovalLimit !== undefined && u.financialApprovalLimit !== null
        ? String(u.financialApprovalLimit)
        : ''
    );
    setPaymentExecutionLimit(
      u.paymentExecutionLimit !== undefined && u.paymentExecutionLimit !== null
        ? String(u.paymentExecutionLimit)
        : ''
    );
    setReplacementSupervisorId('');
    setNeedsReplacementPrompt(null);
    setFormError(null);
  };

  const handleSubmitUserForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim() || !personnelCode.trim() || !department.trim()) {
      setFormError('نام و نام خانوادگی، کد پرسنلی (نام کاربری) و واحد سازمانی الزامی هستند.');
      return;
    }

    if (!editingUserId && initialPassword.trim().length < 5) {
      setFormError('برای ایجاد کاربر جدید، تعیین رمز عبور اولیه / موقت حداقل ۵ کاراکتری الزامی است.');
      return;
    }

    setIsSavingUser(true);
    try {
      const result = await onSaveUser({
        id: editingUserId || undefined,
        name: name.trim(),
        personnelCode: personnelCode.trim(),
        department,
        company,
        role,
        additionalRoles: additionalRoles.filter(r => r !== role),
        password: !editingUserId ? initialPassword.trim() : undefined,
        mustChangePassword: !editingUserId ? mustChangePassword : undefined,
        phone: phone.trim(),
        supervisorId: supervisorId || null,
        isActive,
        accessScope,
        financialApprovalLimit:
          financialApprovalLimit.trim() === '' ? null : Number(financialApprovalLimit),
        paymentExecutionLimit:
          paymentExecutionLimit.trim() === '' ? null : Number(paymentExecutionLimit),
        replacementSupervisorId: replacementSupervisorId || undefined,
      });

      if (!result.ok) {
        if (result.requiresReplacementSupervisor) {
          setNeedsReplacementPrompt({
            pendingCount: result.pendingCount || 1,
            mode: 'FORM',
          });
        }
        setFormError(result.error || 'خطا در ذخیره اطلاعات کاربر');
        return;
      }

      resetUserForm();
    } finally {
      setIsSavingUser(false);
    }
  };

  const handleQuickToggleStatus = async (u: User, chosenReplacementId?: string) => {
    const nextStatus = u.isActive === false;
    const res = await onToggleUserStatus({
      targetUserId: u.id,
      isActive: nextStatus,
      replacementSupervisorId: chosenReplacementId,
    });
    if (!res.ok) {
      if (res.requiresReplacementSupervisor) {
        setNeedsReplacementPrompt({
          pendingCount: res.pendingCount || 1,
          mode: 'TOGGLE',
          targetUser: u,
        });
        setReplacementSupervisorId(eligibleReplacementApprovers[0]?.id || '');
      } else {
        setFormError(res.error || 'خطا در تغییر وضعیت حساب کاربر');
      }
    } else {
      setNeedsReplacementPrompt(null);
      setReplacementSupervisorId('');
    }
  };

  const handleConfirmPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTargetUser) return;
    if (tempPassword.trim().length < 5) {
      setResetError('رمز عبور موقت باید حداقل ۵ کاراکتر باشد.');
      return;
    }
    setIsResettingPass(true);
    setResetError(null);
    try {
      const res = await onResetUserPassword({
        targetUserId: resetTargetUser.id,
        tempPassword: tempPassword.trim(),
        mustChangePassword: forceChangeOnLogin,
        recoveryRequestId: resetRecoveryId,
      });
      if (!res.ok) {
        setResetError(res.error || 'خطا در بازنشانی رمز عبور موقت');
        return;
      }
      setResetTargetUser(null);
      setResetRecoveryId(undefined);
      setTempPassword('');
    } finally {
      setIsResettingPass(false);
    }
  };

  const handleSaveRoleSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRoleConfig) return;
    setIsSavingRole(true);
    setRoleSaveError(null);
    try {
      const res = await onSaveRoleConfig({
        role: activeRoleConfig.role,
        title: roleTitleDraft.trim() || activeRoleConfig.title,
        description: roleDescDraft.trim() || activeRoleConfig.description,
        defaultLandingSection: roleLandingDraft,
        accessScope: roleScopeDraft,
        approvalLimitRial: Number(roleApprovalLimitDraft) || 0,
        paymentLimitRial: Number(rolePaymentLimitDraft) || 0,
        ...(activeRoleConfig.role!=='ADMIN'&&JSON.stringify(roleCompaniesDraft)!==JSON.stringify(activeRoleConfig.allowedCompanies||[])?{allowedCompanies:roleCompaniesDraft,expectedAllowedCompanies:activeRoleConfig.allowedCompanies||[]}:{}),
        permissions: Object.fromEntries(Object.entries(rolePermsDraft).filter(([key,value])=>normalizeRolePermissionSet(activeRoleConfig.permissions,activeRoleConfig.role,activeRoleConfig.baseTemplateRole)[key as keyof RolePermissionSet]!==value)) as RolePermissionSet,
      });
      if (!res.ok) {
        setRoleSaveError(res.error || 'خطا در ذخیره تنظیمات نقش');
      }
    } finally {
      setIsSavingRole(false);
    }
  };

  const handleCreateCustomRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleTitle.trim()) {
      setRoleSaveError('عنوان فارسی نقش جدید الزامی است.');
      return;
    }
    const cleanCode = (
      newRoleCode.trim() || `CUSTOM_${Date.now().toString().slice(-5)}`
    )
      .toUpperCase()
      .replace(/[^A-Z0-9_]/g, '_');

    if (roleConfigs.some((r) => r.role === cleanCode)) {
      setRoleSaveError('نقشی با این کد شناسایی از قبل وجود دارد. لطفاً کد دیگری انتخاب کنید.');
      return;
    }

    const templatePerms =
      newRoleTemplate === 'MINIMAL'
        ? {
            ...getDefaultPermissionsForRole('REQUESTER'),
            canCreateRequest: false,
            canCreatePaymentBatch: false,
            canCreatePaymentSingle: false,
            canCreateAdvanceBatch: false,
            canCreateAdvanceSingle: false,
          }
        : getDefaultPermissionsForRole(newRoleTemplate);

    const templateScope: AccessScope =
      newRoleTemplate === 'APPROVER'
        ? 'ASSIGNED_AND_SUBORDINATES'
        : newRoleTemplate === 'ACCOUNTING' ||
          newRoleTemplate === 'TREASURY' ||
          newRoleTemplate === 'ADMIN'
        ? 'COMPANY_WIDE'
        : 'SELF_ONLY';

    const templateLanding:
      | 'REQUESTER'
      | 'APPROVER'
      | 'ACCOUNTING'
      | 'TREASURY'
      | 'ADMIN_PANEL'
      | 'SETTINGS' =
      newRoleTemplate === 'APPROVER'
        ? 'APPROVER'
        : newRoleTemplate === 'ACCOUNTING'
        ? 'ACCOUNTING'
        : newRoleTemplate === 'TREASURY'
        ? 'TREASURY'
        : newRoleTemplate === 'ADMIN'
        ? 'ADMIN_PANEL'
        : 'REQUESTER';

    setIsCreatingNewRole(true);
    setRoleSaveError(null);
    try {
      const res = await onSaveRoleConfig({
        role: cleanCode,
        title: newRoleTitle.trim(),
        description:
          newRoleDesc.trim() ||
          `نقش سازمانی سفارشی «${newRoleTitle.trim()}» با دسترسی‌های اختصاصی`,
        isCustom: true,
        defaultLandingSection: templateLanding,
        accessScope: templateScope,
        approvalLimitRial:
          newRoleTemplate === 'APPROVER'
            ? 2500000000
            : newRoleTemplate === 'ACCOUNTING'
            ? 20000000000
            : 0,
        paymentLimitRial: newRoleTemplate === 'TREASURY' ? 50000000000 : 0,
        permissions: {...templatePerms,canAccessTreasuryReports:false},
      });
      if (!res.ok) {
        setRoleSaveError(res.error || 'خطا در ایجاد نقش جدید');
        return;
      }
      setSelectedRoleKey(cleanCode);
      setNewRoleTitle('');
      setNewRoleCode('');
      setNewRoleDesc('');
      setShowNewRoleForm(false);
    } finally {
      setIsCreatingNewRole(false);
    }
  };

  const handleApplyTemplateToCurrentRole = (templateRole: BuiltInRole) => {
    if (!activeRoleConfig) return;
    const defPerms = getDefaultPermissionsForRole(templateRole);
    setRolePermsDraft(defPerms);
    if (templateRole === 'REQUESTER') {
      setRoleScopeDraft('SELF_ONLY');
      setRoleLandingDraft('REQUESTER');
      setRoleApprovalLimitDraft('0');
      setRolePaymentLimitDraft('0');
    } else if (templateRole === 'APPROVER') {
      setRoleScopeDraft('ASSIGNED_AND_SUBORDINATES');
      setRoleLandingDraft('APPROVER');
      setRoleApprovalLimitDraft('2500000000');
      setRolePaymentLimitDraft('0');
    } else if (templateRole === 'ACCOUNTING') {
      setRoleScopeDraft('COMPANY_WIDE');
      setRoleLandingDraft('ACCOUNTING');
      setRoleApprovalLimitDraft('20000000000');
      setRolePaymentLimitDraft('0');
    } else if (templateRole === 'TREASURY') {
      setRoleScopeDraft('COMPANY_WIDE');
      setRoleLandingDraft('TREASURY');
      setRoleApprovalLimitDraft('0');
      setRolePaymentLimitDraft('50000000000');
    } else if (templateRole === 'ADMIN') {
      setRoleScopeDraft('COMPANY_WIDE');
      setRoleLandingDraft('ADMIN_PANEL');
      setRoleApprovalLimitDraft('0');
      setRolePaymentLimitDraft('0');
    }
  };

  return (
    <div className="space-y-5">
      {/* TAB: MASTER DATA OR SMS GATEWAY */}
      {(activeAdminTab === 'MASTER_COMPANIES' ||
        activeAdminTab === 'MASTER_DEPARTMENTS' ||
        activeAdminTab === 'MASTER_COST_CENTERS' ||
        activeAdminTab === 'SMS_GATEWAY') && (
        <AdminMasterDataAndSmsSection
          mode={activeAdminTab === 'SMS_GATEWAY' ? 'SMS_GATEWAY' : 'MASTER_DATA'}
          activeMasterSubTab={
            activeAdminTab === 'MASTER_DEPARTMENTS'
              ? 'DEPARTMENTS'
              : activeAdminTab === 'MASTER_COST_CENTERS'
              ? 'COST_CENTERS'
              : 'COMPANIES'
          }
          companies={companies}
          departments={departments}
          costCenters={costCenters}
          masterDataCodeSequences={masterDataCodeSequences}
          onBulkCreateMasterData={onBulkCreateMasterData}
          smsConfig={smsConfig}
          smsLogs={smsLogs}
          onSaveCompany={onSaveCompany}
          onToggleCompanyStatus={onToggleCompanyStatus}
          onDeleteCompany={onDeleteCompany}
          onSaveDepartment={onSaveDepartment}
          onToggleDepartmentStatus={onToggleDepartmentStatus}
          onDeleteDepartment={onDeleteDepartment}
          onSaveCostCenter={onSaveCostCenter}
          onToggleCostCenterStatus={onToggleCostCenterStatus}
          onDeleteCostCenter={onDeleteCostCenter}
          onSaveSmsConfig={onSaveSmsConfig}
          onTestSmsDispatch={onTestSmsDispatch}
        />
      )}

      {/* TAB 1: USER MANAGEMENT */}
      {activeAdminTab === 'USERS' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Create / Edit User Form (4 cols) */}
          <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-blue-700" />
                <h2 className="text-sm font-bold text-slate-900">
                  {editingUserId ? 'ویرایش مشخصات و دسترسی کاربر' : 'تعریف کاربر جدید در سازمان'}
                </h2>
              </div>
              {editingUserId && (
                <button
                  type="button"
                  onClick={resetUserForm}
                  className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>انصراف</span>
                </button>
              )}
            </div>

            {formError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2 leading-relaxed">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            {(!activeCompanyNames.length || !activeDepartmentNames.length) && (
              <p className="p-3 rounded-lg bg-amber-50 text-amber-900 text-xs leading-6">
                برای شروع، از منوی «مدیریت اطلاعات پایه» شرکت و واحد سازمانی را تعریف کنید؛ سپس کاربر جدید بسازید.
              </p>
            )}

            <form onSubmit={handleSubmitUserForm} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  نام و نام خانوادگی <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: مهندس آرش کاظمی"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    کد پرسنلی / نام کاربری <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={personnelCode}
                    onChange={(e) => setPersonnelCode(e.target.value)}
                    placeholder="مثال: 01042"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-mono-num focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    شماره همراه
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0912..."
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-mono-num focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    شرکت سازمانی
                  </label>
                  <select
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    {Array.from(new Set([...activeCompanyNames, ...(company ? [company] : [])])).map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    واحد سازمانی <span className="text-rose-600">*</span>
                  </label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    {Array.from(new Set([...activeDepartmentNames, ...(department ? [department] : [])])).map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    <span id="user-primary-role-label">نقش اصلی</span> <span className="text-rose-600">*</span>
                  </label>
                  <select
                    id="user-primary-role" aria-labelledby="user-primary-role-label"
                    value={role}
                    onChange={(e) => {
                      const nextR = e.target.value as Role;
                      setRole(nextR);
                      setAdditionalRoles(prev => prev.filter(r => r !== nextR));
                      const rc = roleConfigs.find((r) => r.role === nextR);
                      if (rc) setAccessScope(rc.accessScope);
                    }}
                    className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    {roleConfigs.map((rc) => (
                      <option key={rc.role} value={rc.role}>
                        {rc.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    محدوده دسترسی اطلاعات
                  </label>
                  <select
                    aria-label="محدوده دسترسی اطلاعات کاربر"
                    value={accessScope}
                    onChange={(e) => setAccessScope(e.target.value as AccessScope)}
                    className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="SELF_ONLY">فقط درخواست‌های خود شخص</option>
                    <option value="ASSIGNED_AND_SUBORDINATES">درخواست‌های ارجاع‌شده و زیرمجموعه</option>
                    <option value="DEPARTMENT">واحد سازمانی مجاز</option>
                    <option value="COMPANY_WIDE">کل شرکت مجاز</option>
                  </select>
                </div>
              </div>

              <fieldset className="border border-slate-200 rounded-xl p-3 space-y-2">
                <legend className="text-xs font-bold text-slate-700 px-1">نقش‌های تکمیلی — انتخاب چندتایی</legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {roleConfigs.filter(rc => rc.role !== role && rc.role !== 'ADMIN').map(rc => (
                    <label key={rc.role} className="flex items-start gap-2 text-xs text-slate-700 rounded-lg border border-slate-200 p-2 cursor-pointer">
                      <input type="checkbox" className="mt-0.5 accent-blue-600" checked={additionalRoles.includes(rc.role)} onChange={e => setAdditionalRoles(prev => e.target.checked ? [...prev,rc.role] : prev.filter(r => r !== rc.role))} />
                      <span>{rc.title}</span>
                    </label>
                  ))}
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">مجوزهای نقش‌ها با هم جمع می‌شوند؛ محدوده و سقف‌های همین فرم معتبرند. پیش‌فرض سقف و صفحهٔ ورود از نقش اصلی می‌آید. مدیر سامانه فقط نقش اصلی است.</p>
              </fieldset>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  سرپرست مستقیم / تأییدکننده مرحله اول
                </label>
                <select
                  aria-label="سرپرست مستقیم کاربر"
                  value={supervisorId}
                  onChange={(e) => setSupervisorId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="">-- بدون سرپرست؛ ارسال مستقیم به حسابداری --</option>
                  {supervisorId&&!eligibleSupervisors.some(s=>s.id===supervisorId)&&<option value={supervisorId} disabled>{users.find(u=>u.id===supervisorId)?.name||'سرپرست فعلی'} (ارجاع فعلی؛ شرایط انتخاب مجدد برقرار نیست)</option>}
                  {eligibleSupervisors.map((sup) => (
                    <option key={sup.id} value={sup.id}>
                      {sup.name} ({sup.department} — {getUserRoles(sup).map(r => getRoleLabel(r, roleConfigs)).join('، ')})
                    </option>
                  ))}
                </select>
              </div>

              {/* Financial limits override for roles with approval or payment permissions */}
              {formRoles.some(r => r === 'APPROVER' || r === 'ACCOUNTING' || Boolean(roleConfigs.find(rc => rc.role === r)?.permissions?.canApprove)) && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    سقف مجاز تأیید مالی اختصاصی (ریال) — اختیاری
                  </label>
                  <RialInput
                    key={`user-approval-${editingUserId||'new'}`}
                    min={0}
                    value={financialApprovalLimit}
                    onChange={(e) => setFinancialApprovalLimit(e.target.value)}
                    placeholder="خالی = استفاده از سقف پیش‌فرض نقش"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-mono-num focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              )}

              {formRoles.some(r => r === 'TREASURY' || Boolean(roleConfigs.find(rc => rc.role === r)?.permissions?.canExecutePayment)) && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    سقف مجاز اجرای پرداخت اختصاصی (ریال) — اختیاری
                  </label>
                  <RialInput
                    key={`user-payment-${editingUserId||'new'}`}
                    min={0}
                    value={paymentExecutionLimit}
                    onChange={(e) => setPaymentExecutionLimit(e.target.value)}
                    placeholder="خالی = استفاده از سقف پیش‌فرض نقش"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-mono-num focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              )}

              {/* Initial password ONLY on user creation; edit mode never loads or shows previous password */}
              {!editingUserId ? (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      رمز عبور اولیه / موقت <span className="text-rose-600">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showInitialPassword ? 'text' : 'password'}
                        required
                        minLength={5}
                        value={initialPassword}
                        onChange={(e) => setInitialPassword(e.target.value)}
                        placeholder="حداقل ۵ کاراکتر"
                        className="w-full pr-3 pl-9 py-2 text-xs bg-white border border-slate-300 rounded-lg font-mono-num focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                      <button
                        type="button"
                        onClick={() => setShowInitialPassword((prev) => !prev)}
                        className="absolute left-2.5 top-2 text-slate-400 hover:text-slate-700 cursor-pointer"
                        title={showInitialPassword ? 'پنهان کردن' : 'نمایش رمز در حال تایپ'}
                      >
                        {showInitialPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-[11px] text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={mustChangePassword}
                      onChange={(e) => setMustChangePassword(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600"
                    />
                    <span>الزام کاربر به تغییر رمز عبور در اولین ورود</span>
                  </label>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                  <span className="text-slate-600">رمز عبور کاربر به صورت هش امن نگهداری می‌شود.</span>
                  <button
                    type="button"
                    onClick={() => {
                      const u = users.find((x) => x.id === editingUserId);
                      if (u) {
                        setResetTargetUser(u);
                        setResetRecoveryId(undefined);
                        setTempPassword('');
                        setResetError(null);
                      }
                    }}
                    className="font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1 cursor-pointer"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>بازنشانی رمز موقت</span>
                  </button>
                </div>
              )}

              {/* Account Active Status */}
              <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="text-xs font-bold text-slate-700">وضعیت حساب کاربری:</span>
                <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-600"
                  />
                  <span className={isActive ? 'text-emerald-700' : 'text-rose-700'}>
                    {isActive ? 'فعال (مجاز به ورود)' : 'غیرفعال (مسدود)'}
                  </span>
                </label>
              </div>

              {/* Replacement Supervisor selector if deactivating/changing role of Approver with pending work */}
              {needsReplacementPrompt && needsReplacementPrompt.mode === 'FORM' && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl space-y-2">
                  <div className="text-xs font-bold text-amber-950">
                    انتقال {needsReplacementPrompt.pendingCount} کار منتظر تأیید به سرپرست جایگزین:
                  </div>
                  <select
                    value={replacementSupervisorId}
                    onChange={(e) => setReplacementSupervisorId(e.target.value)}
                    required
                    className="w-full px-2.5 py-2 text-xs bg-white border border-amber-400 rounded-lg"
                  >
                    <option value="">-- انتخاب سرپرست جایگزین فعال --</option>
                    {eligibleReplacementApprovers.map((ap) => (
                      <option key={ap.id} value={ap.id}>
                        {ap.name} ({ap.department})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                type="submit"
                disabled={isSavingUser || !company || !department}
                className="w-full py-2.5 px-4 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-bold text-xs rounded-lg shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>
                  {isSavingUser
                    ? 'در حال ثبت در سرور...'
                    : editingUserId
                    ? 'ذخیره تغییرات مشخصات کاربر'
                    : 'ایجاد حساب کاربری جدید'}
                </span>
              </button>
            </form>
          </div>

          {/* Users Table & Filters (8 cols) */}
          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-slate-700" />
                  <span>فهرست کاربران سازمان و سلسله‌مراتب سرپرستی</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  جست‌وجو، فیلتر، ویرایش مشخصات، بازنشانی رمز موقت و مدیریت وضعیت فعال/غیرفعال حساب‌ها
                </p>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="جستجو نام، کد پرسنلی، تلفن..."
                  className="w-full pr-9 pl-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            {/* Filter Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">فیلتر نقش سازمانی:</label>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                >
                  <option value="ALL">همه نقش‌ها</option>
                  {roleConfigs.map((rc) => (
                    <option key={rc.role} value={rc.role}>
                      {rc.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">فیلتر واحد سازمانی:</label>
                <select
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                >
                  <option value="ALL">همه واحدها</option>
                  {Array.from(new Set([...activeDepartmentNames, ...users.map((u) => u.department).filter(Boolean)])).map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">وضعیت حساب:</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE')}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                >
                  <option value="ALL">همه وضعیت‌ها ({users.length})</option>
                  <option value="ACTIVE">فقط کاربران فعال</option>
                  <option value="INACTIVE">فقط کاربران غیرفعال</option>
                </select>
              </div>
            </div>

            <div className="w-full border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full table-auto text-right border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <SortableHeader label="نام و نام خانوادگی" field="name" sortConfig={sortConfig} onSort={handleSort} />
                    <SortableHeader label="کد پرسنلی" field="personnelCode" sortConfig={sortConfig} onSort={handleSort} />
                    <SortableHeader label="واحد و شرکت" field="department" sortConfig={sortConfig} onSort={handleSort} />
                    <SortableHeader label="نقش و محدوده" field="role" sortConfig={sortConfig} onSort={handleSort} />
                    <SortableHeader label="سرپرست مستقیم" field="supervisorName" sortConfig={sortConfig} onSort={handleSort} />
                    <th className="py-2.5 px-2.5 text-xs font-semibold text-slate-600">وضعیت حساب</th>
                    <th className="py-2.5 px-2.5 text-xs font-semibold text-slate-600">عملیات مدیریت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {sortedUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        کاربری مطابق با فیلترهای انتخاب‌شده یافت نشد.
                      </td>
                    </tr>
                  ) : (
                    sortedUsers.map((u) => {
                      const active = u.isActive !== false;
                      return (
                        <tr key={u.id} className={`hover:bg-slate-50 transition-colors align-top ${!active ? 'bg-slate-50/70 opacity-75' : ''}`}>
                          <td className="py-2.5 px-2.5 break-words">
                            <div className="font-bold text-slate-900">{u.name}</div>
                            {u.phone && (
                              <div className="text-[11px] text-slate-500 font-mono-num flex items-center gap-1 mt-0.5">
                                <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                                <span>{u.phone}</span>
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-2.5 font-mono-num font-bold text-blue-800 break-words">
                            {u.personnelCode}
                          </td>
                          <td className="py-2.5 px-2.5 break-words">
                            <div className="font-semibold text-slate-800">{u.department}</div>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              {u.company || 'هلدینگ مرکزی آریا'}
                            </div>
                          </td>
                          <td className="py-2.5 px-2.5 break-words">
                            <span className="inline-flex items-center gap-1 font-bold text-slate-800">
                              <Shield className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>{getUserRoles(u).map(r => getRoleLabel(r, roleConfigs)).join('، ')}</span>
                            </span>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              {getAccessScopeLabel(u.effectiveAccessScope || u.accessScope)}
                            </div>
                            {(u.effectiveApprovalLimitRial || 0) > 0 && (
                              <div className="text-[10px] text-emerald-700 font-mono-num mt-0.5">
                                سقف تأیید: {formatRial(u.effectiveApprovalLimitRial || 0)} ریال
                              </div>
                            )}
                            {(u.effectivePaymentLimitRial || 0) > 0 && (
                              <div className="text-[10px] text-blue-700 font-mono-num mt-0.5">
                                سقف پرداخت: {formatRial(u.effectivePaymentLimitRial || 0)} ریال
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-2.5 text-slate-700 font-medium break-words">
                            {u.supervisorName || <span className="text-slate-400">---</span>}
                          </td>
                          <td className="py-2.5 px-2.5">
                            <div className="flex flex-col gap-1">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold w-fit ${
                                  active
                                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                                }`}
                              >
                                {active ? (
                                  <>
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                                    <span>فعال</span>
                                  </>
                                ) : (
                                  <>
                                    <Ban className="w-3 h-3 text-rose-600 shrink-0" />
                                    <span>غیرفعال</span>
                                  </>
                                )}
                              </span>
                              {u.mustChangePassword && (
                                <span className="text-[10px] text-amber-700 font-semibold">
                                  نیازمند تغییر رمز موقت
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-2.5">
                            <div className="flex flex-wrap items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleEditClick(u)}
                                className="px-2 py-1 text-[11px] font-bold text-blue-700 hover:bg-blue-50 border border-blue-200 rounded-lg transition cursor-pointer flex items-center gap-1"
                                title="ویرایش مشخصات و دسترسی"
                              >
                                <Edit className="w-3.5 h-3.5" />
                                <span>ویرایش</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setResetTargetUser(u);
                                  setResetRecoveryId(undefined);
                                  setTempPassword('');
                                  setResetError(null);
                                }}
                                className="px-2 py-1 text-[11px] font-bold text-amber-800 hover:bg-amber-50 border border-amber-200 rounded-lg transition cursor-pointer flex items-center gap-1"
                                title="تعریف رمز عبور موقت جدید"
                              >
                                <KeyRound className="w-3.5 h-3.5" />
                                <span>بازنشانی رمز</span>
                              </button>
                              {u.id !== currentUser.id && (
                                <button
                                  type="button"
                                  onClick={() => handleQuickToggleStatus(u)}
                                  className={`px-2 py-1 text-[11px] font-bold rounded-lg border transition cursor-pointer ${
                                    active
                                      ? 'text-rose-700 hover:bg-rose-50 border-rose-200'
                                      : 'text-emerald-700 hover:bg-emerald-50 border-emerald-200'
                                  }`}
                                  title={active ? 'غیرفعال کردن حساب کاربر' : 'فعال‌سازی مجدد حساب کاربر'}
                                >
                                  {active ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SIMPLE & COMPLETE ROLE & PANEL ACCESS MANAGEMENT */}
      {activeAdminTab === 'ROLES' && activeRoleConfig && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Right Column (4 cols): Role Cards + Add New Role */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3.5">
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">نقش‌های سازمانی سامانه</h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    انتخاب نقش یا تعریف نقش جدید با دسترسی سفارشی
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowNewRoleForm((prev) => !prev);
                    setRoleSaveError(null);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                    showNewRoleForm
                      ? 'bg-slate-200 text-slate-800'
                      : 'bg-blue-700 hover:bg-blue-800 text-white shadow-xs'
                  }`}
                >
                  {showNewRoleForm ? (
                    <>
                      <X className="w-3.5 h-3.5" />
                      <span>بستن فرم</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>افزودن نقش جدید</span>
                    </>
                  )}
                </button>
              </div>

              {/* Add New Role Expandable Form */}
              {showNewRoleForm && (
                <form
                  onSubmit={handleCreateCustomRole}
                  className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl space-y-3"
                >
                  <div className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-blue-700" />
                    <span>تعریف نقش سازمانی جدید در پنل</span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      عنوان فارسی نقش <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={newRoleTitle}
                      onChange={(e) => setNewRoleTitle(e.target.value)}
                      placeholder="مثال: مدیر مالی ارشد / بازرس داخلی / تنخواه‌دار"
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        کد شناسه (اختیاری)
                      </label>
                      <input
                        type="text"
                        dir="ltr"
                        value={newRoleCode}
                        onChange={(e) => setNewRoleCode(e.target.value)}
                        placeholder="SENIOR_FINANCE"
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        الگوی دسترسی اولیه
                      </label>
                      <select
                        value={newRoleTemplate}
                        onChange={(e) =>
                          setNewRoleTemplate(e.target.value as BuiltInRole | 'MINIMAL')
                        }
                        className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                      >
                        <option value="REQUESTER">الگوی متقاضی / کارمند</option>
                        <option value="APPROVER">الگوی سرپرست و تأییدکننده</option>
                        <option value="ACCOUNTING">الگوی حسابداری و مالی</option>
                        <option value="TREASURY">الگوی خزانه‌داری و پرداخت</option>
                        <option value="ADMIN">الگوی مدیر سیستم</option>
                        <option value="MINIMAL">حداقل دسترسی (خام)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      توضیح کوتاه شرح وظایف نقش
                    </label>
                    <input
                      type="text"
                      value={newRoleDesc}
                      onChange={(e) => setNewRoleDesc(e.target.value)}
                      placeholder="توضیح مختصر درباره اختیارات این نقش..."
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isCreatingNewRole}
                    className="w-full py-2 px-3 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>
                      {isCreatingNewRole
                        ? 'در حال ایجاد نقش...'
                        : 'ایجاد نقش و باز کردن تنظیمات دسترسی'}
                    </span>
                  </button>
                </form>
              )}

              {/* Role Cards List */}
              <div className="space-y-2">
                {roleConfigs.map((rc) => {
                  const isSelected = rc.role === selectedRoleKey;
                  const countInRole = users.filter(
                    (u) => getUserRoles(u).includes(rc.role) && u.isActive !== false
                  ).length;
                  const normPerms = normalizeRolePermissionSet(rc.permissions, rc.role);
                  const activePermCount = permissionCount(normPerms,rc.role==='ADMIN');
                  const isBuiltIn = ['REQUESTER', 'APPROVER', 'ACCOUNTING', 'TREASURY', 'ADMIN'].includes(
                    rc.role
                  );

                  return (
                    <button
                      key={rc.role}
                      type="button"
                      onClick={() => handleSelectRoleCard(rc)}
                      className={`w-full text-right p-3.5 rounded-xl border transition cursor-pointer flex flex-col gap-1.5 ${
                        isSelected
                          ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Shield
                            className={`w-4 h-4 shrink-0 ${
                              isSelected ? 'text-amber-400' : 'text-blue-700'
                            }`}
                          />
                          <span className="text-xs font-bold truncate">{rc.title}</span>
                        </div>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-mono-num font-bold shrink-0 ${
                            isSelected ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {countInRole} کاربر
                        </span>
                      </div>

                      <p
                        className={`text-[11px] leading-relaxed line-clamp-2 ${
                          isSelected ? 'text-slate-300' : 'text-slate-500'
                        }`}
                      >
                        {rc.description}
                      </p>

                      <div className="flex items-center justify-between pt-1.5 mt-0.5 border-t border-slate-200/20 text-[10px]">
                        <span
                          className={`px-1.5 py-0.5 rounded font-semibold ${
                            isSelected
                              ? 'bg-slate-800 text-slate-300'
                              : isBuiltIn
                              ? 'bg-slate-200/70 text-slate-600'
                              : 'bg-indigo-100 text-indigo-800'
                          }`}
                        >
                          {isBuiltIn ? 'نقش استاندارد سیستم' : `سفارشی (${rc.role})`}
                        </span>
                        <span
                          className={`font-mono-num font-bold ${
                            isSelected ? 'text-emerald-400' : 'text-emerald-700'
                          }`}
                        >
                          {activePermCount} دسترسی فعال
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Reset All Roles to Factory Defaults */}
              {onResetRoleDefaults && (
                <div className="pt-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={async () => {
                      setIsSavingRole(true);
                      try {
                        await onResetRoleDefaults();
                      } finally {
                        setIsSavingRole(false);
                      }
                    }}
                    disabled={isSavingRole}
                    className="w-full py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
                    <span>بازگردانی تمام نقش‌ها به تنظیمات پیش‌فرض استاندارد</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Left Column (8 cols): Selected Role Configuration & All Panel Permissions */}
          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-5">
            {/* Header & Quick Preset Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
              <div>
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-blue-700" />
                  <h2 className="text-base font-bold text-slate-900">
                    مدیریت دسترسی‌ها و تنظیمات پیش‌فرض: {activeRoleConfig.title}
                  </h2>
                  <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-mono text-slate-600">
                    {activeRoleConfig.role}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">{activeRoleConfig.description}</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Reset Current Role to Default */}
                <button
                  type="button"
                  onClick={async () => {
                    if (
                      ['REQUESTER', 'APPROVER', 'ACCOUNTING', 'TREASURY', 'ADMIN'].includes(
                        activeRoleConfig.role
                      ) &&
                      onResetRoleDefaults
                    ) {
                      setIsSavingRole(true);
                      try {
                        await onResetRoleDefaults(activeRoleConfig.role);
                      } finally {
                        setIsSavingRole(false);
                      }
                    } else {
                      handleApplyTemplateToCurrentRole('REQUESTER');
                    }
                  }}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer"
                  title="بازگردانی مجوزها و سقف مالی این نقش به حالت پیش‌فرض"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-blue-700" />
                  <span>پیش‌فرض این نقش</span>
                </button>

                {/* Delete Custom Role if not built-in */}
                {!['REQUESTER', 'APPROVER', 'ACCOUNTING', 'TREASURY', 'ADMIN'].includes(
                  activeRoleConfig.role
                ) &&
                  onDeleteRoleConfig && (
                    <button
                      type="button"
                      onClick={async () => {
                        setRoleSaveError(null);
                        const res = await onDeleteRoleConfig(activeRoleConfig.role);
                        if (!res.ok) {
                          setRoleSaveError(res.error || 'خطا در حذف نقش سفارشی');
                        } else {
                          setSelectedRoleKey('REQUESTER');
                        }
                      }}
                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>حذف نقش سفارشی</span>
                    </button>
                  )}
              </div>
            </div>

            {activeRoleConfig.role === 'ADMIN' && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-950 flex items-start gap-2.5 leading-relaxed">
                <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <div>
                  <strong>دسترسی کامل ادمین پرتال:</strong> نقش «مدیر ارشد سامانه (ادمین پرتال)» دارای مجوز کامل به تمامی بخش‌ها، فرم‌های ثبت درخواست، کارتابل‌های تأیید سرپرست و حسابداری، عملیات خزانه‌داری، اطلاعات پایه و مدیریت کاربران است.
                </div>
              </div>
            )}

            {roleSaveError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{roleSaveError}</span>
              </div>
            )}

            <form onSubmit={handleSaveRoleSettings} className="space-y-5">
              {/* Role Title & Description + Quick Preset Templates Bar */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-200">
                  <span className="text-xs font-bold text-slate-800">
                    ۱. مشخصات پایه، کارتابل پیش‌فرض و حدود اختیار مالی نقش
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-slate-500">اعمال سریع الگوی پیش‌فرض:</span>
                    {(
                      [
                        { key: 'REQUESTER', label: 'متقاضی' },
                        { key: 'APPROVER', label: 'سرپرست' },
                        { key: 'ACCOUNTING', label: 'حسابداری' },
                        { key: 'TREASURY', label: 'خزانه‌دار' },
                        { key: 'ADMIN', label: 'ادمین کل' },
                      ] as { key: BuiltInRole; label: string }[]
                    ).map((tpl) => (
                      <button
                        key={tpl.key}
                        type="button"
                        onClick={() => handleApplyTemplateToCurrentRole(tpl.key)}
                        className="px-2 py-1 bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-800 border border-slate-300 rounded text-[10px] font-bold transition cursor-pointer"
                      >
                        الگوی {tpl.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Editable Role Title & Description */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      عنوان نمایشی نقش در سامانه
                    </label>
                    <input
                      type="text"
                      value={roleTitleDraft}
                      onChange={(e) => setRoleTitleDraft(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-bold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      شرح وظایف و توضیحات نقش
                    </label>
                    <input
                      type="text"
                      value={roleDescDraft}
                      onChange={(e) => setRoleDescDraft(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-700"
                    />
                  </div>
                </div>

                {/* Default Landing Page, Access Scope, Approval Limit, Payment Limit */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-800 mb-1">
                      صفحه پیش‌فرض پس از ورود
                    </label>
                    <select
                      value={roleLandingDraft}
                      onChange={(e) =>
                        setRoleLandingDraft(
                          e.target.value as
                            | 'REQUESTER'
                            | 'APPROVER'
                            | 'ACCOUNTING'
                            | 'TREASURY'
                            | 'ADMIN_PANEL'
                            | 'SETTINGS'
                        )
                      }
                      className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                    >
                      <option value="REQUESTER">ثبت و پیگیری درخواست‌ها</option>
                      <option value="APPROVER">کارتابل تأیید سرپرست واحد</option>
                      <option value="ACCOUNTING">بررسی مالی حسابداری</option>
                      <option value="TREASURY">میز کار خزانه‌داری و پرداخت</option>
                      <option value="ADMIN_PANEL">پنل مدیریت و اطلاعات پایه</option>
                      <option value="SETTINGS">تنظیمات حساب کاربری</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-800 mb-1">
                      محدوده پیش‌فرض مشاهده اطلاعات
                    </label>
                    <select
                      value={roleScopeDraft}
                      onChange={(e) => setRoleScopeDraft(e.target.value as AccessScope)}
                      className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                    >
                      <option value="SELF_ONLY">فقط درخواست‌های خود شخص</option>
                      <option value="ASSIGNED_AND_SUBORDINATES">درخواست‌های ارجاع‌شده و زیرمجموعه</option>
                      <option value="DEPARTMENT">واحد سازمانی مجاز</option>
                      <option value="COMPANY_WIDE">کل شرکت مجاز</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-800 mb-1">
                      سقف پیش‌فرض تأیید مالی (ریال)
                    </label>
                    <RialInput
                      key={`role-approval-${activeRoleConfig.role}`}
                      min={0}
                      disabled={!rolePermsDraft.canApprove}
                      value={roleApprovalLimitDraft}
                      onChange={(e) => setRoleApprovalLimitDraft(e.target.value)}
                      className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg font-mono-num disabled:bg-slate-100"
                    />
                    <span className="text-[10px] text-slate-500 mt-0.5 block font-mono-num">
                      {formatRial(Number(roleApprovalLimitDraft) || 0)} ریال
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-800 mb-1">
                      سقف پیش‌فرض اجرای پرداخت (ریال)
                    </label>
                    <RialInput
                      key={`role-payment-${activeRoleConfig.role}`}
                      min={0}
                      disabled={!rolePermsDraft.canExecutePayment}
                      value={rolePaymentLimitDraft}
                      onChange={(e) => setRolePaymentLimitDraft(e.target.value)}
                      className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg font-mono-num disabled:bg-slate-100"
                    />
                    <span className="text-[10px] text-slate-500 mt-0.5 block font-mono-num">
                      {formatRial(Number(rolePaymentLimitDraft) || 0)} ریال
                    </span>
                  </div>
                </div>
              </div>

              <RoleCompanyAccess value={roleCompaniesDraft} onChange={setRoleCompaniesDraft} companies={companies} admin={activeRoleConfig.role==='ADMIN'} />
              <PermissionSettings value={rolePermsDraft} onChange={setRolePermsDraft} admin={activeRoleConfig.role === 'ADMIN'} />

              {/* Sticky / Clear Action Footer */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-slate-200">
                <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                  <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    تغییرات بلافاصله روی کارتابل و منوهای{" "}
                    <strong className="text-slate-800">
                      {users.filter((u) => getUserRoles(u).includes(activeRoleConfig.role)).length} کاربر
                    </strong>{" "}
                    دارای نقش «{activeRoleConfig.title}» اعمال می‌شود.
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={isSavingRole}
                  className="px-6 py-2.5 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>
                    {isSavingRole
                      ? 'در حال ذخیره تنظیمات...'
                      : `ذخیره تنظیمات و دسترسی‌های «${roleTitleDraft || activeRoleConfig.title}»`}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB 3: PASSWORD RECOVERY REQUESTS */}
      {activeAdminTab === 'RECOVERY' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              درخواست‌های بازیابی دسترسی و صدور رمز عبور موقت
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              کاربرانی که رمز عبور خود را فراموش کرده‌اند پس از تطابق کد پرسنلی و شماره همراه در این فهرست ثبت می‌شوند.
            </p>
          </div>

          <div className="w-full border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full table-auto text-right border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <th className="py-2.5 px-3">کد پیگیری</th>
                  <th className="py-2.5 px-3">نام کاربر و کد پرسنلی</th>
                  <th className="py-2.5 px-3">تلفن همراه</th>
                  <th className="py-2.5 px-3">توضیحات درخواست</th>
                  <th className="py-2.5 px-3">زمان ثبت</th>
                  <th className="py-2.5 px-3">وضعیت</th>
                  <th className="py-2.5 px-3">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {passwordRecoveryRequests.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      هیچ درخواست بازیابی رمز عبوری ثبت نشده است.
                    </td>
                  </tr>
                ) : (
                  passwordRecoveryRequests.map((rec) => {
                    const matchedU = users.find((u) => u.id === rec.userId || u.personnelCode === rec.personnelCode);
                    return (
                      <tr key={rec.id} className="hover:bg-slate-50 align-top">
                        <td className="py-2.5 px-3 font-mono-num font-bold text-slate-900 break-words">{rec.trackingCode}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-800 break-words">
                          {rec.userName || matchedU?.name || '---'} ({rec.personnelCode})
                        </td>
                        <td className="py-2.5 px-3 font-mono-num break-words">{rec.phone}</td>
                        <td className="py-2.5 px-3 text-slate-600 break-words">{rec.note}</td>
                        <td className="py-2.5 px-3 font-mono-num text-slate-500 break-words">{rec.createdAt}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                              rec.status === 'Pending'
                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            }`}
                          >
                            {rec.status === 'Pending' ? 'در انتظار صدور رمز موقت' : `انجام‌شده (${rec.resolvedBy || 'مدیر'})`}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          {rec.status === 'Pending' && matchedU && (
                            <button
                              type="button"
                              onClick={() => {
                                setResetTargetUser(matchedU);
                                setResetRecoveryId(rec.id);
                                setTempPassword('');
                                setForceChangeOnLogin(true);
                                setResetError(null);
                              }}
                              className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-[11px] font-bold cursor-pointer flex items-center gap-1"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                              <span>صدور رمز موقت</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: SECURITY & ACCESS AUDIT LOGS */}
      {activeAdminTab === 'AUDIT' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              گزارش حسابرسی امنیتی و تاریخچه تغییرات کاربران و دسترسی‌ها
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              ثبت غیرقابل‌حذف کلیه تغییرات نقش، سقف مالی، سرپرست، وضعیت حساب و بازنشانی رمز عبور با ذکر شخص اقدام‌کننده و زمان سرور
            </p>
          </div>

          <div className="w-full border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full table-auto text-right border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <th className="py-2.5 px-3">زمان سرور</th>
                  <th className="py-2.5 px-3">نوع رویداد</th>
                  <th className="py-2.5 px-3">اقدام‌کننده</th>
                  <th className="py-2.5 px-3">کاربر / نقش هدف</th>
                  <th className="py-2.5 px-3">شرح دقیق عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {securityAuditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      هنوز رویداد امنیتی جدیدی ثبت نشده است.
                    </td>
                  </tr>
                ) : (
                  securityAuditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 align-top">
                      <td className="py-2.5 px-3 font-mono-num text-slate-500 break-words">
                        {log.createdAt}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-800 break-words">
                        {log.actionType}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800 break-words">
                        {log.actorName}
                      </td>
                      <td className="py-2.5 px-3 text-blue-800 font-semibold break-words">
                        {log.targetUserName || '---'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 leading-relaxed break-words">
                        {log.description}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: Controlled Temporary Password Reset */}
      {resetTargetUser && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  بازنشانی رمز عبور موقت کاربر
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setResetTargetUser(null)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
              <div>
                <span className="text-slate-500">کاربر هدف: </span>
                <strong className="text-slate-900">{resetTargetUser.name}</strong>
              </div>
              <div>
                <span className="text-slate-500">کد پرسنلی / نام کاربری: </span>
                <strong className="font-mono-num text-blue-800">{resetTargetUser.personnelCode}</strong>
              </div>
            </div>

            <form onSubmit={handleConfirmPasswordReset} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  رمز عبور موقت جدید <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showTempPassword ? 'text' : 'password'}
                    required
                    minLength={5}
                    value={tempPassword}
                    onChange={(e) => setTempPassword(e.target.value)}
                    placeholder="حداقل ۵ کاراکتر"
                    className="w-full pr-3 pl-9 py-2 text-xs bg-white border border-slate-300 rounded-lg font-mono-num focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowTempPassword((p) => !p)}
                    className="absolute left-2.5 top-2 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    {showTempPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  رمز به صورت هش امن ذخیره شده و پس از بستن این پنجره دیگر نمایش داده نخواهد شد.
                </p>
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={forceChangeOnLogin}
                  onChange={(e) => setForceChangeOnLogin(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600"
                />
                <span>الزام کاربر به تغییر این رمز موقت در اولین ورود به سامانه</span>
              </label>

              {resetError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
                  {resetError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetTargetUser(null)}
                  className="px-3.5 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={isResettingPass}
                  className="px-4 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg cursor-pointer"
                >
                  {isResettingPass ? 'در حال ثبت...' : 'ثبت رمز موقت و ابطال نشست‌های قبلی'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Reassign Pending Approvals Before Deactivating Approver */}
      {needsReplacementPrompt && needsReplacementPrompt.mode === 'TOGGLE' && needsReplacementPrompt.targetUser && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  تعیین سرپرست جایگزین پیش از غیرفعال‌سازی
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setNeedsReplacementPrompt(null)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-700 leading-relaxed">
              تأییدکننده <strong>«{needsReplacementPrompt.targetUser.name}»</strong> دارای{' '}
              <strong>{needsReplacementPrompt.pendingCount} ردیف درخواست منتظر بررسی سرپرست</strong> است. طبق قواعد کنترل داخلی، غیرفعال‌سازی حساب نباید موجب تأیید خودکار یا بلاتکلیفی درخواست‌ها شود. لطفاً سرپرست جایگزین مجاز را انتخاب کنید:
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                سرپرست جایگزین مجاز <span className="text-rose-600">*</span>
              </label>
              <select
                value={replacementSupervisorId}
                onChange={(e) => setReplacementSupervisorId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
              >
                <option value="">-- انتخاب تأییدکننده جایگزین فعال --</option>
                {eligibleReplacementApprovers.map((ap) => (
                  <option key={ap.id} value={ap.id}>
                    {ap.name} ({ap.department})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setNeedsReplacementPrompt(null)}
                className="px-3.5 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                disabled={!replacementSupervisorId}
                onClick={() => {
                  if (needsReplacementPrompt.targetUser && replacementSupervisorId) {
                    handleQuickToggleStatus(needsReplacementPrompt.targetUser, replacementSupervisorId);
                  }
                }}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg cursor-pointer"
              >
                انتقال کارهای منتظر و غیرفعال‌سازی حساب
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
