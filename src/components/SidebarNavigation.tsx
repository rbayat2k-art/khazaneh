import {WorkflowSubmenus,hasWorkflowSubmenus,workflowMenuGroup} from './WorkflowSubmenus';
import type {PersonnelBalanceTab,PersonnelBalanceSummary} from '../types/personnel-balance';
import type {AccountInquiryTab,AccountInquirySummary}from'../types/account-inquiry';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Landmark,
  CreditCard,
  ListPlus,
  Users,
  Calendar,
  AlertCircle,
  Clock,
  CheckCircle2,
  ShieldCheck,
  CheckSquare,
  PhoneCall,
  Lock,
  Folder,
  UserCheck,
  Keyboard,
  LogOut,
  X,
  ChevronDown,
  ChevronLeft,
  Settings,
  Building2,
  FolderTree,
  Layers,
  MessageSquare,
  Sliders,
  HelpCircle,
  History,
  Database,
  FileCheck2,
  RotateCcw,
} from 'lucide-react';
import {
  type User,
  type Role,
  type TreasurySubTab,
  type ApprovalCategoryTab,
  type RoleDefinitionConfig,
  normalizeRolePermissionSet,
} from '../types/treasury';
import type { AdminSubTab } from './AdminPortalView';
import { getRoleLabel } from '../utils/sorting';
import {menuVisible,visibleMenus,permissionValue} from '../utils/permission-registry';

export type MainSection =
  | 'PERSONNEL_BALANCES'
  | 'ACCOUNT_INQUIRIES'
  | 'ADMIN_PANEL'
  | 'REQUESTER'
  | 'APPROVER'
  | 'ACCOUNTING'
  | 'TREASURY'
  | 'REPORTS'
  | 'SETTINGS';

export type RequesterSubView =
  | 'PAYMENT_SINGLE'
  | 'PAYMENT_BATCH'
  | 'ADVANCE_SINGLE'
  | 'ADVANCE_BATCH'
  | 'CARTABLE';

interface SidebarNavigationProps {
  currentUser: User;
  roleConfigs?: RoleDefinitionConfig[];
  activeSection: MainSection;
  onSelectSection: (section: MainSection) => void;
  activeRequesterFormTab?: RequesterSubView;
  activeRequesterStatusFilter?: string;
  onSelectRequesterTab?: (
    tab: RequesterSubView,
    statusFilter?: string
  ) => void;
  activeApprovalCategoryTab?: ApprovalCategoryTab;
  onSelectApprovalCategoryTab?: (
    mode: 'APPROVER' | 'ACCOUNTING',
    tab: ApprovalCategoryTab
  ) => void;
  personnelBalanceSummary?:PersonnelBalanceSummary;
  personnelBalanceTab?:PersonnelBalanceTab;
  onSelectPersonnelBalanceTab?:(tab:PersonnelBalanceTab)=>void;
  accountInquirySummary?:AccountInquirySummary;
  activeAccountInquiryTab?:AccountInquiryTab;
  onSelectAccountInquiryTab?:(tab:AccountInquiryTab)=>void;
  activeTreasuryTab?: TreasurySubTab;
  onSelectTreasuryTab?: (tab: TreasurySubTab) => void;
  activeAdminTab?: AdminSubTab;
  onSelectAdminTab?: (tab: AdminSubTab) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  onOpenKeyboardHelp: () => void;
  onLogout: () => void;
  badges: {
    needsRevision: number;
    trackingTotal:number;
    pendingApprover: number;
    pendingAccounting: number;
    pendingTreasury: number;
    inPaymentTreasury: number;
    completedPayments: number;
    totalReceipts: number;
    pendingPasswordRecovery?: number;
    totalUsers?: number;
    totalCompanies?: number;
    totalDepartments?: number;
    totalCostCenters?: number;
    totalAuditLogs?: number;
  };
}


const mainMenuColors={
 forms:['bg-slate-50 text-slate-700 hover:bg-slate-200','bg-slate-900 text-white hover:bg-slate-800 ring-1 ring-inset ring-slate-900'],
 tracking:['bg-gray-50 text-slate-700 hover:bg-slate-200','bg-slate-900 text-white hover:bg-slate-800 ring-1 ring-inset ring-slate-900'],
 approver:['bg-slate-100 text-slate-700 hover:bg-slate-200','bg-slate-900 text-white hover:bg-slate-800 ring-1 ring-inset ring-slate-900'],
 accounting:['bg-neutral-50 text-slate-700 hover:bg-slate-200','bg-slate-900 text-white hover:bg-slate-800 ring-1 ring-inset ring-slate-900'],
 treasury:['bg-stone-100 text-slate-700 hover:bg-slate-200','bg-slate-900 text-white hover:bg-slate-800 ring-1 ring-inset ring-slate-900'],
 reports:['bg-zinc-50 text-slate-700 hover:bg-slate-200','bg-slate-900 text-white hover:bg-slate-800 ring-1 ring-inset ring-slate-900'],
 master:['bg-gray-100 text-slate-700 hover:bg-slate-200','bg-slate-900 text-white hover:bg-slate-800 ring-1 ring-inset ring-slate-900'],
 users:['bg-zinc-100 text-slate-700 hover:bg-slate-200','bg-slate-900 text-white hover:bg-slate-800 ring-1 ring-inset ring-slate-900'],
 settings:['bg-stone-50 text-slate-700 hover:bg-slate-200','bg-slate-900 text-white hover:bg-slate-800 ring-1 ring-inset ring-slate-900'],
} as const;
const menuHeaderTone=(menu:keyof typeof mainMenuColors,active:boolean)=>mainMenuColors[menu][active?1:0]+' font-bold';

type CollapsibleMenuKey =
  | 'REQUESTER_FORMS_MENU'
  | 'REQUESTER_CARTABLE_MENU'
  | 'APPROVER_MENU'
  | 'ACCOUNTING_MENU'
  | 'TREASURY_MENU'
  | 'REPORTS_MENU'
  | 'MASTER_DATA_MENU'
  | 'USERS_ACCESS_MENU'
  | 'SETTINGS_MENU';

