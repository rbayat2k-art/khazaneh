import React, { useState } from 'react';
import {
  User as UserIcon,
  Shield,
  Lock,
  Bell,
  Sliders,
  Save,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  LogOut,
  Building2,
  Users,
} from 'lucide-react';
import type {
  User,
  UserPersonalPreferences,
  RolePermissionSet,
} from '../types/treasury';
import { getRoleLabel, formatRial } from '../utils/sorting';
import { getAccessScopeLabel } from './AdminPortalView';

interface SettingsViewProps {
  currentUser: User;
  onChangePassword: (payload: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  onSavePreferences: (payload: {
    preferences: UserPersonalPreferences;
    twoFactorEnabled?: boolean;
    twoFactorPin?: string;
    currentPassword?: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  onRevokeOtherSessions: () => Promise<{ ok: boolean; revokedCount?: number; error?: string }>;
  onNavigateToAdminPanel?: () => void;
}

const PERMISSION_LABELS: Array<{ key: keyof RolePermissionSet; label: string }> = [
  { key: 'canViewRequests', label: 'مشاهده درخواست' },
  { key: 'canCreateRequest', label: 'ثبت درخواست' },
  { key: 'canEditAmount', label: 'ویرایش مبلغ' },
  { key: 'canApprove', label: 'تأیید' },
  { key: 'canReturnForRevision', label: 'برگشت برای اصلاح' },
  { key: 'canExecutePayment', label: 'ثبت پرداخت' },
  { key: 'canViewAttachments', label: 'مشاهده مدارک' },
  { key: 'canExportReports', label: 'گزارش و خروجی' },
  { key: 'canManageUsers', label: 'مدیریت کاربران' },
];

export const SettingsView: React.FC<SettingsViewProps> = ({
  currentUser,
  onChangePassword,
  onSavePreferences,
  onRevokeOtherSessions,
  onNavigateToAdminPanel,
}) => {
  // Password Change Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [passLoading, setPassLoading] = useState(false);
  const [passError, setPassError] = useState<string | null>(null);
  const [passSuccess, setPassSuccess] = useState<string | null>(null);

  // Preferences State
  const prefs = currentUser.preferences || {};
  const [defaultSection, setDefaultSection] = useState<
    'REQUESTER' | 'APPROVER' | 'ACCOUNTING' | 'TREASURY' | 'ADMIN_PANEL' | 'SETTINGS'
  >(
    prefs.defaultSection ||
      (currentUser.role === 'ADMIN'
        ? 'ADMIN_PANEL'
        : currentUser.role === 'APPROVER'
        ? 'APPROVER'
        : currentUser.role === 'ACCOUNTING'
        ? 'ACCOUNTING'
        : currentUser.role === 'TREASURY'
        ? 'TREASURY'
        : 'REQUESTER')
  );
  const [tablePageSize, setTablePageSize] = useState<number>(prefs.tablePageSize || 20);
  const [notifyOnSubmit, setNotifyOnSubmit] = useState<boolean>(prefs.notifyOnSubmit !== false);
  const [notifyOnRevision, setNotifyOnRevision] = useState<boolean>(prefs.notifyOnRevision !== false);
  const [notifyOnApproval, setNotifyOnApproval] = useState<boolean>(prefs.notifyOnApproval !== false);
  const [notifyOnPayment, setNotifyOnPayment] = useState<boolean>(prefs.notifyOnPayment !== false);
  const [prefLoading, setPrefLoading] = useState(false);
  const [prefError, setPrefError] = useState<string | null>(null);
  const [prefSuccess, setPrefSuccess] = useState<string | null>(null);

  // 2FA State for Financial Roles
  const [twoFactorEnabled, setTwoFactorEnabled] = useState<boolean>(
    Boolean(currentUser.twoFactorEnabled)
  );
  const [twoFactorPin, setTwoFactorPin] = useState('');
  const [twoFactorCurrentPass, setTwoFactorCurrentPass] = useState('');
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);
  const [twoFactorError, setTwoFactorError] = useState<string | null>(null);
  const [twoFactorSuccess, setTwoFactorSuccess] = useState<string | null>(null);

  // Session Revoke State
  const [revokingSessions, setRevokingSessions] = useState(false);

  const isFinancialRole =
    currentUser.role === 'APPROVER' ||
    currentUser.role === 'ACCOUNTING' ||
    currentUser.role === 'TREASURY';

  const allowedSectionOptions = [
    { value: 'REQUESTER', label: 'کارتابل متقاضی (درخواست‌های من)', show: true },
    {
      value: 'APPROVER',
      label: 'کارتابل بررسی و تأیید سرپرست',
      show: currentUser.role === 'APPROVER' || currentUser.role === 'ADMIN',
    },
    {
      value: 'ACCOUNTING',
      label: 'کارتابل کنترل مالی و حسابداری',
      show: currentUser.role === 'ACCOUNTING' || currentUser.role === 'ADMIN',
    },
    {
      value: 'TREASURY',
      label: 'میز کار خزانه‌داری و پرداخت',
      show: currentUser.role === 'TREASURY' || currentUser.role === 'ADMIN',
    },
    {
      value: 'ADMIN_PANEL',
      label: 'مدیریت کاربران و دسترسی‌ها',
      show: currentUser.role === 'ADMIN' || Boolean(currentUser.effectivePermissions?.canManageUsers),
    },
  ].filter((opt) => opt.show);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError(null);
    setPassSuccess(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPassError('وارد کردن رمز عبور فعلی، رمز جدید و تکرار آن الزامی است.');
      return;
    }
    if (newPassword.length < 5) {
      setPassError('رمز عبور جدید باید حداقل ۵ کاراکتر باشد.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPassError('رمز عبور جدید و تکرار آن یکسان نیستند.');
      return;
    }

    setPassLoading(true);
    try {
      const res = await onChangePassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });
      if (!res.ok) {
        setPassError(res.error || 'خطا در تغییر رمز عبور');
        return;
      }
      setPassSuccess('رمز عبور شما با موفقیت تغییر یافت و سایر نشست‌های قبلی بسته شدند.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } finally {
      setPassLoading(false);
    }
  };

  const handleSavePrefsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPrefError(null);
    setPrefSuccess(null);
    setPrefLoading(true);
    try {
      const res = await onSavePreferences({
        preferences: {
          defaultSection,
          tablePageSize,
          notifyOnSubmit,
          notifyOnRevision,
          notifyOnApproval,
          notifyOnPayment,
        },
      });
      if (!res.ok) {
        setPrefError(res.error || 'خطا در ذخیره تنظیمات کارتابل');
        return;
      }
      setPrefSuccess('تنظیمات کارتابل و اعلان‌های نقش شما در سرور ذخیره شد.');
    } finally {
      setPrefLoading(false);
    }
  };

