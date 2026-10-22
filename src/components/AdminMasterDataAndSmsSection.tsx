import React, { useState, useMemo, useEffect } from 'react';
import {
  Building2,
  FolderTree,
  Layers,
  MessageSquare,
  Plus,
  Edit,
  Trash2,
  CheckCircle2,
  Ban,
  AlertCircle,
  Send,
  Save,
  Search,
  KeyRound,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import type {
  OrganizationCompany,
  OrganizationalDepartment,
  CostCenterItem,
  SmsGatewayConfig,
  SmsDispatchLogEntry,
  SmsProviderType,
  MasterDataKind,
  BulkMasterDataKind,
  BulkMasterDataRow,
} from '../types/treasury';
import { normalizePersianText } from '../utils/sorting';
import {nextMasterDataCode} from '../utils/master-data-codes';
import {MasterDataBulkDialog} from './MasterDataBulkDialog';

export type MasterDataSubTab = 'COMPANIES' | 'DEPARTMENTS' | 'COST_CENTERS';

interface AdminMasterDataAndSmsSectionProps {
  mode: 'MASTER_DATA' | 'SMS_GATEWAY';
  activeMasterSubTab?: MasterDataSubTab;
  companies: OrganizationCompany[];
  departments: OrganizationalDepartment[];
  costCenters: CostCenterItem[];
  masterDataCodeSequences?:Partial<Record<MasterDataKind,number>>;
  onBulkCreateMasterData:(kind:BulkMasterDataKind,rows:BulkMasterDataRow[])=>Promise<{ok:boolean;error?:string}>;
  smsConfig?: SmsGatewayConfig;
  smsLogs: SmsDispatchLogEntry[];
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

export const AdminMasterDataAndSmsSection: React.FC<AdminMasterDataAndSmsSectionProps> = ({
  mode,
  activeMasterSubTab = 'COMPANIES',
  companies,
  departments,
  costCenters,
  masterDataCodeSequences,
  onBulkCreateMasterData,
  smsConfig,
  smsLogs,
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
  const [masterSubTab, setMasterSubTab] = useState<MasterDataSubTab>(activeMasterSubTab);
  const [searchTerm, setSearchTerm] = useState('');
  const [bulkKind,setBulkKind]=useState<BulkMasterDataKind|null>(null);
  const codePreview=(kind:MasterDataKind)=>{try{return nextMasterDataCode({companies,departments,costCenters,masterDataCodeSequences},kind);}catch{return 'تخصیص هنگام ثبت';}};
  const [statusFeedback, setStatusFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    setMasterSubTab(activeMasterSubTab);
    setStatusFeedback(null);
  }, [activeMasterSubTab]);

  // Company Form State
  const [editingCompId, setEditingCompId] = useState<string | null>(null);
  const [compCode, setCompCode] = useState('');
  const [compName, setCompName] = useState('');
  const [compNationalId, setCompNationalId] = useState('');
  const [compDesc, setCompDesc] = useState('');
  const [compActive, setCompActive] = useState(true);
  const [compDefault, setCompDefault] = useState(false);
  const [savingComp, setSavingComp] = useState(false);

  // Department Form State
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
  const [deptCode, setDeptCode] = useState('');
  const [deptName, setDeptName] = useState('');
  const [deptCompanyId, setDeptCompanyId] = useState<string>(() => companies[0]?.id || '');
  const [deptDesc, setDeptDesc] = useState('');
  const [deptActive, setDeptActive] = useState(true);
  const [savingDept, setSavingDept] = useState(false);

  // Cost Center Form State
  const [editingCcId, setEditingCcId] = useState<string | null>(null);
  const [ccCode, setCcCode] = useState('');
  const [ccName, setCcName] = useState('');
  const [ccCompanyId, setCcCompanyId] = useState<string>(() => companies[0]?.id || '');
  const [ccDepartmentId, setCcDepartmentId] = useState<string>('');
  const [ccCategory, setCcCategory] = useState('عملیاتی');
  const [ccDesc, setCcDesc] = useState('');
  const [ccActive, setCcActive] = useState(true);
  const [savingCc, setSavingCc] = useState(false);

  // SMS Config State
  const [smsEnabled, setSmsEnabled] = useState<boolean>(Boolean(smsConfig?.enabled));
  const [smsProvider, setSmsProvider] = useState<SmsProviderType>(smsConfig?.provider || 'KAVENEGAR');
  const [smsSender, setSmsSender] = useState<string>(smsConfig?.senderNumber || '');
  const [smsApiUrl, setSmsApiUrl] = useState<string>(
    smsConfig?.apiUrl || 'https://api.kavenegar.com/v1/{API_KEY}/sms/send.json'
  );
  const [smsApiKey, setSmsApiKey] = useState<string>('');
  const [smsUsername, setSmsUsername] = useState<string>(smsConfig?.username || '');
  const [smsPassword, setSmsPassword] = useState<string>('');
  const [smsDomain, setSmsDomain] = useState<string>(smsConfig?.domain || '');
  const [evOtpRecovery, setEvOtpRecovery] = useState<boolean>(
    smsConfig?.events?.sendOtpOnRecovery !== false
  );
  const [evPassReset, setEvPassReset] = useState<boolean>(
    smsConfig?.events?.sendOnPasswordReset !== false
  );
  const [evPendingApproval, setEvPendingApproval] = useState<boolean>(
    smsConfig?.events?.sendOnPendingApproval !== false
  );
  const [evRevision, setEvRevision] = useState<boolean>(
    smsConfig?.events?.sendOnRevisionOrReject !== false
  );
  const [evPayment, setEvPayment] = useState<boolean>(
    smsConfig?.events?.sendOnPaymentExecuted !== false
  );
  const [savingSms, setSavingSms] = useState(false);

  // Test SMS State
  const [testPhone, setTestPhone] = useState('');
  const [testMsg, setTestMsg] = useState('');
  const [testingSms, setTestingSms] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
    details?: string;
  } | null>(null);

  const resetCompanyForm = () => {
    setEditingCompId(null);
    setCompCode('');
    setCompName('');
    setCompNationalId('');
    setCompDesc('');
    setCompActive(true);
    setCompDefault(false);
  };

  const resetDeptForm = () => {
    setEditingDeptId(null);
    setDeptCode('');
    setDeptName('');
    setDeptCompanyId(companies[0]?.id || '');
    setDeptDesc('');
    setDeptActive(true);
  };

  const resetCcForm = () => {
    setEditingCcId(null);
    setCcCode('');
    setCcName('');
    setCcCompanyId(companies[0]?.id || '');
    setCcDepartmentId('');
    setCcCategory('عملیاتی');
    setCcDesc('');
    setCcActive(true);
  };

  const handleCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusFeedback(null);
    setSavingComp(true);
    const res = await onSaveCompany({
      id: editingCompId || undefined,
      code: compCode.trim(),
      name: compName.trim(),
      nationalId: compNationalId.trim(),
      description: compDesc.trim(),
      isActive: compActive,
      isDefault: compDefault,
    });
    setSavingComp(false);
    if (!res.ok) {
      setStatusFeedback({ type: 'error', message: res.error || 'خطا در ذخیره شرکت/سازمان' });
    } else {
      setStatusFeedback({
        type: 'success',
        message: editingCompId
          ? `اطلاعات شرکت «${compName}» با موفقیت بروزرسانی شد.`
          : `شرکت جدید «${compName}» با موفقیت ثبت گردید.`,
      });
      resetCompanyForm();
    }
  };

  const handleDeptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusFeedback(null);
    setSavingDept(true);
    const res = await onSaveDepartment({
      id: editingDeptId || undefined,
      code: deptCode.trim(),
      name: deptName.trim(),
      companyId: deptCompanyId || companies[0]?.id,
      description: deptDesc.trim(),
      isActive: deptActive,
    });
    setSavingDept(false);
    if (!res.ok) {
      setStatusFeedback({ type: 'error', message: res.error || 'خطا در ذخیره واحد سازمانی' });
    } else {
      setStatusFeedback({
        type: 'success',
        message: editingDeptId
          ? `واحد سازمانی «${deptName}» با موفقیت ویرایش شد.`
          : `واحد سازمانی جدید «${deptName}» با موفقیت اضافه شد.`,
      });
      resetDeptForm();
    }
  };

  const handleCcSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusFeedback(null);
    setSavingCc(true);
    const res = await onSaveCostCenter({
      id: editingCcId || undefined,
      code: ccCode.trim(),
      name: ccName.trim(),
      companyId: ccCompanyId || companies[0]?.id,
      departmentId: ccDepartmentId || null,
      budgetCategory: ccCategory.trim(),
      description: ccDesc.trim(),
      isActive: ccActive,
    });
    setSavingCc(false);
    if (!res.ok) {
      setStatusFeedback({ type: 'error', message: res.error || 'خطا در ذخیره مرکز هزینه' });
    } else {
      setStatusFeedback({
        type: 'success',
        message: editingCcId
          ? `مرکز هزینه «${ccName}» با موفقیت بروزرسانی شد.`
          : `مرکز هزینه جدید «${ccName}» با موفقیت ثبت شد.`,
      });
      resetCcForm();
    }
  };

  const handleSmsConfigSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusFeedback(null);
    setSavingSms(true);
    const res = await onSaveSmsConfig({
      enabled: smsEnabled,
      provider: smsProvider,
      senderNumber: smsSender.trim(),
      apiUrl: smsApiUrl.trim(),
      apiKey: smsApiKey.trim() || undefined,
      username: smsUsername.trim() || undefined,
      password: smsPassword.trim() || undefined,
      domain: smsDomain.trim() || undefined,
      events: {
        sendOtpOnRecovery: evOtpRecovery,
        sendOnPasswordReset: evPassReset,
        sendOnPendingApproval: evPendingApproval,
        sendOnRevisionOrReject: evRevision,
        sendOnPaymentExecuted: evPayment,
      },
    });
    setSavingSms(false);
    if (!res.ok) {
      setStatusFeedback({ type: 'error', message: res.error || 'خطا در ذخیره تنظیمات پیامک' });
    } else {
      setSmsApiKey('');
      setSmsPassword('');
      setStatusFeedback({
        type: 'success',
        message: 'تنظیمات درگاه پیامک سازمانی با موفقیت در سرور ذخیره شد.',
      });
    }
  };

  const handleRunSmsTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setTestResult(null);
    setTestingSms(true);
    const res = await onTestSmsDispatch({
      recipientPhone: testPhone.trim(),
      testMessage: testMsg.trim() || undefined,
    });
    setTestingSms(false);
    if (res.ok) {
      setTestResult({
        ok: true,
        message: `پیامک تست با موفقیت به درگاه ارسال شد (وضعیت: ${res.status || 'SENT'}).`,
        details: res.providerResponse,
      });
    } else {
      setTestResult({
        ok: false,
        message: res.error || 'ارسال پیامک تست ناموفق بود.',
        details: res.providerResponse,
      });
    }
  };

  const filteredCompanies = useMemo(() => {
    const q = normalizePersianText(searchTerm);
    if (!q) return companies;
    return companies.filter(
      (c) =>
        normalizePersianText(c.name).includes(q) ||
        normalizePersianText(c.code).includes(q) ||
        normalizePersianText(c.nationalId || '').includes(q)
    );
  }, [companies, searchTerm]);

  const filteredDepartments = useMemo(() => {
    const q = normalizePersianText(searchTerm);
    if (!q) return departments;
    return departments.filter(
      (d) =>
        normalizePersianText(d.name).includes(q) ||
        normalizePersianText(d.code).includes(q) ||
        normalizePersianText(d.companyName).includes(q)
    );
  }, [departments, searchTerm]);

  const filteredCostCenters = useMemo(() => {
    const q = normalizePersianText(searchTerm);
    if (!q) return costCenters;
    return costCenters.filter(
      (cc) =>
        normalizePersianText(cc.name).includes(q) ||
        normalizePersianText(cc.code).includes(q) ||
        normalizePersianText(cc.companyName).includes(q) ||
        normalizePersianText(cc.departmentName || '').includes(q)
    );
  }, [costCenters, searchTerm]);

  if (mode === 'SMS_GATEWAY') {
    return (
      <div className="space-y-6">
        {statusFeedback && (
          <div
            className={`p-3.5 rounded-xl border text-xs font-bold flex items-center justify-between gap-2 ${
              statusFeedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            <div className="flex items-center gap-2">
              {statusFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{statusFeedback.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusFeedback(null)}
              className="text-xs underline cursor-pointer"
            >
              بستن
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Configuration Form */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-blue-700" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    پیکربندی درگاه پیامک سازمانی (SMS Gateway)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    تنظیمات اتصال واقعی وب‌سرویس پیامک جهت ارسال کد بازیابی (OTP) و اعلان‌های گردش کار
                  </p>
                </div>
              </div>
              <span
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                  smsConfig?.enabled
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-slate-100 text-slate-700 border border-slate-300'
                }`}
              >
                {smsConfig?.enabled ? 'درگاه فعال است' : 'درگاه غیرفعال است'}
              </span>
            </div>

            <form onSubmit={handleSmsConfigSubmit} className="space-y-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-900">وضعیت فعال‌سازی ارسال پیامک</div>
                  <div className="text-[11px] text-slate-500">
                    در صورت غیرفعال بودن، هیچ پیامک شبیه‌سازی‌شده‌ای جعل نمی‌شود و وضعیت واقعی اعلام می‌گردد.
                  </div>
                </div>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={smsEnabled}
                    onChange={(e) => setSmsEnabled(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                  <span className="text-xs font-bold text-slate-800">
                    {smsEnabled ? 'فعال' : 'غیرفعال'}
                  </span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ارائه‌دهنده وب‌سرویس پیامک
                  </label>
                  <select
                    value={smsProvider}
                    onChange={(e) => {
                      const nextProv = e.target.value as SmsProviderType;
                      setSmsProvider(nextProv);
                      if (nextProv === 'KAVENEGAR') {
                        setSmsApiUrl('https://api.kavenegar.com/v1/{API_KEY}/sms/send.json');
                      } else if (nextProv === 'FARAZ_SMS') {
                        setSmsApiUrl('https://api2.ippanel.com/api/v1/sms/send/webservice/single');
                      } else if (nextProv === 'MELIPAYAMAK') {
                        setSmsApiUrl('https://rest.payamak-panel.com/api/SendSMS/SendSMS');
                      }
                    }}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="KAVENEGAR">کاوه‌نگار (Kavenegar REST API)</option>
                    <option value="FARAZ_SMS">فراز اس‌ام‌اس (IPPanel Edge API)</option>
                    <option value="MELIPAYAMAK">ملی‌پیامک (MeliPayamak REST)</option>
                    <option value="CUSTOM_REST">وب‌سرویس اختصاصی سازمانی (Custom POST JSON)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    شماره خط ارسال‌کننده (Sender Number) *
                  </label>
                  <input
                    type="text"
                    value={smsSender}
                    onChange={(e) => setSmsSender(e.target.value)}
                    placeholder="مثال: 10008663 یا 3000..."
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono-num dir-ltr text-right"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  آدرس وب‌سرویس (API Endpoint URL)
                </label>
                <input
                  type="text"
                  value={smsApiUrl}
                  onChange={(e) => setSmsApiUrl(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono-num dir-ltr text-left"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                    <span>کلید وب‌سرویس (API Key)</span>
                    {smsConfig?.hasApiKey && (
                      <span className="text-[10px] text-emerald-700 font-semibold">
                        (کلید در سرور ذخیره شده است)
                      </span>
                    )}
                  </label>
                  <input
                    type="password"
                    value={smsApiKey}
                    onChange={(e) => setSmsApiKey(e.target.value)}
                    placeholder={
                      smsConfig?.hasApiKey
                        ? '•••••••••••••••• (برای تغییر وارد کنید)'
                        : 'کلید API درگاه پیامک را وارد کنید'
                    }
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono-num dir-ltr text-right"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    نام کاربری وب‌سرویس (ویژه ملی‌پیامک/اختصاصی)
                  </label>
                  <input
                    type="text"
                    value={smsUsername}
                    onChange={(e) => setSmsUsername(e.target.value)}
                    placeholder="اختیاری در صورت استفاده از API Key"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono-num dir-ltr text-right"
                  />
                </div>
              </div>

              <div className="border-t border-slate-200 pt-3">
                <div className="text-xs font-bold text-slate-800 mb-2">
                  رویدادهای مجاز ارسال پیامک خودکار:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700">
                  <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={evOtpRecovery}
                      onChange={(e) => setEvOtpRecovery(e.target.checked)}
                    />
                    <span>ارسال کد تأیید یک‌بارمصرف (OTP) فراموشی رمز</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={evPassReset}
                      onChange={(e) => setEvPassReset(e.target.checked)}
                    />
                    <span>اطلاع‌رسانی بازنشانی رمز عبور توسط ادمین</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={evPendingApproval}
                      onChange={(e) => setEvPendingApproval(e.target.checked)}
                    />
                    <span>ورود درخواست جدید به کارتابل تأییدکننده</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={evRevision}
                      onChange={(e) => setEvRevision(e.target.checked)}
                    />
                    <span>برگشت درخواست جهت اصلاح به متقاضی</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={evPayment}
                      onChange={(e) => setEvPayment(e.target.checked)}
                    />
                    <span>ثبت پرداخت قطعی و صدور فیش در خزانه‌داری</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                {smsConfig?.hasApiKey ? (
                  <button
                    type="button"
                    onClick={async () => {
                      await onSaveSmsConfig({ enabled: false, clearSecrets: true });
                      setSmsEnabled(false);
                      setStatusFeedback({
                        type: 'success',
                        message: 'کلیدهای امنیتی درگاه پاک شد و درگاه غیرفعال گردید.',
                      });
                    }}
                    className="text-xs font-bold text-rose-700 hover:underline cursor-pointer"
                  >
                    حذف کلید ذخیره شده و غیرفعال‌سازی
                  </button>
                ) : (
                  <span />
                )}
                <button
                  type="submit"
                  disabled={savingSms}
                  className="px-5 py-2.5 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{savingSms ? 'در حال ذخیره...' : 'ذخیره تنظیمات درگاه پیامک'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Test SMS & Status Card */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
                <Send className="w-4 h-4 text-indigo-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">تست واقعی اتصال و ارسال پیامک</h3>
                  <p className="text-[11px] text-slate-500">
                    بررسی صحت کلید API، خط ارسال‌کننده و پاسخ واقعی وب‌سرویس
                  </p>
                </div>
              </div>

              {smsConfig?.lastTestedAt && (
                <div
                  className={`p-3 rounded-xl border text-xs space-y-1 ${
                    smsConfig.lastTestStatus === 'SUCCESS'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-amber-50 border-amber-200 text-amber-900'
                  }`}
                >
                  <div className="font-bold flex items-center justify-between">
                    <span>آخرین وضعیت تست ثبت‌شده:</span>
                    <span className="font-mono-num text-[11px]">{smsConfig.lastTestedAt}</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">{smsConfig.lastTestMessage}</p>
                </div>
              )}

              <form onSubmit={handleRunSmsTest} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    شماره موبایل گیرنده تست *
                  </label>
                  <input
                    type="text"
                    required
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    placeholder="0912..."
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono-num dir-ltr text-right"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    متن پیامک آزمایشی (اختیاری)
                  </label>
                  <input
                    type="text"
                    value={testMsg}
                    onChange={(e) => setTestMsg(e.target.value)}
                    placeholder="پیامک تست اتصال درگاه پرتال خزانه‌داری آریا"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                </div>

                {testResult && (
                  <div
                    className={`p-3 rounded-xl border text-xs space-y-1 ${
                      testResult.ok
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        : 'bg-rose-50 border-rose-200 text-rose-900'
                    }`}
                  >
                    <div className="font-bold">{testResult.message}</div>
                    {testResult.details && (
                      <div className="text-[10px] font-mono break-all opacity-80">
                        {testResult.details}
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={testingSms}
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{testingSms ? 'در حال ارسال به وب‌سرویس...' : 'ارسال پیامک آزمایشی'}</span>
                </button>
              </form>
            </div>

            {/* Recent SMS Dispatch Logs */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-3">
              <h4 className="text-xs font-bold text-slate-900 border-b border-slate-200 pb-2">
                لاگ آخرین تلاش‌های ارسال پیامک ({smsLogs.length} مورد)
              </h4>
              {smsLogs.length === 0 ? (
                <div className="text-xs text-slate-500 py-4 text-center">
                  هنوز هیچ درخواست ارسال پیامکی در لاگ ثبت نشده است.
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                  {smsLogs.slice(0, 20).map((log) => (
                    <div
                      key={log.id}
                      className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-[11px] space-y-1"
                    >
                      <div className="flex items-center justify-between font-bold">
                        <span className="text-slate-800">
                          {log.recipientName} ({log.recipientPhone})
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] ${
                            log.status === 'SENT'
                              ? 'bg-emerald-100 text-emerald-800'
                              : log.status === 'SKIPPED_DISABLED'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {log.status === 'SENT'
                            ? 'ارسال موفق'
                            : log.status === 'SKIPPED_DISABLED'
                            ? 'ارسال نشد (درگاه غیرفعال)'
                            : 'خطای درگاه'}
                        </span>
                      </div>
                      <div className="text-slate-600">{log.messageSummary}</div>
                      {log.errorMessage && (
                        <div className="text-rose-700 font-semibold">علت: {log.errorMessage}</div>
                      )}
                      <div className="text-[10px] text-slate-400 font-mono-num flex justify-between">
                        <span>درگاه: {log.provider}</span>
                        <span>{log.timestamp}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // MASTER_DATA MODE
  return (
    <div className="space-y-5">
      {/* Header & Search for active Master Data Sub-section */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-2.5">
          {masterSubTab === 'COMPANIES' && (
            <>
              <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  اطلاعات پایه: تعریف شرکت‌ها و سازمان‌ها ({companies.length} مورد)
                </h2>
                <p className="text-[11px] text-slate-500">
                  مدیریت شرکت‌های زیرمجموعه هلدینگ، شناسه ملی و وضعیت فعال در فرم‌های مالی
                </p>
              </div>
            </>
          )}
          {masterSubTab === 'DEPARTMENTS' && (
            <>
              <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center">
                <FolderTree className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  اطلاعات پایه: تعریف واحدهای سازمانی ({departments.length} مورد)
                </h2>
                <p className="text-[11px] text-slate-500">
                  تعریف چارت واحدها و دپارتمان‌های متصل به هر شرکت جهت انتساب پرسنل و سرپرستان
                </p>
              </div>
            </>
          )}
          {masterSubTab === 'COST_CENTERS' && (
            <>
              <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  اطلاعات پایه: تعریف مراکز هزینه ({costCenters.length} مورد)
                </h2>
                <p className="text-[11px] text-slate-500">
                  مدیریت کدهای مرکز هزینه و سرفصل‌های بودجه‌ای قابل انتخاب در دستورات پرداخت
                </p>
              </div>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {masterSubTab!=='COMPANIES'&&<button type="button" onClick={()=>setBulkKind(masterSubTab==='DEPARTMENTS'?'departments':'cost-centers')} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-blue-700 hover:bg-blue-800 text-white rounded-lg"><Plus className="w-3.5 h-3.5"/>تعریف گروهی</button>}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="جست‌وجو در کد یا عنوان..."
            className="w-full pr-9 pl-3 py-1.5 text-xs border border-slate-300 rounded-lg"
          />
        </div>
        </div>
      </div>

      {statusFeedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-bold flex items-center justify-between gap-2 ${
            statusFeedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{statusFeedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusFeedback(null)}
            className="text-xs underline cursor-pointer"
          >
            بستن
          </button>
        </div>
      )}

      {/* SUB-TAB 1: COMPANIES */}
      {masterSubTab === 'COMPANIES' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 shadow-2xs h-fit">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-3 mb-4 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-700" />
              <span>{editingCompId ? 'ویرایش شرکت / سازمان' : 'تعریف شرکت / سازمان جدید'}</span>
            </h3>
            <form onSubmit={handleCompanySubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  کد یکتای شرکت (خودکار)
                </label>
                <input
                  type="text"
                  readOnly
                  aria-label="کد یکتای شرکت"
                  value={editingCompId?compCode:codePreview('companies')}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono-num"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  نام رسمی شرکت / سازمان *
                </label>
                <input
                  type="text"
                  required
                  value={compName}
                  onChange={(e) => setCompName(e.target.value)}
                  placeholder="مثال: شرکت مهندسی و ساخت آریا"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  شناسه ملی / کد اقتصادی (رشته متنی با حفظ صفر ابتدایی)
                </label>
                <input
                  type="text"
                  value={compNationalId}
                  onChange={(e) => setCompNationalId(e.target.value)}
                  placeholder="مثال: 10102938471"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono-num"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">توضیحات</label>
                <input
                  type="text"
                  value={compDesc}
                  onChange={(e) => setCompDesc(e.target.value)}
                  placeholder="شرح حوزه فعالیت..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>
              <div className="flex items-center justify-between pt-1">
                <label className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={compActive}
                    onChange={(e) => setCompActive(e.target.checked)}
                  />
                  <span>فعال در فرم‌های جدید</span>
                </label>
                <label className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={compDefault}
                    onChange={(e) => setCompDefault(e.target.checked)}
                  />
                  <span>شرکت پیش‌فرض</span>
                </label>
              </div>
              <div className="flex items-center gap-2 pt-2">
                {editingCompId && (
                  <button
                    type="button"
                    onClick={resetCompanyForm}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-600 cursor-pointer"
                  >
                    انصراف
                  </button>
                )}
                <button
                  type="submit"
                  disabled={savingComp}
                  className="flex-1 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{editingCompId ? 'ذخیره تغییرات شرکت' : 'ثبت شرکت جدید'}</span>
                </button>
              </div>
            </form>
          </div>

          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
            <div className="w-full overflow-hidden">
              <table className="w-full table-auto text-xs text-right">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">کد شرکت</th>
                    <th className="p-3">نام شرکت / سازمان</th>
                    <th className="p-3">شناسه ملی</th>
                    <th className="p-3">وضعیت</th>
                    <th className="p-3 text-left">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredCompanies.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono-num font-bold text-slate-900">{c.code}</td>
                      <td className="p-3">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <span>{c.name}</span>
                          {c.isDefault && (
                            <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px]">
                              پیش‌فرض
                            </span>
                          )}
                        </div>
                        {c.description && (
                          <div className="text-[11px] text-slate-500 mt-0.5">{c.description}</div>
                        )}
                      </td>
                      <td className="p-3 font-mono-num text-slate-600">{c.nationalId || '—'}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            c.isActive
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {c.isActive ? 'فعال' : 'غیرفعال'}
                        </span>
                      </td>
                      <td className="p-3 text-left">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCompId(c.id);
                              setCompCode(c.code);
                              setCompName(c.name);
                              setCompNationalId(c.nationalId || '');
                              setCompDesc(c.description || '');
                              setCompActive(c.isActive);
                              setCompDefault(Boolean(c.isDefault));
                            }}
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 cursor-pointer"
                            title="ویرایش"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              const res = await onToggleCompanyStatus(c.id, !c.isActive);
                              if (!res.ok) {
                                setStatusFeedback({
                                  type: 'error',
                                  message: res.error || 'خطا در تغییر وضعیت شرکت',
                                });
                              } else {
                                setStatusFeedback({
                                  type: 'success',
                                  message: `وضعیت شرکت «${c.name}» تغییر یافت.`,
                                });
                              }
                            }}
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-amber-700 cursor-pointer"
                            title={c.isActive ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              const res = await onDeleteCompany(c.id);
                              if (!res.ok) {
                                setStatusFeedback({
                                  type: 'error',
                                  message: res.error || 'امکان حذف شرکت وجود ندارد.',
                                });
                              } else {
                                setStatusFeedback({
                                  type: 'success',
                                  message: `شرکت «${c.name}» حذف شد.`,
                                });
                              }
                            }}
                            className="p-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-700 cursor-pointer"
                            title="حذف (فقط در صورت عدم استفاده در سوابق)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: DEPARTMENTS */}
      {masterSubTab === 'DEPARTMENTS' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 shadow-2xs h-fit">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-3 mb-4 flex items-center gap-2">
              <FolderTree className="w-4 h-4 text-blue-700" />
              <span>{editingDeptId ? 'ویرایش واحد سازمانی' : 'تعریف واحد سازمانی جدید'}</span>
            </h3>
            <form onSubmit={handleDeptSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  کد واحد سازمانی (خودکار)
                </label>
                <input
                  type="text"
                  readOnly
                  aria-label="کد واحد سازمانی"
                  value={editingDeptId?deptCode:codePreview('departments')}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono-num"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  عنوان واحد سازمانی *
                </label>
                <input
                  type="text"
                  required
                  value={deptName}
                  onChange={(e) => setDeptName(e.target.value)}
                  placeholder="مثال: برنامه‌ریزی و کنترل پروژه"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  شرکت / سازمان متبوع *
                </label>
                <select
                  value={deptCompanyId}
                  onChange={(e) => setDeptCompanyId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {!c.isActive ? '(غیرفعال)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">توضیحات</label>
                <input
                  type="text"
                  value={deptDesc}
                  onChange={(e) => setDeptDesc(e.target.value)}
                  placeholder="شرح وظایف واحد..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>
              <label className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={deptActive}
                  onChange={(e) => setDeptActive(e.target.checked)}
                />
                <span>واحد فعال است</span>
              </label>
              <div className="flex items-center gap-2 pt-2">
                {editingDeptId && (
                  <button
                    type="button"
                    onClick={resetDeptForm}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-600 cursor-pointer"
                  >
                    انصراف
                  </button>
                )}
                <button
                  type="submit"
                  disabled={savingDept}
                  className="flex-1 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{editingDeptId ? 'ذخیره تغییرات واحد' : 'ثبت واحد سازمانی'}</span>
                </button>
              </div>
            </form>
          </div>

          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
            <div className="w-full overflow-hidden">
              <table className="w-full table-auto text-xs text-right">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">کد واحد</th>
                    <th className="p-3">عنوان واحد سازمانی</th>
                    <th className="p-3">شرکت متبوع</th>
                    <th className="p-3">وضعیت</th>
                    <th className="p-3 text-left">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredDepartments.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono-num font-bold text-slate-900">{d.code}</td>
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{d.name}</div>
                        {d.description && (
                          <div className="text-[11px] text-slate-500 mt-0.5">{d.description}</div>
                        )}
                      </td>
                      <td className="p-3 text-slate-700">{d.companyName}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            d.isActive
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {d.isActive ? 'فعال' : 'غیرفعال'}
                        </span>
                      </td>
                      <td className="p-3 text-left">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingDeptId(d.id);
                              setDeptCode(d.code);
                              setDeptName(d.name);
                              setDeptCompanyId(d.companyId);
                              setDeptDesc(d.description || '');
                              setDeptActive(d.isActive);
                            }}
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 cursor-pointer"
                            title="ویرایش"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              const res = await onToggleDepartmentStatus(d.id, !d.isActive);
                              if (!res.ok) {
                                setStatusFeedback({
                                  type: 'error',
                                  message: res.error || 'خطا در تغییر وضعیت واحد',
                                });
                              } else {
                                setStatusFeedback({
                                  type: 'success',
                                  message: `وضعیت واحد «${d.name}» تغییر یافت.`,
                                });
                              }
                            }}
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-amber-700 cursor-pointer"
                            title={d.isActive ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              const res = await onDeleteDepartment(d.id);
                              if (!res.ok) {
                                setStatusFeedback({
                                  type: 'error',
                                  message: res.error || 'حذف واحد مجاز نیست.',
                                });
                              } else {
                                setStatusFeedback({
                                  type: 'success',
                                  message: `واحد «${d.name}» حذف شد.`,
                                });
                              }
                            }}
                            className="p-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-700 cursor-pointer"
                            title="حذف (فقط در صورت عدم استفاده)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: COST CENTERS */}
      {masterSubTab === 'COST_CENTERS' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 shadow-2xs h-fit">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-3 mb-4 flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-700" />
              <span>{editingCcId ? 'ویرایش مرکز هزینه' : 'تعریف مرکز هزینه جدید'}</span>
            </h3>
            <form onSubmit={handleCcSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  کد مرکز هزینه (خودکار؛ با حفظ صفر ابتدایی)
                </label>
                <input
                  type="text"
                  readOnly
                  aria-label="کد مرکز هزینه"
                  value={editingCcId?ccCode:codePreview('cost-centers')}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono-num"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  عنوان مرکز هزینه *
                </label>
                <input
                  type="text"
                  required
                  value={ccName}
                  onChange={(e) => setCcName(e.target.value)}
                  placeholder="مثال: پروژه توسعه دیتاسنتر غرب"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  شرکت مرتبط *
                </label>
                <select
                  value={ccCompanyId}
                  onChange={(e) => setCcCompanyId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  واحد سازمانی مرتبط (اختیاری)
                </label>
                <select
                  value={ccDepartmentId}
                  onChange={(e) => setCcDepartmentId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  <option value="">عمومی / مشترک بین واحدها</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.companyName})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  طبقه بودجه‌ای
                </label>
                <select
                  value={ccCategory}
                  onChange={(e) => setCcCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  <option value="عملیاتی">هزینه‌های عملیاتی و تولید (OPEX)</option>
                  <option value="سرمایه‌ای">پروژه‌های سرمایه‌ای و خرید دارایی (CAPEX)</option>
                  <option value="پشتیبانی">پشتیبانی، اداری و ستادی</option>
                  <option value="بازرگانی">فروش، بازاریابی و لجستیک</option>
                </select>
              </div>
              <label className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ccActive}
                  onChange={(e) => setCcActive(e.target.checked)}
                />
                <span>مرکز هزینه فعال و قابل انتخاب در ثبت درخواست</span>
              </label>
              <div className="flex items-center gap-2 pt-2">
                {editingCcId && (
                  <button
                    type="button"
                    onClick={resetCcForm}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-600 cursor-pointer"
                  >
                    انصراف
                  </button>
                )}
                <button
                  type="submit"
                  disabled={savingCc}
                  className="flex-1 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{editingCcId ? 'ذخیره تغییرات مرکز هزینه' : 'ثبت مرکز هزینه جدید'}</span>
                </button>
              </div>
            </form>
          </div>

          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
            <div className="w-full overflow-hidden">
              <table className="w-full table-auto text-xs text-right">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">کد مرکز</th>
                    <th className="p-3">عنوان مرکز هزینه</th>
                    <th className="p-3">شرکت / واحد</th>
                    <th className="p-3">طبقه</th>
                    <th className="p-3">وضعیت</th>
                    <th className="p-3 text-left">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredCostCenters.map((cc) => (
                    <tr key={cc.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono-num font-bold text-slate-900">{cc.code}</td>
                      <td className="p-3 font-bold text-slate-900">{cc.name}</td>
                      <td className="p-3 text-slate-600">
                        <div>{cc.companyName}</div>
                        <div className="text-[10px] text-slate-400">
                          {cc.departmentName || 'مشترک کلیه واحدها'}
                        </div>
                      </td>
                      <td className="p-3 text-slate-600">{cc.budgetCategory || 'عملیاتی'}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            cc.isActive
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {cc.isActive ? 'فعال' : 'غیرفعال'}
                        </span>
                      </td>
                      <td className="p-3 text-left">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCcId(cc.id);
                              setCcCode(cc.code);
                              setCcName(cc.name);
                              setCcCompanyId(cc.companyId);
                              setCcDepartmentId(cc.departmentId || '');
                              setCcCategory(cc.budgetCategory || 'عملیاتی');
                              setCcDesc(cc.description || '');
                              setCcActive(cc.isActive);
                            }}
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 cursor-pointer"
                            title="ویرایش"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              const res = await onToggleCostCenterStatus(cc.id, !cc.isActive);
                              if (!res.ok) {
                                setStatusFeedback({
                                  type: 'error',
                                  message: res.error || 'خطا در تغییر وضعیت مرکز هزینه',
                                });
                              } else {
                                setStatusFeedback({
                                  type: 'success',
                                  message: `وضعیت مرکز هزینه «${cc.name}» تغییر یافت.`,
                                });
                              }
                            }}
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-amber-700 cursor-pointer"
                            title={cc.isActive ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              const res = await onDeleteCostCenter(cc.id);
                              if (!res.ok) {
                                setStatusFeedback({
                                  type: 'error',
                                  message: res.error || 'حذف مرکز هزینه مجاز نیست.',
                                });
                              } else {
                                setStatusFeedback({
                                  type: 'success',
                                  message: `مرکز هزینه «${cc.name}» حذف شد.`,
                                });
                              }
                            }}
                            className="p-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-700 cursor-pointer"
                            title="حذف (فقط در صورت عدم استفاده در اسناد)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      {bulkKind&&<MasterDataBulkDialog kind={bulkKind} companies={companies} departments={departments} initialCompanyId={bulkKind==='departments'?deptCompanyId:ccCompanyId} onClose={()=>setBulkKind(null)} onSave={onBulkCreateMasterData}/>}
    </div>
  );
};