export const SidebarNavigation: React.FC<SidebarNavigationProps> = ({
  currentUser,
  roleConfigs,
  activeSection,
  onSelectSection,
  activeRequesterFormTab = 'PAYMENT_BATCH',
  activeRequesterStatusFilter = 'ALL',
  onSelectRequesterTab,
  activeApprovalCategoryTab = 'PENDING',
  onSelectApprovalCategoryTab,
  personnelBalanceSummary,personnelBalanceTab='MINE',onSelectPersonnelBalanceTab,
  accountInquirySummary,
  activeAccountInquiryTab='MINE',
  onSelectAccountInquiryTab,
  activeTreasuryTab = 'QUEUE',
  onSelectTreasuryTab,
  activeAdminTab = 'USERS',
  onSelectAdminTab,
  isOpenMobile,
  onCloseMobile,
  onOpenKeyboardHelp,
  onLogout,
  badges,
}) => {

  const perms = useMemo(
    () => normalizeRolePermissionSet(currentUser.effectivePermissions, currentUser.role),
    [currentUser.effectivePermissions, currentUser.role]
  );

  const canAccessRequesterForms = Boolean(
    perms.canAccessRequesterSection ||
      perms.canCreatePaymentBatch ||
      perms.canCreatePaymentSingle ||
      perms.canCreateAdvanceBatch ||
      perms.canCreateAdvanceSingle || hasWorkflowSubmenus(perms,'forms')
  );

  const nav=(id:string)=>menuVisible(perms,id);
  const canAccessRequesterCartable = visibleMenus(perms,'REQUESTER').some(e=>e.tab==='CARTABLE')||hasWorkflowSubmenus(perms,'tracking');

  const canAccessApprover = visibleMenus(perms,'APPROVER').length>0||hasWorkflowSubmenus(perms,'approver');
  const canAccessAccounting = visibleMenus(perms,'ACCOUNTING').length>0||hasWorkflowSubmenus(perms,'accounting');

  const canAccessTreasury = visibleMenus(perms,'TREASURY').length>0;

  const canAccessMasterDataMenu = Boolean(
    currentUser.role === 'ADMIN' ||
      perms.canManageCompanies ||
      perms.canManageDepartments ||
      perms.canManageCostCenters ||
      perms.canManageSmsGateway || perms.canManageBankInquiry
  );

  const canAccessUsersAccessMenu = Boolean(
    currentUser.role === 'ADMIN' ||
      perms.canManageUsers ||
      perms.canManageRoles ||
      perms.canManagePasswordRecovery ||
      perms.canViewSecurityAudit
  );

  const isMasterDataSubTab =
    activeSection === 'ADMIN_PANEL' &&
    (activeAdminTab === 'MASTER_COMPANIES' ||
      activeAdminTab === 'MASTER_DEPARTMENTS' ||
      activeAdminTab === 'MASTER_COST_CENTERS' ||
      activeAdminTab === 'SMS_GATEWAY'||activeAdminTab==='BANK_INQUIRY');

  const isUsersAccessSubTab =
    activeSection === 'ADMIN_PANEL' &&
    (activeAdminTab === 'USERS' ||
      activeAdminTab === 'ROLES' ||
      activeAdminTab === 'RECOVERY' ||
      activeAdminTab === 'AUDIT');

  const workflowGroup=workflowMenuGroup(activeSection,activeSection==='PERSONNEL_BALANCES'?personnelBalanceTab:activeAccountInquiryTab);
  const isApproverActive=activeSection==='APPROVER'||workflowGroup==='approver',isAccountingActive=activeSection==='ACCOUNTING'||workflowGroup==='accounting';
  const workflowLinks=(group:'forms'|'tracking'|'approver'|'accounting')=><WorkflowSubmenus group={group} permissions={perms} section={activeSection} inquiryTab={activeAccountInquiryTab} balanceTab={personnelBalanceTab} inquirySummary={accountInquirySummary} balanceSummary={personnelBalanceSummary} onInquiry={tab=>{onSelectSection('ACCOUNT_INQUIRIES');onSelectAccountInquiryTab?.(tab);onCloseMobile();}} onBalance={tab=>{onSelectSection('PERSONNEL_BALANCES');onSelectPersonnelBalanceTab?.(tab);onCloseMobile();}}/>;
  const isRequesterFormsActive =
    activeSection === 'REQUESTER' && activeRequesterFormTab !== 'CARTABLE'||workflowGroup==='forms';
  const isRequesterCartableActive =
    activeSection === 'REQUESTER' && activeRequesterFormTab === 'CARTABLE'||workflowGroup==='tracking';

  // State for collapsible dropdown menus
  const [openMenus, setOpenMenus] = useState<Record<CollapsibleMenuKey, boolean>>(() => ({
    REQUESTER_FORMS_MENU: activeSection === 'REQUESTER',
    REQUESTER_CARTABLE_MENU: activeSection === 'REQUESTER',
    APPROVER_MENU: isApproverActive,
    ACCOUNTING_MENU: isAccountingActive,
    TREASURY_MENU: activeSection === 'TREASURY',
    REPORTS_MENU:activeSection==='REPORTS',
    MASTER_DATA_MENU: isMasterDataSubTab,
    USERS_ACCESS_MENU: isUsersAccessSubTab || activeSection === 'ADMIN_PANEL',
    SETTINGS_MENU: activeSection === 'SETTINGS',
  }));

  // Automatically expand the relevant menu group when activeSection or activeRequesterFormTab changes
  useEffect(() => {
    if(workflowGroup){const key=workflowGroup==='forms'?'REQUESTER_FORMS_MENU':workflowGroup==='tracking'?'REQUESTER_CARTABLE_MENU':workflowGroup==='approver'?'APPROVER_MENU':'ACCOUNTING_MENU';setOpenMenus(prev=>({...prev,[key]:true}));}
    else if (activeSection === 'REQUESTER') {
      if (activeRequesterFormTab === 'CARTABLE') {
        setOpenMenus((prev) => ({ ...prev, REQUESTER_CARTABLE_MENU: true }));
      } else {
        setOpenMenus((prev) => ({ ...prev, REQUESTER_FORMS_MENU: true }));
      }
    } else if (isApproverActive) {
      setOpenMenus((prev) => ({ ...prev, APPROVER_MENU: true }));
    } else if (isAccountingActive) {
      setOpenMenus((prev) => ({ ...prev, ACCOUNTING_MENU: true }));
    } else if (activeSection === 'TREASURY') {
      setOpenMenus((prev) => ({ ...prev, TREASURY_MENU: true }));
    } else if (activeSection === 'REPORTS') {
      setOpenMenus((prev) => ({ ...prev, REPORTS_MENU: true }));
    } else if (activeSection === 'ADMIN_PANEL') {
      if (
        activeAdminTab === 'MASTER_COMPANIES' ||
        activeAdminTab === 'MASTER_DEPARTMENTS' ||
        activeAdminTab === 'MASTER_COST_CENTERS' ||
        activeAdminTab === 'SMS_GATEWAY' || activeAdminTab === 'BANK_INQUIRY'
      ) {
        setOpenMenus((prev) => ({ ...prev, MASTER_DATA_MENU: true }));
      } else {
        setOpenMenus((prev) => ({ ...prev, USERS_ACCESS_MENU: true }));
      }
    } else if (activeSection === 'SETTINGS') {
      setOpenMenus((prev) => ({ ...prev, SETTINGS_MENU: true }));
    }
  }, [activeSection, activeRequesterFormTab, activeAdminTab,workflowGroup]);

  const toggleMenu = (key: CollapsibleMenuKey) => {
    setOpenMenus((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleNavClick = (section: MainSection) => {
    onSelectSection(section);
    onCloseMobile();
  };

  const handleRequesterSubClick = (
    tab: RequesterSubView,
    statusFilter = 'ALL'
  ) => {
    const id=tab==='CARTABLE'?'TRACK_'+statusFilter:'FORM_'+tab;
    if(!nav(id)){const first=visibleMenus(perms,'REQUESTER').find(e=>tab==='CARTABLE'?e.tab==='CARTABLE':e.tab!=='CARTABLE');if(!first)return;tab=first.tab as RequesterSubView;statusFilter=first.filter||'ALL';}
    onSelectSection('REQUESTER');
    if (onSelectRequesterTab) {
      onSelectRequesterTab(tab, statusFilter);
    }
    onCloseMobile();
  };

  const handleApprovalSubClick = (
    mode: 'APPROVER' | 'ACCOUNTING',
    tab: ApprovalCategoryTab
  ) => {
    if(!nav(mode+'_'+tab)){const first=visibleMenus(perms,mode)[0];if(!first)return;tab=first.tab as ApprovalCategoryTab;}
    onSelectSection(mode);
    if (onSelectApprovalCategoryTab) {
      onSelectApprovalCategoryTab(mode, tab);
    }
    onCloseMobile();
  };

  const handleTreasurySubClick = (tab: TreasurySubTab) => {
    if(!nav('TREASURY_'+tab))return;
    onSelectSection('TREASURY');
    if (onSelectTreasuryTab) {
      onSelectTreasuryTab(tab);
    }
    onCloseMobile();
  };

  const handleAdminSubClick = (tab: AdminSubTab) => {
    if(!nav('ADMIN_'+tab))return;
    onSelectSection('ADMIN_PANEL');
    if (onSelectAdminTab) {
      onSelectAdminTab(tab);
    }
    onCloseMobile();
  };

  // Role Badge Styling
  const getRoleBadgeClasses = (role: Role) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-purple-100 text-purple-900 border-purple-200';
      case 'APPROVER':
        return 'bg-blue-100 text-blue-900 border-blue-200';
      case 'ACCOUNTING':
        return 'bg-emerald-100 text-emerald-900 border-emerald-200';
      case 'TREASURY':
        return 'bg-amber-100 text-amber-900 border-amber-200';
      case 'REQUESTER':
        return 'bg-slate-100 text-slate-800 border-slate-200';
      default:
        return 'bg-indigo-100 text-indigo-900 border-indigo-200';
    }
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 lg:hidden transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Persistent Desktop & Slide-out Mobile Sidebar */}
      <aside
        className={`fixed inset-y-0 right-0 z-50 w-72 bg-white border-l border-slate-200 flex flex-col transition-transform duration-300 ease-in-out lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 shrink-0 ${
          isOpenMobile ? 'translate-x-0 shadow-2xl' : 'translate-x-full lg:translate-x-0'
        }`}
        aria-label="ناوبری اصلی پرتال"
      >
        {/* Brand Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0 bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs shrink-0">
              <Landmark className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="text-xs font-black text-slate-950 tracking-tight leading-snug">
                سامانه جامع مالی و خزانه داری شاهراه
              </div>
              <div className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                <span>سامانه سازمانی گردش اسناد</span>
              </div>
            </div>
          </div>

          {/* Close Button for Mobile */}
          <button
            type="button"
            onClick={onCloseMobile}
            className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg lg:hidden cursor-pointer"
            aria-label="بستن منو"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Profile Card */}
        <div className="p-3.5 m-3 rounded-xl bg-slate-50/90 border border-slate-200/90 shrink-0 space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-slate-800 text-white font-bold text-xs flex items-center justify-center shrink-0">
              {currentUser.name.slice(0, 2)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-slate-900 truncate" title={currentUser.name}>
                {currentUser.name}
              </div>
              <div className="text-[10px] text-slate-500 font-mono-num truncate">
                پرسنلی: {currentUser.personnelCode}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-200/60 text-[11px]">
            <span
              className={`px-2 py-0.5 rounded font-bold text-[10px] border truncate max-w-[140px] ${getRoleBadgeClasses(
                currentUser.role
              )}`}
              title={getRoleLabel(currentUser.role, roleConfigs)}
            >
              {getRoleLabel(currentUser.role, roleConfigs)}
            </span>
            <span className="text-[10px] text-slate-500 truncate" title={currentUser.department}>
              {currentUser.department}
            </span>
          </div>
        </div>

        {/* Scrollable Collapsible Accordion Navigation Menus */}
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-2 text-xs font-medium">
          {/* 1A. COLLAPSIBLE MENU: REQUESTER CREATION FORMS (ثبت درخواست جدید) */}
          {canAccessRequesterForms && (
            <div className="rounded-xl border border-slate-200/80 bg-white overflow-hidden">
              <button
                type="button"
                onClick={() => toggleMenu('REQUESTER_FORMS_MENU')}
                className={`w-full flex items-center justify-between px-3 py-2.5 transition-colors cursor-pointer text-right ${
                  menuHeaderTone('forms',isRequesterFormsActive)
                }`}
              >
                <div className="flex items-center gap-2">
                  <CreditCard
                    className="w-4 h-4 shrink-0"
                  />
                  <span>ثبت درخواست‌های مالی و پرسنلی</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {openMenus.REQUESTER_FORMS_MENU ? (
                    <ChevronDown className="w-4 h-4 opacity-80" />
                  ) : (
                    <ChevronLeft className="w-4 h-4 opacity-70" />
                  )}
                </div>
              </button>

              {openMenus.REQUESTER_FORMS_MENU && (
                <div className="p-1.5 bg-white border-t border-slate-100 space-y-0.5">
                  {workflowLinks('forms')}
                  {perms.canCreateAdvanceSingle !== false && (
                    <button
                      type="button"
                      onClick={() => handleRequesterSubClick('ADVANCE_SINGLE', 'ALL')}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[11px] transition cursor-pointer text-right ${
                        activeSection === 'REQUESTER' &&
                        activeRequesterFormTab === 'ADVANCE_SINGLE'
                          ? 'bg-slate-900/10 text-slate-950 font-bold border-r-2 border-slate-900'
                          : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        <span>مساعده حقوق تکی (برای خودم)</span>
                      </div>
                    </button>
                  )}

                  {perms.canCreateAdvanceBatch !== false && (
                    <button
                      type="button"
                      onClick={() => handleRequesterSubClick('ADVANCE_BATCH', 'ALL')}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[11px] transition cursor-pointer text-right ${
                        activeSection === 'REQUESTER' &&
                        activeRequesterFormTab === 'ADVANCE_BATCH'
                          ? 'bg-slate-900/10 text-slate-950 font-bold border-r-2 border-slate-900'
                          : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Users className="w-3.5 h-3.5 text-slate-500" />
                        <span>مساعده گروهی (برای سایر افراد)</span>
                      </div>
                    </button>
                  )}

                  {perms.canCreatePaymentSingle !== false && (
                    <button
                      type="button"
                      onClick={() => handleRequesterSubClick('PAYMENT_SINGLE', 'ALL')}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[11px] transition cursor-pointer text-right ${
                        activeSection === 'REQUESTER' &&
                        activeRequesterFormTab === 'PAYMENT_SINGLE'
                          ? 'bg-slate-900/10 text-slate-950 font-bold border-r-2 border-slate-900'
                          : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-3.5 h-3.5 text-slate-500" />
                        <span>دستور پرداخت تکی</span>
                      </div>
                    </button>
                  )}

                  {perms.canCreatePaymentBatch !== false && (
                    <button
                      type="button"
                      onClick={() => handleRequesterSubClick('PAYMENT_BATCH', 'ALL')}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[11px] transition cursor-pointer text-right ${
                        activeSection === 'REQUESTER' &&
                        activeRequesterFormTab === 'PAYMENT_BATCH'
                          ? 'bg-slate-900/10 text-slate-950 font-bold border-r-2 border-slate-900'
                          : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <ListPlus className="w-3.5 h-3.5 text-slate-500" />
                        <span>دستور پرداخت گروهی (تجمیعی)</span>
                      </div>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 1B. COLLAPSIBLE MENU: REQUESTER TRACKING CARTABLE (کارتابل پیگیری درخواست‌ها) */}
          {canAccessRequesterCartable && (
            <div className="rounded-xl border border-slate-200/80 bg-white overflow-hidden">
              <button
                type="button"
                onClick={() => {
                  if (!isRequesterCartableActive) {
                    setOpenMenus((prev) => ({ ...prev, REQUESTER_CARTABLE_MENU: true }));
                    handleRequesterSubClick('CARTABLE', 'ALL');
                  } else {
                    toggleMenu('REQUESTER_CARTABLE_MENU');
                  }
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 transition-colors cursor-pointer text-right ${
                  menuHeaderTone('tracking',isRequesterCartableActive)
                }`}
              >
                <div className="flex items-center gap-2">
                  <Clock
                    className="w-4 h-4 shrink-0"
                  />
                  <span>کارتابل پیگیری درخواست‌ها</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white font-mono-num" aria-label={'تعداد موارد قابل پیگیری: '+badges.trackingTotal} title="مجموع موارد زیرمنوهای مجاز؛ فیلترهای مالی و سوابق استعلام دوباره شمرده نمی‌شوند.">
                    {badges.trackingTotal.toLocaleString('fa-IR')}
                  </span>
                  {openMenus.REQUESTER_CARTABLE_MENU ? (
                    <ChevronDown className="w-4 h-4 opacity-80" />
                  ) : (
                    <ChevronLeft className="w-4 h-4 opacity-70" />
                  )}
                </div>
              </button>

              {openMenus.REQUESTER_CARTABLE_MENU && (
                <div className="p-1.5 bg-white border-t border-slate-100 space-y-0.5">
                  {workflowLinks('tracking')}
                  <button
                    type="button"
onClick={() => handleRequesterSubClick('CARTABLE', 'ALL')}
                    style={{display: nav('TRACK_ALL') ? undefined : 'none'}}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[11px] transition cursor-pointer text-right ${
                      activeSection === 'REQUESTER' &&
                      activeRequesterFormTab === 'CARTABLE' &&
                      activeRequesterStatusFilter === 'ALL'
                        ? 'bg-slate-900/10 text-slate-950 font-bold border-r-2 border-slate-900'
                        : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <History className="w-3.5 h-3.5 text-indigo-600" />
                      <span>همه درخواست‌ها و سوابق من</span>
                    </div>
                  </button>

                  <button
                    type="button"
onClick={() => handleRequesterSubClick('CARTABLE', 'ADVANCE_SINGLE')}
                    style={{display: nav('TRACK_ADVANCE_SINGLE') ? undefined : 'none'}}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[11px] transition cursor-pointer text-right ${
                      activeSection === 'REQUESTER' &&
                      activeRequesterFormTab === 'CARTABLE' &&
                      activeRequesterStatusFilter === 'ADVANCE_SINGLE'
                        ? 'bg-slate-900/10 text-slate-950 font-bold border-r-2 border-slate-900'
                        : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      <span>پیگیری مساعده تکی</span>
                    </div>
                  </button>

                  <button
                    type="button"
onClick={() => handleRequesterSubClick('CARTABLE', 'ADVANCE_BATCH')}
                    style={{display: nav('TRACK_ADVANCE_BATCH') ? undefined : 'none'}}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[11px] transition cursor-pointer text-right ${
                      activeSection === 'REQUESTER' &&
                      activeRequesterFormTab === 'CARTABLE' &&
                      activeRequesterStatusFilter === 'ADVANCE_BATCH'
                        ? 'bg-slate-900/10 text-slate-950 font-bold border-r-2 border-slate-900'
                        : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-slate-500" />
                      <span>پیگیری مساعده گروهی</span>
                    </div>
                  </button>

                  <button
                    type="button"
onClick={() => handleRequesterSubClick('CARTABLE', 'PAYMENT_SINGLE')}
                    style={{display: nav('TRACK_PAYMENT_SINGLE') ? undefined : 'none'}}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[11px] transition cursor-pointer text-right ${
                      activeSection === 'REQUESTER' &&
                      activeRequesterFormTab === 'CARTABLE' &&
                      activeRequesterStatusFilter === 'PAYMENT_SINGLE'
                        ? 'bg-slate-900/10 text-slate-950 font-bold border-r-2 border-slate-900'
                        : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-3.5 h-3.5 text-slate-500" />
                      <span>پیگیری درخواست پرداخت تکی</span>
                    </div>
                  </button>

                  <button
                    type="button"
onClick={() => handleRequesterSubClick('CARTABLE', 'PAYMENT_BATCH')}
                    style={{display: nav('TRACK_PAYMENT_BATCH') ? undefined : 'none'}}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[11px] transition cursor-pointer text-right ${
                      activeSection === 'REQUESTER' &&
                      activeRequesterFormTab === 'CARTABLE' &&
                      activeRequesterStatusFilter === 'PAYMENT_BATCH'
                        ? 'bg-slate-900/10 text-slate-950 font-bold border-r-2 border-slate-900'
                        : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <ListPlus className="w-3.5 h-3.5 text-slate-500" />
                      <span>پیگیری درخواست پرداخت گروهی</span>
                    </div>
                  </button>

                  <button
                    type="button"
onClick={() => handleRequesterSubClick('CARTABLE', 'NEEDS_REVISION')}
                    style={{display: nav('TRACK_NEEDS_REVISION') ? undefined : 'none'}}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[11px] transition cursor-pointer text-right ${
                      activeSection === 'REQUESTER' &&
                      activeRequesterFormTab === 'CARTABLE' &&
                      activeRequesterStatusFilter === 'NEEDS_REVISION'
                        ? 'bg-amber-100 text-amber-950 font-bold border-r-2 border-amber-600'
                        : 'text-amber-800 hover:bg-amber-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                      <span>نیازمند اصلاح و بازنگری</span>
                    </div>
                    {badges.needsRevision > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-white font-mono-num">
                        {badges.needsRevision}
                      </span>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 2A. COLLAPSIBLE MENU: APPROVER CARTABLE (کارتابل تایید سرپرست واحد) */}
          {canAccessApprover && (
            <div className="rounded-xl border border-slate-200/80 bg-white overflow-hidden">
              <button
                type="button"
                onClick={() => toggleMenu('APPROVER_MENU')}
                className={`w-full flex items-center justify-between px-3 py-2.5 transition-colors cursor-pointer text-right ${
                  menuHeaderTone('approver',isApproverActive)
                }`}
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2
                    className="w-4 h-4 shrink-0"
                  />
                  <span>کارتابل تایید سرپرست واحد</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {badges.pendingApprover > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white font-mono-num">
                      {badges.pendingApprover}
                    </span>
                  )}
                  {openMenus.APPROVER_MENU ? (
                    <ChevronDown className="w-4 h-4 opacity-80" />
                  ) : (
                    <ChevronLeft className="w-4 h-4 opacity-70" />
                  )}
                </div>
              </button>

              {openMenus.APPROVER_MENU && (
                <div className="p-1.5 bg-white border-t border-slate-100 space-y-0.5">
                  {workflowLinks('approver')}
                  <button
                    type="button"
onClick={() => handleApprovalSubClick('APPROVER', 'PENDING')}
                    style={{display: nav('APPROVER_PENDING') ? undefined : 'none'}}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[11px] transition cursor-pointer text-right ${
                      activeSection === 'APPROVER' && activeApprovalCategoryTab === 'PENDING'
                        ? 'bg-blue-50 text-blue-950 font-bold border-r-2 border-blue-600'
                        : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      <span>در انتظار تأیید من</span>
                    </div>
                    {badges.pendingApprover > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-blue-100 text-blue-900 font-mono-num">
                        {badges.pendingApprover}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
onClick={() => handleApprovalSubClick('APPROVER', 'APPROVED_BY_ME')}
                    style={{display: nav('APPROVER_APPROVED_BY_ME') ? undefined : 'none'}}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[11px] transition cursor-pointer text-right ${
                      activeSection === 'APPROVER' && activeApprovalCategoryTab === 'APPROVED_BY_ME'
                        ? 'bg-blue-50 text-blue-950 font-bold border-r-2 border-blue-600'
                        : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <FileCheck2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>تأییدشده توسط من</span>
                    </div>
                  </button>

                  <button
                    type="button"
onClick={() => handleApprovalSubClick('APPROVER', 'RETURNED_BY_ME')}
                    style={{display: nav('APPROVER_RETURNED_BY_ME') ? undefined : 'none'}}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[11px] transition cursor-pointer text-right ${
                      activeSection === 'APPROVER' && activeApprovalCategoryTab === 'RETURNED_BY_ME'
                        ? 'bg-blue-50 text-blue-950 font-bold border-r-2 border-blue-600'
                        : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                      <span>برگشت‌داده‌شده برای اصلاح</span>
                    </div>
                  </button>

                  <button
                    type="button"
onClick={() => handleApprovalSubClick('APPROVER', 'ALL_MY_RECORDS')}
                    style={{display: nav('APPROVER_ALL_MY_RECORDS') ? undefined : 'none'}}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[11px] transition cursor-pointer text-right ${
                      activeSection === 'APPROVER' && activeApprovalCategoryTab === 'ALL_MY_RECORDS'
                        ? 'bg-blue-50 text-blue-950 font-bold border-r-2 border-blue-600'
                        : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <History className="w-3.5 h-3.5 text-indigo-600" />
                      <span>همه سوابق من</span>
                    </div>
                  </button>
                  <button type="button" onClick={()=>handleApprovalSubClick('APPROVER','REJECTED_BY_ME')} style={{display: nav('APPROVER_REJECTED_BY_ME') ? undefined : 'none'}} className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[11px] transition cursor-pointer text-right ${activeSection==='APPROVER'&&activeApprovalCategoryTab==='REJECTED_BY_ME'?'bg-blue-50 text-blue-950 font-bold border-r-2 border-blue-600':'text-slate-600 hover:text-slate-950 hover:bg-slate-50'}`}><RotateCcw className="w-3.5 h-3.5 text-rose-600" /><span>ردشده توسط من</span></button>
                </div>
              )}
            </div>
          )}

          {/* 2B. COLLAPSIBLE MENU: ACCOUNTING CARTABLE (کارتابل بررسی مالی حسابداری) */}
          {canAccessAccounting && (
            <div className="rounded-xl border border-slate-200/80 bg-white overflow-hidden">
              <button
                type="button"
                onClick={() => toggleMenu('ACCOUNTING_MENU')}
                className={`w-full flex items-center justify-between px-3 py-2.5 transition-colors cursor-pointer text-right ${
                  menuHeaderTone('accounting',isAccountingActive)
                }`}
              >
                <div className="flex items-center gap-2">
                  <ShieldCheck
                    className="w-4 h-4 shrink-0"
                  />
                  <span>کارتابل بررسی مالی حسابداری</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {badges.pendingAccounting > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white font-mono-num">
                      {badges.pendingAccounting}
                    </span>
                  )}
                  {openMenus.ACCOUNTING_MENU ? (
                    <ChevronDown className="w-4 h-4 opacity-80" />
                  ) : (
                    <ChevronLeft className="w-4 h-4 opacity-70" />
                  )}
                </div>
              </button>

              {openMenus.ACCOUNTING_MENU && (
                <div className="p-1.5 bg-white border-t border-slate-100 space-y-0.5">
                  {workflowLinks('accounting')}
                  <button
                    type="button"
onClick={() => handleApprovalSubClick('ACCOUNTING', 'PENDING')}
                    style={{display: nav('ACCOUNTING_PENDING') ? undefined : 'none'}}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[11px] transition cursor-pointer text-right ${
                      activeSection === 'ACCOUNTING' && activeApprovalCategoryTab === 'PENDING'
                        ? 'bg-emerald-50 text-emerald-950 font-bold border-r-2 border-emerald-600'
                        : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      <span>در انتظار تأیید من</span>
                    </div>
                    {badges.pendingAccounting > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 font-mono-num">
                        {badges.pendingAccounting}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
onClick={() => handleApprovalSubClick('ACCOUNTING', 'APPROVED_BY_ME')}
                    style={{display: nav('ACCOUNTING_APPROVED_BY_ME') ? undefined : 'none'}}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[11px] transition cursor-pointer text-right ${
                      activeSection === 'ACCOUNTING' && activeApprovalCategoryTab === 'APPROVED_BY_ME'
                        ? 'bg-emerald-50 text-emerald-950 font-bold border-r-2 border-emerald-600'
                        : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <FileCheck2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>تأییدشده توسط من</span>
                    </div>
                  </button>

                  <button
                    type="button"
onClick={() => handleApprovalSubClick('ACCOUNTING', 'RETURNED_BY_ME')}
                    style={{display: nav('ACCOUNTING_RETURNED_BY_ME') ? undefined : 'none'}}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[11px] transition cursor-pointer text-right ${
                      activeSection === 'ACCOUNTING' && activeApprovalCategoryTab === 'RETURNED_BY_ME'
                        ? 'bg-emerald-50 text-emerald-950 font-bold border-r-2 border-emerald-600'
                        : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                      <span>برگشت‌داده‌شده برای اصلاح</span>
                    </div>
                  </button>

                  <button
                    type="button"
onClick={() => handleApprovalSubClick('ACCOUNTING', 'ALL_MY_RECORDS')}
                    style={{display: nav('ACCOUNTING_ALL_MY_RECORDS') ? undefined : 'none'}}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[11px] transition cursor-pointer text-right ${
                      activeSection === 'ACCOUNTING' && activeApprovalCategoryTab === 'ALL_MY_RECORDS'
                        ? 'bg-emerald-50 text-emerald-950 font-bold border-r-2 border-emerald-600'
                        : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <History className="w-3.5 h-3.5 text-indigo-600" />
                      <span>همه سوابق من</span>
                    </div>
                  </button>
                  <button type="button" onClick={()=>handleApprovalSubClick('ACCOUNTING','REJECTED_BY_ME')} style={{display: nav('ACCOUNTING_REJECTED_BY_ME') ? undefined : 'none'}} className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[11px] transition cursor-pointer text-right ${activeSection==='ACCOUNTING'&&activeApprovalCategoryTab==='REJECTED_BY_ME'?'bg-blue-50 text-blue-950 font-bold border-r-2 border-blue-600':'text-slate-600 hover:text-slate-950 hover:bg-slate-50'}`}><RotateCcw className="w-3.5 h-3.5 text-rose-600" /><span>ردشده توسط من</span></button>
                </div>
              )}
            </div>
          )}

          {/* 3. COLLAPSIBLE MENU: TREASURY & PAYMENTS */}
          {canAccessTreasury && (
            <div className="rounded-xl border border-slate-200/80 bg-white overflow-hidden">
              <button
                type="button"
                onClick={() => toggleMenu('TREASURY_MENU')}
                className={`w-full flex items-center justify-between px-3 py-2.5 transition-colors cursor-pointer text-right ${
                  menuHeaderTone('treasury',activeSection === 'TREASURY')
                }`}
              >
                <div className="flex items-center gap-2">
                  <Landmark
                    className="w-4 h-4 shrink-0"
                  />
                  <span>خزانه‌داری و عملیات پرداخت</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {badges.pendingTreasury > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white font-mono-num">
                      {badges.pendingTreasury}
                    </span>
                  )}
                  {openMenus.TREASURY_MENU ? (
                    <ChevronDown className="w-4 h-4 opacity-80" />
                  ) : (
                    <ChevronLeft className="w-4 h-4 opacity-70" />
                  )}
                </div>
              </button>

              {openMenus.TREASURY_MENU && (
                <div className="p-1.5 bg-white border-t border-slate-100 space-y-0.5">
                  {perms.canAccessTreasuryQueue !== false && (
                    <button
                      type="button"
                      onClick={() => handleTreasurySubClick('QUEUE')}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[11px] transition cursor-pointer text-right ${
                        activeSection === 'TREASURY' && activeTreasuryTab === 'QUEUE'
                          ? 'bg-amber-50 text-amber-950 font-bold border-r-2 border-amber-600'
                          : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <CheckSquare className="w-3.5 h-3.5 text-slate-500" />
                        <span>صف انتظار پرداخت</span>
                      </div>
                      {badges.pendingTreasury > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-200 text-amber-900 font-mono-num">
                          {badges.pendingTreasury}
                        </span>
                      )}
                    </button>
                  )}

                  {perms.canAccessTreasuryInPayment !== false && (
                    <button
                      type="button"
                      onClick={() => handleTreasurySubClick('IN_PAYMENT')}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[11px] transition cursor-pointer text-right ${
                        activeSection === 'TREASURY' && activeTreasuryTab === 'IN_PAYMENT'
                          ? 'bg-purple-50 text-purple-950 font-bold border-r-2 border-purple-600'
                          : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-purple-600" />
                        <span>مخزن در حال پرداخت</span>
                      </div>
                      {badges.inPaymentTreasury > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-purple-200 text-purple-900 font-mono-num">
                          {badges.inPaymentTreasury}
                        </span>
                      )}
                    </button>
                  )}

                  {nav('TREASURY_REJECTED')&&<button type="button" onClick={()=>handleTreasurySubClick('REJECTED')} className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[11px] cursor-pointer text-right ${activeSection==='TREASURY'&&activeTreasuryTab==='REJECTED'?'bg-rose-50 text-rose-950 font-bold border-r-2 border-rose-600':'text-slate-600 hover:bg-slate-50'}`}><AlertCircle className="w-3.5 h-3.5 text-rose-600"/><span>پرداخت‌های ردشده</span></button>}
                  {perms.canAccessTreasuryCompleted !== false && (
                    <button
                      type="button"
                      onClick={() => handleTreasurySubClick('COMPLETED')}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[11px] transition cursor-pointer text-right ${
                        activeSection === 'TREASURY' && activeTreasuryTab === 'COMPLETED'
                          ? 'bg-emerald-50 text-emerald-950 font-bold border-r-2 border-emerald-600'
                          : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>پرداختی‌های انجام‌شده</span>
                      </div>
                      {badges.completedPayments > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-emerald-200 text-emerald-900 font-mono-num">
                          {badges.completedPayments}
                        </span>
                      )}
                    </button>
                  )}

                  {(perms.canInquireBankDetails||perms.canConfirmBankOwner)&&<button type="button" onClick={()=>handleTreasurySubClick('BANK_INQUIRY')} style={{display: nav('TREASURY_BANK_INQUIRY') ? undefined : 'none'}} className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[11px] text-right ${activeSection==='TREASURY'&&activeTreasuryTab==='BANK_INQUIRY'?'bg-blue-50 text-blue-950 font-bold border-r-2 border-blue-600':'text-slate-600 hover:text-slate-950 hover:bg-slate-50'}`}><ShieldCheck className="w-3.5 h-3.5 text-blue-600"/><span>تکمیل و استعلام شبا</span></button>}
                  {perms.canAccessTreasuryBankAccounts !== false && (
                    <button
                      type="button"
                      onClick={() => handleTreasurySubClick('BANK_ACCOUNTS')}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[11px] transition cursor-pointer text-right ${
                        activeSection === 'TREASURY' && activeTreasuryTab === 'BANK_ACCOUNTS'
                          ? 'bg-blue-50 text-blue-950 font-bold border-r-2 border-blue-600'
                          : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Landmark className="w-3.5 h-3.5 text-blue-600" />
                        <span>بانک‌ها و شماره‌حساب‌ها</span>
                      </div>
                    </button>
                  )}

                  {perms.canAccessTreasuryManualPayment !== false && (
                    <button
                      type="button"
                      onClick={() => handleTreasurySubClick('MANUAL')}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[11px] transition cursor-pointer text-right ${
                        activeSection === 'TREASURY' && activeTreasuryTab === 'MANUAL'
                          ? 'bg-slate-900/10 text-slate-950 font-bold border-r-2 border-slate-900'
                          : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <PhoneCall className="w-3.5 h-3.5 text-slate-500" />
                        <span>ثبت پرداخت انجام‌شده</span>
                      </div>
                    </button>
                  )}

                  {perms.canAccessTreasuryManualPayment !== false && perms.canCreateRequest && perms.canSubmitSinglePayment && (
                    <button type="button" onClick={()=>handleTreasurySubClick('EXTERNAL_ORDER')} style={{display: nav('TREASURY_EXTERNAL_ORDER') ? undefined : 'none'}} className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[11px] cursor-pointer text-right ${activeSection==='TREASURY'&&activeTreasuryTab==='EXTERNAL_ORDER'?'bg-slate-900/10 text-slate-950 font-bold border-r-2 border-slate-900':'text-slate-600 hover:text-slate-950 hover:bg-slate-50'}`}><PhoneCall className="w-3.5 h-3.5 text-slate-500"/><span>ثبت دستور پرداخت خارج سامانه</span></button>
                  )}
                  {perms.canAccessTreasuryDailyCover !== false && (
                    <button
                      type="button"
                      onClick={() => handleTreasurySubClick('COVER')}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[11px] transition cursor-pointer text-right ${
                        activeSection === 'TREASURY' && activeTreasuryTab === 'COVER'
                          ? 'bg-slate-900/10 text-slate-950 font-bold border-r-2 border-slate-900'
                          : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Lock className="w-3.5 h-3.5 text-slate-500" />
                        <span>روکش روزانه</span>
                      </div>
                    </button>
                  )}

                  {perms.canAccessTreasuryArchive !== false && (
                    <button
                      type="button"
                      onClick={() => handleTreasurySubClick('ARCHIVE')}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[11px] transition cursor-pointer text-right ${
                        activeSection === 'TREASURY' && activeTreasuryTab === 'ARCHIVE'
                          ? 'bg-slate-900/10 text-slate-950 font-bold border-r-2 border-slate-900'
                          : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Folder className="w-3.5 h-3.5 text-slate-500" />
                        <span>بایگانی فیش‌ها</span>
                      </div>
                      {badges.totalReceipts > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 font-mono-num">
                          {badges.totalReceipts}
                        </span>
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 4. COLLAPSIBLE MENU: MASTER DATA MANAGEMENT (اطلاعات پایه) */}
          {perms.canAccessTreasuryReports&&<div className="rounded-xl border border-slate-200/80 bg-white overflow-hidden"><button type="button" onClick={()=>toggleMenu('REPORTS_MENU')} aria-expanded={openMenus.REPORTS_MENU} className={'w-full flex items-center justify-between px-3 py-2.5 text-right font-bold '+menuHeaderTone('reports',activeSection==='REPORTS')}><span className="flex items-center gap-2"><History className="w-4 h-4"/>گزارش‌ها و خروجی‌ها</span><ChevronDown className="w-4 h-4"/></button>{openMenus.REPORTS_MENU&&<div className="p-2"><button type="button" onClick={()=>{onSelectSection('REPORTS');onCloseMobile();}} className={'w-full px-2.5 py-2 rounded-lg text-xs text-right '+(activeSection==='REPORTS'?'bg-blue-50 text-blue-950 font-bold':'text-slate-600 hover:bg-slate-50')}>گزارش جامع درخواست‌ها و پرداخت‌ها</button></div>}</div>}
          {canAccessMasterDataMenu && (
            <div className="rounded-xl border border-slate-200/80 bg-white overflow-hidden">
              <button
                type="button"
                onClick={() => toggleMenu('MASTER_DATA_MENU')}
                className={`w-full flex items-center justify-between px-3 py-2.5 transition-colors cursor-pointer text-right ${
                  menuHeaderTone('master',isMasterDataSubTab)
                }`}
              >
                <div className="flex items-center gap-2">
                  <Database
                    className="w-4 h-4 shrink-0"
                  />
                  <span>مدیریت اطلاعات پایه</span>
                </div>
                {openMenus.MASTER_DATA_MENU ? (
                  <ChevronDown className="w-4 h-4 opacity-80" />
                ) : (
                  <ChevronLeft className="w-4 h-4 opacity-70" />
                )}
              </button>

              {openMenus.MASTER_DATA_MENU && (
                <div className="p-1.5 bg-white border-t border-slate-100 space-y-0.5">
                  {(currentUser.role === 'ADMIN' || perms.canManageCompanies) && (
                    <button
                      type="button"
                      onClick={() => handleAdminSubClick('MASTER_COMPANIES')}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[11px] transition cursor-pointer text-right ${
                        activeSection === 'ADMIN_PANEL' && activeAdminTab === 'MASTER_COMPANIES'
                          ? 'bg-sky-50 text-sky-950 font-bold border-r-2 border-sky-600'
                          : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Building2 className="w-3.5 h-3.5 text-sky-600" />
                        <span>تعریف شرکت‌ها و سازمان‌ها</span>
                      </div>
                      {typeof badges.totalCompanies === 'number' && (
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 font-mono-num">
                          {badges.totalCompanies}
                        </span>
                      )}
                    </button>
                  )}

                  {(currentUser.role === 'ADMIN' || perms.canManageDepartments) && (
                    <button
                      type="button"
                      onClick={() => handleAdminSubClick('MASTER_DEPARTMENTS')}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[11px] transition cursor-pointer text-right ${
                        activeSection === 'ADMIN_PANEL' && activeAdminTab === 'MASTER_DEPARTMENTS'
                          ? 'bg-sky-50 text-sky-950 font-bold border-r-2 border-sky-600'
                          : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <FolderTree className="w-3.5 h-3.5 text-indigo-600" />
                        <span>تعریف واحدهای سازمانی</span>
                      </div>
                      {typeof badges.totalDepartments === 'number' && (
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 font-mono-num">
                          {badges.totalDepartments}
                        </span>
                      )}
                    </button>
                  )}

                  {(currentUser.role === 'ADMIN' || perms.canManageCostCenters) && (
                    <button
                      type="button"
                      onClick={() => handleAdminSubClick('MASTER_COST_CENTERS')}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[11px] transition cursor-pointer text-right ${
                        activeSection === 'ADMIN_PANEL' && activeAdminTab === 'MASTER_COST_CENTERS'
                          ? 'bg-sky-50 text-sky-950 font-bold border-r-2 border-sky-600'
                          : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Layers className="w-3.5 h-3.5 text-emerald-600" />
                        <span>تعریف مراکز هزینه</span>
                      </div>
                      {typeof badges.totalCostCenters === 'number' && (
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 font-mono-num">
                          {badges.totalCostCenters}
                        </span>
                      )}
                    </button>
                  )}

                  {perms.canManageBankInquiry&&<button type="button" onClick={()=>handleAdminSubClick('BANK_INQUIRY')} className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[11px] text-right ${activeSection==='ADMIN_PANEL'&&activeAdminTab==='BANK_INQUIRY'?'bg-blue-50 text-blue-950 font-bold border-r-2 border-blue-600':'text-slate-600 hover:text-slate-950 hover:bg-slate-50'}`}><ShieldCheck className="w-3.5 h-3.5 text-blue-600"/><span>تنظیمات استعلام کارت و شبا</span></button>}
                  {(currentUser.role === 'ADMIN' || perms.canManageSmsGateway) && (
                    <button
                      type="button"
                      onClick={() => handleAdminSubClick('SMS_GATEWAY')}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[11px] transition cursor-pointer text-right ${
                        activeSection === 'ADMIN_PANEL' && activeAdminTab === 'SMS_GATEWAY'
                          ? 'bg-sky-50 text-sky-950 font-bold border-r-2 border-sky-600'
                          : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-3.5 h-3.5 text-amber-600" />
                        <span>سامانه پیامک و اطلاع‌رسانی</span>
                      </div>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 5. COLLAPSIBLE MENU: USERS & ACCESS MANAGEMENT (مدیریت کاربران و دسترسی‌ها) */}
          {canAccessUsersAccessMenu && (
            <div className="rounded-xl border border-slate-200/80 bg-white overflow-hidden">
              <button
                type="button"
                onClick={() => toggleMenu('USERS_ACCESS_MENU')}
                className={`w-full flex items-center justify-between px-3 py-2.5 transition-colors cursor-pointer text-right ${
                  menuHeaderTone('users',isUsersAccessSubTab)
                }`}
              >
                <div className="flex items-center gap-2">
                  <UserCheck
                    className="w-4 h-4 shrink-0"
                  />
                  <span>مدیریت کاربران و دسترسی‌ها</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {Boolean(badges.pendingPasswordRecovery && badges.pendingPasswordRecovery > 0) && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-600 text-white font-mono-num">
                      {badges.pendingPasswordRecovery}
                    </span>
                  )}
                  {openMenus.USERS_ACCESS_MENU ? (
                    <ChevronDown className="w-4 h-4 opacity-80" />
                  ) : (
                    <ChevronLeft className="w-4 h-4 opacity-70" />
                  )}
                </div>
              </button>

              {openMenus.USERS_ACCESS_MENU && (
                <div className="p-1.5 bg-white border-t border-slate-100 space-y-0.5">
                  {(currentUser.role === 'ADMIN' || perms.canManageUsers) && (
                    <button
                      type="button"
                      onClick={() => handleAdminSubClick('USERS')}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[11px] transition cursor-pointer text-right ${
                        activeSection === 'ADMIN_PANEL' && activeAdminTab === 'USERS'
                          ? 'bg-purple-50 text-purple-950 font-bold border-r-2 border-purple-600'
                          : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Users className="w-3.5 h-3.5 text-purple-600" />
                        <span>فهرست و مدیریت کاربران</span>
                      </div>
                      {typeof badges.totalUsers === 'number' && (
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 font-mono-num">
                          {badges.totalUsers}
                        </span>
                      )}
                    </button>
                  )}

                  {(currentUser.role === 'ADMIN' || perms.canManageRoles) && (
                    <button
                      type="button"
                      onClick={() => handleAdminSubClick('ROLES')}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[11px] transition cursor-pointer text-right ${
                        activeSection === 'ADMIN_PANEL' && activeAdminTab === 'ROLES'
                          ? 'bg-purple-50 text-purple-950 font-bold border-r-2 border-purple-600'
                          : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Sliders className="w-3.5 h-3.5 text-blue-600" />
                        <span>مدیریت نقش‌ها و حدود اختیار</span>
                      </div>
                    </button>
                  )}

                  {(currentUser.role === 'ADMIN' || perms.canManagePasswordRecovery) && (
                    <button
                      type="button"
                      onClick={() => handleAdminSubClick('RECOVERY')}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[11px] transition cursor-pointer text-right ${
                        activeSection === 'ADMIN_PANEL' && activeAdminTab === 'RECOVERY'
                          ? 'bg-purple-50 text-purple-950 font-bold border-r-2 border-purple-600'
                          : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <HelpCircle className="w-3.5 h-3.5 text-rose-600" />
                        <span>درخواست‌های بازیابی رمز عبور</span>
                      </div>
                      {Boolean(badges.pendingPasswordRecovery && badges.pendingPasswordRecovery > 0) && (
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-600 text-white font-mono-num">
                          {badges.pendingPasswordRecovery}
                        </span>
                      )}
                    </button>
                  )}

                  {(currentUser.role === 'ADMIN' || perms.canViewSecurityAudit) && (
                    <button
                      type="button"
                      onClick={() => handleAdminSubClick('AUDIT')}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[11px] transition cursor-pointer text-right ${
                        activeSection === 'ADMIN_PANEL' && activeAdminTab === 'AUDIT'
                          ? 'bg-purple-50 text-purple-950 font-bold border-r-2 border-purple-600'
                          : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <History className="w-3.5 h-3.5 text-slate-600" />
                        <span>تاریخچه امنیتی و تغییرات دسترسی</span>
                      </div>
                      {typeof badges.totalAuditLogs === 'number' && (
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 font-mono-num">
                          {badges.totalAuditLogs}
                        </span>
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 6. COLLAPSIBLE MENU: ACCOUNT & SYSTEM SETTINGS */}
          {perms.canAccessSettings !== false && (
            <div className="rounded-xl border border-slate-200/80 bg-white overflow-hidden">
              <button
                type="button"
                onClick={() => toggleMenu('SETTINGS_MENU')}
                className={`w-full flex items-center justify-between px-3 py-2.5 transition-colors cursor-pointer text-right ${
                  menuHeaderTone('settings',activeSection === 'SETTINGS')
                }`}
              >
                <div className="flex items-center gap-2">
                  <Settings
                    className="w-4 h-4 shrink-0"
                  />
                  <span>تنظیمات و حساب کاربری</span>
                </div>
                {openMenus.SETTINGS_MENU ? (
                  <ChevronDown className="w-4 h-4 opacity-80" />
                ) : (
                  <ChevronLeft className="w-4 h-4 opacity-70" />
                )}
              </button>

              {openMenus.SETTINGS_MENU && (
                <div className="p-1.5 bg-white border-t border-slate-100 space-y-0.5">
                  <button
                    type="button"
                    onClick={() => handleNavClick('SETTINGS')}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[11px] transition cursor-pointer text-right ${
                      activeSection === 'SETTINGS'
                        ? 'bg-blue-50 text-blue-950 font-bold border-r-2 border-blue-600'
                        : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Settings className="w-3.5 h-3.5 text-blue-600" />
                      <span>تنظیمات امنیتی و کارتابل من</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={onOpenKeyboardHelp}
                    style={{display:permissionValue(perms,'canShowKeyboardHelp')?undefined:'none'}}
                    className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[11px] text-slate-600 hover:text-slate-950 hover:bg-slate-50 transition cursor-pointer text-right"
                  >
                    <div className="flex items-center gap-2">
                      <Keyboard className="w-3.5 h-3.5 text-slate-500" />
                      <span>راهنمای کلیدهای میانبر</span>
                    </div>
                    <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded text-[9px] font-mono text-slate-600">
                      Alt+H
                    </kbd>
                  </button>
                </div>
              )}
            </div>
          )}
        </nav>

        {/* Footer Zone: Logout */}
        <div className="p-3 border-t border-slate-200 shrink-0 bg-slate-50/70">
          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-rose-700 hover:text-rose-800 hover:bg-rose-100/70 rounded-lg transition cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <LogOut className="w-4 h-4 text-rose-600" />
              <span>خروج از حساب کاربری</span>
            </div>
            <kbd className="px-1.5 py-0.5 bg-rose-50 border border-rose-200 rounded text-[10px] font-mono text-rose-700">
              Alt+L
            </kbd>
          </button>
        </div>
      </aside>
    </>
  );
};


