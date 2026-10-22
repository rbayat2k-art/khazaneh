import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Keyboard,
  LogOut,
  Printer,
  X,
  CheckCircle2,
  Users,
  Building2,
  Menu,
  Search,
  Bell,
  BellRing,
  BellOff,
  CheckCheck,
  KeyRound,
  AlertCircle,
} from 'lucide-react';
import type {
  TreasuryDatabaseState,
  ReceiptArchive,
  Priority,
  Role,
  User as UserType,
  BatchItem,
  AttachmentFile,
  AppNotification,
  TreasurySubTab,
  RoleDefinitionConfig,
  UserPersonalPreferences,
  CompanyBankAccount,
  PaymentMethodType,
  OrganizationCompany,
  OrganizationalDepartment,
  CostCenterItem,
  SmsGatewayConfig,
  ApprovalCategoryTab,
  RequestStatus,
  BulkMasterDataKind,
  BulkMasterDataRow,
} from './types/treasury';
import { normalizeRolePermissionSet } from './types/treasury';
import type { SubmittedRequestEdit } from './utils/request-edit';
import type {ImportBankAccounts} from './components/BankAccountImportDialog';
import { formatRial, getRoleLabel } from './utils/sorting';
import {createStateFetch} from './utils/state-sync';
import {
  getBrowserNotificationPermission,
  requestBrowserNotificationPermission,
  sendBrowserPushNotification,
  isUserDesktopNotificationEnabled,
  setUserDesktopNotificationEnabled,
  hasNotificationBeenPushedToOS,
  markNotificationPushedToOS,
  seedInitialPushedNotifications,
  getNotificationEventMeta,
} from './services/browserNotificationService';
import { LoginPage } from './components/LoginPage';
import { SidebarNavigation, type MainSection, type RequesterSubView } from './components/SidebarNavigation';
import type { AdminSubTab } from './components/AdminPortalView';
const AdminPortalView = React.lazy(() => import('./components/AdminPortalView').then(m => ({ default: m.AdminPortalView })));
const EmployeeRequestsView = React.lazy(() => import('./components/EmployeeRequestsView').then(m => ({ default: m.EmployeeRequestsView })));
const ApprovalsWorkspaceView = React.lazy(() => import('./components/ApprovalsWorkspaceView').then(m => ({ default: m.ApprovalsWorkspaceView })));
const TreasuryWorkspaceView = React.lazy(() => import('./components/TreasuryWorkspaceView').then(m => ({ default: m.TreasuryWorkspaceView })));
const SettingsView = React.lazy(() => import('./components/SettingsView').then(m => ({ default: m.SettingsView })));

const AUTH_STORAGE_KEY = 'treasury_auth_user_session';
const TOKEN_STORAGE_KEY = 'treasury_auth_session_token';

