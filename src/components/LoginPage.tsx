import React, { useState, useRef } from 'react';
import {
  Lock,
  User as UserIcon,
  LogIn,
  AlertCircle,
  ShieldCheck,
  Eye,
  EyeOff,
  KeyRound,
  HelpCircle,
  CheckCircle2,
  ArrowRight,
  Phone,
  FileText,
  Smartphone,
  MessageSquare,
  Building2,
  Layers,
  FileSpreadsheet,
  ArrowUpLeft,
  ChevronLeft,
} from 'lucide-react';
import type { User } from '../types/treasury';

interface LoginPageProps {
  onLoginSuccess: (payload: {
    user: User;
    token: string;
    expiresAt: number;
    mustChangePassword: boolean;
  }) => void;
}

interface QuickRoleAccount {
  id: string;
  roleTitle: string;
  personName: string;
  personnelCode: string;
  password: string;
  scopeSummary: string;
}

const QUICK_ROLE_ACCOUNTS: QuickRoleAccount[] = import.meta.env.DEV ? [
  {
    id: 'admin',
    roleTitle: 'ادمین پرتال (مدیریت کل)',
    personName: 'مدیر کل پرتال',
    personnelCode: 'admin',
    password: 'admin',
    scopeSummary: 'دسترسی کامل به تمام فرم‌ها، کارتابل‌ها، خزانه و نقش‌ها',
  },
  {
    id: 'approver',
    roleTitle: 'سرپرست واحد (تأییدکننده)',
    personName: 'دکتر بهرام رستگاری',
    personnelCode: '2011',
    password: '123',
    scopeSummary: 'بررسی و تأیید ردیف‌به‌ردیف، تعدیل مبلغ و ثبت دستور گروهی',
  },
  {
    id: 'accounting',
    roleTitle: 'حسابداری و کنترل مالی',
    personName: 'مهدی سلیمانی',
    personnelCode: '3004',
    password: '123',
    scopeSummary: 'ممیزی اسناد مثبته، کنترل مراکز هزینه و تأیید نهایی مالی',
  },
  {
    id: 'treasury',
    roleTitle: 'خزانه‌داری و اجرای پرداخت',
    personName: 'کیوان فرهمند',
    personnelCode: '4001',
    password: '123',
    scopeSummary: 'صف پرداخت، حساب‌های مبدأ، خروجی اکسل پایا/ساتنا و روکش روزانه',
  },
  {
    id: 'requester',
    roleTitle: 'متقاضی (کارشناس واحد)',
    personName: 'مهندس آرش کاظمی',
    personnelCode: '1042',
    password: '123',
    scopeSummary: 'ثبت دستور پرداخت و مساعده، پیگیری مراحل و اصلاح برگشتی‌ها',
  },
] : [];