  const handleSave2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setTwoFactorError(null);
    setTwoFactorSuccess(null);
    if (!twoFactorCurrentPass) {
      setTwoFactorError('وارد کردن رمز عبور فعلی برای تغییر وضعیت احراز هویت دومرحله‌ای الزامی است.');
      return;
    }
    if (twoFactorEnabled && !/^\d{6}$/.test(twoFactorPin.trim()) && !currentUser.twoFactorEnabled) {
      setTwoFactorError('لطفاً یک کد پین امنیتی ۶ رقمی عددی تعیین کنید.');
      return;
    }

    setTwoFactorLoading(true);
    try {
      const res = await onSavePreferences({
        preferences: currentUser.preferences || {},
        twoFactorEnabled,
        twoFactorPin: twoFactorPin.trim() || undefined,
        currentPassword: twoFactorCurrentPass,
      });
      if (!res.ok) {
        setTwoFactorError(res.error || 'خطا در ذخیره تنظیمات احراز هویت دومرحله‌ای');
        return;
      }
      setTwoFactorSuccess(
        twoFactorEnabled
          ? 'احراز هویت دومرحله‌ای برای حساب شما فعال شد.'
          : 'احراز هویت دومرحله‌ای غیرفعال شد.'
      );
      setTwoFactorPin('');
      setTwoFactorCurrentPass('');
    } finally {
      setTwoFactorLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. User Identity, Role Scope & Effective Permissions Summary */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 font-bold text-base">
              <UserIcon className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">{currentUser.name}</h2>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1">
                <span>کد پرسنلی: <strong className="font-mono-num text-slate-800">{currentUser.personnelCode}</strong></span>
                <span>•</span>
                <span>واحد: <strong className="text-slate-800">{currentUser.department}</strong></span>
                <span>•</span>
                <span>شرکت: <strong className="text-slate-800">{currentUser.company || 'هلدینگ مرکزی آریا'}</strong></span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:items-end gap-1">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-900 text-white text-xs font-bold">
              <Shield className="w-3.5 h-3.5 text-blue-400" />
              <span>{getRoleLabel(currentUser.role)}</span>
            </span>
            <span className="text-[11px] text-slate-500">
              محدوده دسترسی: <strong>{getAccessScopeLabel(currentUser.effectiveAccessScope || currentUser.accessScope)}</strong>
            </span>
          </div>
        </div>

        {/* Role-specific Organizational & Financial Authority Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-[11px] text-slate-500 block">سرپرست مستقیم ثبت‌شده در پرونده:</span>
            <strong className="text-xs text-slate-900 mt-1 block">
              {currentUser.supervisorName || 'بدون سرپرست مستقیم (ارشد)'}
            </strong>
          </div>

          {(currentUser.role === 'APPROVER' || currentUser.role === 'ACCOUNTING') && (
            <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-xl">
              <span className="text-[11px] text-emerald-800 block">سقف مجاز تأیید مالی شما:</span>
              <strong className="text-xs font-mono-num text-emerald-950 mt-1 block">
                {formatRial(currentUser.effectiveApprovalLimitRial || 0)} ریال
              </strong>
            </div>
          )}

          {currentUser.role === 'TREASURY' && (
            <div className="p-3.5 bg-blue-50/60 border border-blue-200 rounded-xl">
              <span className="text-[11px] text-blue-800 block">سقف مجاز اجرای پرداخت خزانه:</span>
              <strong className="text-xs font-mono-num text-blue-950 mt-1 block">
                {formatRial(currentUser.effectivePaymentLimitRial || 0)} ریال
              </strong>
            </div>
          )}

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-[11px] text-slate-500 block">شماره همراه ثبت‌شده (جهت بازیابی دسترسی):</span>
            <strong className="text-xs font-mono-num text-slate-900 mt-1 block">
              {currentUser.phone || 'ثبت نشده'}
            </strong>
          </div>
        </div>

        {/* Effective Permissions Badges */}
        <div>
          <div className="text-xs font-bold text-slate-700 mb-2">
            مجوزهای عملیاتی فعال برای نقش شما:
          </div>
          <div className="flex flex-wrap gap-2">
            {PERMISSION_LABELS.map((item) => {
              const allowed = Boolean(currentUser.effectivePermissions?.[item.key]);
              return (
                <span
                  key={item.key}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border flex items-center gap-1.5 ${
                    allowed
                      ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                      : 'bg-slate-100 text-slate-400 border-slate-200 line-through'
                  }`}
                >
                  {allowed && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                  <span>{item.label}</span>
                </span>
              );
            })}
          </div>
        </div>

        {/* Admin Quick Link to Full User & Role Management */}
        {(currentUser.role === 'ADMIN' || currentUser.effectivePermissions?.canManageUsers) &&
          onNavigateToAdminPanel && (
            <div className="p-4 bg-slate-900 text-white rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-blue-400" />
                  <span>مدیریت کاربران، نقش‌ها، سقف‌های مالی و درخواست‌های بازیابی رمز</span>
                </div>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  به عنوان مدیر سامانه می‌توانید از بخش مدیریت کاربران، دسترسی‌های هر نقش و حساب‌های کاربری را ویرایش کنید.
                </p>
              </div>
              <button
                type="button"
                onClick={onNavigateToAdminPanel}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold shrink-0 cursor-pointer"
              >
                ورود به پنل مدیریت کاربران و نقش‌ها
              </button>
            </div>
          )}
      </div>

      {/* 2. Role-Specific Workspace & Notification Preferences + Password & Security */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Role-Specific Workspace & Notification Settings (6 cols) */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
            <Sliders className="w-4 h-4 text-blue-700" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                تنظیمات کارتابل و اعلان‌های ویژه نقش «{getRoleLabel(currentUser.role)}»
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                این ترجیحات در سرور ذخیره شده و در تمامی دستگاه‌های شما اعمال می‌گردد.
              </p>
            </div>
          </div>

          {prefError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{prefError}</span>
            </div>
          )}
          {prefSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{prefSuccess}</span>
            </div>
          )}

          <form onSubmit={handleSavePrefsSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  صفحه پیش‌فرض پس از ورود به سامانه
                </label>
                <select
                  value={defaultSection}
                  onChange={(e) => setDefaultSection(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                >
                  {allowedSectionOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  تعداد ردیف پیش‌فرض در جدول‌های کارتابل
                </label>
                <select
                  value={tablePageSize}
                  onChange={(e) => setTablePageSize(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-mono-num"
                >
                  <option value={10}>۱۰ ردیف در هر صفحه</option>
                  <option value={20}>۲۰ ردیف در هر صفحه</option>
                  <option value={50}>۵۰ ردیف در هر صفحه</option>
                  <option value={100}>۱۰۰ ردیف در هر صفحه</option>
                </select>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Bell className="w-4 h-4 text-blue-700" />
                <span>تنظیمات دریافت اعلان‌های مرتبط با نقش شما:</span>
              </div>

              {/* Requester relevant notifications */}
              {currentUser.role === 'REQUESTER' && (
                <>
                  <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifyOnRevision}
                      onChange={(e) => setNotifyOnRevision(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600"
                    />
                    <span>دریافت اعلان هنگام برگشت درخواست برای اصلاح (توسط سرپرست یا حسابداری)</span>
                  </label>
                  <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifyOnApproval}
                      onChange={(e) => setNotifyOnApproval(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600"
                    />
                    <span>دریافت اعلان هنگام تأیید مراحل سرپرست و حسابداری یا اصلاح مبلغ مصوب</span>
                  </label>
                  <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifyOnPayment}
                      onChange={(e) => setNotifyOnPayment(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600"
                    />
                    <span>دریافت اعلان هنگام ثبت پرداخت قطعی و صدور فیش بانکی در خزانه</span>
                  </label>
                </>
              )}

              {/* Approver relevant notifications */}
              {currentUser.role === 'APPROVER' && (
                <>
                  <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifyOnSubmit}
                      onChange={(e) => setNotifyOnSubmit(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600"
                    />
                    <span>دریافت اعلان ثبت درخواست‌های جدید کارکنان تحت سرپرستی (منتظر بررسی سرپرست)</span>
                  </label>
                  <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifyOnRevision}
                      onChange={(e) => setNotifyOnRevision(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600"
                    />
                    <span>دریافت اعلان ارسال مجدد درخواست‌های اصلاح‌شده توسط متقاضیان</span>
                  </label>
                </>
              )}

              {/* Accounting relevant notifications */}
              {currentUser.role === 'ACCOUNTING' && (
                <>
                  <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifyOnApproval}
                      onChange={(e) => setNotifyOnApproval(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600"
                    />
                    <span>دریافت اعلان درخواست‌های تأییدشده توسط سرپرست واحد (ورود به کارتابل حسابداری)</span>
                  </label>
                  <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifyOnRevision}
                      onChange={(e) => setNotifyOnRevision(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600"
                    />
                    <span>دریافت اعلان موارد برگشتی و اصلاحیه مبالغ مصوب</span>
                  </label>
                </>
              )}

              {/* Treasury relevant notifications */}
              {currentUser.role === 'TREASURY' && (
                <>
                  <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifyOnApproval}
                      onChange={(e) => setNotifyOnApproval(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600"
                    />
                    <span>دریافت اعلان درخواست‌های تأیید نهایی‌شده حسابداری (ورود به صف پرداخت خزانه)</span>
                  </label>
                  <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifyOnPayment}
                      onChange={(e) => setNotifyOnPayment(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600"
                    />
                    <span>دریافت اعلان ثبت فیش‌های پرداخت و بستن روکش روزانه</span>
                  </label>
                </>
              )}

              {currentUser.role === 'ADMIN' && (
                <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifyOnSubmit}
                    onChange={(e) => setNotifyOnSubmit(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600"
                  />
                  <span>دریافت اعلان رویدادهای مدیریتی و درخواست‌های بازیابی رمز عبور کاربران</span>
                </label>
              )}
            </div>

            <button
              type="submit"
              disabled={prefLoading}
              className="w-full py-2.5 px-4 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{prefLoading ? 'در حال ذخیره...' : 'ذخیره تنظیمات کارتابل و اعلان‌ها'}</span>
            </button>
          </form>
        </div>

        {/* Password Change, 2FA & Session Management (6 cols) */}
        <div className="lg:col-span-6 space-y-6">
          {/* Change Password Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-slate-800" />
                <h3 className="text-sm font-bold text-slate-900">تغییر رمز عبور حساب کاربری</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPass((p) => !p)}
                className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
              >
                {showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{showPass ? 'پنهان کردن رمزها' : 'نمایش رمزها هنگام تایپ'}</span>
              </button>
            </div>

            {passError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{passError}</span>
              </div>
            )}
            {passSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{passSuccess}</span>
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  رمز عبور فعلی <span className="text-rose-600">*</span>
                </label>
                <input
                  type={showPass ? 'text' : 'password'}
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-mono-num"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    رمز عبور جدید (حداقل ۵ کاراکتر) <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type={showPass ? 'text' : 'password'}
                    required
                    minLength={5}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-mono-num"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    تکرار رمز عبور جدید <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type={showPass ? 'text' : 'password'}
                    required
                    minLength={5}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-mono-num"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={passLoading}
                className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <KeyRound className="w-4 h-4" />
                <span>{passLoading ? 'در حال تغییر رمز...' : 'ثبت رمز عبور جدید'}</span>
              </button>
            </form>

            {/* Active Sessions Control */}
            <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
              <span className="text-[11px] text-slate-600">
                پایان دادن به سایر نشست‌های باز این حساب در مرورگرها یا دستگاه‌های دیگر:
              </span>
              <button
                type="button"
                disabled={revokingSessions}
                onClick={async () => {
                  setRevokingSessions(true);
                  try {
                    await onRevokeOtherSessions();
                  } finally {
                    setRevokingSessions(false);
                  }
                }}
                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-lg text-[11px] font-bold shrink-0 cursor-pointer flex items-center gap-1"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>خاتمه سایر نشست‌ها</span>
              </button>
            </div>
          </div>

          {/* 2FA Card for Sensitive Financial Roles */}
          {isFinancialRole && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <div className="border-b border-slate-200 pb-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-700" />
                  <span>احراز هویت دومرحله‌ای (ویژه نقش‌های حساس مالی)</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  با فعال‌سازی این گزینه، هنگام ورود علاوه بر رمز عبور، کد پین امنیتی ۶ رقمی شما نیز درخواست می‌شود.
                </p>
              </div>

              {twoFactorError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
                  {twoFactorError}
                </div>
              )}
              {twoFactorSuccess && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800">
                  {twoFactorSuccess}
                </div>
              )}

              <form onSubmit={handleSave2FA} className="space-y-3">
                <label className="flex items-center gap-2.5 text-xs font-bold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={twoFactorEnabled}
                    onChange={(e) => setTwoFactorEnabled(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-600"
                  />
                  <span>فعال‌سازی ورود دومرحله‌ای برای حساب کاربری من</span>
                </label>

                {twoFactorEnabled && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      کد پین امنیتی ۶ رقمی جدید
                    </label>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      value={twoFactorPin}
                      onChange={(e) => setTwoFactorPin(e.target.value.replace(/\D/g, ''))}
                      placeholder="۶ رقم عددی (مثال: 482910)"
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-mono-num"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    رمز عبور فعلی جهت تأیید تغییر <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    value={twoFactorCurrentPass}
                    onChange={(e) => setTwoFactorCurrentPass(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-mono-num"
                  />
                </div>

                <button
                  type="submit"
                  disabled={twoFactorLoading}
                  className="w-full py-2 px-4 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  {twoFactorLoading ? 'در حال ثبت...' : 'ذخیره تنظیمات احراز هویت دومرحله‌ای'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