export default function App() {
  const [dbState, setDbState] = useState<TreasuryDatabaseState | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [sessionToken, setSessionToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem(TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  });
  const [currentUser, setCurrentUser] = useState<UserType | null>(() => {
    try {
      const tok = localStorage.getItem(TOKEN_STORAGE_KEY);
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (!tok || !stored) {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        return null;
      }
      return JSON.parse(stored);
    } catch {
      return null;
    }
  });

  const sessionTokenRef = useRef<string | null>(sessionToken);
  // Same callbacks/UI state; only authenticated wire transfer is paged/incremental.
  const fetch=useMemo(()=>createStateFetch(window.fetch.bind(window),()=>sessionTokenRef.current),[]);
  const paymentResponseGeneration=useRef(0);
  useEffect(() => {
    sessionTokenRef.current = sessionToken;
  }, [sessionToken]);

  const currentUserRef = useRef<UserType | null>(currentUser);
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  // First-Login Forced Temporary Password Change State
  const [forcedCurrentPass, setForcedCurrentPass] = useState('');
  const [forcedNewPass, setForcedNewPass] = useState('');
  const [forcedConfirmPass, setForcedConfirmPass] = useState('');
  const [forcedPassError, setForcedPassError] = useState<string | null>(null);
  const [forcedPassLoading, setForcedPassLoading] = useState(false);

  const [activeSection, setActiveSection] = useState<MainSection>('REQUESTER');
  const [activeReceiptModal, setActiveReceiptModal] = useState<ReceiptArchive | null>(null);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [requesterFormTab, setRequesterFormTab] = useState<RequesterSubView>('PAYMENT_BATCH');
  const [requesterStatusFilter, setRequesterStatusFilter] = useState<string>('ALL');
  const [approvalCategoryTab, setApprovalCategoryTab] = useState<ApprovalCategoryTab>('PENDING');
  const [treasurySubTab, setTreasurySubTab] = useState<TreasurySubTab>('QUEUE');
  const [adminSubTab, setAdminSubTab] = useState<AdminSubTab>('USERS');

  // Browser Push Notification & Notification Center states
  const [showNotifDropdown, setShowNotifDropdown] = useState<boolean>(false);
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission | 'unsupported'>(() =>
    getBrowserNotificationPermission()
  );
  const [desktopNotifEnabled, setDesktopNotifEnabled] = useState<boolean>(() =>
    currentUser ? isUserDesktopNotificationEnabled(currentUser.id) : true
  );

  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3500);
  }, []);

  const clearClientSession = useCallback((reasonMsg?: string) => {
    sessionTokenRef.current = null;
    currentUserRef.current = null;
    // Never carry a privileged in-memory projection into the next login.
    setDbState(null);
    setLoading(true);
    setCurrentUser(null);
    setSessionToken(null);
    setShowNotifDropdown(false);
    setIsMobileSidebarOpen(false);
    setActiveReceiptModal(null);
    setActiveSection('REQUESTER');
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      sessionStorage.clear();
    } catch {
      // ignore storage errors
    }
    if (reasonMsg) {
      showToast(reasonMsg);
    }
  }, [showToast]);

  const isFetchingRef = useRef(false);

  const fetchState = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    const activeTokenAtStart = sessionTokenRef.current;
    const generation=paymentResponseGeneration.current;
    try {
      const res = await fetch('/api/state', {
        headers: activeTokenAtStart ? { Authorization: `Bearer ${activeTokenAtStart}` } : undefined,
      });
      if(sessionTokenRef.current!==activeTokenAtStart)return;
      if (res.status === 401 || res.status === 403) {
        if (activeTokenAtStart) clearClientSession('لطفاً دوباره وارد سامانه شوید.');
        return;
      }
      const contentType = res.headers.get('content-type') || '';
      if (!res.ok || !contentType.includes('application/json')) {
        return;
      }
      const data = (await res.json()) as TreasuryDatabaseState;
      if(sessionTokenRef.current!==activeTokenAtStart||paymentResponseGeneration.current!==generation)return;
      setDbState(data);

      // Verify current user session and active status from server only if session was not logged out while fetching
      if (sessionTokenRef.current && sessionTokenRef.current === activeTokenAtStart) {
        const meRes = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${activeTokenAtStart}` },
        });
        const meType = meRes.headers.get('content-type') || '';
        if (!meRes.ok || !meType.includes('application/json')) {
          if (meRes.status === 401 || meRes.status === 403) {
            clearClientSession('نشست کاربری شما منقضی یا لغو شده است. لطفاً مجدداً وارد شوید.');
          }
          return;
        }
        const meData = await meRes.json();
        if (sessionTokenRef.current !== activeTokenAtStart) {
          return;
        }
        if (meData.user) {
          const serializedNew = JSON.stringify(meData.user);
          const serializedCurrent = currentUserRef.current ? JSON.stringify(currentUserRef.current) : '';
          if (serializedNew !== serializedCurrent) {
            currentUserRef.current = meData.user;
            setCurrentUser(meData.user);
            localStorage.setItem(AUTH_STORAGE_KEY, serializedNew);
          }
          return;
        }
      } else if (!sessionTokenRef.current && currentUserRef.current) {
        clearClientSession();
      }
    } catch {
      // Silently ignore transient network errors during dev server restarts
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
    }
  }, [clearClientSession]);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  // Retry loading state automatically if server was temporarily unavailable on initial boot
  useEffect(() => {
    if (dbState) return;
    const retryTimer = window.setInterval(() => {
      fetchState();
    }, 2000);
    return () => window.clearInterval(retryTimer);
  }, [dbState, fetchState]);

  // Poll state every 7 seconds for real-time cross-user workflow notifications
  useEffect(() => {
    if (!currentUser?.id || !sessionToken) return;
    const intervalId = window.setInterval(() => {
      if (sessionTokenRef.current) {
        fetchState();
        setBrowserPermission(getBrowserNotificationPermission());
      }
    }, 7000);
    return () => window.clearInterval(intervalId);
  }, [currentUser?.id, sessionToken, fetchState]);

  // Sync user's desktop notification preference on login/switch
  useEffect(() => {
    if (currentUser) {
      setDesktopNotifEnabled(isUserDesktopNotificationEnabled(currentUser.id));
      setBrowserPermission(getBrowserNotificationPermission());
    }
  }, [currentUser?.id]);

  // Adjust default landing section when user logs in based on user preferences or role's defaultLandingSection
  useEffect(() => {
    if (currentUser) {
      const prefSec = currentUser.preferences?.defaultSection;
      const roleCfg = dbState?.roleConfigs?.find((r) => r.role === currentUser.role);
      if (prefSec) {
        setActiveSection(prefSec);
      } else if (roleCfg?.defaultLandingSection) {
        setActiveSection(roleCfg.defaultLandingSection);
      } else if (currentUser.role === 'ADMIN') {
        setActiveSection('ADMIN_PANEL');
      } else if (currentUser.role === 'TREASURY') {
        setActiveSection('TREASURY');
      } else if (currentUser.role === 'ACCOUNTING') {
        setActiveSection('ACCOUNTING');
      } else if (currentUser.role === 'APPROVER') {
        setActiveSection('APPROVER');
      } else {
        setActiveSection('REQUESTER');
      }
    }
  }, [currentUser?.id, currentUser?.role]);

  const handleLoginSuccess = (payload: {
    user: UserType;
    token: string;
    expiresAt: number;
    mustChangePassword: boolean;
  }) => {
    sessionTokenRef.current = payload.token;
    setDbState(null);
    setLoading(true);
    setCurrentUser(payload.user);
    setSessionToken(payload.token);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload.user));
    localStorage.setItem(TOKEN_STORAGE_KEY, payload.token);
    void fetchState();
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, '', window.location.pathname);
    }
    showToast(`خوش آمدید، ${payload.user.name} (${getRoleLabel(payload.user.role)})`);
  };

  const handleLogout = async () => {
    const tokenToRevoke = sessionTokenRef.current || sessionToken;
    clearClientSession('از حساب کاربری خود خارج شدید.');
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, '', window.location.pathname);
    }
    if (tokenToRevoke) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokenToRevoke}`,
          },
          body: JSON.stringify({ token: tokenToRevoke }),
        });
      } catch {
        // Ignore network error on logout cleanup
      }
    }
  };

  // Global Keyboard Navigation
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if (
        (e.key === '/' && !isTyping) ||
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      if (e.key === 'Escape') {
        if (activeReceiptModal) setActiveReceiptModal(null);
        if (showKeyboardHelp) setShowKeyboardHelp(false);
        if (isMobileSidebarOpen) setIsMobileSidebarOpen(false);
        if (showNotifDropdown) setShowNotifDropdown(false);
        return;
      }

      if (e.altKey && !isTyping) {
        if (e.key === '1') {
          e.preventDefault();
          setActiveSection('REQUESTER');
        } else if (e.key === '2' && (currentUser?.role === 'APPROVER' || currentUser?.role === 'ADMIN')) {
          e.preventDefault();
          setActiveSection('APPROVER');
        } else if (e.key === '3' && (currentUser?.role === 'ACCOUNTING' || currentUser?.role === 'ADMIN')) {
          e.preventDefault();
          setActiveSection('ACCOUNTING');
        } else if (e.key === '4' && (currentUser?.role === 'TREASURY' || currentUser?.role === 'ADMIN')) {
          e.preventDefault();
          setActiveSection('TREASURY');
        } else if (e.key === '5' && currentUser?.role === 'ADMIN') {
          e.preventDefault();
          setActiveSection('ADMIN_PANEL');
        } else if (e.key.toLowerCase() === 'h') {
          e.preventDefault();
          setShowKeyboardHelp((prev) => !prev);
        } else if (e.key.toLowerCase() === 'l') {
          e.preventDefault();
          handleLogout();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [activeReceiptModal, showKeyboardHelp, isMobileSidebarOpen, showNotifDropdown, currentUser]);

  // Filter notifications relevant to current user & role
  const visibleNotifications = useMemo<AppNotification[]>(() => {
    if (!dbState?.notifications || !currentUser) return [];
    return dbState.notifications.filter((n) => {
      if (currentUser.role === 'ADMIN') return true;
      if (n.recipientUserId && n.recipientUserId === currentUser.id) return true;
      if (n.recipientRole && n.recipientRole === currentUser.role) return true;
      if (n.actorName === currentUser.name) return true;
      return false;
    });
  }, [dbState?.notifications, currentUser]);

  const unreadNotificationsCount = useMemo(() => {
    if (!currentUser) return 0;
    return visibleNotifications.filter((n) => !n.readByUserIds.includes(currentUser.id)).length;
  }, [visibleNotifications, currentUser]);

  // Dispatch Windows / Browser Push Notifications via Web Notification API for new events
  useEffect(() => {
    if (!currentUser || !dbState?.notifications) return;

    // Seed initial notifications on first session so historical items don't spam OS tray
    seedInitialPushedNotifications(
      currentUser.id,
      visibleNotifications.filter((n) => n.readByUserIds.includes(currentUser.id)).map((n) => n.id)
    );

    for (const notif of visibleNotifications) {
      if (!hasNotificationBeenPushedToOS(currentUser.id, notif.id)) {
        markNotificationPushedToOS(currentUser.id, notif.id);

        if (desktopNotifEnabled && getBrowserNotificationPermission() === 'granted') {
          sendBrowserPushNotification({
            id: notif.id,
            title: notif.title,
            body: notif.body,
            tag: notif.id,
            eventType: notif.eventType,
            onClick: () => {
              setActiveSection(notif.targetSection);
            },
          });
        }
      }
    }
  }, [visibleNotifications, currentUser, dbState?.notifications, desktopNotifEnabled]);

  // Real-time Badge Counters (declared unconditionally before early returns)
  const badges = useMemo(() => {
    if (!dbState || !currentUser) {
      return {
        needsRevision: 0,
        pendingApprover: 0,
        pendingAccounting: 0,
        pendingTreasury: 0,
        inPaymentTreasury: 0,
        completedPayments: 0,
        totalReceipts: 0,
      };
    }
    const isMine = (reqId: string) => currentUser.role === 'ADMIN' || reqId === currentUser.id;
    let needsRevision = 0;
    dbState.batchPayments.forEach((b) => {
      if (isMine(b.requesterId)) {
        needsRevision += b.items.filter((it) => it.status === 'Needs_Revision').length;
      }
    });
    dbState.paymentRequests.forEach((p) => {
      if (isMine(p.requesterId) && p.status === 'Needs_Revision') needsRevision++;
    });
    dbState.advanceRequests.forEach((a) => {
      if (isMine(a.requesterId) && a.status === 'Needs_Revision') needsRevision++;
    });

    let pendingApprover = 0;
    const isMySupervised = (supId?: string | null) =>
      currentUser.role === 'ADMIN' || !supId || supId === currentUser.id;
    dbState.batchPayments.forEach((b) => {
      if ((currentUser.role === 'ADMIN' || b.requesterId !== currentUser.id) && isMySupervised(b.supervisorId)) {
        pendingApprover += b.items.filter((it) => (it.status || b.status) === 'Pending_Approver').length;
      }
    });
    dbState.paymentRequests.forEach((p) => {
      if ((currentUser.role === 'ADMIN' || p.requesterId !== currentUser.id) && isMySupervised(p.supervisorId) && p.status === 'Pending_Approver') {
        pendingApprover++;
      }
    });
    dbState.advanceRequests.forEach((a) => {
      if ((currentUser.role === 'ADMIN' || a.requesterId !== currentUser.id) && isMySupervised(a.supervisorId) && a.status === 'Pending_Approver') {
        pendingApprover++;
      }
    });

    let pendingAccounting = 0;
    dbState.batchPayments.forEach((b) => {
      if (currentUser.role === 'ADMIN' || b.requesterId !== currentUser.id) {
        pendingAccounting += b.items.filter((it) => (it.status || b.status) === 'Pending_Accounting').length;
      }
    });
    dbState.paymentRequests.forEach((p) => {
      if ((currentUser.role === 'ADMIN' || p.requesterId !== currentUser.id) && p.status === 'Pending_Accounting') pendingAccounting++;
    });
    dbState.advanceRequests.forEach((a) => {
      if ((currentUser.role === 'ADMIN' || a.requesterId !== currentUser.id) && a.status === 'Pending_Accounting') pendingAccounting++;
    });

    let pendingTreasury = 0;
    dbState.batchPayments.forEach((b) => {
      if (b.status === 'Pending_Treasury' || b.items.some((it) => (it.status || b.status) === 'Pending_Treasury')) {
        pendingTreasury++;
      }
    });
    dbState.paymentRequests.forEach((p) => {
      if (p.status === 'Pending_Treasury') pendingTreasury++;
    });
    dbState.advanceRequests.forEach((a) => {
      if (a.status === 'Pending_Treasury') pendingTreasury++;
    });

    let inPaymentTreasury = 0;
    dbState.batchPayments.forEach((b) => {
      if (b.status === 'In_Payment' || b.items.some((it) => (it.status || b.status) === 'In_Payment')) {
        inPaymentTreasury++;
      }
    });
    dbState.paymentRequests.forEach((p) => {
      if (p.status === 'In_Payment') inPaymentTreasury++;
    });
    dbState.advanceRequests.forEach((a) => {
      if (a.status === 'In_Payment') inPaymentTreasury++;
    });

    let completedPayments = dbState.manualPayments.length;
    dbState.batchPayments.forEach((b) => {
      if (b.status === 'Paid' || b.items.some((it) => (it.status || b.status) === 'Paid')) {
        completedPayments++;
      }
    });
    dbState.paymentRequests.forEach((p) => {
      if (p.status === 'Paid') completedPayments++;
    });
    dbState.advanceRequests.forEach((a) => {
      if (a.status === 'Paid') completedPayments++;
    });

    return {
      needsRevision,
      pendingApprover,
      pendingAccounting,
      pendingTreasury,
      inPaymentTreasury,
      completedPayments,
      totalReceipts: dbState.receiptArchives.length,
      pendingPasswordRecovery: (dbState.passwordRecoveryRequests || []).filter(
        (r) => r.status === 'Pending'
      ).length,
      totalUsers: (dbState.users || []).length,
      totalCompanies: (dbState.companies || []).length,
      totalDepartments: (dbState.departments || []).length,
      totalCostCenters: (dbState.costCenters || []).length,
      totalAuditLogs: (dbState.securityAuditLogs || []).length,
    };
  }, [dbState, currentUser]);

  const sectionInfo = useMemo(() => {
    switch (activeSection) {
      case 'ADMIN_PANEL': {
        if (adminSubTab === 'MASTER_COMPANIES') {
          return {
            title: 'اطلاعات پایه: تعریف شرکت‌ها و سازمان‌ها',
            subtitle: 'تعریف، ویرایش و مدیریت وضعیت شرکت‌ها و سازمان‌های زیرمجموعه هلدینگ',
            badge: 'اطلاعات پایه',
          };
        }
        if (adminSubTab === 'MASTER_DEPARTMENTS') {
          return {
            title: 'اطلاعات پایه: تعریف واحدهای سازمانی',
            subtitle: 'مدیریت چارت سازمانی و واحدهای تابعه هر شرکت',
            badge: 'اطلاعات پایه',
          };
        }
        if (adminSubTab === 'MASTER_COST_CENTERS') {
          return {
            title: 'اطلاعات پایه: تعریف مراکز هزینه',
            subtitle: 'مدیریت کدها و سرفصل‌های مراکز هزینه قابل انتخاب در دستورات پرداخت',
            badge: 'اطلاعات پایه',
          };
        }
        if (adminSubTab === 'SMS_GATEWAY') {
          return {
            title: 'اطلاعات پایه: سامانه پیامک و اطلاع‌رسانی (SMS Gateway)',
            subtitle: 'پیکربندی درگاه پیامکی، کد تأیید یک‌بارمصرف (OTP) و گزارش ارسال‌ها',
            badge: 'اطلاعات پایه',
          };
        }
        if (adminSubTab === 'ROLES') {
          return {
            title: 'مدیریت نقش‌ها، حدود اختیار و دسترسی‌ها',
            subtitle: 'تعیین سقف تایید مالی، سقف اجرای پرداخت و مجوزهای عملیاتی هر نقش',
            badge: 'مدیریت دسترسی‌ها',
          };
        }
        if (adminSubTab === 'RECOVERY') {
          return {
            title: 'درخواست‌های بازیابی رمز عبور پرسنل',
            subtitle: 'بررسی و صدور رمز عبور موقت برای کاربرانی که درخواست بازیابی ثبت کرده‌اند',
            badge: 'مدیریت کاربران',
          };
        }
        if (adminSubTab === 'AUDIT') {
          return {
            title: 'تاریخچه امنیتی و لاگ تغییرات دسترسی',
            subtitle: 'رهگیری کامل تغییرات کاربران، نقش‌ها، اطلاعات پایه و ورود به سامانه',
            badge: 'مدیریت کاربران',
          };
        }
        return {
          title: 'فهرست و مدیریت کاربران سازمان',
          subtitle: 'تعریف کاربران، انتساب نقش‌ها، تعیین سرپرست مستقیم و سقف اختیارات مالی',
          badge: 'مدیریت کاربران و دسترسی‌ها',
        };
      }
      case 'REQUESTER':
        return {
          title: 'کارتابل درخواست‌های مالی و پرسنلی',
          subtitle: 'ثبت دستور پرداخت‌های تکی و تجمیعی، تقاضای مساعده حقوق و پیگیری موارد نیازمند اصلاح',
          badge: 'امور متقاضیان',
        };
      case 'APPROVER':
        return {
          title: 'کارتابل تایید سرپرست واحد',
          subtitle: 'بررسی ردیف‌به‌ردیف درخواست‌های واصله از نیروهای تحت سرپرستی با امکان ویرایش مبلغ، تایید یا برگشت انتخابی',
          badge: 'تایید سازمانی',
        };
      case 'ACCOUNTING':
        return {
          title: 'کارتابل بررسی و تایید مالی حسابداری',
          subtitle: 'تطبیق مالی اسناد، کنترل مدارک و صورت‌حساب‌ها قبل از ارسال به صف خزانه‌داری',
          badge: 'بررسی مالی',
        };
      case 'SETTINGS':
        return {
          title: 'تنظیمات کارتابل، امنیت و حساب کاربری',
          subtitle: 'مدیریت رمز عبور، احراز هویت دومرحله‌ای، نشست‌های فعال و ترجیحات کارتابل متناسب با نقش سازمانی',
          badge: 'تنظیمات نقش',
        };
      case 'TREASURY':
      default:
        return {
          title: 'میز کار خزانه‌داری و پرداخت',
          subtitle: 'مدیریت صف پرداخت‌های مصوب، تسویه از بانک عامل، روکش روزانه و بایگانی فیش‌های بانکی',
          badge: 'عملیات پرداخت',
        };
    }
  }, [activeSection, adminSubTab]);

  const authHeaders = useMemo(() => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (sessionToken) h.Authorization = `Bearer ${sessionToken}`;
    return h;
  }, [sessionToken]);

  if (!currentUser) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  if (loading || !dbState) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-xl p-8 max-w-md w-full text-center space-y-3">
          <div className="text-base font-bold text-slate-900">
            در حال راه‌اندازی پرتال مالی و ارتباط با پایگاه داده...
          </div>
        </div>
      </div>
    );
  }

  // If not logged in, show proper Login Page
  if (!currentUser) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  // Handlers for User, Role, Password, and Preferences Management
  const handleSaveUser = async (
    payload: Partial<UserType> & { replacementSupervisorId?: string }
  ): Promise<{
    ok: boolean;
    error?: string;
    requiresReplacementSupervisor?: boolean;
    pendingCount?: number;
  }> => {
    try {
      const res = await fetch('/api/users/save', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ ...payload, actorId: currentUser.id }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        return {
          ok: false,
          error: data.error || 'خطا در ذخیره اطلاعات کاربر',
          requiresReplacementSupervisor: data.requiresReplacementSupervisor,
          pendingCount: data.pendingCount,
        };
      }
      if (data.state) {
        setDbState(data.state);
        const me = data.state.users.find((u: UserType) => u.id === currentUser.id);
        if (me) {
          setCurrentUser(me);
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(me));
        }
        showToast('اطلاعات کاربر و دسترسی‌ها با موفقیت در سرور ذخیره شد.');
      }
      return { ok: true };
    } catch {
      return { ok: false, error: 'خطا در ارتباط با سرور' };
    }
  };

  const handleResetUserPassword = async (payload: {
    targetUserId: string;
    tempPassword: string;
    mustChangePassword: boolean;
    recoveryRequestId?: string;
  }): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/users/reset-password', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ ...payload, actorId: currentUser.id }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        return { ok: false, error: data.error || 'خطا در بازنشانی رمز عبور' };
      }
      if (data.state) {
        setDbState(data.state);
        showToast('رمز عبور موقت کاربر با موفقیت ثبت شد و نشست‌های قبلی او بسته شدند.');
      }
      return { ok: true };
    } catch {
      return { ok: false, error: 'خطا در ارتباط با سرور' };
    }
  };

  const handleToggleUserStatus = async (payload: {
    targetUserId: string;
    isActive: boolean;
    replacementSupervisorId?: string;
  }): Promise<{
    ok: boolean;
    error?: string;
    requiresReplacementSupervisor?: boolean;
    pendingCount?: number;
  }> => {
    try {
      const res = await fetch('/api/users/toggle-status', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ ...payload, actorId: currentUser.id }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        return {
          ok: false,
          error: data.error || 'خطا در تغییر وضعیت حساب',
          requiresReplacementSupervisor: data.requiresReplacementSupervisor,
          pendingCount: data.pendingCount,
        };
      }
      if (data.state) {
        setDbState(data.state);
        showToast(
          payload.isActive
            ? 'حساب کاربری با موفقیت فعال شد.'
            : 'حساب کاربری غیرفعال شد و دسترسی‌های او لغو گردید.'
        );
      }
      return { ok: true };
    } catch {
      return { ok: false, error: 'خطا در ارتباط با سرور' };
    }
  };

  const handleSaveRoleConfig = async (
    config: Partial<RoleDefinitionConfig> & { role: Role }
  ): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/roles/save', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ ...config, actorId: currentUser.id }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        return { ok: false, error: data.error || 'خطا در ذخیره تنظیمات نقش' };
      }
      if (data.state) {
        setDbState(data.state);
        const me = data.state.users.find((u: UserType) => u.id === currentUser.id);
        if (me) {
          setCurrentUser(me);
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(me));
        }
        showToast('تنظیمات دسترسی و سقف مالی نقش با موفقیت ذخیره شد.');
      }
      return { ok: true };
    } catch {
      return { ok: false, error: 'خطا در ارتباط با سرور' };
    }
  };

  const handleDeleteRoleConfig = async (
    role: Role
  ): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/roles/delete', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ role, actorId: currentUser.id }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        return { ok: false, error: data.error || 'خطا در حذف نقش سفارشی' };
      }
      if (data.state) {
        setDbState(data.state);
        showToast('نقش سفارشی با موفقیت حذف شد.');
      }
      return { ok: true };
    } catch {
      return { ok: false, error: 'خطا در ارتباط با سرور' };
    }
  };

  const handleResetRoleDefaults = async (
    role?: Role
  ): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/roles/reset-defaults', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ role, actorId: currentUser.id }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        return { ok: false, error: data.error || 'خطا در بازگردانی تنظیمات پیش‌فرض نقش' };
      }
      if (data.state) {
        setDbState(data.state);
        const me = data.state.users.find((u: UserType) => u.id === currentUser.id);
        if (me) {
          setCurrentUser(me);
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(me));
        }
        showToast('تنظیمات پیش‌فرض نقش با موفقیت بازگردانی شد.');
      }
      return { ok: true };
    } catch {
      return { ok: false, error: 'خطا در ارتباط با سرور' };
    }
  };

  // Master Data & SMS Gateway Admin Handlers
  const postMasterDataAction = async (
    url: string,
    payload: Record<string, unknown>,
    successMsg?: string
  ): Promise<{ ok: boolean; error?: string; status?: string; providerResponse?: string }> => {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ ...payload, actorId: currentUser.id }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        if (data.state) setDbState(data.state);
        return {
          ok: false,
          error: data.error || 'خطا در اجرای عملیات',
          status: data.status,
          providerResponse: data.providerResponse,
        };
      }
      if (data.state) {
        setDbState(data.state);
        const me = data.state.users?.find((u: UserType) => u.id === currentUser.id);
        if (me) {
          setCurrentUser(me);
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(me));
        }
      }
      if (successMsg) showToast(successMsg);
      return {
        ok: data.success !== false,
        status: data.status,
        error: data.error,
        providerResponse: data.providerResponse,
      };
    } catch {
      return { ok: false, error: 'خطا در ارتباط با سرور' };
    }
  };

  const handleSaveCompany = (payload: Partial<OrganizationCompany>) =>
    postMasterDataAction('/api/master-data/companies/save', payload, 'اطلاعات شرکت/سازمان ذخیره شد.');
  const handleBulkCreateMasterData=(kind:BulkMasterDataKind,rows:BulkMasterDataRow[])=>
    postMasterDataAction(`/api/master-data/${kind}/bulk-create`,{rows},'اطلاعات گروه با کد خودکار ثبت شد.');
  const handleToggleCompanyStatus = (id: string, isActive: boolean) =>
    postMasterDataAction('/api/master-data/companies/toggle-status', { id, isActive });
  const handleDeleteCompany = (id: string) =>
    postMasterDataAction('/api/master-data/companies/delete', { id });

  const handleSaveDepartment = (payload: Partial<OrganizationalDepartment>) =>
    postMasterDataAction('/api/master-data/departments/save', payload, 'اطلاعات واحد سازمانی ذخیره شد.');
  const handleToggleDepartmentStatus = (id: string, isActive: boolean) =>
    postMasterDataAction('/api/master-data/departments/toggle-status', { id, isActive });
  const handleDeleteDepartment = (id: string) =>
    postMasterDataAction('/api/master-data/departments/delete', { id });

  const handleSaveCostCenter = (payload: Partial<CostCenterItem>) =>
    postMasterDataAction('/api/master-data/cost-centers/save', payload, 'اطلاعات مرکز هزینه ذخیره شد.');
  const handleToggleCostCenterStatus = (id: string, isActive: boolean) =>
    postMasterDataAction('/api/master-data/cost-centers/toggle-status', { id, isActive });
  const handleDeleteCostCenter = (id: string) =>
    postMasterDataAction('/api/master-data/cost-centers/delete', { id });

  const handleSaveSmsConfig = (payload: Partial<SmsGatewayConfig> & { clearSecrets?: boolean }) =>
    postMasterDataAction('/api/sms/config', payload, 'تنظیمات درگاه پیامک ذخیره شد.');
  const handleTestSmsDispatch = (payload: { recipientPhone: string; testMessage?: string }) =>
    postMasterDataAction('/api/sms/test', payload);

  const handleChangePassword = async (payload: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ ...payload, userId: currentUser.id }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        return { ok: false, error: data.error || 'خطا در تغییر رمز عبور' };
      }
      if (data.user) {
        setCurrentUser(data.user);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data.user));
      }
      if (data.state) {
        setDbState(data.state);
      }
      showToast('رمز عبور شما با موفقیت تغییر یافت.');
      return { ok: true };
    } catch {
      return { ok: false, error: 'خطا در ارتباط با سرور' };
    }
  };

  const handleSavePreferences = async (payload: {
    preferences: UserPersonalPreferences;
    twoFactorEnabled?: boolean;
    twoFactorPin?: string;
    currentPassword?: string;
  }): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/auth/preferences', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ ...payload, userId: currentUser.id }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        return { ok: false, error: data.error || 'خطا در ذخیره تنظیمات' };
      }
      if (data.user) {
        setCurrentUser(data.user);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data.user));
      }
      if (data.state) {
        setDbState(data.state);
      }
      showToast('تنظیمات شخصی و امنیتی حساب شما ذخیره شد.');
      return { ok: true };
    } catch {
      return { ok: false, error: 'خطا در ارتباط با سرور' };
    }
  };

  const handleRevokeOtherSessions = async (): Promise<{
    ok: boolean;
    revokedCount?: number;
    error?: string;
  }> => {
    try {
      const res = await fetch('/api/auth/logout-other-sessions', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ userId: currentUser.id }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        return { ok: false, error: data.error || 'خطا در بستن سایر نشست‌ها' };
      }
      showToast(`سایر نشست‌های فعال شما (${data.revokedCount || 0} مورد) با موفقیت بسته شدند.`);
      return { ok: true, revokedCount: data.revokedCount };
    } catch {
      return { ok: false, error: 'خطا در ارتباط با سرور' };
    }
  };

  // Forced password change screen when mustChangePassword is true
  if (currentUser.mustChangePassword) {
    const handleForcedSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setForcedPassError(null);
      setForcedPassLoading(true);
      const res = await handleChangePassword({
        currentPassword: forcedCurrentPass,
        newPassword: forcedNewPass,
        confirmPassword: forcedConfirmPass,
      });
      setForcedPassLoading(false);
      if (!res.ok) {
        setForcedPassError(res.error || 'خطا در تغییر رمز عبور موقت');
      } else {
        setForcedCurrentPass('');
        setForcedNewPass('');
        setForcedConfirmPass('');
      }
    };

    return (
      <div
        dir="rtl"
        className="min-h-screen bg-slate-950 text-slate-900 flex items-center justify-center p-4"
      >
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-2xl">
          <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                الزام تغییر رمز عبور موقت در اولین ورود
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                کاربر گرامی {currentUser.name}، برای ادامه کار با سامانه لازم است رمز عبور موقت خود را به یک رمز عبور شخصی جدید تغییر دهید.
              </p>
            </div>
          </div>

          {forcedPassError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{forcedPassError}</span>
            </div>
          )}

          <form onSubmit={handleForcedSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                رمز عبور موقت (فعلی) <span className="text-rose-600">*</span>
              </label>
              <input
                type="password"
                required
                value={forcedCurrentPass}
                onChange={(e) => setForcedCurrentPass(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono-num"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                رمز عبور شخصی جدید (حداقل ۵ کاراکتر) <span className="text-rose-600">*</span>
              </label>
              <input
                type="password"
                required
                minLength={5}
                value={forcedNewPass}
                onChange={(e) => setForcedNewPass(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono-num"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                تکرار رمز عبور شخصی جدید <span className="text-rose-600">*</span>
              </label>
              <input
                type="password"
                required
                minLength={5}
                value={forcedConfirmPass}
                onChange={(e) => setForcedConfirmPass(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono-num"
              />
            </div>

            <div className="flex items-center justify-between gap-2 pt-2">
              <button
                type="button"
                onClick={handleLogout}
                className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                خروج از حساب
              </button>
              <button
                type="submit"
                disabled={forcedPassLoading}
                className="px-5 py-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                {forcedPassLoading ? 'در حال ثبت...' : 'ثبت رمز عبور جدید و ورود به کارتابل'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  const submitRequestForm = async (
    route: string, payload: unknown, recordKey: 'item' | 'batch',
    successMessage: (record: {id:string;trackingCode:string;status?:string;itemCount?:number}) => string,
  ): Promise<boolean> => {
    try {
      const res = await fetch(route, {method:'POST',headers:authHeaders,body:JSON.stringify(payload)});
      const data = await res.json();
      if (!res.ok || data.error) { showToast(data.error || 'عملیات انجام نشد؛ اطلاعات فرم حفظ شده است.'); return false; }
      const record = data[recordKey];
      if (!data.state || !record?.id || !record?.trackingCode) {
        showToast('ثبت تأیید نشد؛ اطلاعات فرم حفظ شد. پیش از ارسال دوباره، کارتابل را بررسی کنید.');
        return false;
      }
      setDbState(data.state);
      showToast(successMessage(record));
      return true;
    } catch {
      showToast('نتیجه ثبت دریافت نشد؛ اطلاعات فرم حفظ شد. پیش از ارسال دوباره، کارتابل را بررسی کنید.');
      return false;
    }
  };

  const handleSubmitAdvance = async (payload: {
    requesterId: string;
    requestedMonth: string;
    amount: number;
    suggestedDate: string;
    reason: string;
  }) => {
    return submitRequestForm('/api/advance-requests',payload,'item',item => `درخواست مساعده با کد ${item.trackingCode} ثبت و به ${item.status === 'Pending_Accounting' ? 'حسابداری' : 'سرپرست'} ارسال شد.`);
  };

  const handleSubmitPayment = async (payload: {
    requesterId: string;
    dueDate: string;
    priority: Priority;
    costCenter: string;
    description: string;
    amount: number;
    payeeName: string;
    accountOrCard: string;
    iban: string;
    bankName: string;
    invoiceNumber: string;
  }) => {
    return submitRequestForm('/api/payment-requests',payload,'item',item => `دستور پرداخت با کد ${item.trackingCode} ثبت شد.`);
  };

  const handleSubmitBatchPayment = async (payload: {
    requesterId: string;
    title: string;
    items: Omit<BatchItem, 'id'>[];
  }) => {
    return submitRequestForm('/api/batch-payments',payload,'batch',batch => `لیست پرداخت تجمیعی با کد ${batch.trackingCode} شامل ${batch.itemCount} ردیف با موفقیت ثبت گردید.`);
  };

  const handleRowReviewAction = async (payload: {
    reviewerId: string;
    reviewStage?: 'APPROVER' | 'ACCOUNTING';
    expectedVersion?: number;
    expectedStatus?: RequestStatus;
    itemType: 'BATCH_ITEM' | 'PAYMENT' | 'ADVANCE';
    requestId: string;
    rowId?: string;
    action: 'APPROVE' | 'RETURN_FOR_REVISION' | 'UPDATE_AMOUNT_COMMENT' | 'UPDATE_AND_APPROVE' | 'REJECT' | 'CLOSE_REJECTED';
    comment?: string;
    returnReason?: string;
    newAmount?: number;
    amountChangeReason?: string;
  }): Promise<boolean> => {
    try {
      const res = await fetch('/api/review/row-action', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        showToast(data.error || 'خطا در ثبت اقدام');
        return false;
      }
      if (data.state) {
        setDbState(data.state);
        if (payload.action === 'APPROVE') {
          showToast('تایید ردیف با موفقیت ثبت شد.');
        } else if (payload.action === 'RETURN_FOR_REVISION') {
          showToast('ردیف جهت اصلاح به کارتابل درخواست‌دهنده برگشت داده شد.');
          } else if (payload.action === 'REJECT') {
            showToast('درخواست در «ردشده توسط من» باز می‌ماند.');
          } else if (payload.action === 'CLOSE_REJECTED') {
            showToast('درخواست به صورت نهایی بسته و بایگانی شد.');
        } else if (payload.action === 'UPDATE_AND_APPROVE') {
          showToast('تغییرات مبلغ و کامنت ذخیره و تایید ثبت گردید.');
        } else {
          showToast('تغییرات مبلغ و یادداشت با موفقیت ذخیره شد.');
        }
      }
      return true;
    } catch {
      showToast('خطا در برقراری ارتباط با سرور');
      return false;
    }
  };

  const handleBulkReviewAction = async (payload: {
    reviewerId: string;
    reviewStage?: 'APPROVER' | 'ACCOUNTING';
    action: 'APPROVE' | 'RETURN_FOR_REVISION' | 'REJECT';
    returnReason?: string;
    items: Array<{
      itemType: 'BATCH_ITEM' | 'PAYMENT' | 'ADVANCE';
      requestId: string;
      rowId?: string;
      expectedVersion?: number;
      expectedStatus?: RequestStatus;
    }>;
  }): Promise<boolean> => {
    try {
      const res = await fetch('/api/review/bulk-action', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        showToast(data.error || 'خطا در عملیات گروهی');
        return false;
      }
      if (data.state) {
        setDbState(data.state);
        showToast(
          `عملیات گروهی انجام شد: ${data.successCount || 0} ردیف با موفقیت ثبت شد${
            data.failedCount ? ` و ${data.failedCount} ردیف خطا داشت.` : '.'
          }`
        );
      }
      return true;
    } catch {
      showToast('خطا در اجرای عملیات گروهی');
      return false;
    }
  };

  const handleEditSubmittedRequest = async (payload: SubmittedRequestEdit): Promise<{ok:boolean;error?:string}> => {
    try{
      const response=await fetch('/api/requests/edit-submitted',{method:'POST',headers:authHeaders,body:JSON.stringify(payload)});
      const result=await response.json();
      if(!response.ok||result.error)return {ok:false,error:result.error||'ویرایش درخواست ثبت نشد.'};
      if(result.state)setDbState(result.state);
      showToast('ویرایش ذخیره شد؛ درخواست در همان مرحلهٔ بررسی باقی ماند.');
      return {ok:true};
    }catch{return {ok:false,error:'ارتباط برقرار نشد؛ ابتدا وضعیت درخواست را بررسی کنید، سپس دوباره تلاش کنید.'};}
  };

  const handleResubmitRequest = async (payload: {
    requesterId: string;
    itemType: 'BATCH_ITEM' | 'PAYMENT' | 'ADVANCE';
    requestId: string;
    rowId?: string;
    amount?: number;
    description?: string;
    accountOrCard?: string;
    iban?: string;
    bankName?: string;
    newAttachments?: AttachmentFile[];
  }): Promise<boolean> => {
    try {
      const res = await fetch('/api/requests/resubmit', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        showToast(data.error || 'خطا در ارسال مجدد');
        return false;
      }
      if (data.state) {
        setDbState(data.state);
        showToast('درخواست اصلاح شد و مجدداً به صف تایید ارسال گردید.');
      }
      return true;
    } catch {
      showToast('خطا در ارسال مجدد درخواست');
      return false;
    }
  };

  const handleMoveTreasuryPool = async (payload: {
    items: Array<{ id: string; type: 'ADVANCE' | 'PAYMENT' | 'BATCH' | 'BATCH_ITEM'; batchId?: string }>;
    targetPool: 'IN_PAYMENT' | 'QUEUE';
    treasuryUserId: string;
    reason?: string;
  }): Promise<boolean> => {
    try {
      const res = await fetch('/api/treasury/move-pool', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        showToast(data.error || 'خطا در جابجایی مخزن پرداخت');
        return false;
      }
      if (data.state) {
        setDbState(data.state);
        if (payload.targetPool === 'IN_PAYMENT') {
          showToast(
            `${data.movedCount || payload.items.length} سند از صف انتظار به «مخزن در حال پرداخت» منتقل شد.`
          );
        } else {
          showToast(
            `${data.movedCount || payload.items.length} سند از مخزن در حال پرداخت به «صف انتظار» بازگردانده شد.`
          );
        }
      }
      return true;
    } catch {
      showToast('خطا در ارتباط با سرور هنگام جابجایی مخزن');
      return false;
    }
  };

  const handleExecutePayment = async (payload: {
    items: Array<{
      id: string;
      type: 'ADVANCE' | 'PAYMENT' | 'BATCH' | 'BATCH_ITEM';
      batchId?: string;
    }>;
    sourceBankAccountId: string;
    paidBankName: string;
    paymentAmount?: number;
    paymentMethod?: PaymentMethodType;
    bankRefNumber: string;
    dateJalali: string;
    treasuryUserId: string;
    receiptFileUrl?: string;
    receiptFileName?: string;
    idempotencyKey?: string;
    expectedPaidAmounts?:Record<string,number>;
  }): Promise<{ ok: boolean; error?: string;status?:number;code?:string;ambiguous?:boolean }> => {
    const activeToken=sessionTokenRef.current,actor=currentUserRef.current?.id,generation=++paymentResponseGeneration.current;
    try {
      const res = await fetch('/api/treasury/execute-payment', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if(sessionTokenRef.current!==activeToken||currentUserRef.current?.id!==actor||paymentResponseGeneration.current!==generation)return {ok:false,ambiguous:true};
      if (!res.ok || data.error) {
        return { ok: false, error: data.error || 'خطا در ثبت پرداخت در سرور',status:res.status,code:data.code };
      }
      if(!data.state||!data.receipt?.id)return {ok:false,ambiguous:true,error:'نتیجه ثبت قابل تأیید نیست؛ ابتدا از سرور استعلام کنید.'};
      if (data.state) {
        paymentResponseGeneration.current++;
        setDbState(data.state);
        showToast(
          `پرداخت از حساب «${data.receipt?.sourceAccountSnapshot?.accountTitle || payload.paidBankName}» ثبت شد و فیش مرجع ${data.receipt?.bankRefNumber} صادر گردید.`
        );
      }
      return { ok: true };
    } catch {
      return { ok: false, ambiguous:true,error: 'خطا در ارتباط با سرور هنگام ثبت پرداخت' };
    }
  };

  const handleCreateManualPayment = async (payload: {
    amount: number;
    payee: string;
    description: string;
    sourceBankAccountId: string;
    bankName: string;
    date: string;
    orderedBy: string;
    createdById: string;
    bankRefNumber: string;
    receiptFileUrl?: string;
    receiptFileName?: string;
  }): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/treasury/manual-payment', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        return { ok: false, error: data.error || 'خطا در ثبت پرداخت دستی' };
      }
      if (data.state) {
        setDbState(data.state);
        showToast(`پرداخت دستی از طریق ${payload.bankName} ثبت گردید.`);
      }
      return { ok: true };
    } catch {
      return { ok: false, error: 'خطا در ارتباط با سرور' };
    }
  };

  const handleImportBankAccounts:ImportBankAccounts = async (payload,commit) => {
    try{
      const response=await fetch('/api/treasury/bank-accounts/'+(commit?'import':'import-preview'),{method:'POST',headers:authHeaders,body:JSON.stringify(payload)});
      const data=await response.json();if(!response.ok)return {ok:false,error:data.error||'ورود گروهی انجام نشد.',report:data.report};
      if(commit&&data.state)setDbState(data.state);
      return data;
    }catch{return {ok:false,error:commit?'نتیجه ثبت دریافت نشد؛ برای جلوگیری از تکرار، دوباره بازبینی کنید.':'خطا در ارتباط با سرور؛ فایل شما حفظ شده است.'};}
  };

  const handleSaveBankAccount = async (
    payload: Partial<CompanyBankAccount>
  ): Promise<{ ok: boolean; account?: CompanyBankAccount; error?: string }> => {
    try {
      const res = await fetch('/api/treasury/bank-accounts/save', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ ...payload, actorId: currentUser.id }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        return { ok: false, error: data.error || 'خطا در ذخیره حساب بانکی مبدأ' };
      }
      if (data.state) {
        setDbState(data.state);
        showToast('اطلاعات حساب بانکی مبدأ شرکت با موفقیت ذخیره شد.');
      }
      return { ok: true, account: data.account };
    } catch {
      return { ok: false, error: 'خطا در ارتباط با سرور' };
    }
  };

  const handleToggleBankAccountStatus = async (payload: {
    accountId: string;
    isActive: boolean;
  }): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/treasury/bank-accounts/toggle-status', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ ...payload, actorId: currentUser.id }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        showToast(data.error || 'خطا در تغییر وضعیت حساب بانکی');
        return { ok: false, error: data.error };
      }
      if (data.state) {
        setDbState(data.state);
        showToast(
          payload.isActive
            ? 'حساب بانکی مبدأ مجدداً فعال شد.'
            : 'حساب بانکی مبدأ غیرفعال شد (سوابق پرداخت‌های قبلی حفظ گردید).'
        );
      }
      return { ok: true };
    } catch {
      return { ok: false, error: 'خطا در ارتباط با سرور' };
    }
  };

  const handleSetDefaultBankAccount = async (payload: {
    accountId: string;
  }): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/treasury/bank-accounts/set-default', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ ...payload, actorId: currentUser.id }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        showToast(data.error || 'خطا در تنظیم حساب پیش‌فرض');
        return { ok: false, error: data.error };
      }
      if (data.state) {
        setDbState(data.state);
        showToast('حساب بانکی انتخابی به‌عنوان حساب پیش‌فرض پرداخت شرکت تنظیم شد.');
      }
      return { ok: true };
    } catch {
      return { ok: false, error: 'خطا در ارتباط با سرور' };
    }
  };

  const handleCloseDailyCover = async (payload: {
    date: string;
    bankName: string;
    sourceBankAccountId?: string;
    totalIn: number;
    bankFee: number;
    note: string;
    closedByUserId: string;
  }) => {
    const res = await fetch('/api/treasury/daily-cover', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || data.error) { showToast(data.error || 'عملیات انجام نشد؛ دوباره بررسی کنید.'); return; }
    if (data.state) {
      setDbState(data.state);
      showToast(`روکش روزانه شماره ${data.cover.coverNumber} با موفقیت بسته شد.`);
    }
  };

  const handleMarkNotificationRead = async (notificationId?: string) => {
    try {
      const res = await fetch('/api/notifications/read', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ userId: currentUser.id, notificationId }),
      });
      const data = await res.json();
      if (data.state) {
        setDbState(data.state);
      }
    } catch {
      // ignore error
    }
  };

  const handleToggleBrowserNotifications = async () => {
    const currentPerm = getBrowserNotificationPermission();
    setBrowserPermission(currentPerm);

    if (currentPerm === 'unsupported') {
      showToast('مرورگر فعلی از Web Notification API پشتیبانی نمی‌کند.');
      return;
    }

    if (currentPerm === 'granted') {
      const nextEnabled = !desktopNotifEnabled;
      setDesktopNotifEnabled(nextEnabled);
      setUserDesktopNotificationEnabled(currentUser.id, nextEnabled);
      if (nextEnabled) {
        sendBrowserPushNotification({
          id: `notif-enabled-${Date.now()}`,
          title: 'اعلان ویندوز پرتال خزانه فعال شد',
          body: 'رویدادهای کلیدی مانند «ارسال مجدد درخواست» و «تایید نهایی» در محیط ویندوز شما نمایش داده می‌شوند.',
        });
        showToast('اعلان‌های دسکتاپ ویندوز (Browser Push) فعال شد.');
      } else {
        showToast('نمایش اعلان در محیط ویندوز برای حساب شما غیرفعال شد.');
      }
      return;
    }

    const reqRes = await requestBrowserNotificationPermission();
    setBrowserPermission(reqRes.permission);
    if (reqRes.granted) {
      setDesktopNotifEnabled(true);
      setUserDesktopNotificationEnabled(currentUser.id, true);
      sendBrowserPushNotification({
        id: `notif-granted-${Date.now()}`,
        title: 'اعلان ویندوز پرتال خزانه فعال شد',
        body: 'رویدادهای کلیدی مانند «ارسال مجدد درخواست» و «تایید نهایی» در محیط ویندوز شما نمایش داده می‌شوند.',
      });
      showToast('مجوز اعلان مرورگر تایید شد و اعلان آزمایشی در ویندوز نمایش داده شد.');
    } else {
      showToast(reqRes.errorMessage || 'امکان فعال‌سازی اعلان مرورگر وجود نداشت.');
    }
  };

  const handleSendTestWindowsNotification = async () => {
    let perm = getBrowserNotificationPermission();
    if (perm === 'default') {
      const reqRes = await requestBrowserNotificationPermission();
      perm = reqRes.permission;
      setBrowserPermission(perm);
    }

    if (perm !== 'granted') {
      showToast(
        'برای نمایش اعلان در محیط ویندوز، ابتدا مجوز Notifications مرورگر را تایید (Allow) نمایید.'
      );
      return;
    }

    setDesktopNotifEnabled(true);
    setUserDesktopNotificationEnabled(currentUser.id, true);

    const result = sendBrowserPushNotification({
      id: `test-push-${Date.now()}`,
      title: 'اعلان آزمایشی پرتال خزانه (ویندوز)',
      body: `کاربر گرامی ${currentUser.name}، اعلان رویدادهای «ارسال مجدد درخواست» و «تایید نهایی» در محیط ویندوز شما فعال است.`,
    });

    if (result.sent) {
      showToast('اعلان آزمایشی با موفقیت به محیط ویندوز (Notification API) ارسال شد.');
    } else {
      showToast(`خطا در نمایش اعلان مرورگر: ${result.reason || 'محدودیت مرورگر'}`);
    }
  };

  const currentPerms = normalizeRolePermissionSet(
    currentUser.effectivePermissions,
    currentUser.role
  );

  const canAccessAdmin = Boolean(
    currentUser.role === 'ADMIN' ||
      currentPerms.canManageUsers ||
      currentPerms.canManageRoles ||
      currentPerms.canManagePasswordRecovery ||
      currentPerms.canViewSecurityAudit ||
      currentPerms.canManageCompanies ||
      currentPerms.canManageDepartments ||
      currentPerms.canManageCostCenters ||
      currentPerms.canManageSmsGateway
  );
  const canAccessApprover = Boolean(currentPerms.canAccessApproverCartable);
  const canAccessAccounting = Boolean(currentPerms.canAccessAccountingCartable);
  const canAccessTreasury = Boolean(
    currentPerms.canAccessTreasuryQueue ||
      currentPerms.canAccessTreasuryInPayment ||
      currentPerms.canAccessTreasuryCompleted ||
      currentPerms.canAccessTreasuryBankAccounts ||
      currentPerms.canAccessTreasuryManualPayment ||
      currentPerms.canAccessTreasuryDailyCover ||
      currentPerms.canAccessTreasuryArchive
  );

  const isPushActive = browserPermission === 'granted' && desktopNotifEnabled;

  return (
    <React.Suspense fallback={<div dir="rtl" className="min-h-screen grid place-items-center bg-slate-50 text-slate-700">در حال بازکردن کارتابل...</div>}>
    <div dir="rtl" className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Right Fixed / Sticky Sidebar with Submenus & Cartable & Role Accesses */}
      <SidebarNavigation
        currentUser={currentUser}
        roleConfigs={dbState.roleConfigs || []}
        activeSection={activeSection}
        onSelectSection={(sec) => setActiveSection(sec)}
        activeRequesterFormTab={requesterFormTab}
        activeRequesterStatusFilter={requesterStatusFilter}
        onSelectRequesterTab={(tab, statusFilter) => {
          setRequesterFormTab(tab);
          if (statusFilter) setRequesterStatusFilter(statusFilter);
        }}
        activeApprovalCategoryTab={approvalCategoryTab}
        onSelectApprovalCategoryTab={(mode, tab) => {
          setActiveSection(mode);
          setApprovalCategoryTab(tab);
        }}
        activeTreasuryTab={treasurySubTab}
        onSelectTreasuryTab={(tab) => setTreasurySubTab(tab)}
        activeAdminTab={adminSubTab}
        onSelectAdminTab={(tab) => setAdminSubTab(tab)}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onOpenKeyboardHelp={() => setShowKeyboardHelp(true)}
        onLogout={handleLogout}
        badges={badges}
      />

      {/* Main Workspace Area (takes remainder of width) */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        {/* Top Navbar Header for Title, Breadcrumb, Browser Push Notifications & Mobile Menu Toggle */}
        <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between gap-4 sticky top-0 z-20 no-print">
          <div className="flex items-center gap-3">
            {/* Mobile Hamburger Button */}
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="p-2 text-slate-700 hover:text-slate-950 hover:bg-slate-100 rounded-lg lg:hidden cursor-pointer"
              aria-label="باز کردن منوی کناری"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div>
              <div className="text-xs sm:text-sm font-bold text-slate-950 flex items-center gap-2">
                <span>{sectionInfo.title}</span>
                <span className="hidden sm:inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                  {sectionInfo.badge}
                </span>
              </div>
              <p className="hidden md:block text-[11px] text-slate-500 mt-0.5">
                {sectionInfo.subtitle}
              </p>
            </div>
          </div>

          {/* Right Header Actions: Search + Browser Push Notification Toggle + Notification Center Bell */}
          <div className="flex items-center gap-2 relative">
            {/* Quick Search Focus Action */}
            <button
              type="button"
              onClick={() => {
                searchInputRef.current?.focus();
                searchInputRef.current?.select();
              }}
              className="hidden md:inline-flex items-center gap-2 px-3 py-1.5 text-xs text-slate-600 hover:text-slate-950 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer"
              title="فوکوس روی جستجو (/ یا Ctrl+K)"
            >
              <Search className="w-3.5 h-3.5 text-slate-500" />
              <span>جستجو در کارتابل</span>
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-[10px] font-mono text-slate-600">
                /
              </kbd>
            </button>

            {/* Browser Push Notification Status & Toggle Button */}
            <button
              type="button"
              onClick={handleToggleBrowserNotifications}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                isPushActive
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100'
                  : browserPermission === 'denied'
                  ? 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
                  : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
              }`}
              title="مدیریت نمایش اعلان‌های مرورگر در محیط ویندوز (Notification API)"
            >
              {isPushActive ? (
                <>
                  <BellRing className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="hidden sm:inline">اعلان ویندوز: فعال</span>
                </>
              ) : browserPermission === 'denied' ? (
                <>
                  <BellOff className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                  <span className="hidden sm:inline">اعلان مسدود</span>
                </>
              ) : (
                <>
                  <Bell className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                  <span className="hidden sm:inline">فعال‌سازی اعلان ویندوز</span>
                </>
              )}
            </button>

            {/* Notification Center Bell & Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowNotifDropdown((prev) => !prev)}
                className="relative p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-950 transition cursor-pointer"
                aria-label="مرکز اعلان‌ها"
                title="مشاهده رویدادها و اعلان‌های سیستم"
              >
                <Bell className="w-4 h-4" />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center font-mono-num">
                    {unreadNotificationsCount}
                  </span>
                )}
              </button>

              {showNotifDropdown && (
                <div className="absolute left-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
                  <div className="p-3 bg-slate-900 text-white flex items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-bold flex items-center gap-1.5">
                        <BellRing className="w-3.5 h-3.5 text-amber-400" />
                        <span>اعلان‌های سامانه و ویندوز</span>
                      </div>
                      <div className="text-[10px] text-slate-300 mt-0.5">
                        رویدادهای ارسال مجدد، تایید نهایی و پرداخت
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={handleSendTestWindowsNotification}
                        className="px-2 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 text-[10px] font-bold transition cursor-pointer"
                        title="ارسال یک اعلان آزمایشی به محیط ویندوز"
                      >
                        تست اعلان ویندوز
                      </button>
                      {unreadNotificationsCount > 0 && (
                        <button
                          type="button"
                          onClick={() => handleMarkNotificationRead()}
                          className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] transition cursor-pointer"
                          title="ثبت همه به عنوان خوانده‌شده"
                        >
                          <CheckCheck className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Permission Status Banner inside Dropdown */}
                  <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-[11px]">
                    <span className="text-slate-600">وضعیت Notification API مرورگر:</span>
                    <span
                      className={`font-bold ${
                        isPushActive
                          ? 'text-emerald-700'
                          : browserPermission === 'denied'
                          ? 'text-rose-700'
                          : 'text-amber-700'
                      }`}
                    >
                      {isPushActive
                        ? 'متصل به ویندوز (Granted)'
                        : browserPermission === 'denied'
                        ? 'مسدود در مرورگر (Denied)'
                        : 'نیازمند تایید مجوز'}
                    </span>
                  </div>

                  {/* Notification Items List */}
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {visibleNotifications.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-500">
                        هنوز رویداد یا اعلانی برای کارتابل شما ثبت نشده است.
                      </div>
                    ) : (
                      visibleNotifications.slice(0, 25).map((notif) => {
                        const isRead = notif.readByUserIds.includes(currentUser.id);
                        const meta = getNotificationEventMeta(notif.eventType);
                        return (
                          <div
                            key={notif.id}
                            onClick={() => {
                              setActiveSection(notif.targetSection);
                              if (!isRead) {
                                handleMarkNotificationRead(notif.id);
                              }
                              setShowNotifDropdown(false);
                            }}
                            className={`p-3 text-right transition cursor-pointer hover:bg-slate-50 ${
                              isRead ? 'bg-white opacity-80' : 'bg-blue-50/40'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded border ${meta.badgeClass}`}
                              >
                                {meta.label}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-slate-400 font-mono-num">
                                  {notif.createdAt}
                                </span>
                                {!isRead && (
                                  <span
                                    className="w-2 h-2 rounded-full bg-blue-600"
                                    title="خوانده‌نشده"
                                  />
                                )}
                              </div>
                            </div>
                            <div className="text-xs font-bold text-slate-900">{notif.title}</div>
                            <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                              {notif.body}
                            </p>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Direct Top-Bar Logout Button */}
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition cursor-pointer"
              title="خروج امن از حساب کاربری (Alt+L)"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">خروج</span>
            </button>
          </div>
        </header>

        {/* Main Viewport Content - 100% Full Screen without horizontal scroll */}
        <main className="flex-1 w-full max-w-none px-3 sm:px-5 py-4 space-y-5 overflow-x-hidden">
          {/* Toast Notification Banner */}
          {toastMessage && (
            <div
              role="status"
              aria-live="polite"
              className="bg-slate-900 text-white px-4 py-3 rounded-xl flex items-center justify-between text-xs font-medium shadow-sm"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{toastMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setToastMessage(null)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* 1. ADMIN PANEL */}
          {activeSection === 'ADMIN_PANEL' && canAccessAdmin && (
              <AdminPortalView
                currentUser={currentUser}
                activeSubTab={adminSubTab}
                users={dbState.users}
                roleConfigs={dbState.roleConfigs || []}
                securityAuditLogs={dbState.securityAuditLogs || []}
                passwordRecoveryRequests={dbState.passwordRecoveryRequests || []}
                companies={dbState.companies || []}
                departments={dbState.departments || []}
                costCenters={dbState.costCenters || []}
                smsConfig={dbState.smsConfig}
                smsLogs={dbState.smsLogs || []}
                searchInputRef={searchInputRef}
                onSaveUser={handleSaveUser}
                onResetUserPassword={handleResetUserPassword}
                onToggleUserStatus={handleToggleUserStatus}
                onSaveRoleConfig={handleSaveRoleConfig}
                onDeleteRoleConfig={handleDeleteRoleConfig}
                onResetRoleDefaults={handleResetRoleDefaults}
                onSaveCompany={handleSaveCompany}
                masterDataCodeSequences={dbState.masterDataCodeSequences}
                onBulkCreateMasterData={handleBulkCreateMasterData}
                onToggleCompanyStatus={handleToggleCompanyStatus}
                onDeleteCompany={handleDeleteCompany}
                onSaveDepartment={handleSaveDepartment}
                onToggleDepartmentStatus={handleToggleDepartmentStatus}
                onDeleteDepartment={handleDeleteDepartment}
                onSaveCostCenter={handleSaveCostCenter}
                onToggleCostCenterStatus={handleToggleCostCenterStatus}
                onDeleteCostCenter={handleDeleteCostCenter}
                onSaveSmsConfig={handleSaveSmsConfig}
                onTestSmsDispatch={handleTestSmsDispatch}
              />
            )}

          {/* 1b. SETTINGS VIEW (Accessible to ALL Roles with role-specific sections) */}
          {activeSection === 'SETTINGS' && (
            <SettingsView
              currentUser={currentUser}
              onChangePassword={handleChangePassword}
              onSavePreferences={handleSavePreferences}
              onRevokeOtherSessions={handleRevokeOtherSessions}
              onNavigateToAdminPanel={
                canAccessAdmin || Boolean(currentUser.effectivePermissions?.canManageUsers)
                  ? () => setActiveSection('ADMIN_PANEL')
                  : undefined
              }
            />
          )}

          {/* 2. REQUESTER WORKSPACE */}
          {activeSection === 'REQUESTER' && (
            <EmployeeRequestsView
              currentUser={currentUser}
              advanceRequests={dbState.advanceRequests}
              paymentRequests={dbState.paymentRequests}
              batchPayments={dbState.batchPayments}
              receiptArchives={dbState.receiptArchives}
              costCenters={dbState.costCenters || []}
              searchInputRef={searchInputRef}
              initialFormTab={requesterFormTab}
              initialStatusFilter={requesterStatusFilter}
              onSubmitAdvance={handleSubmitAdvance}
              onSubmitPayment={handleSubmitPayment}
              onSubmitBatchPayment={handleSubmitBatchPayment}
              onResubmitRequest={handleResubmitRequest}
              onEditSubmittedRequest={handleEditSubmittedRequest}
              onOpenReceiptModal={(rcp) => setActiveReceiptModal(rcp)}
            />
          )}

          {/* 3. APPROVER WORKSPACE */}
          {activeSection === 'APPROVER' && canAccessApprover && (
            <ApprovalsWorkspaceView
              mode="APPROVER"
              currentUser={currentUser}
              advanceRequests={dbState.advanceRequests}
              paymentRequests={dbState.paymentRequests}
              batchPayments={dbState.batchPayments}
              searchInputRef={searchInputRef}
              initialCategoryTab={approvalCategoryTab}
              onCategoryTabChange={(tab) => setApprovalCategoryTab(tab)}
              onRowReviewAction={handleRowReviewAction}
              onBulkReviewAction={handleBulkReviewAction}
            />
          )}

          {/* 4. ACCOUNTING WORKSPACE */}
          {activeSection === 'ACCOUNTING' && canAccessAccounting && (
            currentPerms.canViewRequests ? (
            <ApprovalsWorkspaceView
              mode="ACCOUNTING"
              currentUser={currentUser}
              advanceRequests={dbState.advanceRequests}
              paymentRequests={dbState.paymentRequests}
              batchPayments={dbState.batchPayments}
              searchInputRef={searchInputRef}
              initialCategoryTab={approvalCategoryTab}
              onCategoryTabChange={(tab) => setApprovalCategoryTab(tab)}
              onRowReviewAction={handleRowReviewAction}
              onBulkReviewAction={handleBulkReviewAction}
            />
            ) : (
              <div role="alert" className="p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 text-sm leading-relaxed">
                منوی حسابداری فعال است، اما مجوز مشاهده درخواست‌ها برای حساب شما غیرفعال است.
                مدیر سامانه باید در «مدیریت دسترسی‌ها و تنظیمات پیش‌فرض»، بخش «منوی بررسی مالی و مجوزهای مشترک تأیید»، گزینهٔ «مشاهده درخواست‌ها در کارتابل‌های مجاز» را بررسی و فعال کند.
                تا آن زمان اطلاعات مالی نمایش داده نمی‌شود.
              </div>
            )
          )}

          {/* 5. TREASURY WORKSPACE */}
          {activeSection === 'TREASURY' && canAccessTreasury && (
            <TreasuryWorkspaceView
              currentUser={currentUser}
              advanceRequests={dbState.advanceRequests}
              paymentRequests={dbState.paymentRequests}
              batchPayments={dbState.batchPayments}
              manualPayments={dbState.manualPayments}
              dailyCovers={dbState.dailyCovers}
              receiptArchives={dbState.receiptArchives}
              companyBankAccounts={dbState.companyBankAccounts || []}
              searchInputRef={searchInputRef}
              initialSubTab={treasurySubTab}
              onMoveTreasuryPool={handleMoveTreasuryPool}
              onExecutePayment={handleExecutePayment}
              onRefreshState={fetchState}
              onCreateManualPayment={handleCreateManualPayment}
              onCloseDailyCover={handleCloseDailyCover}
              onSaveBankAccount={handleSaveBankAccount}
                onImportBankAccounts={handleImportBankAccounts}
              onToggleBankAccountStatus={handleToggleBankAccountStatus}
              onSetDefaultBankAccount={handleSetDefaultBankAccount}
              onOpenReceiptModal={(rcp) => setActiveReceiptModal(rcp)}
              onShowToast={showToast}
            />
          )}
        </main>
      </div>

      {/* Receipt Modal */}
      {activeReceiptModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white border border-slate-200 rounded-xl max-w-xl w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 text-sm">
                رسید تراکنش بانکی — مرجع: {activeReceiptModal.bankRefNumber}
              </h3>
              <button
                type="button"
                onClick={() => setActiveReceiptModal(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-center">
              <img
                src={activeReceiptModal.fileUrl}
                alt="رسید بانکی"
                className="max-h-72 w-auto object-contain rounded"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div>
                <span className="text-slate-500 block">مبلغ:</span>
                <strong className="font-mono-num text-slate-900">{formatRial(activeReceiptModal.amount)} ریال</strong>
              </div>
              <div>
                <span className="text-slate-500 block">بانک و حساب مبدأ پرداخت:</span>
                <strong className="text-slate-900">
                  {activeReceiptModal.sourceAccountSnapshot?.bankName || activeReceiptModal.bankName}
                  {activeReceiptModal.sourceAccountSnapshot?.accountTitle
                    ? ` — ${activeReceiptModal.sourceAccountSnapshot.accountTitle}`
                    : ''}
                </strong>
                {activeReceiptModal.sourceAccountSnapshot?.accountNumber && (
                  <span className="block text-[11px] font-mono-num text-slate-600 mt-0.5">
                    شماره حساب مبدأ: {activeReceiptModal.sourceAccountSnapshot.accountNumber}
                  </span>
                )}
                {activeReceiptModal.sourceAccountSnapshot?.iban && (
                  <span className="block text-[10px] font-mono-num text-slate-500" dir="ltr">
                    {activeReceiptModal.sourceAccountSnapshot.iban}
                  </span>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3.5 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 inline ml-1" />
                <span>چاپ</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveReceiptModal(null)}
                className="px-4 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded-lg cursor-pointer"
              >
                بستن (Esc)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Modal */}
      {showKeyboardHelp && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-5 space-y-3 shadow-xl text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 text-sm">راهنمای کلیدهای میانبر کیبورد</h3>
              <button
                type="button"
                onClick={() => setShowKeyboardHelp(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span>فوکوس فوری روی جستجو</span>
                <kbd className="px-2 py-0.5 bg-slate-100 border border-slate-300 rounded font-mono">/ یا Ctrl+K</kbd>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span>ثبت درخواست</span>
                <kbd className="px-2 py-0.5 bg-slate-100 border border-slate-300 rounded font-mono">Alt + 1</kbd>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span>کارتابل تایید سرپرست</span>
                <kbd className="px-2 py-0.5 bg-slate-100 border border-slate-300 rounded font-mono">Alt + 2</kbd>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span>بررسی حسابداری</span>
                <kbd className="px-2 py-0.5 bg-slate-100 border border-slate-300 rounded font-mono">Alt + 3</kbd>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span>خزانه‌داری</span>
                <kbd className="px-2 py-0.5 bg-slate-100 border border-slate-300 rounded font-mono">Alt + 4</kbd>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span>مدیریت ادمین</span>
                <kbd className="px-2 py-0.5 bg-slate-100 border border-slate-300 rounded font-mono">Alt + 5</kbd>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span>خروج از حساب</span>
                <kbd className="px-2 py-0.5 bg-slate-100 border border-slate-300 rounded font-mono">Alt + L</kbd>
              </div>
              <div className="flex justify-between py-1">
                <span>بستن پنجره‌ها / پاک کردن جستجو</span>
                <kbd className="px-2 py-0.5 bg-slate-100 border border-slate-300 rounded font-mono">Escape</kbd>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowKeyboardHelp(false)}
                className="px-3.5 py-1.5 bg-slate-900 text-white rounded-lg cursor-pointer"
              >
                متوجه شدم
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </React.Suspense>
  );
}