const WORKFLOW_STAGES = [
  {
    step: '01',
    title: 'ثبت درخواست پرداخت و مساعده (تکی و تجمیعی)',
    actor: 'واحد متقاضی و سرپرستان بخش‌ها',
    mechanism:
      'ثبت مشخصات ذینفع، شماره شبا و کارت با حفظ صفرهای ابتدایی، تخصیص مرکز هزینه و بارگذاری فاکتور یا مستندات در قالب فرم‌های تکی یا جدول تجمیعی تمام‌صفحه.',
    outcome: 'حذف کامل فرم‌های کاغذی و ثبت کد رهگیری یکتا برای هر ردیف پرداخت از لحظه ایجاد.',
  },
  {
    step: '02',
    title: 'بررسی و تأیید مستقل ردیف‌به‌ردیف سرپرست واحد',
    actor: 'مدیران و سرپرستان واحدهای سازمانی',
    mechanism:
      'بررسی هر ردیف در لیست‌های گروهی به‌صورت کاملاً مستقل؛ امکان تأیید مستقیم، ویرایش مبلغ مصوب با درج دلیل یا برگشت ردیف جهت اصلاح بدون توقف سایر ردیف‌های لیست.',
    outcome: 'جلوگیری از توقف کل لیست پرداخت به خاطر نقص مدارک یک ردیف و ثبت نسخه جدید پس از اصلاح.',
  },
  {
    step: '03',
    title: 'ممیزی اسناد، کنترل بودجه و تأیید حسابداری',
    actor: 'واحد مالی و حسابداری',
    mechanism:
      'انطباق فاکتور با سامانه مودیان، کنترل سقف بودجه مرکز هزینه، بررسی کسورات قانونی و تأیید نهایی مالی پیش از ارسال خودکار به صف خزانه‌داری.',
    outcome: 'تضمین صحت حسابداری و انطباق ۱۰۰٪ پرداخت‌ها با سقف مجوزهای مالی شرکت.',
  },
  {
    step: '04',
    title: 'اجرای پرداخت بانکی، ثبت فیش و روکش روزانه خزانه',
    actor: 'واحد خزانه‌داری و بانک',
    mechanism:
      'انتقال به مخزن در حال پرداخت، تهیه خروجی اکسل استاندارد بانکی، انتخاب حساب مبدأ شرکت، ثبت پرداخت کامل یا مرحله‌ای به همراه فیش و بستن روکش روزانه.',
    outcome: 'ثبت تصویر ثابت حساب بانکی مبدأ روی هر تراکنش و بایگانی خودکار فیش‌ها در پوشه روز پرداخت.',
  },
];

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [mode, setMode] = useState<'LOGIN' | 'RECOVERY'>('LOGIN');
  const [recoveryMethod, setRecoveryMethod] = useState<'SMS_OTP' | 'ADMIN_TICKET'>('SMS_OTP');
  const [activeWorkflowIdx, setActiveWorkflowIdx] = useState<number>(0);
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [showcaseImgFailed, setShowcaseImgFailed] = useState(false);

  const personnelInputRef = useRef<HTMLInputElement | null>(null);
  const loginCardRef = useRef<HTMLDivElement | null>(null);

  // Login State
  const [personnelCode, setPersonnelCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [twoFactorStep, setTwoFactorStep] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Recovery Request State
  const [recPersonnelCode, setRecPersonnelCode] = useState('');
  const [recPhone, setRecPhone] = useState('');
  const [recNote, setRecNote] = useState('');
  const [recOtpSent, setRecOtpSent] = useState(false);
  const [recOtpCode, setRecOtpCode] = useState('');
  const [recNewPassword, setRecNewPassword] = useState('');
  const [recConfirmPassword, setRecConfirmPassword] = useState('');
  const [recSmsUnavailable, setRecSmsUnavailable] = useState(false);
  const [recLoading, setRecLoading] = useState(false);
  const [recError, setRecError] = useState<string | null>(null);
  const [recSuccess, setRecSuccess] = useState<{ trackingCode?: string; message: string } | null>(
    null
  );

  const focusLoginForm = () => {
    setMode('LOGIN');
    loginCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => {
      personnelInputRef.current?.focus();
    }, 150);
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const executeLoginRequest = async (codeToUse: string, passToUse: string, twoFactorPin?: string) => {
    if (!codeToUse.trim() || !passToUse.trim()) {
      setError('لطفاً کد پرسنلی (نام کاربری) و رمز عبور خود را وارد نمایید.');
      return;
    }
    if (twoFactorStep && !twoFactorPin?.trim()) {
      setError('لطفاً کد پین امنیتی دومرحله‌ای ۶ رقمی را وارد نمایید.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personnelCode: codeToUse.trim(),
          password: passToUse,
          twoFactorCode: twoFactorStep ? twoFactorPin?.trim() : undefined,
        }),
      });
      const data = await res.json();

      if (res.ok && data.requiresTwoFactor) {
        setTwoFactorStep(true);
        setError(null);
        return;
      }

      if (!res.ok || !data.success) {
        setError(data.error || 'خطا در احراز هویت کاربر');
        return;
      }

      onLoginSuccess({
        user: data.user,
        token: data.token,
        expiresAt: data.expiresAt,
        mustChangePassword: Boolean(data.mustChangePassword),
      });
    } catch {
      setError('خطا در برقراری ارتباط با سرور احراز هویت');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeLoginRequest(personnelCode, password, twoFactorCode);
  };

  const handleQuickRoleSelect = (acc: QuickRoleAccount, autoSubmit: boolean) => {
    setMode('LOGIN');
    setTwoFactorStep(false);
    setTwoFactorCode('');
    setError(null);
    setPersonnelCode(acc.personnelCode);
    setPassword(acc.password);
    if (autoSubmit) {
      void executeLoginRequest(acc.personnelCode, acc.password);
    } else {
      focusLoginForm();
    }
  };

  const handleSendOtpRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recPersonnelCode.trim() || !recPhone.trim()) {
      setRecError('وارد کردن کد پرسنلی و شماره تلفن همراه ثبت‌شده در سامانه الزامی است.');
      return;
    }
    setRecLoading(true);
    setRecError(null);
    setRecSmsUnavailable(false);
    setRecSuccess(null);
    try {
      const res = await fetch('/api/auth/recovery-send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personnelCode: recPersonnelCode.trim(),
          phone: recPhone.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRecError(data.error || 'خطا در ارسال کد تأیید پیامکی.');
        if (data.smsUnavailable) {
          setRecSmsUnavailable(true);
        }
        return;
      }
      setRecOtpSent(true);
    } catch {
      setRecError('خطا در ارتباط با سرور جهت ارسال کد تأیید پیامکی.');
    } finally {
      setRecLoading(false);
    }
  };

  const handleVerifyOtpRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recOtpCode.trim() || !recNewPassword || !recConfirmPassword) {
      setRecError('لطفاً کد تأیید پیامکی، رمز عبور جدید و تکرار آن را وارد کنید.');
      return;
    }
    setRecLoading(true);
    setRecError(null);
    try {
      const res = await fetch('/api/auth/recovery-verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personnelCode: recPersonnelCode.trim(),
          phone: recPhone.trim(),
          otpCode: recOtpCode.trim(),
          newPassword: recNewPassword,
          confirmPassword: recConfirmPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRecError(data.error || 'خطا در تأیید کد پیامکی.');
        return;
      }
      setPersonnelCode(recPersonnelCode.trim());
      setPassword('');
      setRecOtpSent(false);
      setRecOtpCode('');
      setRecNewPassword('');
      setRecConfirmPassword('');
      setRecSuccess({
        message: data.message || 'رمز عبور شما با موفقیت تغییر یافت. اکنون می‌توانید وارد شوید.',
      });
    } catch {
      setRecError('خطا در ارتباط با سرور جهت تغییر رمز عبور.');
    } finally {
      setRecLoading(false);
    }
  };

  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recPersonnelCode.trim() || !recPhone.trim()) {
      setRecError('وارد کردن کد پرسنلی و شماره تلفن همراه ثبت‌شده در سامانه الزامی است.');
      return;
    }

    setRecLoading(true);
    setRecError(null);
    setRecSuccess(null);
    try {
      const res = await fetch('/api/auth/recovery-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personnelCode: recPersonnelCode.trim(),
          phone: recPhone.trim(),
          note: recNote.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setRecError(data.error || 'خطا در ثبت درخواست بازیابی دسترسی');
        return;
      }
      setRecSuccess({
        trackingCode: data.trackingCode,
        message: data.message,
      });
    } catch {
      setRecError('خطا در ارتباط با سرور جهت ثبت درخواست بازیابی');
    } finally {
      setRecLoading(false);
    }
  };

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* =====================================================================
          1. TOP BAR CONTRACT (Strict 3-Zone Corporate Header)
      ===================================================================== */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="w-full max-w-[1440px] mx-auto px-6 lg:px-10 min-h-16 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 lg:gap-8">
          {/* Zone 1: Single Text Element Wordmark */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="text-base sm:text-lg font-bold tracking-tight text-slate-950 whitespace-nowrap shrink-0"
          >
            سامانه جامع مالی و خزانه داری شاهراه
          </a>

          {/* Zone 2: 4 Single-Line Navigation Links */}
          <nav className="hidden xl:flex items-center gap-7 text-xs sm:text-sm font-medium text-slate-600">
            <button
              type="button"
              onClick={() => scrollToSection('portal-about')}
              className="hover:text-slate-950 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              معرفی سامانه
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('portal-workflow')}
              className="hover:text-slate-950 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              چرخه تایید و پرداخت
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('portal-capabilities')}
              className="hover:text-slate-950 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              امکانات خزانه‌داری
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('portal-guide')}
              className="hover:text-slate-950 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              راهنمای دسترسی
            </button>
          </nav>

          {/* Zone 3: 1 Primary Action Button */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={focusLoginForm}
              className="px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              ورود به کارتابل سازمانی
            </button>
          </div>
        </div>
      </header>

      {/* =====================================================================
          2. ABOVE-THE-FOLD: 2-COLUMN SPLIT HERO & PORTAL LOGIN GATEWAY
      ===================================================================== */}
      <main id="top" className="flex-1">
        <section className="w-full max-w-[1440px] mx-auto px-6 lg:px-10 pt-6 pb-10 lg:py-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            {/* RIGHT COLUMN (lg:col-span-7): Corporate Visual Carrier & Value Proposition */}
            <div className="lg:col-span-7 bg-slate-950 text-white rounded-2xl overflow-hidden border border-slate-800 flex flex-col justify-between relative">
              {/* Top Editorial Copy & Unboxed Metadata */}
              <div className="p-6 sm:p-8 lg:p-9 space-y-4 z-10">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <span>شاهراه</span>
                  <span aria-hidden="true">·</span>
                  <span>پرتال یکپارچه درخواست پرداخت، ممیزی مالی و خزانه‌داری</span>
                  <span aria-hidden="true">·</span>
                  <span>کنترل دسترسی مبتنی بر نقش (RBAC)</span>
                </div>

                <h1
                  className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-white leading-snug"
                  style={{ textWrap: 'balance' }}
                >
                  مدیریت متمرکز درخواست‌های پرداخت، تأییدهای سلسله‌مراتبی و تسویه بانکی خزانه
                </h1>

                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-2xl">
                  درگاه رسمی ثبت دستور پرداخت تکی و تجمیعی، مساعده حقوق پرسنل، کارتابل بررسی ردیف‌به‌ردیف سرپرستان و حسابداری، مدیریت حساب‌های بانکی مبدأ و بستن روکش روزانه خزانه‌داری در یک بستر امن سازمانی.
                </p>
              </div>

              {/* Center High-Fidelity Visual Asset with Measured Contrast Scrim & Resilient Fallback */}
              <div className="px-6 sm:px-8">
                <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-900 aspect-video w-full">
                  {!heroImgFailed ? (
                    <img
                      src="/assets/treasury-portal-hero.svg?v=cab6689f18d9"
                      alt="نمایش گرافیکی مرکز فرماندهی خزانه‌داری، چرخه چهارمرحله‌ای تایید اسناد مالی و صف تسویه بانکی"
                      referrerPolicy="no-referrer"
                      onError={() => setHeroImgFailed(true)}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full p-8 flex flex-col justify-between bg-gradient-to-br from-slate-900 via-slate-950 to-blue-950">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                        <span className="text-sm font-bold text-white">
                          معماری یکپارچه گردش اسناد مالی و خزانه‌داری
                        </span>
                        <ShieldCheck className="w-6 h-6 text-sky-400" />
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-auto">
                        <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800">
                          <div className="text-xs font-bold text-sky-400">۱. متقاضی</div>
                          <div className="text-[11px] text-slate-300 mt-1">ثبت تکی و تجمیعی</div>
                        </div>
                        <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800">
                          <div className="text-xs font-bold text-amber-400">۲. سرپرست واحد</div>
                          <div className="text-[11px] text-slate-300 mt-1">تأیید یا اصلاح ردیف</div>
                        </div>
                        <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800">
                          <div className="text-xs font-bold text-indigo-400">۳. حسابداری</div>
                          <div className="text-[11px] text-slate-300 mt-1">ممیزی و مرکز هزینه</div>
                        </div>
                        <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800">
                          <div className="text-xs font-bold text-emerald-400">۴. خزانه‌داری</div>
                          <div className="text-[11px] text-slate-300 mt-1">واریز و بایگانی فیش</div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-transparent" />
                </div>
              </div>

              {/* Development-only fixtures never appear in the published portal. */}
              {import.meta.env.DEV && <div className="p-6 sm:p-8 pt-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-slate-200">
                    ورود سریع آزمایشی به کارتابل‌های سازمانی (انتخاب نقش و ورود مستقیم):
                  </span>
                  <span className="text-slate-400">
                    با کلیک روی هر نقش، اطلاعات کاربری در فرم ورود قرار می‌گیرد
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-2">
                  {QUICK_ROLE_ACCOUNTS.map((acc) => {
                    const isSelected = personnelCode === acc.personnelCode;
                    return (
                      <div
                        key={acc.id}
                        className={`p-2.5 rounded-xl border transition flex flex-col justify-between gap-2 ${
                          isSelected
                            ? 'bg-blue-950/80 border-blue-500 text-white'
                            : 'bg-slate-900/90 border-slate-800 hover:border-slate-700 text-slate-200'
                        }`}
                      >
                        <div>
                          <div className="text-[11px] font-bold text-white leading-tight">
                            {acc.roleTitle}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {acc.personName} · کد:{' '}
                            <span className="font-mono-num text-slate-200">{acc.personnelCode}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 pt-1 border-t border-slate-800/80">
                          <button
                            type="button"
                            onClick={() => handleQuickRoleSelect(acc, false)}
                            className="flex-1 py-1 px-1.5 text-[10px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded cursor-pointer whitespace-nowrap"
                          >
                            درج در فرم
                          </button>
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() => handleQuickRoleSelect(acc, true)}
                            className="flex-1 py-1 px-1.5 text-[10px] font-bold bg-blue-600 hover:bg-blue-500 text-white rounded cursor-pointer whitespace-nowrap"
                          >
                            ورود مستقیم
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>}
            </div>

            {/* LEFT COLUMN (lg:col-span-5): Official Portal Authentication & Recovery Card */}
            <div
              ref={loginCardRef}
              className="lg:col-span-5 bg-white text-slate-900 rounded-2xl border border-slate-200 p-6 sm:p-8 flex flex-col justify-between"
            >
              <div>
                {/* Card Top Header */}
                <div className="pb-5 mb-6 border-b border-slate-200 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs text-slate-500 mb-1">
                      درگاه احراز هویت یکپارچه کارکنان و مدیران
                    </div>
                    <h2 className="text-lg sm:text-xl font-bold text-slate-950">
                      {mode === 'LOGIN' ? 'ورود به پرتال سازمانی' : 'بازیابی امن رمز عبور'}
                    </h2>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 text-slate-800">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                </div>

                {mode === 'LOGIN' ? (
                  <form onSubmit={handleLogin} className="space-y-4" noValidate>
                    <div>
                      <label
                        htmlFor="login-personnel-code"
                        className="block text-xs font-bold text-slate-700 mb-1.5"
                      >
                        کد پرسنلی / نام کاربری
                      </label>
                      <div className="relative">
                        <UserIcon className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                        <input
                          ref={personnelInputRef}
                          id="login-personnel-code"
                          type="text"
                          required
                          autoComplete="username"
                          disabled={twoFactorStep}
                          value={personnelCode}
                          onChange={(e) => setPersonnelCode(e.target.value)}
                          placeholder="مثلاً admin یا کد پرسنلی ۴ رقمی"
                          className="w-full pr-10 pl-3.5 py-2.5 text-sm bg-slate-50 focus:bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono-num disabled:bg-slate-100"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label
                          htmlFor="login-password"
                          className="block text-xs font-bold text-slate-700"
                        >
                          رمز عبور
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setMode('RECOVERY');
                            setRecPersonnelCode(personnelCode);
                            setRecError(null);
                            setRecSuccess(null);
                            setRecOtpSent(false);
                            setRecSmsUnavailable(false);
                          }}
                          className="text-xs font-semibold text-blue-700 hover:text-blue-900 cursor-pointer flex items-center gap-1 whitespace-nowrap"
                        >
                          <HelpCircle className="w-3.5 h-3.5" />
                          <span>فراموشی / بازیابی رمز عبور</span>
                        </button>
                      </div>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                        <input
                          id="login-password"
                          type={showPassword ? 'text' : 'password'}
                          required
                          autoComplete="current-password"
                          disabled={twoFactorStep}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full pr-10 pl-10 py-2.5 text-sm bg-slate-50 focus:bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono-num disabled:bg-slate-100"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((prev) => !prev)}
                          className="absolute left-3 top-2.5 text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                          aria-label={showPassword ? 'پنهان کردن رمز عبور' : 'نمایش رمز عبور'}
                          title={showPassword ? 'پنهان کردن رمز عبور' : 'نمایش رمز عبور'}
                        >
                          {showPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {twoFactorStep && (
                      <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl space-y-2">
                        <label
                          htmlFor="login-2fa-code"
                          className="block text-xs font-bold text-blue-950 flex items-center gap-1.5"
                        >
                          <KeyRound className="w-4 h-4 text-blue-700" />
                          <span>کد پین امنیتی دومرحله‌ای (۶ رقمی)</span>
                        </label>
                        <input
                          id="login-2fa-code"
                          type="password"
                          inputMode="numeric"
                          maxLength={6}
                          required
                          value={twoFactorCode}
                          onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
                          placeholder="------"
                          className="w-full px-3.5 py-2 text-center tracking-widest text-sm bg-white border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono-num"
                        />
                        <div className="flex justify-between items-center text-[11px] text-blue-800">
                          <span>کد امنیتی ۶ رقمی تعریف‌شده در تنظیمات حساب را وارد کنید.</span>
                          <button
                            type="button"
                            onClick={() => {
                              setTwoFactorStep(false);
                              setTwoFactorCode('');
                            }}
                            className="underline font-bold cursor-pointer whitespace-nowrap"
                          >
                            تغییر کاربر
                          </button>
                        </div>
                      </div>
                    )}

                    {error && (
                      <div
                        role="alert"
                        className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2 leading-relaxed"
                      >
                        <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                        <span>{error}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-3 px-4 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-bold text-sm rounded-xl transition flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                    >
                      <LogIn className="w-4 h-4" />
                      <span>
                        {loading
                          ? 'در حال بررسی اعتبار و دسترسی‌ها...'
                          : twoFactorStep
                          ? 'تأیید کد امنیتی و ورود به پرتال'
                          : 'ورود به پرتال سازمانی'}
                      </span>
                    </button>
                  </form>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-600">
                        روش بازیابی دسترسی خود را انتخاب کنید:
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setMode('LOGIN');
                          setRecError(null);
                          setRecSuccess(null);
                        }}
                        className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 hover:text-slate-950 cursor-pointer whitespace-nowrap"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                        <span>بازگشت به فرم ورود</span>
                      </button>
                    </div>

                    {/* Method Selector Tabs */}
                    <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
                      <button
                        type="button"
                        onClick={() => {
                          setRecoveryMethod('SMS_OTP');
                          setRecError(null);
                          setRecSuccess(null);
                          setRecSmsUnavailable(false);
                        }}
                        className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                          recoveryMethod === 'SMS_OTP'
                            ? 'bg-blue-700 text-white'
                            : 'text-slate-600 hover:bg-slate-200/70'
                        }`}
                      >
                        <Smartphone className="w-3.5 h-3.5" />
                        <span>کد تأیید پیامکی (OTP)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRecoveryMethod('ADMIN_TICKET');
                          setRecError(null);
                          setRecSuccess(null);
                          setRecSmsUnavailable(false);
                        }}
                        className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                          recoveryMethod === 'ADMIN_TICKET'
                            ? 'bg-blue-700 text-white'
                            : 'text-slate-600 hover:bg-slate-200/70'
                        }`}
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>تیکت برای مدیر سیستم</span>
                      </button>
                    </div>

                    {recSuccess ? (
                      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2 text-xs text-emerald-950">
                        <div className="flex items-center gap-2 font-bold text-emerald-800">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>عملیات بازیابی با موفقیت انجام شد</span>
                        </div>
                        <p className="leading-relaxed">{recSuccess.message}</p>
                        {recSuccess.trackingCode && (
                          <div className="pt-1 font-mono-num text-[11px] text-emerald-800">
                            کد پیگیری درخواست: <strong>{recSuccess.trackingCode}</strong>
                          </div>
                        )}
                        <div className="pt-2">
                          <button
                            type="button"
                            onClick={() => {
                              setMode('LOGIN');
                              setRecSuccess(null);
                            }}
                            className="w-full py-2.5 bg-slate-900 text-white rounded-lg font-bold text-xs cursor-pointer"
                          >
                            بازگشت به فرم ورود
                          </button>
                        </div>
                      </div>
                    ) : recoveryMethod === 'SMS_OTP' ? (
                      <div className="space-y-3.5">
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-950 leading-relaxed">
                          در صورتی که <strong>درگاه پیامک سازمانی</strong> فعال باشد، کد تأیید ۶ رقمی به تلفن همراه ثبت‌شده در پرونده پرسنلی شما ارسال می‌گردد.
                        </div>

                        {recError && (
                          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs space-y-2 leading-relaxed">
                            <div className="flex items-start gap-2">
                              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                              <span>{recError}</span>
                            </div>
                            {recSmsUnavailable && (
                              <button
                                type="button"
                                onClick={() => {
                                  setRecoveryMethod('ADMIN_TICKET');
                                  setRecError(null);
                                  setRecSmsUnavailable(false);
                                }}
                                className="w-full py-2 px-3 bg-rose-700 hover:bg-rose-800 text-white rounded-lg font-bold text-xs transition cursor-pointer"
                              >
                                ثبت تیکت بازیابی برای مدیر سیستم
                              </button>
                            )}
                          </div>
                        )}

                        {!recOtpSent ? (
                          <form onSubmit={handleSendOtpRecovery} className="space-y-3.5" noValidate>
                            <div>
                              <label className="block text-xs font-bold text-slate-700 mb-1">
                                کد پرسنلی / نام کاربری <span className="text-rose-600">*</span>
                              </label>
                              <div className="relative">
                                <UserIcon className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                                <input
                                  type="text"
                                  required
                                  value={recPersonnelCode}
                                  onChange={(e) => setRecPersonnelCode(e.target.value)}
                                  placeholder="مثال: 1042"
                                  className="w-full pr-9 pl-3 py-2 text-xs border border-slate-300 rounded-lg font-mono-num focus:outline-none focus:ring-2 focus:ring-blue-600"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-xs font-bold text-slate-700 mb-1">
                                شماره تلفن همراه ثبت‌شده در پرونده <span className="text-rose-600">*</span>
                              </label>
                              <div className="relative">
                                <Phone className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                                <input
                                  type="text"
                                  required
                                  value={recPhone}
                                  onChange={(e) => setRecPhone(e.target.value)}
                                  placeholder="0912..."
                                  className="w-full pr-9 pl-3 py-2 text-xs border border-slate-300 rounded-lg font-mono-num focus:outline-none focus:ring-2 focus:ring-blue-600"
                                />
                              </div>
                            </div>

                            <button
                              type="submit"
                              disabled={recLoading}
                              className="w-full py-2.5 px-4 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition cursor-pointer"
                            >
                              {recLoading
                                ? 'در حال ارتباط با درگاه پیامک...'
                                : 'دریافت کد تأیید پیامکی'}
                            </button>
                          </form>
                        ) : (
                          <form
                            onSubmit={handleVerifyOtpRecovery}
                            className="space-y-3.5"
                            noValidate
                          >
                            <div>
                              <label className="block text-xs font-bold text-slate-700 mb-1">
                                کد تأیید ۶ رقمی پیامک‌شده <span className="text-rose-600">*</span>
                              </label>
                              <input
                                type="text"
                                inputMode="numeric"
                                maxLength={6}
                                required
                                value={recOtpCode}
                                onChange={(e) => setRecOtpCode(e.target.value)}
                                placeholder="------"
                                className="w-full px-3 py-2 text-center tracking-widest text-sm border border-blue-300 rounded-lg font-mono-num focus:outline-none focus:ring-2 focus:ring-blue-600"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-slate-700 mb-1">
                                رمز عبور جدید (حداقل ۵ کاراکتر) <span className="text-rose-600">*</span>
                              </label>
                              <input
                                type="password"
                                required
                                value={recNewPassword}
                                minLength={5}
                                onChange={(e) => setRecNewPassword(e.target.value)}
                                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono-num focus:outline-none focus:ring-2 focus:ring-blue-600"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-slate-700 mb-1">
                                تکرار رمز عبور جدید <span className="text-rose-600">*</span>
                              </label>
                              <input
                                type="password"
                                required
                                value={recConfirmPassword}
                                minLength={5}
                                onChange={(e) => setRecConfirmPassword(e.target.value)}
                                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono-num focus:outline-none focus:ring-2 focus:ring-blue-600"
                              />
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => setRecOtpSent(false)}
                                className="text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
                              >
                                تغییر شماره / ارسال مجدد
                              </button>
                              <button
                                type="submit"
                                disabled={recLoading}
                                className="py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition cursor-pointer"
                              >
                                {recLoading ? 'در حال ثبت...' : 'تأیید کد و تغییر رمز'}
                              </button>
                            </div>
                          </form>
                        )}
                      </div>
                    ) : (
                      <form onSubmit={handleRecoverySubmit} className="space-y-3.5" noValidate>
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 leading-relaxed">
                          در صورت عدم دسترسی به پیامک، بازیابی رمز عبور از طریق ثبت تیکت رسمی برای{' '}
                          <strong>مدیر سامانه</strong> انجام می‌شود تا رمز موقت یک‌بارمصرف صادر گردد.
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            کد پرسنلی / نام کاربری <span className="text-rose-600">*</span>
                          </label>
                          <div className="relative">
                            <UserIcon className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                            <input
                              type="text"
                              required
                              value={recPersonnelCode}
                              onChange={(e) => setRecPersonnelCode(e.target.value)}
                              placeholder="مثال: 1042"
                              className="w-full pr-9 pl-3 py-2 text-xs border border-slate-300 rounded-lg font-mono-num focus:outline-none focus:ring-2 focus:ring-blue-600"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            شماره تلفن همراه ثبت‌شده در پرونده <span className="text-rose-600">*</span>
                          </label>
                          <div className="relative">
                            <Phone className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                            <input
                              type="text"
                              required
                              value={recPhone}
                              onChange={(e) => setRecPhone(e.target.value)}
                              placeholder="0912..."
                              className="w-full pr-9 pl-3 py-2 text-xs border border-slate-300 rounded-lg font-mono-num focus:outline-none focus:ring-2 focus:ring-blue-600"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            توضیحات تکمیلی جهت اطلاع مدیر سیستم
                          </label>
                          <div className="relative">
                            <FileText className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                            <input
                              type="text"
                              value={recNote}
                              onChange={(e) => setRecNote(e.target.value)}
                              placeholder="علت درخواست بازنشانی رمز عبور..."
                              className="w-full pr-9 pl-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                            />
                          </div>
                        </div>

                        {recError && (
                          <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                            <span>{recError}</span>
                          </div>
                        )}

                        <button
                          type="submit"
                          disabled={recLoading}
                          className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition cursor-pointer"
                        >
                          {recLoading ? 'در حال ثبت درخواست...' : 'ثبت درخواست بازیابی رمز عبور'}
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </div>

              {/* Card Bottom Security & Support Information */}
              <div className="mt-6 pt-5 border-t border-slate-200 space-y-3 text-xs text-slate-500">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700">سطح حفاظت نشست‌های کاربری</span>
                  <span className="font-mono-num text-slate-600">Scrypt + 2FA + Audit Log</span>
                </div>
                <p className="leading-relaxed text-[11px]">
                  تمامی عملیات ثبت درخواست، تأیید سرپرست، کنترل حسابداری و اجرای پرداخت در خزانه با نام کاربری، زمان دقیق و نسخه سند در تاریخچه تغییرناپذیر سرور ثبت می‌گردد.
                </p>
              </div>
            </div>
          </div>

          {/* =================================================================
              FULL-WIDTH 4-COLUMN OPERATIONAL SUMMARY STRIP BELOW HERO
          ================================================================= */}
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-xs text-slate-500">چرخه بررسی و کنترل اسناد</div>
              <div className="text-xl font-bold text-slate-950 font-mono-num mt-1">
                ۴ ایستگاه کنترلی مستقل
              </div>
              <div className="text-xs text-slate-600 mt-1">
                متقاضی · سرپرست واحد · حسابداری · خزانه‌داری
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-xs text-slate-500">پوشش سازمانی و مراکز هزینه</div>
              <div className="text-xl font-bold text-slate-950 font-mono-num mt-1">
                ۳ شرکت و ۷ واحد تخصصی
              </div>
              <div className="text-xs text-slate-600 mt-1">
                هلدینگ مرکزی · توسعه فناوری · بازرگانی و لجستیک
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-xs text-slate-500">حساب‌های بانکی مبدأ خزانه</div>
              <div className="text-xl font-bold text-slate-950 font-mono-num mt-1">
                ثبت تصویر ثابت حساب مبدأ
              </div>
              <div className="text-xs text-slate-600 mt-1">
                پشتیبانی از پایا، ساتنا، کارت‌به‌کارت، چک و انتقالی
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-xs text-slate-500">مدیریت نقش‌ها و مجوزها</div>
              <div className="text-xl font-bold text-slate-950 font-mono-num mt-1">
                ۳۱ مجوز ریزدانه (RBAC)
              </div>
              <div className="text-xs text-slate-600 mt-1">
                امکان تعریف نقش سفارشی و تعیین سقف تأیید و پرداخت
              </div>
            </div>
          </div>
        </section>

        {/* =====================================================================
            3. WEBSITE SECTION: PORTAL ARCHITECTURE & BENTO GRID (#portal-about)
        ===================================================================== */}
        <section id="portal-about" className="py-12 bg-white border-t border-slate-200">
          <div className="w-full max-w-[1440px] mx-auto px-6 lg:px-10 space-y-8">
            <div className="max-w-3xl space-y-2">
              <div className="text-xs text-slate-500">
                معرفی سامانه جامع مالی · زیرساخت یکپارچه سازمانی
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-950">
                طراحی‌شده برای شفافیت مالی، سرعت در تأیید و دقت در اجرای پرداخت‌های بانکی
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                این پرتال کلیه فرآیندهای مالی سازمان را از لحظه ثبت تقاضای پرداخت یا مساعده در واحدهای اجرایی تا بررسی سرپرست، ممیزی حسابداری و تسویه نهایی در خزانه‌داری به‌صورت تمام‌صفحه و یکپارچه پوشش می‌دهد.
              </p>
            </div>

            {/* Asymmetric Bento Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-6 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between space-y-3">
                  <div className="space-y-2">
                    <h3 className="text-sm font-bold text-slate-950">
                      01. ثبت دستور پرداخت و مساعده (تکی و تجمیعی)
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      امکان ثبت درخواست‌های پرداخت و مساعده حقوق به‌صورت تکی یا جدول تجمیعی چندردیفه همراه با ورود هوشمند از فایل اکسل (XLSX)، حفظ صفرهای ابتدایی شماره حساب و پیوست مدارک.
                    </p>
                  </div>
                  <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-200/80">
                    خروجی و ورودی استاندارد اکسل · کد رهگیری اختصاصی
                  </div>
                </div>

                <div className="p-6 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between space-y-3">
                  <div className="space-y-2">
                    <h3 className="text-sm font-bold text-slate-950">
                      02. کارتابل مستقل سرپرست واحد و حسابداری
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      هر ردیف در لیست‌های گروهی چرخه حیات مستقل دارد؛ سرپرست یا حسابدار می‌تواند برخی ردیف‌ها را تأیید، مبلغ برخی را تعدیل و موارد ناقص را جهت اصلاح به متقاضی برگشت دهد.
                    </p>
                  </div>
                  <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-200/80">
                    نسخه‌بندی خودکار اصلاحیه‌ها · ثبت تاریخچه تصمیمات
                  </div>
                </div>

                <div className="p-6 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between space-y-3">
                  <div className="space-y-2">
                    <h3 className="text-sm font-bold text-slate-950">
                      03. ایستگاه خزانه‌داری، حساب مبدأ و روکش روزانه
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      تفکیک صف انتظار و مخزن در حال پرداخت، انتخاب حساب بانکی مبدأ شرکت، امکان تسویه جزئی یا کامل در چند مرحله، صدور فیش و بستن قطعی روکش روزانه بانک‌ها.
                    </p>
                  </div>
                  <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-200/80">
                    بایگانی خودکار پوشه‌های روز پرداخت · گزارش جامع تسویه
                  </div>
                </div>

                <div className="p-6 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between space-y-3">
                  <div className="space-y-2">
                    <h3 className="text-sm font-bold text-slate-950">
                      04. مدیریت اطلاعات پایه، کاربران و نقش‌ها
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      تعریف شرکت‌ها، واحدهای سازمانی، مراکز هزینه با سقف بودجه، درگاه پیامک سازمانی و مدیریت کامل نقش‌ها و دسترسی‌های ریزدانه برای هر بخش از پنل.
                    </p>
                  </div>
                  <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-200/80">
                    تعریف نقش‌های جدید · تعیین سقف مجاز تأیید و پرداخت
                  </div>
                </div>
              </div>

              {/* Showcase Visual Card */}
              <div className="lg:col-span-5 rounded-xl border border-slate-200 bg-slate-950 overflow-hidden flex flex-col justify-between">
                <div className="p-5 border-b border-slate-800">
                  <h3 className="text-sm font-bold text-white">
                    نمای شماتیک کنترل اسناد، امنیت نقش‌ها و بایگانی خزانه
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    یکپارچگی کامل میان اطلاعات پایه، سقف بودجه مراکز هزینه و حساب‌های بانکی مبدأ
                  </p>
                </div>
                <div className="p-4 flex-1 flex items-center justify-center">
                  {!showcaseImgFailed ? (
                    <img
                      src="/assets/workflow-showcase.svg"
                      alt="نمای شماتیک کنترل اسناد مالی، دسترسی مبتنی بر نقش و بایگانی فیش‌های خزانه‌داری"
                      referrerPolicy="no-referrer"
                      onError={() => setShowcaseImgFailed(true)}
                      className="w-full h-auto rounded-lg object-contain"
                    />
                  ) : (
                    <div className="p-6 text-slate-300 text-xs space-y-2">
                      <div className="font-bold text-white">کنترل یکپارچه اسناد و حساب‌های مبدأ</div>
                      <p>ثبت تصویر ثابت مشخصات حساب بانکی شرکت در لحظه اجرای هر پرداخت.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =====================================================================
            4. WEBSITE SECTION: INTERACTIVE 4-STAGE WORKFLOW (#portal-workflow)
        ===================================================================== */}
        <section id="portal-workflow" className="py-12 bg-slate-50 border-t border-slate-200">
          <div className="w-full max-w-[1440px] mx-auto px-6 lg:px-10 space-y-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div className="space-y-1.5">
                <div className="text-xs text-slate-500">
                  فرآیند استاندارد گردش کار · ردیابی لحظه‌ای وضعیت اسناد
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-950">
                  چرخه چهارمرحله‌ای بررسی، تأیید و اجرای پرداخت در پرتال
                </h2>
              </div>
              <button
                type="button"
                onClick={focusLoginForm}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-900 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg cursor-pointer whitespace-nowrap self-start md:self-auto"
              >
                <span>ورود به کارتابل و شروع کار</span>
                <ArrowUpLeft className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Interactive Stage Selector Tabs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {WORKFLOW_STAGES.map((st, idx) => {
                const active = activeWorkflowIdx === idx;
                return (
                  <button
                    key={st.step}
                    type="button"
                    onClick={() => setActiveWorkflowIdx(idx)}
                    className={`text-right p-4 rounded-xl border transition cursor-pointer ${
                      active
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span
                        className={`font-mono-num font-bold ${
                          active ? 'text-sky-400' : 'text-blue-700'
                        }`}
                      >
                        مرحله {st.step}
                      </span>
                      <ChevronLeft
                        className={`w-4 h-4 ${active ? 'text-white' : 'text-slate-400'}`}
                      />
                    </div>
                    <div className="text-xs sm:text-sm font-bold leading-snug">{st.title}</div>
                  </button>
                );
              })}
            </div>

            {/* Active Stage Detail Panel */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              <div className="lg:col-span-4 space-y-2 border-b lg:border-b-0 lg:border-l border-slate-200 pb-4 lg:pb-0 lg:pl-6">
                <div className="text-xs font-mono-num font-bold text-blue-700">
                  ایستگاه کاری {WORKFLOW_STAGES[activeWorkflowIdx].step}
                </div>
                <h3 className="text-base font-bold text-slate-950">
                  {WORKFLOW_STAGES[activeWorkflowIdx].title}
                </h3>
                <div className="text-xs text-slate-500">
                  مسئول اقدام: <strong className="text-slate-800">{WORKFLOW_STAGES[activeWorkflowIdx].actor}</strong>
                </div>
              </div>

              <div className="lg:col-span-5 space-y-1.5">
                <div className="text-xs font-bold text-slate-800">مکانیزم اجرایی در سامانه:</div>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {WORKFLOW_STAGES[activeWorkflowIdx].mechanism}
                </p>
              </div>

              <div className="lg:col-span-3 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-1.5">
                <div className="text-xs font-bold text-emerald-800">خروجی و تضمین کنترلی:</div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  {WORKFLOW_STAGES[activeWorkflowIdx].outcome}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* =====================================================================
            5. WEBSITE SECTION: CAPABILITIES & ACCESS GUIDE (#portal-capabilities & #portal-guide)
        ===================================================================== */}
        <section id="portal-capabilities" className="py-12 bg-white border-t border-slate-200">
          <div className="w-full max-w-[1440px] mx-auto px-6 lg:px-10 grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Treasury & Financial Capabilities */}
            <div className="lg:col-span-6 space-y-4">
              <div className="text-xs text-slate-500">امکانات تخصصی خزانه‌داری و حسابداری</div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-950">
                ابزارهای عملیاتی برای تیم‌های مالی و خزانه‌داری
              </h2>

              <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden">
                <div className="p-4 bg-white flex items-start gap-3">
                  <Building2 className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="text-xs sm:text-sm font-bold text-slate-900">
                      مدیریت حساب‌های بانکی مبدأ شرکت با تصویر ثابت (Snapshot)
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      هنگام ثبت هر پرداخت، مشخصات کامل حساب بانکی مبدأ شرکت روی سند ذخیره می‌شود تا در صورت تغییر یا غیرفعال‌سازی بعدی حساب، اصالت اسناد قبلی حفظ شود.
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-white flex items-start gap-3">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="text-xs sm:text-sm font-bold text-slate-900">
                      خروجی و ورودی استاندارد اکسل (XLSX) بدون حذف صفرهای ابتدایی
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      تمامی شماره‌های حساب، کارت و شبا به‌صورت رشته‌ای (Text) پردازش می‌شوند تا صفرهای ابتدایی حساب‌های بانکی در ورود و خروج اکسل کاملاً محفوظ بماند.
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-white flex items-start gap-3">
                  <Layers className="w-5 h-5 text-indigo-700 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="text-xs sm:text-sm font-bold text-slate-900">
                      نمایش تمام‌صفحه جداول بدون اسکرول افقی
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      تمامی فرم‌های ثبت درخواست، جداول تجمیعی و کارتابل‌های بررسی به‌گونه‌ای طراحی شده‌اند که تمام ستون‌ها و اطلاعات هر ردیف به‌صورت یکجا در صفحه قابل مشاهده باشند.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Access Guide (#portal-guide) */}
            <div id="portal-guide" className="lg:col-span-6 space-y-4">
              <div className="text-xs text-slate-500">راهنمای ورود و سطوح دسترسی کاربران</div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-950">
                نحوه ورود به پرتال و تفکیک منوهای هر نقش
              </h2>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
                <p className="text-xs text-slate-600 leading-relaxed">
                  پس از ورود با کد پرسنلی و رمز عبور، منوی کشویی سمت راست بر اساس نقش سازمانی و مجوزهای اختصاص‌یافته به شما تنظیم می‌گردد:
                </p>

                <div className="space-y-2.5 text-xs">
                  <div className="p-3 bg-white border border-slate-200 rounded-lg">
                    <strong className="text-slate-900">۱. منوی ثبت و پیگیری درخواست‌ها:</strong>{' '}
                    <span className="text-slate-600">
                      ثبت دستور پرداخت تجمیعی، دستور پرداخت تکی، مساعده گروهی پرسنل، مساعده تکی و پیگیری و اصلاح موارد برگشتی.
                    </span>
                  </div>
                  <div className="p-3 bg-white border border-slate-200 rounded-lg">
                    <strong className="text-slate-900">۲. کارتابل‌های تأیید سرپرست و حسابداری:</strong>{' '}
                    <span className="text-slate-600">
                      دسترسی به صف در انتظار تأیید، موارد تأییدشده توسط من، برگشت‌داده‌شده برای اصلاح و همه سوابق تصمیمات.
                    </span>
                  </div>
                  <div className="p-3 bg-white border border-slate-200 rounded-lg">
                    <strong className="text-slate-900">۳. میز کار خزانه‌داری و اطلاعات پایه:</strong>{' '}
                    <span className="text-slate-600">
                      صف پرداخت، مخزن در حال پرداخت، پرداختی‌های انجام‌شده، حساب‌های مبدأ، روکش روزانه، تعریف شرکت‌ها، واحدها، مراکز هزینه و مدیریت کاربران و نقش‌ها.
                    </span>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between gap-3">
                  <span className="text-xs text-slate-500">
                    برای ورود فوری می‌توانید از فرم بالا یا دکمه‌های ورود سریع استفاده نمایید.
                  </span>
                  <button
                    type="button"
                    onClick={focusLoginForm}
                    className="px-4 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-lg cursor-pointer whitespace-nowrap"
                  >
                    رفتن به فرم ورود
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* =====================================================================
          6. QUIET CORPORATE FOOTER
      ===================================================================== */}
      <footer className="bg-slate-950 text-slate-400 border-t border-slate-800 py-8">
        <div className="w-full max-w-[1440px] mx-auto px-6 lg:px-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-white">سامانه جامع مالی و خزانه داری شاهراه</span>
            <span aria-hidden="true">·</span>
            <span>پرتال سازمانی درخواست پرداخت، تأیید و خزانه‌داری</span>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <button
              type="button"
              onClick={() => scrollToSection('portal-about')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              معرفی سامانه
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('portal-workflow')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              چرخه تایید و پرداخت
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('portal-capabilities')}
              className="hover:text-white transition-colors cursor-pointer"
            >
              امکانات خزانه‌داری
            </button>
            <button
              type="button"
              onClick={focusLoginForm}
              className="hover:text-white transition-colors cursor-pointer"
            >
              ورود به کارتابل
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
