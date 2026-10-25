import express from 'express';
import {parseReportFilters,buildFinancialReportAsync,financialReportPage,reportError} from './src/utils/financial-report';
import {financialReportState,reportSourceStillVisible} from './src/server/financial-report';
import compression from 'compression';
import {freeze} from 'immer';
import {createMutationRoutes} from './src/server/mutation-queue';
import {installBankInquiry} from './src/server/bank-inquiry-runtime';
import {stopServer,PendingWork} from './src/server/shutdown';
import {StateSync} from './src/server/state-sync';
import {CommittedJson} from './src/server/committed-json';
import {SqliteRecords} from './src/server/sqlite-records';
import {STORE_LOCK_NAME} from './src/server/owner-lock';
import {companyPolicy} from './src/server/company-access';
import {notificationVisible,notificationDeliveryEligible,notificationQueueAllowed} from './src/server/notification-access';
import {notificationAudiences,paymentNotificationDrafts,reviewedNotification,NOTIFICATION_RETENTION} from './src/server/notification-routing';
import {documentInputError,xmlText} from './src/server/documents';
import { todayJalali as getTodayJalali, currentJalaliMonth } from './src/utils/current-date';
import {normalizeFormDates} from './src/server/form-dates';
import {externalInputError,entryOperation,previousEntry} from './src/server/external-entry';
import crypto from 'crypto';
const backgroundWrites=new PendingWork();
let wakeBankInquiry=()=>{};
import fs from 'fs';
import path from 'path';
import { authorizeRequest, canSeeRequest, canSeeNotificationTarget, scopeState } from './src/server/access-control';
import { getUserRoles, hasSupervisorPermissions } from './src/utils/user-roles';
import { applySubmittedChanges, markReviewStarted, validateSubmittedChanges } from './src/utils/request-edit';
import {activeRequestProjection,publicBatch,markRequesterDeleted} from './src/utils/request-deletion';
import {bankFieldsError,normalizedBankFields,bankIdentifierChanged} from './src/utils/bank-identifiers';
import {treasuryInput,validPaymentAllocation} from './src/server/treasury-input';
import {privateSmsEvent,safeSmsLog,readSmsProviderBody} from './src/server/sms-security';
import {reviewEditError,reviewEditEntry} from './src/utils/review-edit';
import {prepareReviewCostCenter,applyReviewCostCenter,ReviewCostCenterError} from './src/server/review-cost-center';
import { allocateMasterDataCode, immutableMasterDataCode, retainMasterDataHighWater, createMasterDataRow } from './src/server/master-data';
import {applyRejectionDecision,type ReviewRow} from './src/utils/review-rejection';
import {correctionTarget,correctionRecipientId,correctionStageAllowed,applyTreasuryReturn,applyTreasuryCorrection} from './src/server/treasury-correction';
import {openTreasuryCorrection} from './src/utils/treasury-correction';
import {permissionPatchError,effectiveNavigationPermissions} from './src/utils/permission-registry';
import {roleCompaniesError} from './src/utils/role-companies';
import {assessBankImport,bankImportShapeError,bankAccountBankName,type BankImportInput} from './src/utils/bank-account-import';
import type {
  TreasuryDatabaseState,
  AdvanceRequest,
  PaymentRequest,
  BatchPaymentRequest,
  ManualPayment,
  DailyCover,
  ReceiptArchive,
  User,
  Role,
  AccessScope,
  RolePermissionSet,
  RoleDefinitionConfig,
  SecurityAuditLogEntry,
  PasswordRecoveryRequest,
  UserSessionRecord,
  UserPersonalPreferences,
  RequestStatus,
  AppNotification,
  CompanyBankAccount,
  SourceBankAccountSnapshot,
  PaymentExecutionRecord,
  PaymentMethodType,
  OrganizationCompany,
  OrganizationalDepartment,
  CostCenterItem,
  SmsGatewayProvider,
  SmsGatewayConfig,
  SmsDispatchLogEntry,
  BuiltInRole,
} from './src/types/treasury';
import {
  getDefaultPermissionsForRole,
  normalizeRolePermissionSet,
} from './src/types/treasury';

function normalizeDigitsServer(input: unknown): string {
  if (input === null || input === undefined) return '';
  return String(input)
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

function getDefaultCompanies(): OrganizationCompany[] {
  return [
    {
      id: 'cmp-1',
      code: '01',
      name: 'هلدینگ مرکزی آریا',
      nationalId: '10104589201',
      description: 'شرکت مادر تخصصی و ستاد مرکزی گروه آریا',
      isActive: true,
      isDefault: true,
      createdAt: '1403/08/01',
      updatedAt: getTodayJalali(),
    },
    {
      id: 'cmp-2',
      code: '02',
      name: 'شرکت توسعه فناوری آریا',
      nationalId: '14008911204',
      description: 'واحد توسعه نرم‌افزار، زیرساخت ابری و دیتاسنتر',
      isActive: true,
      isDefault: false,
      createdAt: '1403/08/01',
      updatedAt: getTodayJalali(),
    },
    {
      id: 'cmp-3',
      code: '03',
      name: 'شرکت بازرگانی و لجستیک آریا',
      nationalId: '14005532109',
      description: 'تامین، بازرگانی، انبارداری و توزیع سراسری',
      isActive: true,
      isDefault: false,
      createdAt: '1403/08/01',
      updatedAt: getTodayJalali(),
    },
  ];
}

function getDefaultDepartments(): OrganizationalDepartment[] {
  return [
    {
      id: 'dept-1',
      code: '0101',
      name: 'فنی و مهندسی',
      companyId: 'cmp-1',
      companyName: 'هلدینگ مرکزی آریا',
      description: 'توسعه فنی، مهندسی و پشتیبانی زیرساخت',
      isActive: true,
      createdAt: '1403/08/01',
      updatedAt: getTodayJalali(),
    },
    {
      id: 'dept-2',
      code: '0102',
      name: 'فروش و بازرگانی',
      companyId: 'cmp-1',
      companyName: 'هلدینگ مرکزی آریا',
      description: 'فروش سازمانی، بازاریابی و امور قراردادها',
      isActive: true,
      createdAt: '1403/08/01',
      updatedAt: getTodayJalali(),
    },
    {
      id: 'dept-3',
      code: '0103',
      name: 'مالی و حسابداری',
      companyId: 'cmp-1',
      companyName: 'هلدینگ مرکزی آریا',
      description: 'کنترل مالی، حسابرسی اسناد و بودجه',
      isActive: true,
      createdAt: '1403/08/01',
      updatedAt: getTodayJalali(),
    },
    {
      id: 'dept-4',
      code: '0104',
      name: 'خزانه‌داری و پرداخت',
      companyId: 'cmp-1',
      companyName: 'هلدینگ مرکزی آریا',
      description: 'مدیریت نقدینگی، حساب‌های بانکی و اجرای پرداخت',
      isActive: true,
      createdAt: '1403/08/01',
      updatedAt: getTodayJalali(),
    },
    {
      id: 'dept-5',
      code: '0105',
      name: 'عملیات و لجستیک',
      companyId: 'cmp-3',
      companyName: 'شرکت بازرگانی و لجستیک آریا',
      description: 'عملیات اجرایی، تدارکات و حمل‌ونقل',
      isActive: true,
      createdAt: '1403/08/01',
      updatedAt: getTodayJalali(),
    },
    {
      id: 'dept-6',
      code: '0106',
      name: 'منابع انسانی و اداری',
      companyId: 'cmp-1',
      companyName: 'هلدینگ مرکزی آریا',
      description: 'امور کارگزینی، رفاهی، حقوق و دستمزد',
      isActive: true,
      createdAt: '1403/08/01',
      updatedAt: getTodayJalali(),
    },
    {
      id: 'dept-7',
      code: '0107',
      name: 'فناوری اطلاعات و مدیریت',
      companyId: 'cmp-2',
      companyName: 'شرکت توسعه فناوری آریا',
      description: 'مدیریت سامانه‌ها، امنیت شبکه و راهبری فناوری',
      isActive: true,
      createdAt: '1403/08/01',
      updatedAt: getTodayJalali(),
    },
  ];
}

function getDefaultCostCenters(): CostCenterItem[] {
  return [
    {
      id: 'cc-1',
      code: 'CC-0101',
      name: 'فنی و مهندسی',
      companyId: 'cmp-1',
      companyName: 'هلدینگ مرکزی آریا',
      departmentId: 'dept-1',
      departmentName: 'فنی و مهندسی',
      budgetLimitRial: 5000000000,
      description: 'مرکز هزینه جاری مهندسی، شبکه و نگهداری سرورها',
      isActive: true,
      createdAt: '1403/08/01',
      updatedAt: getTodayJalali(),
    },
    {
      id: 'cc-2',
      code: 'CC-0102',
      name: 'فروش و بازرگانی',
      companyId: 'cmp-1',
      companyName: 'هلدینگ مرکزی آریا',
      departmentId: 'dept-2',
      departmentName: 'فروش و بازرگانی',
      budgetLimitRial: 3500000000,
      description: 'مرکز هزینه بازاریابی، نمایشگاه‌ها و عملیات فروش',
      isActive: true,
      createdAt: '1403/08/01',
      updatedAt: getTodayJalali(),
    },
    {
      id: 'cc-3',
      code: 'CC-0103',
      name: 'عملیات و لجستیک',
      companyId: 'cmp-3',
      companyName: 'شرکت بازرگانی و لجستیک آریا',
      departmentId: 'dept-5',
      departmentName: 'عملیات و لجستیک',
      budgetLimitRial: 4000000000,
      description: 'مرکز هزینه ناوگان، انبارها و توزیع کالا',
      isActive: true,
      createdAt: '1403/08/01',
      updatedAt: getTodayJalali(),
    },
    {
      id: 'cc-4',
      code: 'CC-0104',
      name: 'پروژه توسعه زیرساخت ابری (فاز ۲)',
      companyId: 'cmp-2',
      companyName: 'شرکت توسعه فناوری آریا',
      departmentId: 'dept-7',
      departmentName: 'فناوری اطلاعات و مدیریت',
      budgetLimitRial: 8000000000,
      description: 'مرکز هزینه سرمایه‌ای توسعه دیتاسنتر و کانتینرها',
      isActive: true,
      createdAt: '1403/08/01',
      updatedAt: getTodayJalali(),
    },
    {
      id: 'cc-5',
      code: 'CC-0105',
      name: 'عمومی و اداری',
      companyId: 'cmp-1',
      companyName: 'هلدینگ مرکزی آریا',
      departmentId: 'dept-6',
      departmentName: 'منابع انسانی و اداری',
      budgetLimitRial: 2500000000,
      description: 'هزینه‌های جاری ستاد مرکزی، تشریفات و ملزومات اداری',
      isActive: true,
      createdAt: '1403/08/01',
      updatedAt: getTodayJalali(),
    },
    {
      id: 'cc-6',
      code: 'CC-0106',
      name: 'پروژه خط ۳ کارگاه اصفهان',
      companyId: 'cmp-1',
      companyName: 'هلدینگ مرکزی آریا',
      departmentId: 'dept-1',
      departmentName: 'فنی و مهندسی',
      budgetLimitRial: 6000000000,
      description: 'مرکز هزینه اجرایی و ماموریت‌های کارگاه اصفهان',
      isActive: true,
      createdAt: '1403/08/01',
      updatedAt: getTodayJalali(),
    },
  ];
}

function getDefaultSmsConfig(): SmsGatewayConfig {
  const envKey = String(process.env.SMS_API_KEY || '').trim();
  const envSender = String(process.env.SMS_SENDER_NUMBER || '').trim();
  const envUrl = String(process.env.SMS_API_URL || '').trim();
  return {
    enabled: Boolean(envKey && envSender),
    provider: 'KAVENEGAR',
    apiUrl: envUrl || 'https://api.kavenegar.com/v1/{API_KEY}/sms/send.json',
    senderNumber: envSender || '10008663',
    apiKey: envKey,
    events: {
      sendOtpOnRecovery: true,
      sendOnAdminPasswordReset: true,
      sendOnPasswordReset: true,
      sendOnRequestSubmitted: false,
      sendOnPendingApproval: true,
      sendOnReturnedForRevision: true,
      sendOnRevisionOrReject: true,
      sendOnFinalApproval: true,
      sendOnPaymentExecuted: true,
    },
    updatedAt: getTodayJalali(),
    updatedBy: 'سیستم',
  };
}

function sanitizeSmsConfigForClient(cfg?: SmsGatewayConfig): SmsGatewayConfig {
  const base = cfg || getDefaultSmsConfig();
  const rawKey = String(base.apiKey || '').trim();
  const hasApiKey = rawKey.length > 0 || Boolean(base.password);
  const maskedApiKey = hasApiKey
    ? rawKey.length > 4
      ? `••••••••${rawKey.slice(-4)}`
      : '••••••••'
    : '';
  const { apiKey: _secret, password: _pass, ...rest } = base;
  return {
    ...rest,
    hasApiKey,
    maskedApiKey,
  };
}

async function dispatchRealSms(
  db: TreasuryDatabaseState,
  params: {
    eventType: SmsDispatchLogEntry['eventType'];
    recipientName: string;
    recipientPhone: string;
    message: string;
    relatedTrackingCode?: string;
  }
): Promise<{
  ok: boolean;
  status: 'SENT' | 'FAILED' | 'SKIPPED_NOT_CONFIGURED' | 'SKIPPED_DISABLED';
  error?: string;
  providerResponse?: string;
  logEntry: SmsDispatchLogEntry;
}> {
  if (!db.smsConfig) db.smsConfig = getDefaultSmsConfig();
  if (!db.smsLogs) db.smsLogs = [];

  const cfg = process.env.DISABLE_EXTERNAL_INTEGRATIONS === 'true' ? { ...db.smsConfig, enabled: false } : db.smsConfig;
  const cleanPhone = normalizeDigitsServer(params.recipientPhone).trim();
  const nowStr = `${getTodayJalali()} - ${new Date().toTimeString().slice(0, 8)}`;

  const recordLog = (
    status: SmsDispatchLogEntry['status'],
    errorDetail?: string | null,
    providerMessageId?: string | null
  ): SmsDispatchLogEntry => {
    const preview = params.message.slice(0, 160);
    const entry: SmsDispatchLogEntry = {
      id: `sms-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      eventType: params.eventType,
      recipientName: params.recipientName,
      recipientPhone: cleanPhone || 'نامشخص',
      messagePreview: preview,
      messageSummary: preview,
      provider: cfg.provider,
      status,
      providerMessageId: providerMessageId || null,
      errorDetail: errorDetail || null,
      errorMessage: errorDetail || null,
      relatedTrackingCode: params.relatedTrackingCode || null,
      createdAt: nowStr,
      timestamp: nowStr,
    };
    const safeEntry=safeSmsLog(entry);
    db.smsLogs!.unshift(safeEntry);
    if (db.smsLogs!.length > 200) {
      db.smsLogs = db.smsLogs!.slice(0, 200);
    }
    return safeEntry;
  };

  if (!cleanPhone || !/^09\d{9}$/.test(cleanPhone)) {
    const err = 'شماره تلفن همراه گیرنده معتبر نیست (باید ۱۱ رقم با پیش‌شماره 09 باشد).';
    const logEntry = recordLog('FAILED', err);
    return { ok: false, status: 'FAILED', error: err, providerResponse: err, logEntry };
  }

  const rawKey = String(cfg.apiKey || process.env.SMS_API_KEY || '').trim();
  const rawSender = String(cfg.senderNumber || process.env.SMS_SENDER_NUMBER || '').trim();
  const rawUrl = String(cfg.apiUrl || '').trim();

  if (!cfg.enabled || !rawKey || !rawSender || !rawUrl) {
    const reason = !cfg.enabled
      ? 'ارسال پیامک در تنظیمات سامانه غیرفعال است.'
      : 'کلید وب‌سرویس (API Key) یا شماره خط فرستنده درگاه پیامک در تنظیمات سرور ثبت نشده است.';
    const statusCode = !cfg.enabled ? 'SKIPPED_DISABLED' : 'SKIPPED_NOT_CONFIGURED';
    const logEntry = recordLog(statusCode, reason);
    return { ok: false, status: statusCode, error: reason, providerResponse: reason, logEntry };
  }

  let timeoutId:ReturnType<typeof setTimeout>|undefined;
  try {
    const resolvedUrl = rawUrl.replace('{API_KEY}', encodeURIComponent(rawKey));
    const parsedUrl = new URL(resolvedUrl);

    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), 5000);

    let response: Response;
    if (cfg.provider === 'KAVENEGAR') {
      const formParams = new URLSearchParams({
        receptor: cleanPhone,
        sender: rawSender,
        message: params.message,
      });
      response = await fetch(`${parsedUrl.toString()}?${formParams.toString()}`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
    } else {
      response = await fetch(parsedUrl.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${rawKey}`,
          'X-API-KEY': rawKey,
        },
        body: JSON.stringify({
          receptor: cleanPhone,
          to: cleanPhone,
          mobile: cleanPhone,
          sender: rawSender,
          from: rawSender,
          lineNumber: rawSender,
          message: params.message,
          text: params.message,
        }),
        signal: controller.signal,
      });
    }
    if (!response.ok) {
      void response.body?.cancel().catch(()=>{});
      const errMsg = `خطای وب‌سرویس پیامک (${cfg.provider}): کد وضعیت HTTP ${response.status}`;
      const logEntry = recordLog('FAILED', errMsg);
      return { ok: false, status: 'FAILED', error: errMsg, providerResponse: errMsg, logEntry };
    }

    const respJson: any = JSON.parse(await readSmsProviderBody(response));
    const msgId = String(
      respJson?.entries?.[0]?.messageid ||
        respJson?.messageId ||
        respJson?.data?.messageId ||
        respJson?.RetStatus ||
        `MSG-${Date.now()}`
    );
    const safeMessageId=/^[\w.:-]{1,100}$/.test(msgId)&&![rawKey,cfg.password].filter(Boolean).some(secret=>msgId.includes(String(secret)))?msgId:null;
    const logEntry = recordLog('SENT', null, safeMessageId);
    return { ok: true, status: 'SENT', providerResponse: privateSmsEvent(params.eventType)?'پیام امنیتی ارسال شد.':`MessageID: ${safeMessageId||'ثبت شد'}`, logEntry };
  } catch (err: any) {
    const errMsg = `عدم امکان برقراری ارتباط با درگاه پیامک (${cfg.provider}): ${
      err?.name === 'AbortError' ? 'مهلت زمانی اتصال منقضی شد (Timeout)' : 'خطای ارتباط یا پاسخ نامعتبر'
    }`;
    const logEntry = recordLog('FAILED', errMsg);
    return { ok: false, status: 'FAILED', error: errMsg, providerResponse: errMsg, logEntry };
  } finally { if(timeoutId!==undefined)clearTimeout(timeoutId); }
}

function getDefaultCompanyBankAccounts(): CompanyBankAccount[] {
  return [
    {
      id: 'bnk-acc-1',
      bankName: 'بانک ملت',
      accountTitle: 'جاری عملیاتی خزانه مرکزی',
      companyName: 'هلدینگ مرکزی آریا',
      accountNumber: '0109482711004',
      iban: 'IR520120000000109482711004',
      cardNumber: '6104337890124455',
      branchName: 'شعبه مرکزی ونک',
      branchCode: '0214',
      accountType: 'جاری',
      currency: 'IRR',
      allowedPaymentMethods: ['PAYA', 'SATNA', 'CARD', 'INTERNAL', 'CHECK'],
      isDefault: true,
      isActive: true,
      description: 'حساب اصلی پرداخت‌های روزمره، پایا و ساتنا',
      createdAt: '1403/08/01',
      updatedAt: getTodayJalali(),
    },
    {
      id: 'bnk-acc-2',
      bankName: 'بانک پاسارگاد',
      accountTitle: 'جاری تسویه تامین‌کنندگان و پروژه‌ها',
      companyName: 'هلدینگ مرکزی آریا',
      accountNumber: '0201148902008',
      iban: 'IR880570020180011489020081',
      cardNumber: '5022291044558899',
      branchName: 'شعبه آفریقا',
      branchCode: '0201',
      accountType: 'جاری',
      currency: 'IRR',
      allowedPaymentMethods: ['PAYA', 'SATNA', 'INTERNAL'],
      isDefault: false,
      isActive: true,
      description: 'ویژه پرداخت قراردادهای فناوری و تامین‌کنندگان',
      createdAt: '1403/08/01',
      updatedAt: getTodayJalali(),
    },
    {
      id: 'bnk-acc-3',
      bankName: 'بانک تجارت',
      accountTitle: 'حساب پرداخت حقوق، مساعده و پرسنلی',
      companyName: 'هلدینگ مرکزی آریا',
      accountNumber: '0018459920117',
      iban: 'IR990180000000627381105544',
      cardNumber: '6273811055443322',
      branchName: 'شعبه میرداماد',
      branchCode: '0085',
      accountType: 'تنخواه',
      currency: 'IRR',
      allowedPaymentMethods: ['PAYA', 'CARD', 'INTERNAL'],
      isDefault: false,
      isActive: true,
      description: 'حساب اختصاصی پرداخت مساعده، تنخواه و ماموریت پرسنل',
      createdAt: '1403/08/01',
      updatedAt: getTodayJalali(),
    },
    {
      id: 'bnk-acc-4',
      bankName: 'بانک سامان',
      accountTitle: 'حساب پشتیبان بازرگانی و لجستیک',
      companyName: 'شرکت بازرگانی و لجستیک آریا',
      accountNumber: '0821800014009',
      iban: 'IR740560082180001400991230',
      cardNumber: '6219861033221144',
      branchName: 'شعبه سعادت‌آباد',
      branchCode: '0821',
      accountType: 'پشتیبان',
      currency: 'IRR',
      allowedPaymentMethods: ['PAYA', 'SATNA', 'CARD'],
      isDefault: false,
      isActive: true,
      description: 'حساب پشتیبان امور بازرگانی و گمرکی',
      createdAt: '1403/08/01',
      updatedAt: getTodayJalali(),
    },
  ];
}

function buildSourceAccountSnapshot(acc: CompanyBankAccount): SourceBankAccountSnapshot {
  return {
    accountId: acc.id,
    bankName: acc.bankName,
    accountTitle: acc.accountTitle,
    accountHolderName: acc.accountHolderName || acc.companyName || acc.company || 'هلدینگ مرکزی آریا',
    companyName: acc.companyName || acc.company || 'هلدینگ مرکزی آریا',
    company: acc.company || acc.companyName || 'هلدینگ مرکزی آریا',
    accountNumber: String(acc.accountNumber),
    iban: acc.iban || '',
    cardNumber: acc.cardNumber || '',
    branchName: acc.branchName || '',
    branchCode: acc.branchCode || '',
    accountType: acc.accountType || 'جاری',
  };
}

function formatSourceAccountDisplay(acc: CompanyBankAccount): string {
  return `${acc.bankName} — ${acc.accountTitle} (${acc.accountNumber})`;
}

function parseArgs() {
  const args = process.argv;
  let port = 3000;
  let host = '127.0.0.1';

  const portIdx = args.indexOf('--port');
  if (portIdx !== -1 && args[portIdx + 1]) {
    port = parseInt(args[portIdx + 1], 10);
  } else if (process.env.PORT) {
    port = parseInt(process.env.PORT, 10);
  }

  const hostIdx = args.indexOf('--host');
  if (hostIdx !== -1 && args[hostIdx + 1]) {
    host = args[hostIdx + 1];
  }

  return { port, host };
}

const { port: PORT, host: HOST } = parseArgs();
const DATA_DIR = path.resolve(process.env.TREASURY_DATA_DIR || path.join(process.cwd(), 'data'));
const STORAGE_MODE=process.env.TREASURY_STORAGE_MODE||'json';
if(!['json','sqlite'].includes(STORAGE_MODE))throw Error('Unsupported storage mode.');
const DB_PATH = path.join(DATA_DIR, STORAGE_MODE==='sqlite'?'treasury.sqlite':'treasury-db.json');
let databaseSnapshots:CommittedJson<TreasuryDatabaseState>;

function createSampleReceiptSvgDataUrl(
  refNumber: string,
  amount: number,
  payee: string,
  bankName: string,
  date: string
): string {
  const formattedAmount = amount.toLocaleString('fa-IR');
  refNumber=xmlText(refNumber);payee=xmlText(payee);bankName=xmlText(bankName);date=xmlText(date);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400" direction="rtl">
    <rect width="600" height="400" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2" rx="12"/>
    <rect x="20" y="20" width="560" height="60" fill="#0f172a" rx="8"/>
    <text x="550" y="57" fill="#ffffff" font-family="Tahoma, sans-serif" font-size="18" font-weight="bold" text-anchor="start">رسید پرداخت بانکی — ${bankName}</text>
    <text x="50" y="57" fill="#94a3b8" font-family="monospace" font-size="14" text-anchor="end">REF: ${refNumber}</text>
    <line x1="40" y1="110" x2="560" y2="110" stroke="#e2e8f0" stroke-width="1"/>
    <text x="550" y="145" fill="#475569" font-family="Tahoma, sans-serif" font-size="15" text-anchor="start">تاریخ عملیات: ${date}</text>
    <text x="550" y="185" fill="#475569" font-family="Tahoma, sans-serif" font-size="15" text-anchor="start">ذینفع / گیرنده وجه: ${payee}</text>
    <text x="550" y="225" fill="#0f172a" font-family="Tahoma, sans-serif" font-size="17" font-weight="bold" text-anchor="start">مبلغ واریزی: ${formattedAmount} ریال</text>
    <text x="550" y="265" fill="#15803d" font-family="Tahoma, sans-serif" font-size="15" font-weight="bold" text-anchor="start">وضعیت تراکنش: موفق — پایا / ساتنا</text>
    <rect x="40" y="305" width="520" height="60" fill="#f1f5f9" rx="6" stroke="#cbd5e1" stroke-dasharray="4 4"/>
    <text x="300" y="340" fill="#334155" font-family="Tahoma, sans-serif" font-size="13" text-anchor="middle">مهر و امضای الکترونیکی واحد خزانه‌داری و پرداخت</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function getInitialSeedState(): TreasuryDatabaseState {
  const todayJalali = getTodayJalali();
  const yesterdayJalali = '1403/08/27';

  const users: User[] = [
    {
      id: 'usr-admin',
      name: 'مدیر کل پرتال (ادمین)',
      personnelCode: 'admin',
      department: 'فناوری اطلاعات و مدیریت',
      role: 'ADMIN',
      password: 'admin',
      phone: '09120000000',
      supervisorId: null,
      supervisorName: null,
    },
    {
      id: 'usr-sup-1',
      name: 'دکتر بهرام رستگاری',
      personnelCode: '2011',
      department: 'فنی و مهندسی',
      role: 'APPROVER',
      password: '123',
      phone: '09121111111',
      supervisorId: 'usr-admin',
      supervisorName: 'مدیر کل پرتال (ادمین)',
    },
    {
      id: 'usr-sup-2',
      name: 'مهندس نیلوفر معینی',
      personnelCode: '2018',
      department: 'فروش و بازرگانی',
      role: 'APPROVER',
      password: '123',
      phone: '09122222222',
      supervisorId: 'usr-admin',
      supervisorName: 'مدیر کل پرتال (ادمین)',
    },
    {
      id: 'usr-emp-1',
      name: 'مهندس آرش کاظمی',
      personnelCode: '1042',
      department: 'فنی و مهندسی',
      role: 'REQUESTER',
      password: '123',
      phone: '09123333333',
      supervisorId: 'usr-sup-1',
      supervisorName: 'دکتر بهرام رستگاری',
    },
    {
      id: 'usr-emp-2',
      name: 'سارا احمدی‌پور',
      personnelCode: '1089',
      department: 'فروش و بازرگانی',
      role: 'REQUESTER',
      password: '123',
      phone: '09124444444',
      supervisorId: 'usr-sup-2',
      supervisorName: 'مهندس نیلوفر معینی',
    },
    {
      id: 'usr-emp-3',
      name: 'حمیدرضا نوری',
      personnelCode: '1105',
      department: 'عملیات و لجستیک',
      role: 'REQUESTER',
      password: '123',
      phone: '09125555555',
      supervisorId: 'usr-sup-1',
      supervisorName: 'دکتر بهرام رستگاری',
    },
    {
      id: 'usr-acc-1',
      name: 'مهدی سلیمانی (رییس حسابداری)',
      personnelCode: '3004',
      department: 'مالی و حسابداری',
      role: 'ACCOUNTING',
      password: '123',
      phone: '09126666666',
      supervisorId: 'usr-admin',
      supervisorName: 'مدیر کل پرتال (ادمین)',
    },
    {
      id: 'usr-trs-1',
      name: 'کیوان فرهمند (مسئول خزانه‌داری)',
      personnelCode: '4001',
      department: 'خزانه‌داری و پرداخت',
      role: 'TREASURY',
      password: '123',
      phone: '09127777777',
      supervisorId: 'usr-admin',
      supervisorName: 'مدیر کل پرتال (ادمین)',
    },
  ];

  const batchItemsDemo = [
    {
      id: 'item-1',
      payeeName: 'مهندس رضا صادقی (سرپرست کارگاه)',
      amount: 45000000,
      accountOrCard: '6037991823451101',
      iban: 'IR120170000000603799182345',
      bankName: 'بانک ملی ایران',
      description: 'حق ماموریت نظارت فنی خط ۳ اصفهان',
      invoiceNumber: 'MAM-403-11',
      costCenter: 'فنی و مهندسی',
    },
    {
      id: 'item-2',
      payeeName: 'علی رضایی (کارشناس ارشد شبکه)',
      amount: 38000000,
      accountOrCard: '5022291044558899',
      iban: 'IR880560081180005022291044',
      bankName: 'بانک پاسارگاد',
      description: 'اضافه کاری شیفت شب راه‌اندازی سرورها',
      invoiceNumber: 'OT-403-08',
      costCenter: 'فنی و مهندسی',
    },
    {
      id: 'item-3',
      payeeName: 'زهرا کاظمی (توسعه دهنده فرانت)',
      amount: 42000000,
      accountOrCard: '6104337899120033',
      iban: 'IR440120000000610433789912',
      bankName: 'بانک ملت',
      description: 'پاداش تحویل فاز یک پورتال مشتریان',
      invoiceNumber: 'BON-403-02',
      costCenter: 'فنی و مهندسی',
    },
    {
      id: 'item-4',
      payeeName: 'حسین مرادی (تکنسین دیتاسنتر)',
      amount: 35000000,
      accountOrCard: '6219861033221144',
      iban: 'IR770560082180006219861033',
      bankName: 'بانک سامان',
      description: 'ماموریت پشتیبانی دیتاسنter تبریز',
      invoiceNumber: 'MAM-403-12',
      costCenter: 'فنی و مهندسی',
    },
    {
      id: 'item-5',
      payeeName: 'مریم حسینی (طراح محصول UI/UX)',
      amount: 40000000,
      accountOrCard: '5892101234567890',
      iban: 'IR190150000000589210123456',
      bankName: 'بانک سپه',
      description: 'اضافه کاری طراحی رابط کاربری پرتال',
      invoiceNumber: 'OT-403-09',
      costCenter: 'فنی و مهندسی',
    },
    {
      id: 'item-6',
      payeeName: 'پویا احمدی (مهندس DevOps)',
      amount: 48000000,
      accountOrCard: '6274121199887766',
      iban: 'IR330540000000627412119988',
      bankName: 'بانک پارسیان',
      description: 'هزینه نگهداری زیرساخت کانتینری',
      invoiceNumber: 'DEV-403-01',
      costCenter: 'فنی و مهندسی',
    },
    {
      id: 'item-7',
      payeeName: 'سعید طاهری (کارشناس امنیت شبکه)',
      amount: 52000000,
      accountOrCard: '6273811055443322',
      iban: 'IR990180000000627381105544',
      bankName: 'بانک تجارت',
      description: 'تست نفوذ و امن‌سازی سرورهای مرکزی',
      invoiceNumber: 'SEC-403-04',
      costCenter: 'فنی و مهندسی',
    },
    {
      id: 'item-8',
      payeeName: 'فاطمه ناصری (تست و کنترل کیفیت QA)',
      amount: 36000000,
      accountOrCard: '5047061088776655',
      iban: 'IR660550000000504706108877',
      bankName: 'بانک شهر',
      description: 'تست رگرسیون و انتشار نگارش پاییز',
      invoiceNumber: 'QA-403-05',
      costCenter: 'فنی و مهندسی',
    },
    {
      id: 'item-9',
      payeeName: 'امیرحسین کریمی (پشتیبان سیستم‌ها)',
      amount: 31000000,
      accountOrCard: '6393461011223344',
      iban: 'IR550620000000639346101122',
      bankName: 'بانک آینده',
      description: 'شیفت پشتیبانی تعطیلات رسمی',
      invoiceNumber: 'SUP-403-07',
      costCenter: 'فنی و مهندسی',
    },
    {
      id: 'item-10',
      payeeName: 'نیما یزدانی (مهندس هوش مصنوعی)',
      amount: 58000000,
      accountOrCard: '6221061099887711',
      iban: 'IR220190000000622106109988',
      bankName: 'بانک صادرات',
      description: 'پاداش پیاده‌سازی مدل دسته‌بندی اسناد',
      invoiceNumber: 'AI-403-01',
      costCenter: 'فنی و مهندسی',
    },
  ];

  const batchTotal = batchItemsDemo.reduce((s, i) => s + i.amount, 0);

  const batchPayments: BatchPaymentRequest[] = [
    {
      id: 'bat-101',
      trackingCode: 'BAT-1403-101',
      batchType: 'PAYMENT',
      title: 'پرداخت تجمیعی ماموریت و اضافه کاری پرسنل فنی (۱۰ نفر)',
      totalAmount: batchTotal,
      itemCount: batchItemsDemo.length,
      requesterId: 'usr-sup-1', // Submitted by supervisor on behalf of team!
      requesterName: 'دکتر بهرام رستگاری',
      requesterPersonnelCode: '2011',
      department: 'فنی و مهندسی',
      supervisorId: 'usr-admin',
      supervisorName: 'مدیر کل پرتال (ادمین)',
      approverNote: 'تایید مستقیم مدیریت واحد جهت تسویه فوری پرسنل.',
      accountingNote: 'لیست ریز مبالغ با لیست کارکرد تطبیق داده شد.',
      rejectionReason: null,
      status: 'Pending_Treasury',
      paidBankName: null,
      paidAt: null,
      paidDateJalali: null,
      createdAt: '1403/08/27',
      items: batchItemsDemo.map((it) => ({
        ...it,
        status: 'Pending_Treasury' as RequestStatus,
        itemType: 'PAYMENT' as const,
        initialAmount: it.amount,
        approvedAmount: it.amount,
        version: 1,
        comments: [],
        auditHistory: [],
        attachments: [],
      })),
    },
    {
      id: 'bat-102',
      trackingCode: 'BAT-1403-102',
      batchType: 'ADVANCE',
      title: 'درخواست مساعده گروهی پرسنل واحد بازرگانی و فروش (۳ نفر)',
      totalAmount: 155000000,
      itemCount: 3,
      requesterId: 'usr-emp-2',
      requesterName: 'سارا احمدی‌پور',
      requesterPersonnelCode: '1089',
      department: 'فروش و بازرگانی',
      supervisorId: 'usr-sup-2',
      supervisorName: 'مهندس نیلوفر معینی',
      approverNote: 'بررسی ردیف‌ها به تفکیک انجام شد.',
      accountingNote: null,
      rejectionReason: null,
      status: 'Needs_Revision',
      paidBankName: null,
      paidAt: null,
      paidDateJalali: null,
      createdAt: getTodayJalali(),
      attachments: [],
      items: [
        {
          id: 'item-adv-1',
          itemType: 'ADVANCE',
          payeeName: 'سارا احمدی‌پور',
          amount: 50000000,
          initialAmount: 50000000,
          approvedAmount: 50000000,
          accountOrCard: '5022-2910-4455-8899',
          iban: 'IR880560081180005022291044',
          bankName: 'بانک پاسارگاد',
          description: 'مساعده حقوق جهت مخارج درمانی',
          invoiceNumber: 'ADV-403-01',
          costCenter: 'فروش و بازرگانی',
          requestedMonth: 'آبان ۱۴۰۳',
          status: 'Pending_Approver',
          version: 1,
          comments: [],
          auditHistory: [],
          attachments: [],
        },
        {
          id: 'item-adv-2',
          itemType: 'ADVANCE',
          payeeName: 'رضا صمدی (کارشناس فروش)',
          amount: 45000000,
          initialAmount: 45000000,
          approvedAmount: 45000000,
          accountOrCard: '6037-9918-7744-1234',
          iban: 'IR120170000000603799187744',
          bankName: 'بانک ملی ایران',
          description: 'مساعده ضروری هزینه ثبت نام',
          invoiceNumber: 'ADV-403-02',
          costCenter: 'فروش و بازرگانی',
          requestedMonth: 'آبان ۱۴۰۳',
          status: 'Pending_Approver',
          version: 1,
          comments: [],
          auditHistory: [],
          attachments: [],
        },
        {
          id: 'item-adv-3',
          itemType: 'ADVANCE',
          payeeName: 'مهرداد پاکزاد (ویزیتور)',
          amount: 60000000,
          initialAmount: 60000000,
          approvedAmount: 60000000,
          accountOrCard: '6219-8610-9988-3322',
          iban: 'IR770560082180006219869988',
          bankName: 'بانک سامان',
          description: 'مساعده سفر کاری بازاریابی شیراز',
          invoiceNumber: 'ADV-403-03',
          costCenter: 'فروش و بازرگانی',
          requestedMonth: 'آبان ۱۴۰۳',
          status: 'Needs_Revision',
          returnedReason: 'سقف مساعده مجاز برای ویزیتورها ۴۰ میلیون ریال است؛ لطفاً مبلغ را اصلاح فرمایید.',
          returnedByRole: 'APPROVER',
          returnedByName: 'دکتر بهرام رستگاری',
          returnedAt: '1403/08/28 - 11:20',
          version: 1,
          comments: [
            {
              id: 'cmt-adv-3',
              authorId: 'usr-sup-1',
              authorName: 'دکتر بهرام رستگاری',
              authorRole: 'APPROVER',
              text: 'سقف مساعده مجاز برای ویزیتورها ۴۰ میلیون ریال است؛ لطفاً مبلغ را اصلاح فرمایید.',
              createdAt: '1403/08/28 - 11:20',
            },
          ],
          auditHistory: [
            {
              id: 'aud-adv-3',
              action: 'برگشت برای اصلاح توسط تاییدکننده',
              changedBy: 'دکتر بهرام رستگاری',
              changedAt: '1403/08/28 - 11:20',
              reason: 'سقف مساعده مجاز برای ویزیتورها ۴۰ میلیون ریال است؛ لطفاً مبلغ را اصلاح فرمایید.',
            },
          ],
          attachments: [],
        },
      ],
    },
  ];

  const advanceRequests: AdvanceRequest[] = [
    {
      id: 'adv-101',
      trackingCode: 'ADV-1403-101',
      requestedMonth: 'آبان ۱۴۰۳',
      amount: 85000000,
      suggestedDate: '1403/08/29',
      reason: 'هزینه‌های درمانی و دندانپزشکی خانواده',
      hasPreviousAdvance: false,
      approvedAmount: 85000000,
      accountingNote: 'سقف مساعده رعایت شده و بدهی ندارد.',
      approverNote: 'مورد تایید سرپرست واحد فنی است.',
      rejectionReason: null,
      status: 'Pending_Treasury',
      requesterId: 'usr-emp-1',
      requesterName: 'مهندس آرش کاظمی',
      requesterPersonnelCode: '1042',
      department: 'فنی و مهندسی',
      supervisorId: 'usr-sup-1',
      supervisorName: 'دکتر بهرام رستگاری',
      accountingId: 'usr-acc-1',
      accountingName: 'مهدی سلیمانی (رییس حسابداری)',
      treasuryId: null,
      treasuryName: null,
      paidBankName: null,
      paidAt: null,
      paidDateJalali: null,
      dailyCoverId: null,
      createdAt: '1403/08/26',
    },
    {
      id: 'adv-102',
      trackingCode: 'ADV-1403-102',
      requestedMonth: 'آبان ۱۴۰۳',
      amount: 120000000,
      suggestedDate: getTodayJalali(),
      reason: 'تمدید ودیعه مسکن و جابجایی منزل',
      hasPreviousAdvance: true,
      approvedAmount: 90000000,
      accountingNote: 'با کسر مانده قبلی مبلغ ۹۰ میلیون ریال تایید شد.',
      approverNote: 'تایید سرپرست بازرگانی.',
      rejectionReason: null,
      status: 'Pending_Treasury',
      requesterId: 'usr-emp-2',
      requesterName: 'سارا احمدی‌پور',
      requesterPersonnelCode: '1089',
      department: 'فروش و بازرگانی',
      supervisorId: 'usr-sup-2',
      supervisorName: 'مهندس نیلوفر معینی',
      accountingId: 'usr-acc-1',
      accountingName: 'مهدی سلیمانی (رییس حسابداری)',
      treasuryId: null,
      treasuryName: null,
      paidBankName: null,
      paidAt: null,
      paidDateJalali: null,
      dailyCoverId: null,
      createdAt: '1403/08/27',
    },
    {
      id: 'adv-103',
      trackingCode: 'ADV-1403-103',
      requestedMonth: 'آبان ۱۴۰۳',
      amount: 60000000,
      suggestedDate: '1403/09/02',
      reason: 'تعمیر اساسی خودرو شخصی جهت تردد به انبار',
      hasPreviousAdvance: null,
      approvedAmount: null,
      accountingNote: null,
      approverNote: 'مورد تایید سرپرست.',
      rejectionReason: null,
      status: 'Pending_Accounting',
      requesterId: 'usr-emp-3',
      requesterName: 'حمیدرضا نوری',
      requesterPersonnelCode: '1105',
      department: 'عملیات و لجستیک',
      supervisorId: 'usr-sup-1',
      supervisorName: 'دکتر بهرام رستگاری',
      accountingId: null,
      accountingName: null,
      treasuryId: null,
      treasuryName: null,
      paidBankName: null,
      paidAt: null,
      paidDateJalali: null,
      dailyCoverId: null,
      createdAt: '1403/08/27',
    },
    {
      id: 'adv-104',
      trackingCode: 'ADV-1403-104',
      requestedMonth: 'آذر ۱۴۰۳',
      amount: 75000000,
      suggestedDate: '1403/09/05',
      reason: 'پرداخت شهریه دانشگاه نوبت دوم',
      hasPreviousAdvance: null,
      approvedAmount: null,
      accountingNote: null,
      approverNote: null,
      rejectionReason: null,
      status: 'Pending_Approver',
      requesterId: 'usr-emp-1',
      requesterName: 'مهندس آرش کاظمی',
      requesterPersonnelCode: '1042',
      department: 'فنی و مهندسی',
      supervisorId: 'usr-sup-1',
      supervisorName: 'دکتر بهرام رستگاری',
      accountingId: null,
      accountingName: null,
      treasuryId: null,
      treasuryName: null,
      paidBankName: null,
      paidAt: null,
      paidDateJalali: null,
      dailyCoverId: null,
      createdAt: getTodayJalali(),
    },
    {
      id: 'adv-105',
      trackingCode: 'ADV-1403-105',
      requestedMonth: 'آبان ۱۴۰۳',
      amount: 50000000,
      suggestedDate: getTodayJalali(),
      reason: 'مساعده اضطراری تعمیرات منزل',
      hasPreviousAdvance: false,
      approvedAmount: 50000000,
      accountingNote: 'تایید حقوق و دستمزد.',
      approverNote: 'تایید شد.',
      rejectionReason: null,
      status: 'Paid',
      requesterId: 'usr-emp-3',
      requesterName: 'حمیدرضا نوری',
      requesterPersonnelCode: '1105',
      department: 'عملیات و لجستیک',
      supervisorId: 'usr-sup-1',
      supervisorName: 'دکتر بهرام رستگاری',
      accountingId: 'usr-acc-1',
      accountingName: 'مهدی سلیمانی (رییس حسابداری)',
      treasuryId: 'usr-trs-1',
      treasuryName: 'کیوان فرهمند (مسئول خزانه‌داری)',
      paidBankName: 'بانک تجارت',
      paidAt: '2026-10-19T08:15:00.000Z',
      paidDateJalali: todayJalali,
      dailyCoverId: null,
      createdAt: '1403/08/25',
    },
  ];

  const paymentRequests: PaymentRequest[] = [
    {
      id: 'pay-201',
      trackingCode: 'PAY-1403-201',
      dueDate: getTodayJalali(),
      priority: 'Urgent',
      costCenter: 'زیرساخت ابری و دیتاسنتر',
      description: 'تسویه فاکتور تمدید سرورهای اختصاصی آسیاتک - آبان ۱۴۰۳',
      amount: 640000000,
      payeeName: 'شرکت انتقال داده‌های آسیاتک',
      accountOrCard: '0109482711004',
      iban: 'IR520120000000109482711004',
      bankName: 'بانک ملت',
      invoiceNumber: 'INV-403-8891',
      batchId: null,
      batchTitle: null,
      accountingNote: 'فاکتور در سامانه مودیان بررسی شد.',
      approverNote: 'اولویت فوری جهت عدم قطعی سرورها.',
      rejectionReason: null,
      status: 'Pending_Treasury',
      requesterId: 'usr-emp-1',
      requesterName: 'مهندس آرش کاظمی',
      requesterPersonnelCode: '1042',
      department: 'فنی و مهندسی',
      supervisorId: 'usr-sup-1',
      supervisorName: 'دکتر بهرام رستگاری',
      accountingId: 'usr-acc-1',
      accountingName: 'مهدی سلیمانی (رییس حسابداری)',
      treasuryId: null,
      treasuryName: null,
      paidBankName: null,
      paidAt: null,
      paidDateJalali: null,
      dailyCoverId: null,
      createdAt: '1403/08/26',
    },
    {
      id: 'pay-202',
      trackingCode: 'PAY-1403-202',
      dueDate: '1403/08/29',
      priority: 'Normal',
      costCenter: 'بازاریابی و نمایشگاه‌ها',
      description: 'پیش‌پرداخت غرفه‌سازی نمایشگاه الکامپ',
      amount: 950000000,
      payeeName: 'شرکت سازه‌های نمایشگاهی نگین پارس',
      accountOrCard: '821140099123',
      iban: 'IR740560082180001400991230',
      bankName: 'بانک سامان',
      invoiceNumber: 'INV-403-9042',
      batchId: null,
      batchTitle: null,
      accountingNote: 'طبق قرارداد قسط اول تایید شد.',
      approverNote: 'تایید مدیریت بازرگانی.',
      rejectionReason: null,
      status: 'Pending_Treasury',
      requesterId: 'usr-emp-2',
      requesterName: 'سارا احمدی‌پور',
      requesterPersonnelCode: '1089',
      department: 'فروش و بازرگانی',
      supervisorId: 'usr-sup-2',
      supervisorName: 'مهندس نیلوفر معینی',
      accountingId: 'usr-acc-1',
      accountingName: 'مهدی سلیمانی (رییس حسابداری)',
      treasuryId: null,
      treasuryName: null,
      paidBankName: null,
      paidAt: null,
      paidDateJalali: null,
      dailyCoverId: null,
      createdAt: '1403/08/26',
    },
    {
      id: 'pay-203',
      trackingCode: 'PAY-1403-203',
      dueDate: getTodayJalali(),
      priority: 'Urgent',
      costCenter: 'حمل و نقل و انبارها',
      description: 'کرایه حمل محموله تجهیزات از گمرک بندرعباس به تهران',
      amount: 420000000,
      payeeName: 'باربری سراسری ترابر جنوب',
      accountOrCard: '6104337890124455',
      iban: 'IR290120020000008901244551',
      bankName: 'بانک ملت',
      invoiceNumber: 'BL-1403-5521',
      batchId: null,
      batchTitle: null,
      accountingNote: null,
      approverNote: 'بارنامه بررسی و تایید شد.',
      rejectionReason: null,
      status: 'Pending_Accounting',
      requesterId: 'usr-emp-3',
      requesterName: 'حمیدرضا نوری',
      requesterPersonnelCode: '1105',
      department: 'عملیات و لجستیک',
      supervisorId: 'usr-sup-1',
      supervisorName: 'دکتر بهرام رستگاری',
      accountingId: null,
      accountingName: null,
      treasuryId: null,
      treasuryName: null,
      paidBankName: null,
      paidAt: null,
      paidDateJalali: null,
      dailyCoverId: null,
      createdAt: '1403/08/27',
    },
    {
      id: 'pay-204',
      trackingCode: 'PAY-1403-204',
      dueDate: '1403/09/03',
      priority: 'Normal',
      costCenter: 'تجهیزات سخت‌افزاری',
      description: 'خرید ۴ دستگاه لپ‌تاپ مهندسی تیم توسعه',
      amount: 1480000000,
      payeeName: 'شرکت رایان پردازش نوین',
      accountOrCard: '0201148902008',
      iban: 'IR880570020180011489020081',
      bankName: 'بانک پاسارگاد',
      invoiceNumber: 'INV-403-9115',
      batchId: null,
      batchTitle: null,
      accountingNote: null,
      approverNote: null,
      rejectionReason: null,
      status: 'Pending_Approver',
      requesterId: 'usr-emp-1',
      requesterName: 'مهندس آرش کاظمی',
      requesterPersonnelCode: '1042',
      department: 'فنی و مهندسی',
      supervisorId: 'usr-sup-1',
      supervisorName: 'دکتر بهرام رستگاری',
      accountingId: null,
      accountingName: null,
      treasuryId: null,
      treasuryName: null,
      paidBankName: null,
      paidAt: null,
      paidDateJalali: null,
      dailyCoverId: null,
      createdAt: getTodayJalali(),
    },
    {
      id: 'pay-205',
      trackingCode: 'PAY-1403-205',
      dueDate: getTodayJalali(),
      priority: 'Urgent',
      costCenter: 'مالیات و بیمه تامین اجتماعی',
      description: 'حق بیمه مهرماه ۱۴۰۳ کارکنان دفتر مرکزی',
      amount: 1120000000,
      payeeName: 'سازمان تامین اجتماعی - شعبه ۲۵ تهران',
      accountOrCard: '100884422110',
      iban: 'IR110170000000100884422110',
      bankName: 'بانک ملی ایران',
      invoiceNumber: 'TAMIN-1403-07',
      batchId: null,
      batchTitle: null,
      accountingNote: 'لیست بیمه تایید شد.',
      approverNote: 'تایید.',
      rejectionReason: null,
      status: 'Paid',
      requesterId: 'usr-emp-2',
      requesterName: 'سارا احمدی‌پور',
      requesterPersonnelCode: '1089',
      department: 'فروش و بازرگانی',
      supervisorId: 'usr-sup-2',
      supervisorName: 'مهندس نیلوفر معینی',
      accountingId: 'usr-acc-1',
      accountingName: 'مهدی سلیمانی (رییس حسابداری)',
      treasuryId: 'usr-trs-1',
      treasuryName: 'کیوان فرهمند (مسئول خزانه‌داری)',
      paidBankName: 'بانک ملت',
      paidAt: '2026-10-19T09:00:00.000Z',
      paidDateJalali: todayJalali,
      dailyCoverId: null,
      createdAt: '1403/08/25',
    },
  ];

  const manualPayments: ManualPayment[] = [
    {
      id: 'man-301',
      trackingCode: 'MAN-1403-301',
      amount: 185000000,
      payee: 'ترخیص‌کار گمرک فرودگاه امام (رضا شریفی)',
      description: 'پرداخت فوری تلفنی به دستور مدیرعامل بابت ترخیص قطعه سرور',
      bankName: 'بانک پاسارگاد',
      date: todayJalali,
      orderedBy: 'مدیرعامل (دستور تلفنی)',
      createdById: 'usr-trs-1',
      createdByName: 'کیوان فرهمند (مسئول خزانه‌داری)',
      dailyCoverId: null,
      createdAt: '1403/08/28 - 10:20',
    },
    {
      id: 'man-302',
      trackingCode: 'MAN-1403-302',
      amount: 45000000,
      payee: 'مجتمع چاپ و بسته‌بندی نقش الماس',
      description: 'پرداخت کاغذی خارج از نوبت بابت کاتالوگ‌های همایش',
      bankName: 'بانک سامان',
      date: yesterdayJalali,
      orderedBy: 'معاونت مالی (دستور کاغذی)',
      createdById: 'usr-trs-1',
      createdByName: 'کیوان فرهمند (مسئول خزانه‌داری)',
      dailyCoverId: 'cov-401',
      createdAt: '1403/08/27 - 15:40',
    },
  ];

  const dailyCovers: DailyCover[] = [
    {
      id: 'cov-401',
      coverNumber: 'COV-14030827-01',
      date: yesterdayJalali,
      bankName: 'بانک سامان',
      totalIn: 2400000000,
      totalOut: 45075000,
      bankFee: 75000,
      note: 'روکش روز ۲۷ آبان پس از تطبیق فیش‌ها بسته شد.',
      status: 'Closed',
      closedBy: 'کیوان فرهمند (مسئول خزانه‌داری)',
      closedAt: '1403/08/27 - 18:00',
      advanceRequestIds: [],
      paymentRequestIds: [],
      manualPaymentIds: ['man-302'],
    },
  ];

  const receiptArchives: ReceiptArchive[] = [
    {
      id: 'rcp-501',
      fileUrl: createSampleReceiptSvgDataUrl('9948210455', 50000000, 'حمیدرضا نوری', 'بانک تجارت', todayJalali),
      fileName: 'receipt_mosaedeh_105.svg',
      bankRefNumber: '9948210455',
      paymentType: 'ADVANCE',
      relatedPaymentIds: ['adv-105'],
      relatedTrackingCodes: ['ADV-1403-105'],
      amount: 50000000,
      bankName: 'بانک تجارت',
      uploadedBy: 'کیوان فرهمند (مسئول خزانه‌داری)',
      uploadedAt: '1403/08/28 - 08:20',
      dateJalali: todayJalali,
    },
    {
      id: 'rcp-502',
      fileUrl: createSampleReceiptSvgDataUrl('7710293844', 1120000000, 'سازمان تامین اجتماعی', 'بانک ملت', todayJalali),
      fileName: 'receipt_tamin_205.svg',
      bankRefNumber: '7710293844',
      paymentType: 'PAYMENT',
      relatedPaymentIds: ['pay-205'],
      relatedTrackingCodes: ['PAY-1403-205'],
      amount: 1120000000,
      bankName: 'بانک ملت',
      uploadedBy: 'کیوان فرهمند (مسئول خزانه‌داری)',
      uploadedAt: '1403/08/28 - 09:05',
      dateJalali: todayJalali,
    },
    {
      id: 'rcp-503',
      fileUrl: createSampleReceiptSvgDataUrl('3301928371', 185000000, 'رضا شریفی (گمرک)', 'بانک پاسارگاد', todayJalali),
      fileName: 'receipt_gomrok_301.svg',
      bankRefNumber: '3301928371',
      paymentType: 'MANUAL',
      relatedPaymentIds: ['man-301'],
      relatedTrackingCodes: ['MAN-1403-301'],
      amount: 185000000,
      bankName: 'بانک پاسارگاد',
      uploadedBy: 'کیوان فرهمند (مسئول خزانه‌داری)',
      uploadedAt: '1403/08/28 - 10:22',
      dateJalali: todayJalali,
    },
  ];

  return {
    users,
    advanceRequests,
    paymentRequests,
    batchPayments,
    manualPayments,
    dailyCovers,
    receiptArchives,
  };
}

function hashPasswordWithSalt(password: string, salt: string): string {
  return crypto.scryptSync(String(password), salt, 64).toString('hex');
}

function createPasswordCredentials(password: string): { passwordHash: string; passwordSalt: string } {
  const passwordSalt = crypto.randomBytes(16).toString('hex');
  const passwordHash = hashPasswordWithSalt(password, passwordSalt);
  return { passwordHash, passwordSalt };
}

function verifyUserPassword(password: string, user: User): boolean {
  if (!password) return false;
  if (user.passwordHash && user.passwordSalt) {
    try {
      const candidateHash = hashPasswordWithSalt(password, user.passwordSalt);
      const a = Buffer.from(candidateHash, 'hex');
      const b = Buffer.from(user.passwordHash, 'hex');
      if (a.length !== b.length) return false;
      return crypto.timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }
  if (user.password) {
    return user.password === password;
  }
  return false;
}

function getDefaultRoleConfigs(): RoleDefinitionConfig[] {
  return [
    {
      role: 'REQUESTER',
      title: 'درخواست‌کننده (متقاضی)',
      description: 'ثبت درخواست‌های پرداخت، مساعده و تنخواه، پیگیری وضعیت و اصلاح موارد برگشتی مربوط به خود شخص',
      isCustom: false,
      baseTemplateRole: 'REQUESTER',
      defaultLandingSection: 'REQUESTER',
      accessScope: 'SELF_ONLY',
      allowedCompanies: ['هلدینگ مرکزی آریا', 'شرکت توسعه فناوری آریا', 'شرکت بازرگانی و لجستیک آریا'],
      approvalLimitRial: 0,
      paymentLimitRial: 0,
      permissions: getDefaultPermissionsForRole('REQUESTER', 'REQUESTER'),
    },
    {
      role: 'APPROVER',
      title: 'سرپرست واحد و تأییدکننده',
      description: 'بررسی، ویرایش مبلغ مصوب، تأیید یا برگشت برای اصلاح درخواست‌های ارجاع‌شده کارکنان تحت سرپرستی در سقف مجاز',
      isCustom: false,
      baseTemplateRole: 'APPROVER',
      defaultLandingSection: 'APPROVER',
      accessScope: 'ASSIGNED_AND_SUBORDINATES',
      allowedCompanies: ['هلدینگ مرکزی آریا', 'شرکت توسعه فناوری آریا', 'شرکت بازرگانی و لجستیک آریا'],
      approvalLimitRial: 5000000000, // ۵ میلیارد ریال
      paymentLimitRial: 0,
      permissions: getDefaultPermissionsForRole('APPROVER', 'APPROVER'),
    },
    {
      role: 'ACCOUNTING',
      title: 'حسابداری و کنترل مالی',
      description: 'کنترل اسناد مثبته، مرکز هزینه، کسورات، ویرایش مبلغ مصوب و تأیید نهایی مالی پیش از ارسال به صف خزانه',
      isCustom: false,
      baseTemplateRole: 'ACCOUNTING',
      defaultLandingSection: 'ACCOUNTING',
      accessScope: 'COMPANY_WIDE',
      allowedCompanies: ['هلدینگ مرکزی آریا', 'شرکت توسعه فناوری آریا', 'شرکت بازرگانی و لجستیک آریا'],
      approvalLimitRial: 25000000000, // ۲۵ میلیارد ریال
      paymentLimitRial: 0,
      permissions: getDefaultPermissionsForRole('ACCOUNTING', 'ACCOUNTING'),
    },
    {
      role: 'TREASURY',
      title: 'خزانه‌داری و اجرای پرداخت',
      description: 'مدیریت صف پرداخت و در حال پرداخت، تهیه خروجی بانکی، ثبت پرداخت قطعی با فیش و بستن روکش روزانه',
      isCustom: false,
      baseTemplateRole: 'TREASURY',
      defaultLandingSection: 'TREASURY',
      accessScope: 'COMPANY_WIDE',
      allowedCompanies: ['هلدینگ مرکزی آریا', 'شرکت توسعه فناوری آریا', 'شرکت بازرگانی و لجستیک آریا'],
      approvalLimitRial: 0,
      paymentLimitRial: 50000000000, // ۵۰ میلیارد ریال
      permissions: getDefaultPermissionsForRole('TREASURY', 'TREASURY'),
    },
    {
      role: 'ADMIN',
      title: 'مدیر ارشد سامانه و کاربران (ادمین پرتال)',
      description: 'دسترسی کامل مدیریتی و عملیاتی به تمامی فرم‌ها، کارتابل‌های تایید، خزانه‌داری، اطلاعات پایه و مدیریت کاربران و نقش‌ها',
      isCustom: false,
      baseTemplateRole: 'ADMIN',
      defaultLandingSection: 'ADMIN_PANEL',
      accessScope: 'COMPANY_WIDE',
      allowedCompanies: ['هلدینگ مرکزی آریا', 'شرکت توسعه فناوری آریا', 'شرکت بازرگانی و لجستیک آریا'],
      approvalLimitRial: 1000000000000, // ۱۰۰۰ میلیارد ریال (دسترسی کامل)
      paymentLimitRial: 1000000000000, // ۱۰۰۰ میلیارد ریال (دسترسی کامل)
      permissions: getDefaultPermissionsForRole('ADMIN', 'ADMIN'),
    },
  ];
}

function getDefaultPreferencesForRole(role: Role, roleConfigs?: RoleDefinitionConfig[]): UserPersonalPreferences {
  const matchedCfg = roleConfigs?.find((r) => r.role === role);
  const defaultSection =
    matchedCfg?.defaultLandingSection ||
    (role === 'ADMIN'
      ? 'ADMIN_PANEL'
      : role === 'APPROVER'
      ? 'APPROVER'
      : role === 'ACCOUNTING'
      ? 'ACCOUNTING'
      : role === 'TREASURY'
      ? 'TREASURY'
      : 'REQUESTER');
  return {
    defaultSection,
    tablePageSize: 20,
    notifyOnSubmit: true,
    notifyOnRevision: true,
    notifyOnApproval: true,
    notifyOnPayment: true,
    desktopPushEnabled: false,
  };
}

function computeEffectiveUserAuth(user: User, db: TreasuryDatabaseState): {
  effectivePermissions: RolePermissionSet;
  effectiveAccessScope: AccessScope;
  effectiveApprovalLimitRial: number;
  effectivePaymentLimitRial: number;
} {
  const roleConfigs = db.roleConfigs && db.roleConfigs.length > 0 ? db.roleConfigs : getDefaultRoleConfigs();
  const rc =
    roleConfigs.find((r) => r.role === user.role) ||
    getDefaultRoleConfigs().find((r) => r.role === user.role) ||
    getDefaultRoleConfigs()[0];

  const normalizedRolePerms=normalizeRolePermissionSet(rc.permissions,rc.role,rc.baseTemplateRole);
  const rolePermissionSets=[{...normalizedRolePerms}];
  for (const role of getUserRoles(user).slice(1)) {
    const additional = roleConfigs.find(r => r.role === role);
    if (!additional || role === 'ADMIN') continue;
    const extra=normalizeRolePermissionSet(additional.permissions,additional.role,additional.baseTemplateRole);
    rolePermissionSets.push(extra);
    for (const key of Object.keys(extra) as (keyof RolePermissionSet)[]) {
      if (extra[key]) normalizedRolePerms[key] = true;
    }
  }
  const mergedPermissions: RolePermissionSet = {
    ...normalizedRolePerms,
    ...(user.customPermissions || {}),
  };

  // Portal Admin (ADMIN) has full access to all capabilities
  if (user.role === 'ADMIN') {
    const allAdminPerms = getDefaultPermissionsForRole('ADMIN', 'ADMIN');
    Object.assign(mergedPermissions, allAdminPerms, user.customPermissions || {});
    mergedPermissions.canManageUsers = true;
    mergedPermissions.canManageRoles = true;
  }

  const effectiveAccessScope: AccessScope =
    user.role === 'ADMIN' ? 'COMPANY_WIDE' : user.accessScope || rc.accessScope;
  const effectiveApprovalLimitRial =
    user.financialApprovalLimit !== undefined && user.financialApprovalLimit !== null
      ? Number(user.financialApprovalLimit)
      : rc.approvalLimitRial || (user.role === 'ADMIN' ? 1000000000000 : 0);
  const effectivePaymentLimitRial =
    user.paymentExecutionLimit !== undefined && user.paymentExecutionLimit !== null
      ? Number(user.paymentExecutionLimit)
      : rc.paymentLimitRial || (user.role === 'ADMIN' ? 1000000000000 : 0);

  return {
    effectivePermissions: effectiveNavigationPermissions(mergedPermissions,rolePermissionSets,user.customPermissions||{}),
    effectiveAccessScope,
    effectiveApprovalLimitRial,
    effectivePaymentLimitRial,
  };
}

function canReceiveSupervisorWork(db: TreasuryDatabaseState, previous: User, replacement: User): boolean {
  const auth=computeEffectiveUserAuth(replacement,db);
  if (replacement.isActive === false || replacement.id === previous.id || !hasSupervisorPermissions(auth.effectivePermissions,auth.effectiveAccessScope,auth.effectiveApprovalLimitRial) || wouldCreateSupervisorCycle(db.users,previous.id,replacement.id)) return false;
  if (auth.effectiveAccessScope === 'DEPARTMENT' && db.users.some(u => u.supervisorId === previous.id && (u.department !== replacement.department || u.company !== replacement.company))) return false;
  const rows=[...db.advanceRequests,...db.paymentRequests,...db.batchPayments].filter(r => r.supervisorId === previous.id);
  return rows.every(row => {
    const pending='items' in row ? row.items.filter(item => item.status === 'Pending_Approver') : row.status === 'Pending_Approver' ? [row] : [];
    return !pending.length || (row.requesterId !== replacement.id && canSeeRequest({...row,supervisorId:replacement.id},replacement,db,auth) && pending.every(item => Number(item.approvedAmount ?? item.amount) <= auth.effectiveApprovalLimitRial));
  });
}

function sanitizeUserForClient(user: User, db: TreasuryDatabaseState): User {
  const {
    password: _p,
    passwordHash: _ph,
    passwordSalt: _ps,
    twoFactorPinHash: _tf,
    ...rest
  } = user;
  const effective = computeEffectiveUserAuth(user, db);
  return {
    ...rest,
    personnelCode: String(user.personnelCode ?? ''),
    phone: String(user.phone ?? ''),
    company: user.company || 'هلدینگ مرکزی آریا',
    isActive: user.isActive !== false,
    mustChangePassword: Boolean(user.mustChangePassword),
    twoFactorEnabled: Boolean(user.twoFactorEnabled),
    preferences: {
      ...getDefaultPreferencesForRole(user.role),
      ...(user.preferences || {}),
    },
    ...effective,
  };
}

function requestCompanySnapshot(user:User,db:TreasuryDatabaseState){
  return {company:user.company,companyId:db.companies?.find(c=>c.name===user.company||c.id===user.company)?.id};
}

// Cache only immutable snapshots, never a session/authorization decision. Every
// response still resolves the current viewer and applies scopeState afterward.
const sanitizedStates=new WeakMap<TreasuryDatabaseState,TreasuryDatabaseState>();
function sanitizeDbForClient(db: TreasuryDatabaseState): TreasuryDatabaseState {
  db=databaseSnapshots.snapshot(db);
  const cached=sanitizedStates.get(db);if(cached)return cached;
  const { sessions: _sessions, ...rest } = activeRequestProjection(db);
  const safe=freeze({
    ...rest,
    users: (db.users || []).map((u) => sanitizeUserForClient(u, db)),
    roleConfigs: db.roleConfigs && db.roleConfigs.length > 0 ? db.roleConfigs : getDefaultRoleConfigs(),
    companies: db.companies ?? getDefaultCompanies(),
    departments: db.departments ?? getDefaultDepartments(),
    costCenters: db.costCenters ?? getDefaultCostCenters(),
    smsConfig: sanitizeSmsConfigForClient(db.smsConfig),
    smsLogs: (db.smsLogs || []).map(safeSmsLog),
    companyBankAccounts:
      db.companyBankAccounts ?? getDefaultCompanyBankAccounts(),
    securityAuditLogs: db.securityAuditLogs || [],
    passwordRecoveryRequests: db.passwordRecoveryRequests || [],
  },true) as TreasuryDatabaseState;
  if(Object.isFrozen(db))sanitizedStates.set(db,safe);
  // Handlers and the central response boundary may both sanitize. The private
  // branded, frozen result is already safe; do not remap all users/logs twice.
  sanitizedStates.set(safe,safe);return safe;
}

function pushSecurityAuditLog(
  db: TreasuryDatabaseState,
  entry: Omit<SecurityAuditLogEntry, 'id' | 'createdAt'>
): SecurityAuditLogEntry {
  if (!db.securityAuditLogs) db.securityAuditLogs = [];
  const logItem: SecurityAuditLogEntry = {
    ...entry,
    id: `sec-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    createdAt: `${getTodayJalali()} - ${new Date().toTimeString().slice(0, 8)}`,
  };
  db.securityAuditLogs.unshift(logItem);
  if (db.securityAuditLogs.length > 300) {
    db.securityAuditLogs = db.securityAuditLogs.slice(0, 300);
  }
  return logItem;
}

function wouldCreateSupervisorCycle(
  users: User[],
  targetUserId: string,
  candidateSupervisorId: string | null | undefined
): boolean {
  if (!candidateSupervisorId) return false;
  if (candidateSupervisorId === targetUserId) return true;
  const visited = new Set<string>([targetUserId]);
  let currentId: string | null | undefined = candidateSupervisorId;
  while (currentId) {
    if (visited.has(currentId)) return true;
    visited.add(currentId);
    const parent = users.find((u) => u.id === currentId);
    currentId = parent?.supervisorId || null;
  }
  return false;
}

function countPendingApprovalsForSupervisor(db: TreasuryDatabaseState, supervisorId: string): number {
  let count = 0;
  for (const a of db.advanceRequests || []) {
    if (a.status === 'Pending_Approver' && a.supervisorId === supervisorId) count++;
  }
  for (const p of db.paymentRequests || []) {
    if (p.status === 'Pending_Approver' && p.supervisorId === supervisorId) count++;
  }
  for (const b of db.batchPayments || []) {
    if (b.supervisorId === supervisorId) {
      for (const it of b.items || []) {
        if ((it.status || b.status) === 'Pending_Approver') count++;
      }
    }
  }
  return count;
}

function reassignPendingApprovalsAndSubordinates(
  db: TreasuryDatabaseState,
  fromSupervisor: User,
  toSupervisor: User,
  actorName: string
): number {
  const todayDate = `${getTodayJalali()} - ${new Date().toTimeString().slice(0, 5)}`;
  let movedCount = 0;

  for (const u of db.users || []) {
    if (u.supervisorId === fromSupervisor.id && u.id !== toSupervisor.id) {
      u.supervisorId = toSupervisor.id;
      u.supervisorName = toSupervisor.name;
    }
  }

  for (const a of db.advanceRequests || []) {
    if (a.status === 'Pending_Approver' && a.supervisorId === fromSupervisor.id) {
      a.supervisorId = toSupervisor.id;
      a.supervisorName = toSupervisor.name;
      if (!a.auditHistory) a.auditHistory = [];
      a.auditHistory.push({
        id: `aud-${Date.now()}-${a.id}`,
        action: `انتقال خودکار کار منتظر از «${fromSupervisor.name}» به سرپرست جایگزین «${toSupervisor.name}»`,
        changedBy: actorName,
        changedAt: todayDate,
      });
      pushAppNotification(db,{eventType:'REQUEST_SUBMITTED',title:'ارجاع درخواست منتظر به سرپرست جایگزین',body:'درخواست منتظر برای بررسی به شما ارجاع شد.',trackingCode:a.trackingCode,requestId:a.id,itemType:'ADVANCE',recipientUserId:toSupervisor.id,recipientRole:'APPROVER',actorName,targetSection:'APPROVER'});
      movedCount++;
    }
  }

  for (const p of db.paymentRequests || []) {
    if (p.status === 'Pending_Approver' && p.supervisorId === fromSupervisor.id) {
      p.supervisorId = toSupervisor.id;
      p.supervisorName = toSupervisor.name;
      if (!p.auditHistory) p.auditHistory = [];
      p.auditHistory.push({
        id: `aud-${Date.now()}-${p.id}`,
        action: `انتقال خودکار کار منتظر از «${fromSupervisor.name}» به سرپرست جایگزین «${toSupervisor.name}»`,
        changedBy: actorName,
        changedAt: todayDate,
      });
      pushAppNotification(db,{eventType:'REQUEST_SUBMITTED',title:'ارجاع درخواست منتظر به سرپرست جایگزین',body:'درخواست منتظر برای بررسی به شما ارجاع شد.',trackingCode:p.trackingCode,requestId:p.id,itemType:'PAYMENT',recipientUserId:toSupervisor.id,recipientRole:'APPROVER',actorName,targetSection:'APPROVER'});
      movedCount++;
    }
  }

  for (const b of db.batchPayments || []) {
    if (b.supervisorId === fromSupervisor.id) {
      const hasPending = (b.items || []).some((it) => (it.status || b.status) === 'Pending_Approver');
      if (hasPending) {
        b.supervisorId = toSupervisor.id;
        b.supervisorName = toSupervisor.name;
        for (const it of b.items || []) {
          if ((it.status || b.status) === 'Pending_Approver') {
            if (!it.auditHistory) it.auditHistory = [];
            it.auditHistory.push({
              id: `aud-${Date.now()}-${it.id}`,
              action: `انتقال کار منتظر از «${fromSupervisor.name}» به سرپرست جایگزین «${toSupervisor.name}»`,
              changedBy: actorName,
              changedAt: todayDate,
            });
            pushAppNotification(db,{eventType:'REQUEST_SUBMITTED',title:'ارجاع درخواست منتظر به سرپرست جایگزین',body:'درخواست منتظر برای بررسی به شما ارجاع شد.',trackingCode:b.trackingCode,requestId:b.id,rowId:it.id,itemType:'BATCH_ITEM',recipientUserId:toSupervisor.id,recipientRole:'APPROVER',actorName,targetSection:'APPROVER'});
            movedCount++;
          }
        }
      }
    }
  }

  return movedCount;
}

function loadDb(): TreasuryDatabaseState {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  let db: TreasuryDatabaseState;
  let needsSave = false;
  if (!fs.existsSync(DB_PATH)) {
    if (process.env.NODE_ENV === 'production') throw new Error('پایگاه داده موجود نیست؛ شروع نسخه آنلاین متوقف شد.');
    db = getInitialSeedState();
    needsSave = true;
  } else {
    try {
      const snapshot=databaseSnapshots.draft();
      db=snapshot.value;
      if(snapshot.normalized)return db;
    } catch (error) {
      throw new Error('پایگاه داده قابل خواندن نیست؛ برای حفاظت از اطلاعات، بازنشانی خودکار انجام نشد.', { cause: error });
    }
  }

  needsSave=normalizeDatabase(db)||needsSave;
  // Defaults/backfills which forgot the legacy needsSave flag must not become an
  // in-memory-only baseline for row-level persistence.
  if(databaseSnapshots.base(db)!==databaseSnapshots.snapshot(db))needsSave=true;
  if(needsSave)saveDb(db);
  databaseSnapshots.markNormalized(db,needsSave);
  return db;
}

/** Full normalization at startup/external invalidation; only changed records on commit. */
function normalizeDatabase(db:TreasuryDatabaseState,baseline?:TreasuryDatabaseState):boolean {
  let needsSave=false;
  const snapshot=baseline?databaseSnapshots.snapshot(db):undefined;
  const changed=<K extends keyof TreasuryDatabaseState>(key:K):any[]=>{
    const rows=db[key] as any[];
    if(!baseline)return rows||[];
    if(snapshot![key]===baseline[key])return [];
    const before=new Set((baseline[key] as any[])||[]),next=(snapshot![key] as any[])||[];
    return next.flatMap((row,index)=>before.has(row)?[]:[rows[index]]);
  };
  // Migrate users: hash any plaintext passwords and strip plaintext password from disk
  if (db.users) {
    for (const u of changed('users')) {
      u.personnelCode = String(u.personnelCode ?? '');
      u.phone = String(u.phone ?? '');
      if (u.isActive === undefined) {
        u.isActive = true;
        needsSave = true;
      }
      if (!u.company) {
        u.company = 'هلدینگ مرکزی آریا';
        needsSave = true;
      }
      if (!u.preferences) {
        u.preferences = getDefaultPreferencesForRole(u.role);
        needsSave = true;
      }
      if (u.password && (!u.passwordHash || !u.passwordSalt)) {
        const creds = createPasswordCredentials(u.password);
        u.passwordHash = creds.passwordHash;
        u.passwordSalt = creds.passwordSalt;
        delete u.password;
        needsSave = true;
      } else if (u.password && u.passwordHash && u.passwordSalt) {
        delete u.password;
        needsSave = true;
      } else if (!u.passwordHash || !u.passwordSalt) {
        if (process.env.NODE_ENV === 'production') throw new Error('یک کاربر فاقد رمز معتبر است؛ پیش از انتشار رمز او باید تعیین شود.');
        const fallbackPass = u.role === 'ADMIN' ? 'admin' : '123';
        const creds = createPasswordCredentials(fallbackPass);
        u.passwordHash = creds.passwordHash;
        u.passwordSalt = creds.passwordSalt;
        needsSave = true;
      }
    }
  }

  if (!db.roleConfigs || db.roleConfigs.length === 0) {
    db.roleConfigs = getDefaultRoleConfigs();
    needsSave = true;
  } else {
    for (const rc of changed('roleConfigs')) {
      rc.permissions = normalizeRolePermissionSet(rc.permissions, rc.role, rc.baseTemplateRole);
      if (!rc.defaultLandingSection) {
        rc.defaultLandingSection =
          rc.role === 'ADMIN'
            ? 'ADMIN_PANEL'
            : rc.role === 'APPROVER'
            ? 'APPROVER'
            : rc.role === 'ACCOUNTING'
            ? 'ACCOUNTING'
            : rc.role === 'TREASURY'
            ? 'TREASURY'
            : 'REQUESTER';
      }
      if (rc.role === 'ADMIN') {
        if (!rc.approvalLimitRial || rc.approvalLimitRial <= 0) {
          rc.approvalLimitRial = 1000000000000;
          needsSave = true;
        }
        if (!rc.paymentLimitRial || rc.paymentLimitRial <= 0) {
          rc.paymentLimitRial = 1000000000000;
          needsSave = true;
        }
        const fullAdminPerms = getDefaultPermissionsForRole('ADMIN', 'ADMIN');
        if (!rc.permissions.canApprove || !rc.permissions.canExecutePayment || !rc.permissions.canCreateRequest) {
          rc.permissions = { ...fullAdminPerms };
          needsSave = true;
        }
        rc.permissions.canManageUsers = true;
        rc.permissions.canManageRoles = true;
      }
    }
  }

  if (!db.companies) {
    db.companies = getDefaultCompanies();
    needsSave = true;
  }
  if (!db.departments) {
    db.departments = getDefaultDepartments();
    needsSave = true;
  }
  if (!db.costCenters) {
    db.costCenters = getDefaultCostCenters();
    needsSave = true;
  }
  if (!db.smsConfig) {
    db.smsConfig = getDefaultSmsConfig();
    needsSave = true;
  }
  if (!db.smsLogs) {
    db.smsLogs = [];
    needsSave = true;
  }

  if (!db.securityAuditLogs) {
    db.securityAuditLogs = [];
    needsSave = true;
  }
  if (!db.passwordRecoveryRequests) {
    db.passwordRecoveryRequests = [];
    needsSave = true;
  }
  if (!db.sessions) {
    db.sessions = [];
    needsSave = true;
  }

  if (!db.companyBankAccounts) {
    db.companyBankAccounts = getDefaultCompanyBankAccounts();
    needsSave = true;
  }

  const findAccountForBankName = (bankName?: string | null): CompanyBankAccount => {
    const list = db.companyBankAccounts || getDefaultCompanyBankAccounts();
    if (bankName) {
      const matched = list.find((a) => a.bankName === bankName);
      if (matched) return matched;
    }
    return list.find((a) => a.isDefault) || list[0];
  };

  // Auto-migration & normalization for independent row lifecycles, approval tracking, and source account snapshots
  if (db.batchPayments) {
    for (const b of changed('batchPayments')) {
      if (!b.batchType) b.batchType = 'PAYMENT';
      if (!b.attachments) b.attachments = [];
      if (b.items) {
        for (const item of b.items) {
          if (!item.status) item.status = b.status || 'Pending_Approver';
          if (item.initialAmount === undefined) item.initialAmount = item.amount;
          if (item.approvedAmount === undefined) item.approvedAmount = item.amount;
          if (!item.itemType) item.itemType = b.batchType;
          if (!item.comments) item.comments = [];
          if (!item.auditHistory) item.auditHistory = [];
          if (!item.attachments) item.attachments = [];
          if (!item.version) item.version = 1;

          // Backfill structured approver/accounting IDs for historical items that already passed stages
          if (
            (item.status === 'Pending_Accounting' ||
              item.status === 'Pending_Treasury' ||
              item.status === 'In_Payment' ||
              item.status === 'Paid') &&
            !item.approverId && b.supervisorId && b.supervisorId !== b.requesterId
          ) {
            item.approverId = b.supervisorId && b.supervisorId !== b.requesterId ? b.supervisorId : 'usr-sup-1';
            item.approverName = b.supervisorName || 'دکتر بهرام رستگاری';
            item.approvedByApproverAt = b.createdAt;
            item.approverDecisionVersion = item.version || 1;
            needsSave = true;
          }
          if (
            (item.status === 'Pending_Treasury' ||
              item.status === 'In_Payment' ||
              item.status === 'Paid') &&
            !item.accountingId && item.approvedByAccountingUserId
          ) {
            item.accountingId = item.approvedByAccountingUserId;
            item.accountingName = item.approvedByAccountingName || '';
            item.accountingDecisionVersion = item.version || 1;
            needsSave = true;
          }
          if (item.status === 'Needs_Revision' && !item.returnedById && item.returnedByUserId) {
            item.returnedById = item.returnedByUserId;
            needsSave = true;
          }
          if (item.status === 'Paid' && !item.sourceAccountSnapshot) {
            const acc = findAccountForBankName(item.paidBankName || b.paidBankName);
            item.sourceBankAccountId = acc.id;
            item.sourceAccountSnapshot = buildSourceAccountSnapshot(acc);
            item.paidAmountSoFar = item.approvedAmount ?? item.amount;
            item.remainingAmount = 0;
            needsSave = true;
          }
        }
      }
    }
  }
  if (db.advanceRequests) {
    for (const a of changed('advanceRequests')) {
      if (a.initialAmount === undefined) a.initialAmount = a.amount;
      if (!a.comments) a.comments = [];
      if (!a.auditHistory) a.auditHistory = [];
      if (!a.attachments) a.attachments = [];
      if (!a.version) a.version = 1;
      if (
        (a.status === 'Pending_Accounting' ||
          a.status === 'Pending_Treasury' ||
          a.status === 'In_Payment' ||
          a.status === 'Paid') &&
        !a.approverId && a.supervisorId && a.supervisorId !== a.requesterId
      ) {
        a.approverId = a.supervisorId || 'usr-sup-1';
        a.approverName = a.supervisorName || 'دکتر بهرام رستگاری';
        a.approvedByApproverAt = a.createdAt;
        a.approverDecisionVersion = a.version || 1;
        needsSave = true;
      }
      if (
        (a.status === 'Pending_Treasury' ||
          a.status === 'In_Payment' ||
          a.status === 'Paid') &&
        !a.approvedByAccountingAt &&
        a.accountingId
      ) {
        a.approvedByAccountingAt = a.createdAt;
        a.accountingDecisionVersion = a.version || 1;
        needsSave = true;
      }
      if (a.status === 'Paid' && !a.sourceAccountSnapshot) {
        const acc = findAccountForBankName(a.paidBankName);
        a.sourceBankAccountId = acc.id;
        a.sourceAccountSnapshot = buildSourceAccountSnapshot(acc);
        a.paidAmountSoFar = a.approvedAmount ?? a.amount;
        a.remainingAmount = 0;
        needsSave = true;
      }
    }
  }
  if (db.paymentRequests) {
    for (const p of changed('paymentRequests')) {
      if (p.initialAmount === undefined) p.initialAmount = p.amount;
      if (!p.comments) p.comments = [];
      if (!p.auditHistory) p.auditHistory = [];
      if (!p.attachments) p.attachments = [];
      if (!p.version) p.version = 1;
      if (
        (p.status === 'Pending_Accounting' ||
          p.status === 'Pending_Treasury' ||
          p.status === 'In_Payment' ||
          p.status === 'Paid') &&
        !p.approverId && p.supervisorId && p.supervisorId !== p.requesterId
      ) {
        p.approverId = p.supervisorId || 'usr-sup-1';
        p.approverName = p.supervisorName || 'دکتر بهرام رستگاری';
        p.approvedByApproverAt = p.createdAt;
        p.approverDecisionVersion = p.version || 1;
        needsSave = true;
      }
      if (
        (p.status === 'Pending_Treasury' ||
          p.status === 'In_Payment' ||
          p.status === 'Paid') &&
        !p.approvedByAccountingAt &&
        p.accountingId
      ) {
        p.approvedByAccountingAt = p.createdAt;
        p.accountingDecisionVersion = p.version || 1;
        needsSave = true;
      }
      if (p.status === 'Paid' && !p.sourceAccountSnapshot) {
        const acc = findAccountForBankName(p.paidBankName);
        p.sourceBankAccountId = acc.id;
        p.sourceAccountSnapshot = buildSourceAccountSnapshot(acc);
        p.paidAmountSoFar = p.approvedAmount ?? p.amount;
        p.remainingAmount = 0;
        needsSave = true;
      }
    }
  }
  if (db.manualPayments) {
    for (const m of changed('manualPayments')) {
      if (!m.sourceAccountSnapshot) {
        const acc = findAccountForBankName(m.bankName);
        m.sourceBankAccountId = acc.id;
        m.sourceAccountSnapshot = buildSourceAccountSnapshot(acc);
        needsSave = true;
      }
    }
  }
  if (db.receiptArchives) {
    for (const r of changed('receiptArchives')) {
      if (!r.sourceAccountSnapshot) {
        const acc = findAccountForBankName(r.bankName);
        r.sourceBankAccountId = acc.id;
        r.sourceAccountSnapshot = buildSourceAccountSnapshot(acc);
        needsSave = true;
      }
    }
  }
  if (!db.notifications) {
    db.notifications = [];
  }

  return needsSave;
}

function readDb():TreasuryDatabaseState {
  if(!databaseSnapshots.isNormalized())loadDb();
  return databaseSnapshots.view();
}

function saveDb(state: TreasuryDatabaseState): TreasuryDatabaseState {
  databaseSnapshots.assertCurrent(state);
  normalizeDatabase(state,databaseSnapshots.base(state));
  const snapshot=databaseSnapshots.snapshot(state);
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  // Never persist transient computed effective* fields or plaintext passwords to disk
  const cleanUsers = (snapshot.users || []).map((u) => {
    if(!u.password&&u.effectivePermissions===undefined&&u.effectiveAccessScope===undefined&&u.effectiveApprovalLimitRial===undefined&&u.effectivePaymentLimitRial===undefined)return u;
    const copy = { ...u };
    if (copy.password && (!copy.passwordHash || !copy.passwordSalt)) {
      const creds = createPasswordCredentials(copy.password);
      copy.passwordHash = creds.passwordHash;
      copy.passwordSalt = creds.passwordSalt;
    }
    delete copy.password;
    delete copy.effectivePermissions;
    delete copy.effectiveAccessScope;
    delete copy.effectiveApprovalLimitRial;
    delete copy.effectivePaymentLimitRial;
    return copy;
  });
  const toDisk: TreasuryDatabaseState = {
    ...snapshot,
    users: cleanUsers,
  };
  if(STORAGE_MODE==='sqlite'){
    const backups=path.join(DATA_DIR,'backups');fs.mkdirSync(backups,{recursive:true});
    databaseSnapshots.backup(path.join(backups,`treasury-${new Date().toISOString().slice(0,10)}.sqlite`));
    databaseSnapshots.commitBacking(toDisk,state);wakeBankInquiry();return toDisk;
  }
  // A complete temporary file is committed atomically; a failed write cannot erase the live database.
  const backupDir = path.join(DATA_DIR, 'backups');
  fs.mkdirSync(backupDir, { recursive: true });
  if (fs.existsSync(DB_PATH)) {
    const dailyBackup = path.join(backupDir, `treasury-${new Date().toISOString().slice(0, 10)}.json`);
    if (!fs.existsSync(dailyBackup)) fs.copyFileSync(DB_PATH, dailyBackup, fs.constants.COPYFILE_EXCL);
  }
  const temporary = `${DB_PATH}.${process.pid}.tmp`;
  // Formatting is not part of the JSON contract; avoid rewriting indentation on every commit.
  const encoded=JSON.stringify(toDisk);
  const fd = fs.openSync(temporary, 'w', 0o600);
  let written:fs.BigIntStats;
  try {
    fs.writeFileSync(fd, encoded, 'utf-8');
    fs.fsyncSync(fd);
    written=fs.fstatSync(fd,{bigint:true});
  } finally { fs.closeSync(fd); }
  databaseSnapshots.assertCurrent(state);
  fs.renameSync(temporary, DB_PATH);
  databaseSnapshots.publish(toDisk,written!);
  wakeBankInquiry();
  // This is the frozen snapshot actually published AFTER the durable commit.
  // Responses must not materialize the still-live draft's history a second time.
  return toDisk;
}

function pushAppNotification(
  db: TreasuryDatabaseState,
  payload: Omit<AppNotification, 'id' | 'createdAt' | 'readByUserIds'>
): AppNotification {
  const created=notificationAudiences(payload).map(audience=>pushAddressedNotification(db,audience));
  return created[0];
}

function pushAddressedNotification(
  db: TreasuryDatabaseState,
  payload: Omit<AppNotification, 'id' | 'createdAt' | 'readByUserIds'>
): AppNotification {
  if (!db.notifications) db.notifications = [];
  const notif: AppNotification = {
    ...payload,
    id: `ntf-${crypto.randomUUID()}`,
    createdAt: `${getTodayJalali()} - ${new Date().toTimeString().slice(0, 5)}`,
    readByUserIds: [],
  };
  db.notifications.unshift(notif);
  if (db.notifications.length > NOTIFICATION_RETENTION) {
    db.notifications = db.notifications.slice(0, NOTIFICATION_RETENTION);
  }

  // Trigger optional SMS notification if SMS gateway is enabled and event is checked
  const smsCfg = db.smsConfig;
  if (smsCfg?.enabled && smsCfg.events) {
    let shouldSendSms = false;
    let smsEventType: SmsDispatchLogEntry['eventType'] = 'PENDING_APPROVAL';
    if (
      (payload.eventType === 'REQUEST_SUBMITTED' ||
        payload.eventType === 'REQUEST_RESUBMITTED' ||
        payload.eventType === 'APPROVED_SUPERVISOR' ||
        payload.eventType === 'FINAL_APPROVED_ACCOUNTING') &&
      smsCfg.events.sendOnPendingApproval
    ) {
      shouldSendSms = true;
      smsEventType = 'PENDING_APPROVAL';
    } else if (payload.eventType === 'RETURNED_FOR_REVISION' && smsCfg.events.sendOnRevisionOrReject) {
      shouldSendSms = true;
      smsEventType = 'REVISION_OR_REJECT';
    } else if (payload.eventType === 'PAYMENT_EXECUTED' && smsCfg.events.sendOnPaymentExecuted) {
      shouldSendSms = true;
      smsEventType = 'PAYMENT_EXECUTED';
    }

    if (shouldSendSms) {
      // Observe the committed notification and current audience, not the draft
      // that scheduled this callback. A failed financial commit sends nothing.
      void backgroundWrites.run(async()=>{try{
        const dispatchDb=loadDb(),state=databaseSnapshots.snapshot(dispatchDb),committed=state.notifications?.find(n=>n.id===notif.id);
        if(!committed)return;
        const recipients=state.users.filter(u=>u.phone&&notificationQueueAllowed(committed,computeEffectiveUserAuth(u,state).effectivePermissions)&&notificationDeliveryEligible(committed,u,state,id=>canSeeNotificationTarget(id,u,state,computeEffectiveUserAuth(u,state))));
        for(const candidate of recipients){
        // Re-evaluate each audience after any awaited provider call: access may
        // have been revoked while another recipient's request was in flight.
        const currentDb=loadDb(),currentState=databaseSnapshots.snapshot(currentDb),current=currentState.notifications?.find(n=>n.id===notif.id),targetUser=currentState.users.find(u=>u.id===candidate.id);
        if(!current||!targetUser?.phone||!notificationQueueAllowed(current,computeEffectiveUserAuth(targetUser,currentState).effectivePermissions)||!notificationDeliveryEligible(current,targetUser,currentState,id=>canSeeNotificationTarget(id,targetUser,currentState,computeEffectiveUserAuth(targetUser,currentState))))continue;
        const result=await dispatchRealSms(currentDb, {
          eventType: smsEventType,
          recipientName: targetUser.name,
          recipientPhone: targetUser.phone,
          message: `پرتال مالی شاهراه: ${committed.title} (${committed.trackingCode})`,
          relatedTrackingCode: committed.trackingCode,
        });
          try {
            // Merge only the completed SMS log; this snapshot may predate other users' writes.
            const latest = loadDb();
            if (!(latest.smsLogs || []).some(log => log.id === result.logEntry.id)) {
              latest.smsLogs = [result.logEntry, ...(latest.smsLogs || [])].slice(0, 300);
              saveDb(latest);
            }
          } catch {
            // ignore background save error
          }
        }
      }catch{/* Unknown commit or audience: no external delivery. */}});
    }
  }

  return notif;
}

// In-memory rate limiter for login attempts
const loginAttemptMap = new Map<string, { failedCount: number; firstAttemptAt: number; lockedUntil: number }>();

// In-memory store for SMS OTP password recovery challenges
const smsOtpChallengeMap = new Map<
  string,
  { userId: string; personnelCode: string; phone: string; otpHash: string; salt: string; expiresAt: number; attempts: number }
>();

function extractBearerToken(req: express.Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  if (req.body && typeof req.body.sessionToken === 'string') {
    return req.body.sessionToken;
  }
  return null;
}

function resolveSessionUser(req: express.Request, db: TreasuryDatabaseState): { user: User | null; session: UserSessionRecord | null } {
  const token = extractBearerToken(req);
  if (!token || !db.sessions) return { user: null, session: null };
  const session = db.sessions.find((s) => s.token === token);
  if (!session || session.revoked || session.expiresAt <= Date.now()) {
    return { user: null, session: null };
  }
  const user = db.users.find((u) => u.id === session.userId) || null;
  if (!user || user.isActive === false) {
    return { user: null, session: null };
  }
  return { user, session };
}

async function startServer() {
  // One process owns a JSON store. Separate test stores can still run alongside it.
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const lockPath = path.join(DATA_DIR, STORE_LOCK_NAME);
  if (fs.existsSync(lockPath)) {
    let running = false;
    try {
      const previous = JSON.parse(fs.readFileSync(lockPath, 'utf-8'));
      try { process.kill(previous.pid, 0); running = true; } catch (error: any) { running = error.code !== 'ESRCH'; }
    } catch { throw new Error('قفل پایگاه داده قابل بررسی نیست؛ شروع متوقف شد.'); }
    if (running) throw new Error('این پایگاه داده هم‌اکنون توسط یک سرور دیگر استفاده می‌شود.');
    fs.unlinkSync(lockPath);
  }
  fs.writeFileSync(lockPath, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }), { flag: 'wx' });
  process.once('exit', () => {
    try { if (JSON.parse(fs.readFileSync(lockPath, 'utf-8')).pid === process.pid) fs.unlinkSync(lockPath); } catch {}
  });
  databaseSnapshots=new CommittedJson<TreasuryDatabaseState>(DB_PATH,STORAGE_MODE==='sqlite'?new SqliteRecords<TreasuryDatabaseState>(DB_PATH):undefined);
  loadDb();
  const app = express();
  // A measured full-state response bottleneck includes repeated gzip work.
  // Level 1 retains the same JSON/API contract without raising any deadline.
  app.use(compression({level:1}));
  app.disable('x-powered-by');
  if(process.env.TREASURY_TRUST_PROXY==='loopback')app.set('trust proxy','loopback');
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'same-origin');
    next();
  });
  app.get('/api/health', (_req, res) => res.json({ ok: true, app: 'khazaneh', mode: process.env.NODE_ENV || 'development' }));
  app.use(express.json({ limit: '20mb' }));

  // Defense-in-depth response sanitizer: guarantees no password/hash/salt/session/apiKey ever leaves the server
  const stateSync=new StateSync();
  const scopedViews=new WeakMap<TreasuryDatabaseState,WeakMap<User,{signature:string;view:TreasuryDatabaseState}>>();
  const projectState=(db:TreasuryDatabaseState,viewer:User)=>{
    const safe=sanitizeDbForClient(db),auth=computeEffectiveUserAuth(viewer,db);
    // Session resolution still happens on EVERY request. Only this exact branded,
    // immutable database + immutable viewer + current effective auth may reuse a
    // projection; a commit/external replacement/revocation changes its identity.
    if(!sanitizedStates.has(safe)||!Object.isFrozen(viewer))return scopeState(safe,viewer,auth);
    const signature=JSON.stringify(auth),byViewer=scopedViews.get(safe)||new WeakMap(),cached=byViewer.get(viewer);
    if(cached?.signature===signature)return cached.view;
    const view=freeze(scopeState(safe,viewer,auth),true) as TreasuryDatabaseState;
    byViewer.set(viewer,{signature,view});scopedViews.set(safe,byViewer);return view;
  };
  const stateAuthority=(viewer:User,db:TreasuryDatabaseState)=>crypto.createHash('sha256').update(JSON.stringify({viewer:sanitizeUserForClient(viewer,db),roles:db.roleConfigs?.filter(r=>getUserRoles(viewer).includes(r.role)),companies:db.companies?.map(c=>({id:c.id,name:c.name}))})).digest('hex');
  app.use((_req, res, next) => {
    const origJson = res.json.bind(res);
    const stateReply=(body:any,state:TreasuryDatabaseState)=>{
      if(_req.get('X-Treasury-State-Mode')!=='delta-v1'||!res.locals.syncBinding)return origJson(body);
      const db=readDb(),viewer=res.locals.viewer as User;
      return origJson(stateSync.reply(body,state,res.locals.syncBinding,stateAuthority(viewer,db),db,_req.query.sync==='begin'?undefined:_req.get('X-Treasury-State-Cursor')));
    };
    const protectedState = (state: TreasuryDatabaseState) => {
      state=databaseSnapshots.snapshot(state);
      const viewer = res.locals.viewer as User | undefined;
      if (!viewer) throw new Error('A state response requires an authenticated viewer.');
      return projectState(state,viewer);
    };
    res.json = (body: any) => {
      if (body && typeof body === 'object') {
        for(const key of ['item','batch','receipt','manualPayment'])if(body[key]&&typeof body[key]==='object')body={...body,[key]:databaseSnapshots.snapshot(Object.hasOwn(body[key],'deletedItems')?publicBatch(body[key]):body[key])};
        if (Array.isArray(body.users) && Array.isArray(body.advanceRequests)) {
          const state=protectedState(body as TreasuryDatabaseState);return stateReply(state,state);
        }
        if (body.state && Array.isArray(body.state.users)) {
          body = {
            ...body,
            state: protectedState(body.state as TreasuryDatabaseState),
          };
        }
        if (body.user && typeof body.user === 'object' && body.user.id) {
          const db = body.state || loadDb();
          body = {
            ...body,
            user: sanitizeUserForClient(body.user as User, db),
          };
        }
        const viewer = res.locals.viewer as User | undefined;
        if (viewer && ['item','batch','receipt'].some(key=>body[key]) && !computeEffectiveUserAuth(viewer, body.state || loadDb()).effectivePermissions.canViewAttachments) {
          const stripFiles = (value: any): any => Array.isArray(value) ? value.map(stripFiles) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).filter(([key]) => !['attachments', 'fileUrl', 'receiptFileUrl'].includes(key)).map(([key, value]) => [key, stripFiles(value)])) : value;
          for (const key of ['item', 'batch', 'receipt']) if (body[key]) body[key] = stripFiles(body[key]);
        }
        if (body.smsConfig && typeof body.smsConfig === 'object') {
          body = {
            ...body,
            smsConfig: sanitizeSmsConfigForClient(body.smsConfig as SmsGatewayConfig),
          };
        }
        if(viewer&&Array.isArray(body.companyBankAccounts))body={...body,companyBankAccounts:body.state?.companyBankAccounts||protectedState(readDb()).companyBankAccounts};
      }
      if(body?.state&&Array.isArray(body.state.users))return stateReply(body,body.state);
      return origJson(body);
    };
    next();
  });

  const publicAuthAttempts = new Map<string, { count: number; since: number }>();
  const publicPaths = new Set(['/auth/login','/auth/recovery-request','/auth/recovery-send-otp','/auth/recovery-verify-otp']);

  // Strict server-side session token enforcement: if a Bearer token is supplied on any protected API route and is revoked/expired, reject immediately
  app.use('/api', (req, res, next) => {
    if (publicPaths.has(req.path)) {
      const key = `${req.ip}:${req.path}`;
      const now = Date.now();
      const recent = publicAuthAttempts.get(key) || { count: 0, since: now };
      if (now - recent.since > 60_000) { recent.count = 0; recent.since = now; }
      recent.count++;
      publicAuthAttempts.set(key, recent);
      if (publicAuthAttempts.size > 10_000) publicAuthAttempts.clear();
      if (recent.count > (req.path === '/auth/login' ? 20 : 3)) return res.status(429).json({ error: 'تعداد درخواست زیاد است؛ کمی بعد دوباره تلاش کنید.' });
      return next();
    }
    const db = readDb();
    const { user, session } = resolveSessionUser(req, db);
    if (!user || !session) {
      return res.status(401).json({ error: 'برای دسترسی به سامانه وارد حساب خود شوید.', sessionExpired: true });
    }
    res.locals.viewer = user;
    res.locals.syncBinding=crypto.createHash('sha256').update(session.token+':'+user.id).digest('hex');
    if(req.method==='GET'&&req.path==='/state')res.locals.authorizationDb = db;
    res.setHeader('Cache-Control', 'no-store');
    const denied = authorizeRequest(req, user, db, computeEffectiveUserAuth(user, db));
    if (denied) return res.status(denied.status).json({ error: denied.error,code:denied.code });
    const fileError=documentInputError(req.body,req.path);if(fileError)return res.status(400).json({error:fileError});
    next();
  });

  const mutations=createMutationRoutes(app,(req,res)=>{
    const route=req.path.replace(/^\/api(?=\/)/,'');
    if(publicPaths.has(route))return true;
    const db=loadDb(),authorizationState=databaseSnapshots.snapshot(db),{user,session}=resolveSessionUser(req,authorizationState);
    if(!user||!session){res.status(401).json({error:'برای دسترسی به سامانه وارد حساب خود شوید.',sessionExpired:true});return false;}
    const denied=authorizeRequest({path:route,method:req.method,body:req.body},user,authorizationState,computeEffectiveUserAuth(user,authorizationState));
    if(denied){res.status(denied.status).json({error:denied.error,code:denied.code});return false;}
    const fileError=documentInputError(req.body,route);if(fileError){res.status(400).json({error:fileError});return false;}
    res.locals.viewer=user;res.locals.syncBinding=crypto.createHash('sha256').update(session.token+':'+user.id).digest('hex');res.locals.commandDb=db;return true;
  });

  const bankInquiry=installBankInquiry(app,{read:readDb,load:loadDb,save:saveDb,auth:computeEffectiveUserAuth,session:resolveSessionUser,run:mutations.run,post:mutations.post});
  wakeBankInquiry=bankInquiry.wake;
  await bankInquiry.start();

  // 1. Get full database state
  app.get('/api/state', (req, res) => {
    if(req.query.sync&&req.query.sync!=='begin'){
      const db=res.locals.authorizationDb as TreasuryDatabaseState,viewer=res.locals.viewer as User;
      const view=projectState(db,viewer),authority=stateAuthority(viewer,db);
      try{
        if(req.query.sync==='bundle'){let pages:unknown;try{if(typeof req.query.pages!=='string'||req.query.pages.length>2048)throw Error();pages=JSON.parse(req.query.pages);}catch{return res.status(409).json({error:'صفحات معتبر نیست.',syncExpired:true});}const bundle=stateSync.bundle(req.query.cursor,res.locals.syncBinding,authority,view,pages);return res.type('application/json').send(stateSync.encodedBundle(bundle));}
        return res.json(req.query.sync==='finish'?stateSync.finish(req.query.cursor,res.locals.syncBinding,authority,view,db):stateSync.page(req.query.sync,res.locals.syncBinding,authority,view,req.query.collection,req.query.offset,req.query.limit));
      }catch(error:any){if(error.syncExpired)return res.status(409).json({error:error.message,syncExpired:true});if(error.bundleTooLarge)return res.status(413).json({error:error.message,bundleTooLarge:true});throw error;}
    }
    // Same synchronous read request; the central JSON boundary still sanitizes and scopes it.
    res.json(res.locals.authorizationDb);
  });

  // 1b. Mark notifications as read
  for(const download of [false,true])app.get('/api/reports/treasury'+(download?'/export':''),async(req,res)=>{
    try{const db=readDb(),viewer=res.locals.viewer as User,auth=computeEffectiveUserAuth(viewer,db),filters=parseReportFilters(req.query as Record<string,unknown>),source=financialReportState(sanitizeDbForClient(db),projectState(db,viewer),viewer,auth);
      if(filters.company&&!source.companies?.some(c=>c.id===filters.company||c.name===filters.company))throw reportError('شرکت انتخاب‌شده خارج از محدوده مجاز است.',403);
      const authority=stateAuthority(viewer,db),report=await buildFinancialReportAsync(source,filters,()=>new Promise<void>(resolve=>setImmediate(resolve)));
      const latest=readDb(),current=resolveSessionUser(req,latest).user;
      if(!current)throw reportError('نشست معتبر نیست؛ دوباره وارد شوید.',401);
      if(stateAuthority(current,latest)!==authority||!reportSourceStillVisible(source,financialReportState(sanitizeDbForClient(latest),projectState(latest,current),current,computeEffectiveUserAuth(current,latest))))throw reportError('دسترسی گزارش تغییر کرده است؛ دوباره گزارش بگیرید.',403);
      if(download&&report.warnings.inconsistent)throw reportError('تاریخچه پرداخت ناسازگار است؛ خروجی تا بررسی مسدود است.',409);
      res.json({report:download?report:financialReportPage(report)});
    }catch(error:any){res.status([400,401,403,409,413].includes(error.status)?error.status:500).json({error:error.status?error.message:'تهیه گزارش ناموفق بود؛ اطلاعاتی تغییر نکرد.'});}
  });

  mutations.post('/api/notifications/read', (req, res) => {
    const db = loadDb();
    const { userId, notificationId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'شناسه کاربر مشخص نیست' });
    }
    if (!db.notifications) db.notifications = [];

    const viewer=res.locals.viewer as User,auth=computeEffectiveUserAuth(viewer,db);
    const visible=(n:AppNotification)=>notificationQueueAllowed(n,auth.effectivePermissions)&&notificationVisible(n,viewer,db,id=>canSeeNotificationTarget(id,viewer,db,auth));

    if (notificationId) {
      const target = db.notifications.find((n) => n.id === notificationId);
      if(!target||!visible(target))return res.status(403).json({error:'اعلان در محدودهٔ دسترسی فعلی شما نیست.'});
      if (target && !target.readByUserIds.includes(userId)) {
        target.readByUserIds.push(userId);
      }
    } else {
      for (const n of db.notifications) {
        if (visible(n)&&!n.readByUserIds.includes(userId)) {
          n.readByUserIds.push(userId);
        }
      }
    }

    saveDb(db);
    res.json({ success: true, state: sanitizeDbForClient(db) });
  });

  // 2. Authentication Login Endpoint with Rate Limiting, Active Check, 2FA, and Server Session
  mutations.post('/api/auth/login', (req, res) => {
    const db = loadDb();
    const { personnelCode, password, twoFactorCode } = req.body;
    const rawCode = String(personnelCode || '').trim();
    const normalizedKey = rawCode.toLowerCase();

    if (!rawCode || !password) {
      return res.status(400).json({ error: 'لطفاً کد پرسنلی (نام کاربری) و رمز عبور را وارد نمایید.' });
    }

    // Check rate limiting / lockout (max 5 failed attempts in 10 minutes -> 3 minute lock)
    const now = Date.now();
    const attemptInfo = loginAttemptMap.get(normalizedKey);
    if (attemptInfo && attemptInfo.lockedUntil > now) {
      const remainSec = Math.ceil((attemptInfo.lockedUntil - now) / 1000);
      return res.status(429).json({
        error: `به دلیل تلاش‌های ناموفق متوالی، ورود این حساب به صورت موقت تا ${remainSec} ثانیه دیگر مسدود شده است.`,
        lockedUntil: attemptInfo.lockedUntil,
      });
    }

    const user = db.users.find(
      (u) => String(u.personnelCode || '').trim().toLowerCase() === normalizedKey
    );

    const recordFailedAttempt = () => {
      const prev = loginAttemptMap.get(normalizedKey);
      if (!prev || now - prev.firstAttemptAt > 10 * 60 * 1000) {
        loginAttemptMap.set(normalizedKey, { failedCount: 1, firstAttemptAt: now, lockedUntil: 0 });
      } else {
        const nextCount = prev.failedCount + 1;
        const lockedUntil = nextCount >= 5 ? now + 3 * 60 * 1000 : 0;
        loginAttemptMap.set(normalizedKey, {
          failedCount: nextCount,
          firstAttemptAt: prev.firstAttemptAt,
          lockedUntil,
        });
        if (lockedUntil > 0 && user) {
          pushSecurityAuditLog(db, {
            actionType: 'LOGIN_LOCKED',
            actorId: user.id,
            actorName: user.name,
            targetUserId: user.id,
            targetUserName: user.name,
            description: `مسدودسازی موقت ورود حساب «${user.name}» (${user.personnelCode}) پس از ۵ تلاش ناموفق رمز عبور`,
          });
          saveDb(db);
        }
      }
    };

    if (!user) {
      recordFailedAttempt();
      return res.status(401).json({ error: 'کد پرسنلی (نام کاربری) یا رمز عبور وارد شده نادرست است.' });
    }

    if (user.isActive === false) {
      return res.status(403).json({
        error: 'حساب کاربری شما غیرفعال شده است و امکان ورود به سامانه را ندارد. جهت بررسی با مدیر سیستم تماس بگیرید.',
      });
    }

    if (!verifyUserPassword(String(password), user)) {
      recordFailedAttempt();
      return res.status(401).json({ error: 'کد پرسنلی (نام کاربری) یا رمز عبور وارد شده نادرست است.' });
    }

    // Check Two-Factor Authentication if enabled for this user
    if (user.twoFactorEnabled) {
      if (!twoFactorCode || !String(twoFactorCode).trim()) {
        return res.status(200).json({
          requiresTwoFactor: true,
          message: 'احراز هویت دومرحله‌ای برای این حساب فعال است. لطفاً کد پین امنیتی ۶ رقمی خود را وارد کنید.',
        });
      }
      const pinValid = user.twoFactorPinHash
        ? hashPasswordWithSalt(String(twoFactorCode).trim(), user.passwordSalt || '2fa-salt') === user.twoFactorPinHash
        : false;
      if (!pinValid) {
        recordFailedAttempt();
        return res.status(401).json({ error: 'کد امنیتی دومرحله‌ای وارد شده نادرست است.' });
      }
    }

    // Successful login: clear failed attempts and create session token
    loginAttemptMap.delete(normalizedKey);
    if (!db.sessions) db.sessions = [];
    // Prune expired sessions
    db.sessions = db.sessions.filter((s) => !s.revoked && s.expiresAt > now);

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = now + 8 * 60 * 60 * 1000; // 8 hours
    db.sessions.push({
      token,
      userId: user.id,
      createdAt: now,
      expiresAt,
      revoked: false,
    });
    saveDb(db);

    res.json({
      success: true,
      token,
      expiresAt,
      mustChangePassword: Boolean(user.mustChangePassword),
      user: sanitizeUserForClient(user, db),
    });
  });

  // 2b. Verify Current Session & Active User Status
  app.get('/api/auth/me', (req, res) => {
    const db = loadDb();
    const { user, session } = resolveSessionUser(req, db);
    if (!user || !session) {
      return res.status(401).json({
        error: 'نشست کاربری شما منقضی یا لغو شده است. لطفاً مجدداً وارد سامانه شوید.',
        sessionExpired: true,
      });
    }
    const activeSessionsCount = (db.sessions || []).filter(
      (s) => s.userId === user.id && !s.revoked && s.expiresAt > Date.now()
    ).length;
    res.json({
      success: true,
      user: sanitizeUserForClient(user, db),
      session: {
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        activeSessionsCount,
      },
    });
  });

  // 2c. Real Logout (Revoke Server Session & Record Audit Log)
  mutations.post('/api/auth/logout', (req, res) => {
    const db = loadDb();
    const token = extractBearerToken(req) || req.body?.token;
    let loggedOutUser: User | undefined;
    if (token && db.sessions) {
      for (const s of db.sessions) {
        if (s.token === token) {
          s.revoked = true;
          s.revokedReason = 'USER_LOGOUT';
          loggedOutUser = db.users.find((u) => u.id === s.userId);
        }
      }
      if (loggedOutUser) {
        pushSecurityAuditLog(db, {
          actionType: 'USER_LOGOUT',
          actorId: loggedOutUser.id,
          actorName: loggedOutUser.name,
          targetUserId: loggedOutUser.id,
          targetUserName: loggedOutUser.name,
          description: `خروج رسمی از حساب کاربری و ابطال توکن نشست سرور توسط «${loggedOutUser.name}» (${loggedOutUser.personnelCode})`,
        });
      }
      saveDb(db);
    }
    res.json({ success: true, loggedOut: true });
  });

  // 2d. Revoke Other Active Sessions of Current User
  mutations.post('/api/auth/logout-other-sessions', (req, res) => {
    const db = loadDb();
    const { user, session } = resolveSessionUser(req, db);
    const userId = user?.id || req.body?.userId;
    const currentToken = session?.token || extractBearerToken(req);
    if (!userId) {
      return res.status(401).json({ error: 'نشست معتبر یافت نشد.' });
    }
    let revokedCount = 0;
    for (const s of db.sessions || []) {
      if (s.userId === userId && !s.revoked && s.token !== currentToken) {
        s.revoked = true;
        s.revokedReason = 'REVOKED_BY_USER';
        revokedCount++;
      }
    }
    saveDb(db);
    res.json({ success: true, revokedCount });
  });

  // 2e. Change Password (by Authenticated User or First-Login Forced Temporary Password Change)
  mutations.post('/api/auth/change-password', (req, res) => {
    const db = loadDb();
    const { user: sessionUser } = resolveSessionUser(req, db);
    const targetUserId = sessionUser?.id || req.body?.userId;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!targetUserId) {
      return res.status(401).json({ error: 'کاربر معتبر تشخیص داده نشد.' });
    }
    const targetUser = db.users.find((u) => u.id === targetUserId);
    if (!targetUser || targetUser.isActive === false) {
      return res.status(403).json({ error: 'حساب کاربری معتبر یا فعال نیست.' });
    }

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: 'وارد کردن رمز عبور فعلی، رمز جدید و تکرار رمز جدید الزامی است.' });
    }
    if (!verifyUserPassword(String(currentPassword), targetUser)) {
      return res.status(400).json({ error: 'رمز عبور فعلی وارد شده نادرست است.' });
    }
    const cleanNew = String(newPassword);
    if (cleanNew.length < 5) {
      return res.status(400).json({ error: 'رمز عبور جدید باید حداقل ۵ کاراکتر باشد.' });
    }
    if (cleanNew !== String(confirmPassword)) {
      return res.status(400).json({ error: 'رمز عبور جدید و تکرار آن با یکدیگر مطابقت ندارند.' });
    }
    if (cleanNew === String(currentPassword)) {
      return res.status(400).json({ error: 'رمز عبور جدید نباید با رمز عبور فعلی یا موقت یکسان باشد.' });
    }

    const creds = createPasswordCredentials(cleanNew);
    targetUser.passwordHash = creds.passwordHash;
    targetUser.passwordSalt = creds.passwordSalt;
    targetUser.mustChangePassword = false;
    delete targetUser.password;

    // Revoke other sessions of this user for security
    const currentToken = extractBearerToken(req);
    for (const s of db.sessions || []) {
      if (s.userId === targetUser.id && s.token !== currentToken) {
        s.revoked = true;
        s.revokedReason = 'PASSWORD_CHANGED';
      }
    }

    pushSecurityAuditLog(db, {
      actionType: 'PASSWORD_CHANGED',
      actorId: targetUser.id,
      actorName: targetUser.name,
      targetUserId: targetUser.id,
      targetUserName: targetUser.name,
      description: `تغییر رمز عبور توسط صاحب حساب «${targetUser.name}» (${targetUser.personnelCode})`,
    });

    saveDb(db);
    res.json({
      success: true,
      user: sanitizeUserForClient(targetUser, db),
      state: sanitizeDbForClient(db),
    });
  });

  // 2f. Password Recovery Request (Real internal ticket to Admin without fake SMS/Email)
  mutations.post('/api/auth/recovery-request', (req, res) => {
    const db = loadDb();
    const { personnelCode, phone, note } = req.body;
    const cleanCode = normalizeDigitsServer(personnelCode).trim();
    const cleanPhone = normalizeDigitsServer(phone).trim();

    if (!cleanCode || !cleanPhone) {
      return res.status(400).json({ error: 'وارد کردن کد پرسنلی و شماره تلفن همراه ثبت‌شده الزامی است.' });
    }

    const matchedUser = db.users.find(
      (u) =>
        normalizeDigitsServer(u.personnelCode).trim().toLowerCase() === cleanCode.toLowerCase() &&
        normalizeDigitsServer(u.phone).trim() === cleanPhone
    );

    if (!matchedUser) {
      return res.status(400).json({
        error: 'کد پرسنلی و شماره تلفن همراه وارد شده با اطلاعات ثبت‌شده در سامانه مطابقت ندارد.',
      });
    }

    if (!db.passwordRecoveryRequests) db.passwordRecoveryRequests = [];
    const existingPending = db.passwordRecoveryRequests.find(
      (r) => r.userId === matchedUser.id && r.status === 'Pending'
    );
    if (existingPending) {
      return res.status(400).json({
        error: `شما یک درخواست بازیابی باز با کد پیگیری ${existingPending.trackingCode} دارید که در انتظار اقدام مدیر سیستم است.`,
      });
    }

    const trackingCode = `REC-${getTodayJalali().slice(0,4)}-${101 + db.passwordRecoveryRequests.length}`;
    const rec: PasswordRecoveryRequest = {
      id: `rec-${Date.now()}`,
      trackingCode,
      personnelCode: matchedUser.personnelCode,
      userName: matchedUser.name,
      userId: matchedUser.id,
      phone: cleanPhone,
      note: String(note || 'درخواست صدور رمز عبور موقت جدید').trim(),
      status: 'Pending',
      createdAt: `${getTodayJalali()} - ${new Date().toTimeString().slice(0, 5)}`,
      resolvedAt: null,
      resolvedBy: null,
    };
    db.passwordRecoveryRequests.unshift(rec);
    saveDb(db);

    res.json({
      success: true,
      trackingCode,
      recoveryRequest: rec,
      message: `درخواست بازیابی دسترسی با کد پیگیری ${trackingCode} ثبت شد و در کارتابل مدیر سیستم قرار گرفت.`,
    });
  });

  // 2f-2. Real SMS OTP Password Recovery (Step 1: Send OTP via configured SMS Gateway - NEVER fakes success)
  mutations.post('/api/auth/recovery-send-otp', async (req, res) => {
    const db = loadDb();
    const { personnelCode, phone } = req.body || {};
    const cleanCode = normalizeDigitsServer(personnelCode).trim();
    const cleanPhone = normalizeDigitsServer(phone).trim();

    if (!cleanCode || !cleanPhone) {
      return res.status(400).json({
        error: 'وارد کردن کد پرسنلی و شماره تلفن همراه ثبت‌شده در پرونده الزامی است.',
      });
    }

    const matchedUser = db.users.find(
      (u) =>
        normalizeDigitsServer(u.personnelCode).trim().toLowerCase() === cleanCode.toLowerCase() &&
        normalizeDigitsServer(u.phone).trim() === cleanPhone
    );

    if (!matchedUser) {
      return res.status(400).json({
        error: 'کد پرسنلی و شماره تلفن همراه وارد شده با اطلاعات ثبت‌شده در سامانه مطابقت ندارد.',
      });
    }
    if (matchedUser.isActive === false) {
      return res.status(403).json({
        error: 'این حساب کاربری غیرفعال است و امکان بازیابی رمز عبور ندارد.',
      });
    }

    if (!db.smsConfig?.enabled || !db.smsConfig?.events?.sendOtpOnRecovery) {
      // Record skipped attempt in SMS logs so admin can inspect it, and return honest error
      await dispatchRealSms(db, {
        eventType: 'OTP_RECOVERY',
        recipientName: matchedUser.name,
        recipientPhone: cleanPhone,
        message: 'درخواست کد بازیابی رمز عبور پرتال مالی',
      });
      saveDb(db);
      return res.status(503).json({
        error:
          'درگاه پیامک سازمانی در حال حاضر فعال یا پیکربندی نشده است؛ ارسال پیامک جعلی انجام نمی‌شود. لطفاً از تب «ثبت تیکت بازیابی برای مدیر سیستم» استفاده نمایید.',
        smsUnavailable: true,
      });
    }

    const otpPlain = String(crypto.randomInt(100000, 999999));
    const smsResult = await dispatchRealSms(db, {
      eventType: 'OTP_RECOVERY',
      recipientName: matchedUser.name,
      recipientPhone: cleanPhone,
      message: `پرتال مالی شاهراه - کد بازیابی رمز عبور شما: ${otpPlain} (اعتبار: ۳ دقیقه)`,
    });
    saveDb(db);

    if (!smsResult.ok) {
      return res.status(502).json({
        error: `ارسال پیامک کد تأیید از طریق درگاه پیامک موفق نبود (${smsResult.error}). لطفاً از روش «ثبت تیکت بازیابی برای مدیر سیستم» استفاده کنید.`,
        smsUnavailable: true,
      });
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const otpHash = hashPasswordWithSalt(otpPlain, salt);
    smsOtpChallengeMap.set(matchedUser.id, {
      userId: matchedUser.id,
      personnelCode: matchedUser.personnelCode,
      phone: cleanPhone,
      otpHash,
      salt,
      expiresAt: Date.now() + 3 * 60 * 1000,
      attempts: 0,
    });

    return res.json({
      success: true,
      message: `کد تأیید ۶ رقمی به شماره همراه ${cleanPhone} ارسال شد.`,
    });
  });

  // 2f-3. Real SMS OTP Password Recovery (Step 2: Verify OTP & Set New Password)
  mutations.post('/api/auth/recovery-verify-otp', (req, res) => {
    const db = loadDb();
    const { personnelCode, phone, otpCode, newPassword, confirmPassword } = req.body || {};
    const cleanCode = normalizeDigitsServer(personnelCode).trim();
    const cleanPhone = normalizeDigitsServer(phone).trim();
    const cleanOtp = normalizeDigitsServer(otpCode).trim();

    if (!cleanCode || !cleanPhone || !cleanOtp || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: 'تکمیل تمامی فیلدهای کد تأیید و رمز عبور جدید الزامی است.' });
    }
    if (String(newPassword).length < 5) {
      return res.status(400).json({ error: 'رمز عبور جدید باید حداقل ۵ کاراکتر باشد.' });
    }
    if (String(newPassword) !== String(confirmPassword)) {
      return res.status(400).json({ error: 'رمز عبور جدید و تکرار آن یکسان نیستند.' });
    }

    const matchedUser = db.users.find(
      (u) =>
        normalizeDigitsServer(u.personnelCode).trim().toLowerCase() === cleanCode.toLowerCase() &&
        normalizeDigitsServer(u.phone).trim() === cleanPhone
    );
    if (!matchedUser) {
      return res.status(400).json({ error: 'کاربر معتبر یافت نشد.' });
    }

    const challenge = smsOtpChallengeMap.get(matchedUser.id);
    if (!challenge || challenge.expiresAt < Date.now()) {
      smsOtpChallengeMap.delete(matchedUser.id);
      return res.status(400).json({ error: 'کد تأیید پیامکی منقضی شده یا وجود ندارد. لطفاً مجدداً درخواست دهید.' });
    }

    challenge.attempts += 1;
    if (challenge.attempts > 5) {
      smsOtpChallengeMap.delete(matchedUser.id);
      return res.status(429).json({ error: 'تعداد تلاش‌های مجاز برای این کد به پایان رسید.' });
    }

    const candidateHash = hashPasswordWithSalt(cleanOtp, challenge.salt);
    if (candidateHash !== challenge.otpHash) {
      return res.status(400).json({ error: 'کد تأیید پیامکی وارد شده نادرست است.' });
    }

    smsOtpChallengeMap.delete(matchedUser.id);
    const creds = createPasswordCredentials(String(newPassword));
    matchedUser.passwordHash = creds.passwordHash;
    matchedUser.passwordSalt = creds.passwordSalt;
    matchedUser.mustChangePassword = false;
    delete matchedUser.password;

    for (const s of db.sessions || []) {
      if (s.userId === matchedUser.id && !s.revoked) {
        s.revoked = true;
        s.revokedReason = 'OTP_PASSWORD_RECOVERY';
      }
    }

    pushSecurityAuditLog(db, {
      actionType: 'OTP_RECOVERY_COMPLETED',
      actorId: matchedUser.id,
      actorName: matchedUser.name,
      targetUserId: matchedUser.id,
      targetUserName: matchedUser.name,
      description: `بازیابی و تغییر رمز عبور از طریق کد تأیید پیامکی (OTP) توسط «${matchedUser.name}»`,
    });

    saveDb(db);
    return res.json({
      success: true,
      message: 'رمز عبور شما با موفقیت تغییر یافت. اکنون می‌توانید وارد سامانه شوید.',
    });
  });

  // 2g. Save User Personal Preferences & 2FA Settings
  mutations.post('/api/auth/preferences', (req, res) => {
    const db = loadDb();
    const { user: sessionUser } = resolveSessionUser(req, db);
    const targetUserId = sessionUser?.id || req.body?.userId;
    if (!targetUserId) {
      return res.status(401).json({ error: 'کاربر معتبر نیست.' });
    }
    const targetUser = db.users.find((u) => u.id === targetUserId);
    if (!targetUser || targetUser.isActive === false) {
      return res.status(403).json({ error: 'حساب کاربری فعال یافت نشد.' });
    }

    const { preferences, twoFactorEnabled, twoFactorPin, currentPassword } = req.body;

    if (preferences && typeof preferences === 'object') {
      // Validate allowed defaultSection for role
      const allowedSections = new Set<string>(['REQUESTER', 'SETTINGS']);
      if (targetUser.role === 'ADMIN') {
        allowedSections.add('ADMIN_PANEL');
        allowedSections.add('APPROVER');
        allowedSections.add('ACCOUNTING');
        allowedSections.add('TREASURY');
      } else if (targetUser.role === 'APPROVER') {
        allowedSections.add('APPROVER');
      } else if (targetUser.role === 'ACCOUNTING') {
        allowedSections.add('ACCOUNTING');
      } else if (targetUser.role === 'TREASURY') {
        allowedSections.add('TREASURY');
      }

      const currentPrefs = targetUser.preferences || getDefaultPreferencesForRole(targetUser.role);
      const nextDefault =
        preferences.defaultSection && allowedSections.has(preferences.defaultSection)
          ? preferences.defaultSection
          : currentPrefs.defaultSection;

      const validPageSizes = [10, 20, 50, 100];
      const nextPageSize = validPageSizes.includes(Number(preferences.tablePageSize))
        ? Number(preferences.tablePageSize)
        : currentPrefs.tablePageSize || 20;

      targetUser.preferences = {
        defaultSection: nextDefault,
        tablePageSize: nextPageSize,
        notifyOnSubmit: preferences.notifyOnSubmit !== undefined ? Boolean(preferences.notifyOnSubmit) : currentPrefs.notifyOnSubmit,
        notifyOnRevision: preferences.notifyOnRevision !== undefined ? Boolean(preferences.notifyOnRevision) : currentPrefs.notifyOnRevision,
        notifyOnApproval: preferences.notifyOnApproval !== undefined ? Boolean(preferences.notifyOnApproval) : currentPrefs.notifyOnApproval,
        notifyOnPayment: preferences.notifyOnPayment !== undefined ? Boolean(preferences.notifyOnPayment) : currentPrefs.notifyOnPayment,
        desktopPushEnabled: preferences.desktopPushEnabled !== undefined ? Boolean(preferences.desktopPushEnabled) : currentPrefs.desktopPushEnabled,
      };
    }

    if (twoFactorEnabled !== undefined) {
      const wantEnable = Boolean(twoFactorEnabled);
      if (wantEnable !== Boolean(targetUser.twoFactorEnabled) || (wantEnable && twoFactorPin)) {
        if (!currentPassword || !verifyUserPassword(String(currentPassword), targetUser)) {
          return res.status(400).json({ error: 'برای تغییر وضعیت احراز هویت دومرحله‌ای، وارد کردن رمز عبور فعلی الزامی است.' });
        }
        if (wantEnable) {
          const pinStr = String(twoFactorPin || '').trim();
          if (!/^\d{6}$/.test(pinStr) && !targetUser.twoFactorPinHash) {
            return res.status(400).json({ error: 'کد پین امنیتی دومرحله‌ای باید دقیقاً ۶ رقم عددی باشد.' });
          }
          if (/^\d{6}$/.test(pinStr)) {
            targetUser.twoFactorPinHash = hashPasswordWithSalt(pinStr, targetUser.passwordSalt || '2fa-salt');
          }
          targetUser.twoFactorEnabled = true;
        } else {
          targetUser.twoFactorEnabled = false;
          delete targetUser.twoFactorPinHash;
        }

        pushSecurityAuditLog(db, {
          actionType: '2FA_CHANGED',
          actorId: targetUser.id,
          actorName: targetUser.name,
          targetUserId: targetUser.id,
          targetUserName: targetUser.name,
          description: `${targetUser.twoFactorEnabled ? 'فعال‌سازی' : 'غیرفعال‌سازی'} احراز هویت دومرحله‌ای توسط «${targetUser.name}»`,
        });
      }
    }

    saveDb(db);
    res.json({
      success: true,
      user: sanitizeUserForClient(targetUser, db),
      state: sanitizeDbForClient(db),
    });
  });

  // 3. User Management (Admin Only - Create & Edit User without exposing or overwriting passwords)
  mutations.post('/api/users/save', (req, res) => {
    const db = loadDb();
    const { user: sessionUser } = resolveSessionUser(req, db);
    const actorId = sessionUser?.id || req.body?.actorId || 'usr-admin';
    const actor = db.users.find((u) => u.id === actorId);

    if (!actor || actor.isActive === false) {
      return res.status(401).json({ error: 'کاربر اقدام‌کننده معتبر نیست.' });
    }
    const actorAuth = computeEffectiveUserAuth(actor, db);
    if (actor.role !== 'ADMIN' && !actorAuth.effectivePermissions.canManageUsers) {
      return res.status(403).json({ error: 'شما مجوز مدیریت کاربران را ندارید.' });
    }

    const {
      id,
      name,
      personnelCode,
      department,
      company,
      role,
      additionalRoles,
      password,
      phone,
      supervisorId,
      isActive,
      accessScope,
      financialApprovalLimit,
      paymentExecutionLimit,
      mustChangePassword,
      replacementSupervisorId,
    } = req.body;

    const cleanName = String(name || '').trim();
    const cleanPersonnelCode = String(personnelCode ?? '').trim(); // Preserve leading zeros!
    const cleanDepartment = String(department || '').trim();
    const cleanPhone = String(phone ?? '').trim(); // Preserve leading zero e.g. 0912...
    const cleanCompany = String(company || 'هلدینگ مرکزی آریا').trim();
    const targetRole: Role = role || 'REQUESTER';
    const configs = db.roleConfigs?.length ? db.roleConfigs : getDefaultRoleConfigs();
    const previousUser = id ? db.users.find(u => u.id === id) : undefined;
    const requestedRoles = additionalRoles === undefined ? previousUser?.additionalRoles || [] : additionalRoles;
    if (!configs.some(r => r.role === targetRole) || !Array.isArray(requestedRoles) || requestedRoles.some(r => typeof r !== 'string' || !configs.some(c => c.role === r))) {
      return res.status(400).json({ error: 'نقش اصلی یا نقش‌های تکمیلی معتبر نیستند.' });
    }
    if (requestedRoles.includes('ADMIN')) return res.status(400).json({ error: 'مدیر سامانه فقط به‌عنوان نقش اصلی قابل انتخاب است.' });
    const targetAdditionalRoles: Role[] = [...new Set<string>(requestedRoles)].filter(r => r !== targetRole);
    const canSupervise = (u: User) => {const a=computeEffectiveUserAuth(u, db);return u.isActive !== false && hasSupervisorPermissions(a.effectivePermissions,a.effectiveAccessScope,a.effectiveApprovalLimitRial);};

    if (!cleanName || !cleanPersonnelCode || !cleanDepartment) {
      return res.status(400).json({ error: 'نام و نام خانوادگی، کد پرسنلی (نام کاربری) و واحد سازمانی الزامی هستند.' });
    }

    // Check duplicate personnelCode
    const duplicateUser = db.users.find(
      (u) =>
        u.id !== id &&
        String(u.personnelCode || '').trim().toLowerCase() === cleanPersonnelCode.toLowerCase()
    );
    if (duplicateUser) {
      return res.status(400).json({
        error: `کد پرسنلی / نام کاربری «${cleanPersonnelCode}» تکراری است و قبلاً برای «${duplicateUser.name}» ثبت شده است.`,
      });
    }

    // Validate supervisor relationship (no self-supervision, no circular loop)
    const normalizedSupId = supervisorId ? String(supervisorId).trim() : null;
    if (id && normalizedSupId && wouldCreateSupervisorCycle(db.users, id, normalizedSupId)) {
      return res.status(400).json({
        error: 'انتخاب این سرپرست مجاز نیست؛ کاربر نمی‌تواند سرپرست مستقیم خودش باشد یا حلقه سرپرستی ایجاد کند.',
      });
    }

    const supUser = normalizedSupId ? db.users.find((u) => u.id === normalizedSupId) : null;
    if (normalizedSupId && (!supUser || supUser.isActive === false)) {
      return res.status(400).json({ error: 'سرپرست انتخاب‌شده معتبر یا فعال نیست.' });
    }
    if (supUser && (normalizedSupId !== previousUser?.supervisorId || cleanCompany !== previousUser?.company || cleanDepartment !== previousUser?.department)) {
      const supervisorAuth=computeEffectiveUserAuth(supUser,db),sp=supervisorAuth.effectivePermissions;
      if(!sp.canViewRequests||!sp.canAccessApproverCartable||!sp.canApprove)return res.status(400).json({error:'سرپرست باید مجوز مشاهده، کارتابل سرپرست و تأیید درخواست داشته باشد.'});
      if(!supervisorAuth.effectiveAccessScope||supervisorAuth.effectiveAccessScope==='SELF_ONLY')return res.status(400).json({error:'محدودهٔ دسترسی سرپرست نباید فقط درخواست‌های خود شخص باشد.'});
      if(!(supervisorAuth.effectiveApprovalLimitRial>0))return res.status(400).json({error:'سقف مجاز تأیید سرپرست باید بیشتر از صفر باشد.'});
      if(!companyPolicy(supUser,db).has(cleanCompany))return res.status(400).json({error:'شرکت کاربر در فهرست شرکت‌های مجاز نقش‌های سرپرست نیست؛ سرپرست مجاز دیگری انتخاب کنید یا دسترسی شرکت را آگاهانه تنظیم کنید.'});
      if(supervisorAuth.effectiveAccessScope==='DEPARTMENT'&&(supUser.department!==cleanDepartment||supUser.company!==cleanCompany))return res.status(400).json({error:'سرپرست با محدودهٔ واحد سازمانی باید به همان شرکت و واحد کاربر دسترسی داشته باشد.'});
    }
    const supervisorName = supUser ? supUser.name : null;

    if (id) {
      const existing = db.users.find((u) => u.id === id);
      if (!existing) {
        return res.status(404).json({ error: 'کاربر مورد نظر یافت نشد.' });
      }

      const nextActive = isActive !== undefined ? Boolean(isActive) : existing.isActive !== false;

      // Protect last active ADMIN from being deactivated or demoted
      if (existing.role === 'ADMIN' && (targetRole !== 'ADMIN' || !nextActive)) {
        const otherActiveAdmins = db.users.filter(
          (u) => u.id !== existing.id && u.role === 'ADMIN' && u.isActive !== false
        );
        if (otherActiveAdmins.length === 0) {
          return res.status(400).json({
            error: 'امکان غیرفعال‌سازی یا تغییر نقش آخرین مدیر فعال سامانه وجود ندارد.',
          });
        }
      }

      // Prevent admin from self-escalating their own role to a financial role or setting financial limits on themselves
      if (actor.id === existing.id) {
        if (targetRole !== existing.role || JSON.stringify([...targetAdditionalRoles].sort()) !== JSON.stringify(getUserRoles(existing).slice(1).sort())) {
          return res.status(403).json({
            error: 'طبق قواعد کنترل داخلی، تغییر نقش حساب کاربری خودتان مجاز نیست.',
          });
        }
        const normalizeOverride = (value: unknown) => value === undefined || value === null || value === '' ? null : Number(value);
        if ((accessScope && accessScope !== (existing.accessScope || actorAuth.effectiveAccessScope)) ||
            (financialApprovalLimit !== undefined && normalizeOverride(financialApprovalLimit) !== normalizeOverride(existing.financialApprovalLimit)) ||
            (paymentExecutionLimit !== undefined && normalizeOverride(paymentExecutionLimit) !== normalizeOverride(existing.paymentExecutionLimit))) {
          return res.status(403).json({error:'تغییر محدوده یا سقف اختیار حساب خودتان مجاز نیست.'});
        }
        if (!nextActive) {
          return res.status(400).json({
            error: 'امکان غیرفعال‌سازی حساب کاربری خودتان در حین نشست فعال وجود ندارد.',
          });
        }
      }

      // Check if an APPROVER with pending approvals is being deactivated or having role changed away from APPROVER
      if (!nextActive || (canSupervise(existing) && !canSupervise({...existing,role:targetRole,additionalRoles:targetAdditionalRoles,accessScope:accessScope || existing.accessScope,financialApprovalLimit:financialApprovalLimit === undefined ? existing.financialApprovalLimit : financialApprovalLimit === null || financialApprovalLimit === '' ? null : Number(financialApprovalLimit)}))) {
        const pendingCount = countPendingApprovalsForSupervisor(db, existing.id);
        if (pendingCount > 0 || db.users.some(u => u.supervisorId === existing.id)) {
          if (!replacementSupervisorId) {
            return res.status(409).json({
              error: `کاربر «${existing.name}» دارای ${pendingCount} ردیف درخواست منتظر تأیید در کارتابل است. لطفاً سرپرست جایگزین مجاز را برای انتقال کارهای منتظر انتخاب نمایید.`,
              requiresReplacementSupervisor: true,
              pendingCount,
            });
          }
          const replacement = db.users.find(
            (u) => u.id === replacementSupervisorId && canReceiveSupervisorWork(db,existing,u)
          );
          if (!replacement) {
            return res.status(400).json({ error: 'سرپرست جایگزین انتخاب‌شده باید یک تأییدکننده فعال و مستقل باشد.' });
          }
          const moved = reassignPendingApprovalsAndSubordinates(db, existing, replacement, actor.name);
          pushSecurityAuditLog(db, {
            actionType: 'PENDING_REASSIGNED',
            actorId: actor.id,
            actorName: actor.name,
            targetUserId: existing.id,
            targetUserName: existing.name,
            description: `انتقال ${moved} مورد کار منتظر تأیید و زیرمجموعه‌ها از «${existing.name}» به «${replacement.name}»`,
          });
        }
      }

      const prevRole = existing.role;
      const prevRoles = getUserRoles(existing);
      const prevSupId = existing.supervisorId || null;
      const prevApprovalLimit = existing.financialApprovalLimit ?? null;
      const prevPaymentLimit = existing.paymentExecutionLimit ?? null;
      const prevActive = existing.isActive !== false;
      const prevName = existing.name;

      existing.name = cleanName;
      existing.personnelCode = cleanPersonnelCode;
      existing.department = cleanDepartment;
      existing.company = cleanCompany;
      existing.role = targetRole;
      existing.additionalRoles = targetAdditionalRoles;
      existing.phone = cleanPhone;
      existing.supervisorId = normalizedSupId;
      existing.supervisorName = supervisorName;
      existing.isActive = nextActive;
      if (accessScope) existing.accessScope = accessScope;

      if (targetRole === 'ADMIN') {
        existing.financialApprovalLimit = 0;
        existing.paymentExecutionLimit = 0;
      } else {
        if (financialApprovalLimit !== undefined) {
          existing.financialApprovalLimit =
            financialApprovalLimit === null || financialApprovalLimit === '' ? null : Number(financialApprovalLimit);
        }
        if (paymentExecutionLimit !== undefined) {
          existing.paymentExecutionLimit =
            paymentExecutionLimit === null || paymentExecutionLimit === '' ? null : Number(paymentExecutionLimit);
        }
      }

      // Only update password if explicitly provided and non-empty
      if (password && String(password).trim().length > 0) {
        if (String(password).trim().length < 5) {
          return res.status(400).json({ error: 'رمز عبور جدید باید حداقل ۵ کاراکتر باشد.' });
        }
        const creds = createPasswordCredentials(String(password).trim());
        existing.passwordHash = creds.passwordHash;
        existing.passwordSalt = creds.passwordSalt;
        existing.mustChangePassword = mustChangePassword !== undefined ? Boolean(mustChangePassword) : true;
        delete existing.password;
      }

      // If deactivated, immediately revoke all active sessions of this user
      if (!nextActive && db.sessions) {
        for (const s of db.sessions) {
          if (s.userId === existing.id && !s.revoked) {
            s.revoked = true;
            s.revokedReason = 'USER_DEACTIVATED';
          }
        }
      }

      // If user's name changed, keep supervisorName in sync across subordinates and requests
      if (prevName !== cleanName) {
        for (const u of db.users) {
          if (u.supervisorId === existing.id) u.supervisorName = cleanName;
        }
        for (const a of db.advanceRequests) {
          if (a.requesterId === existing.id) a.requesterName = cleanName;
          if (a.supervisorId === existing.id) a.supervisorName = cleanName;
        }
        for (const p of db.paymentRequests) {
          if (p.requesterId === existing.id) p.requesterName = cleanName;
          if (p.supervisorId === existing.id) p.supervisorName = cleanName;
        }
        for (const b of db.batchPayments) {
          if (b.requesterId === existing.id) b.requesterName = cleanName;
          if (b.supervisorId === existing.id) b.supervisorName = cleanName;
        }
      }

      // Record granular security audit logs
      if (prevRole !== targetRole || JSON.stringify(prevRoles.slice(1).sort()) !== JSON.stringify([...targetAdditionalRoles].sort())) {
        pushSecurityAuditLog(db, {
          actionType: 'ROLE_CHANGED',
          actorId: actor.id,
          actorName: actor.name,
          targetUserId: existing.id,
          targetUserName: existing.name,
          description: `تغییر نقش‌های کاربر از ${prevRoles.join(', ')} به ${[targetRole,...targetAdditionalRoles].join(', ')}`,
        });
      }
      if (prevSupId !== normalizedSupId) {
        pushSecurityAuditLog(db, {
          actionType: 'SUPERVISOR_CHANGED',
          actorId: actor.id,
          actorName: actor.name,
          targetUserId: existing.id,
          targetUserName: existing.name,
          description: `تغییر سرپرست مستقیم «${existing.name}» به «${supervisorName || 'بدون سرپرست'}»`,
        });
      }
      if (prevApprovalLimit !== (existing.financialApprovalLimit ?? null) || prevPaymentLimit !== (existing.paymentExecutionLimit ?? null)) {
        pushSecurityAuditLog(db, {
          actionType: 'LIMIT_CHANGED',
          actorId: actor.id,
          actorName: actor.name,
          targetUserId: existing.id,
          targetUserName: existing.name,
          description: `بروزرسانی سقف مالی اختصاصی «${existing.name}» (سقف تأیید: ${
            existing.financialApprovalLimit ? existing.financialApprovalLimit.toLocaleString('fa-IR') + ' ریال' : 'پیش‌فرض نقش'
          })`,
        });
      }
      if (prevActive !== nextActive) {
        pushSecurityAuditLog(db, {
          actionType: nextActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
          actorId: actor.id,
          actorName: actor.name,
          targetUserId: existing.id,
          targetUserName: existing.name,
          description: `${nextActive ? 'فعال‌سازی مجدد' : 'غیرفعال‌سازی'} حساب کاربری «${existing.name}» (${existing.personnelCode})`,
        });
      }
      pushSecurityAuditLog(db, {
        actionType: 'USER_UPDATED',
        actorId: actor.id,
        actorName: actor.name,
        targetUserId: existing.id,
        targetUserName: existing.name,
        description: `ویرایش مشخصات کاربری «${existing.name}» (کد پرسنلی: ${existing.personnelCode}، واحد: ${existing.department})`,
      });
    } else {
      // Create new user: require initial password (no silent default '123')
      const rawInitialPass = String(password || '').trim();
      if (!rawInitialPass || rawInitialPass.length < 5) {
        return res.status(400).json({
          error: 'برای ایجاد کاربر جدید، تعیین رمز عبور اولیه معتبر (حداقل ۵ کاراکتر) الزامی است.',
        });
      }
      const creds = createPasswordCredentials(rawInitialPass);
      const newUser: User = {
        id: `usr-${Date.now()}`,
        name: cleanName,
        personnelCode: cleanPersonnelCode,
        department: cleanDepartment,
        company: cleanCompany,
        role: targetRole,
        additionalRoles: targetAdditionalRoles,
        passwordHash: creds.passwordHash,
        passwordSalt: creds.passwordSalt,
        phone: cleanPhone,
        supervisorId: normalizedSupId,
        supervisorName,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
        accessScope: accessScope || undefined,
        financialApprovalLimit:
          targetRole === 'ADMIN'
            ? 0
            : financialApprovalLimit !== undefined && financialApprovalLimit !== null && financialApprovalLimit !== ''
            ? Number(financialApprovalLimit)
            : null,
        paymentExecutionLimit:
          targetRole === 'ADMIN'
            ? 0
            : paymentExecutionLimit !== undefined && paymentExecutionLimit !== null && paymentExecutionLimit !== ''
            ? Number(paymentExecutionLimit)
            : null,
        mustChangePassword: mustChangePassword !== undefined ? Boolean(mustChangePassword) : true,
        preferences: getDefaultPreferencesForRole(targetRole),
      };
      db.users.push(newUser);

      pushSecurityAuditLog(db, {
        actionType: 'USER_CREATED',
        actorId: actor.id,
        actorName: actor.name,
        targetUserId: newUser.id,
        targetUserName: newUser.name,
        description: `ایجاد حساب کاربری جدید «${newUser.name}» با کد پرسنلی ${newUser.personnelCode} و نقش ${newUser.role}`,
      });
    }

    saveDb(db);
    res.json({ success: true, state: sanitizeDbForClient(db) });
  });

  // 3b. Controlled Temporary Password Reset by Admin
  mutations.post('/api/users/reset-password', async (req, res) => {
    const db = loadDb();
    const { user: sessionUser } = resolveSessionUser(req, db);
    const actorId = sessionUser?.id || req.body?.actorId || 'usr-admin';
    const actor = db.users.find((u) => u.id === actorId);

    if (!actor || actor.isActive === false) {
      return res.status(401).json({ error: 'کاربر مدیر معتبر نیست.' });
    }
    const actorAuth = computeEffectiveUserAuth(actor, db);
    if (actor.role !== 'ADMIN' && !actorAuth.effectivePermissions.canManagePasswordRecovery) {
      return res.status(403).json({ error: 'شما مجوز بازنشانی رمز عبور کاربران را ندارید.' });
    }

    const { targetUserId, tempPassword, mustChangePassword, recoveryRequestId } = req.body;
    const targetUser = db.users.find((u) => u.id === targetUserId);
    if (!targetUser) {
      return res.status(404).json({ error: 'کاربر مورد نظر یافت نشد.' });
    }

    if(recoveryRequestId&&!db.passwordRecoveryRequests?.some(r=>r.id===recoveryRequestId&&r.userId===targetUser.id))return res.status(400).json({error:'درخواست بازیابی به کاربر انتخاب‌شده تعلق ندارد؛ هیچ تغییری ثبت نشد.'});

    const cleanTemp = String(tempPassword || '').trim();
    if (cleanTemp.length < 5) {
      return res.status(400).json({ error: 'رمز عبور موقت باید حداقل ۵ کاراکتر باشد.' });
    }

    const creds = createPasswordCredentials(cleanTemp);
    targetUser.passwordHash = creds.passwordHash;
    targetUser.passwordSalt = creds.passwordSalt;
    targetUser.mustChangePassword = mustChangePassword !== undefined ? Boolean(mustChangePassword) : true;
    delete targetUser.password;

    // Revoke all existing sessions of target user
    for (const s of db.sessions || []) {
      if (s.userId === targetUser.id && !s.revoked) {
        s.revoked = true;
        s.revokedReason = 'ADMIN_PASSWORD_RESET';
      }
    }

    // Clear any login lockout on this user
    loginAttemptMap.delete(String(targetUser.personnelCode || '').trim().toLowerCase());

    if (recoveryRequestId && db.passwordRecoveryRequests) {
      const rec = db.passwordRecoveryRequests.find((r) => r.id === recoveryRequestId);
      if (rec) {
        rec.status = 'Resolved';
        rec.resolvedAt = `${getTodayJalali()} - ${new Date().toTimeString().slice(0, 5)}`;
        rec.resolvedBy = actor.name;
      }
    } else if (db.passwordRecoveryRequests) {
      for (const rec of db.passwordRecoveryRequests) {
        if (rec.userId === targetUser.id && rec.status === 'Pending') {
          rec.status = 'Resolved';
          rec.resolvedAt = `${getTodayJalali()} - ${new Date().toTimeString().slice(0, 5)}`;
          rec.resolvedBy = actor.name;
        }
      }
    }

    pushSecurityAuditLog(db, {
      actionType: 'PASSWORD_RESET',
      actorId: actor.id,
      actorName: actor.name,
      targetUserId: targetUser.id,
      targetUserName: targetUser.name,
      description: `بازنشانی رمز عبور «${targetUser.name}» (${targetUser.personnelCode}) با رمز موقت یک‌بارمصرف (الزام تغییر در اولین ورود: ${
        targetUser.mustChangePassword ? 'بله' : 'خیر'
      })`,
    });

    let smsDispatched = false;
    let smsError: string | undefined;
    if (db.smsConfig?.enabled && db.smsConfig?.events?.sendOnPasswordReset && targetUser.phone) {
      const smsRes = await dispatchRealSms(db, {
        eventType: 'PASSWORD_RESET',
        recipientName: targetUser.name,
        recipientPhone: targetUser.phone,
        message: `پرتال مالی شاهراه - رمز عبور موقت حساب کاربری شما (${targetUser.personnelCode}) توسط مدیر سیستم صادر شد: ${cleanTemp}`,
      });
      smsDispatched = smsRes.ok;
      smsError = smsRes.error;
    }

    saveDb(db);
    res.json({ success: true, smsDispatched, smsError, state: sanitizeDbForClient(db) });
  });

  // 3c. Activate / Deactivate User Account with Safe Reassignment of Pending Work
  mutations.post('/api/users/toggle-status', (req, res) => {
    const db = loadDb();
    const { user: sessionUser } = resolveSessionUser(req, db);
    const actorId = sessionUser?.id || req.body?.actorId || 'usr-admin';
    const actor = db.users.find((u) => u.id === actorId);

    if (!actor || actor.isActive === false) {
      return res.status(401).json({ error: 'کاربر مدیر معتبر نیست.' });
    }
    const actorAuth = computeEffectiveUserAuth(actor, db);
    if (actor.role !== 'ADMIN' && !actorAuth.effectivePermissions.canManageUsers) {
      return res.status(403).json({ error: 'شما مجوز تغییر وضعیت حساب کاربران را ندارید.' });
    }

    const { targetUserId, isActive, replacementSupervisorId } = req.body;
    const targetUser = db.users.find((u) => u.id === targetUserId);
    if (!targetUser) {
      return res.status(404).json({ error: 'کاربر مورد نظر یافت نشد.' });
    }

    const nextActive = Boolean(isActive);
    if (!nextActive && actor.id === targetUser.id) {
      return res.status(400).json({ error: 'امکان غیرفعال‌سازی حساب کاربری خودتان وجود ندارد.' });
    }

    if (!nextActive && targetUser.role === 'ADMIN') {
      const otherActiveAdmins = db.users.filter(
        (u) => u.id !== targetUser.id && u.role === 'ADMIN' && u.isActive !== false
      );
      if (otherActiveAdmins.length === 0) {
        return res.status(400).json({ error: 'امکان غیرفعال‌سازی آخرین مدیر فعال سامانه وجود ندارد.' });
      }
    }

    if (!nextActive) {
      const pendingCount = countPendingApprovalsForSupervisor(db, targetUser.id);
      if (pendingCount > 0 || db.users.some(u => u.supervisorId === targetUser.id)) {
        if (!replacementSupervisorId) {
          return res.status(409).json({
            error: `کاربر «${targetUser.name}» دارای ${pendingCount} ردیف درخواست منتظر تأیید است. لطفاً سرپرست جایگزین را مشخص کنید.`,
            requiresReplacementSupervisor: true,
            pendingCount,
          });
        }
        const replacement = db.users.find(
          (u) => u.id === replacementSupervisorId && canReceiveSupervisorWork(db,targetUser,u)
        );
        if (!replacement) {
          return res.status(400).json({ error: 'سرپرست جایگزین معتبر نیست.' });
        }
        const moved = reassignPendingApprovalsAndSubordinates(db, targetUser, replacement, actor.name);
        pushSecurityAuditLog(db, {
          actionType: 'PENDING_REASSIGNED',
          actorId: actor.id,
          actorName: actor.name,
          targetUserId: targetUser.id,
          targetUserName: targetUser.name,
          description: `انتقال ${moved} مورد کار منتظر از «${targetUser.name}» به «${replacement.name}» پیش از غیرفعال‌سازی حساب`,
        });
      }
    }

    targetUser.isActive = nextActive;
    if (!nextActive && db.sessions) {
      for (const s of db.sessions) {
        if (s.userId === targetUser.id && !s.revoked) {
          s.revoked = true;
          s.revokedReason = 'USER_DEACTIVATED';
        }
      }
    }

    pushSecurityAuditLog(db, {
      actionType: nextActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
      actorId: actor.id,
      actorName: actor.name,
      targetUserId: targetUser.id,
      targetUserName: targetUser.name,
      description: `${nextActive ? 'فعال‌سازی' : 'غیرفعال‌سازی'} حساب کاربری «${targetUser.name}» (${targetUser.personnelCode})`,
    });

    saveDb(db);
    res.json({ success: true, state: sanitizeDbForClient(db) });
  });

  // 3d. Save or Create Role Definition Config (Role Permissions, Custom Roles & Financial Limits)
  mutations.post('/api/roles/save', (req, res) => {
    const db = loadDb();
    const { user: sessionUser } = resolveSessionUser(req, db);
    const actorId = sessionUser?.id || req.body?.actorId || 'usr-admin';
    const actor = db.users.find((u) => u.id === actorId);

    if (!actor || actor.isActive === false) {
      return res.status(401).json({ error: 'کاربر مدیر معتبر نیست.' });
    }
    const actorAuth = computeEffectiveUserAuth(actor, db);
    if (
      actor.role !== 'ADMIN' &&
      !actorAuth.effectivePermissions.canManageUsers &&
      !actorAuth.effectivePermissions.canManageRoles
    ) {
      return res.status(403).json({ error: 'شما مجوز ویرایش تنظیمات نقش‌ها را ندارید.' });
    }

    const {
      role,
      title,
      description,
      baseTemplateRole,
      defaultLandingSection,
      accessScope,
      allowedCompanies,
      approvalLimitRial,
      paymentLimitRial,
      permissions,
    } = req.body;

    if (!db.roleConfigs || db.roleConfigs.length === 0) {
      db.roleConfigs = getDefaultRoleConfigs();
    }

    const cleanRoleKey = String(role || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_]/g, '_');

    if (!cleanRoleKey) {
      return res.status(400).json({ error: 'شناسه نقش نامعتبر است.' });
    }

    let targetCfg = db.roleConfigs.find((r) => r.role === cleanRoleKey);
    const previousRoleCompanies=[...(targetCfg?.allowedCompanies||[])];
    if(allowedCompanies!==undefined){
      const error=roleCompaniesError(allowedCompanies,previousRoleCompanies,db.companies||[]);
      if(error)return res.status(400).json({error});
      if(req.body.expectedAllowedCompanies!==undefined){
        const expected=req.body.expectedAllowedCompanies;
        if(!Array.isArray(expected)||expected.some((v:unknown)=>typeof v!=='string'))return res.status(400).json({error:'نسخهٔ قبلی شرکت‌های مجاز معتبر نیست.'});
        if(JSON.stringify(expected)!==JSON.stringify(previousRoleCompanies))return res.status(409).json({error:'شرکت‌های مجاز این نقش هم‌زمان تغییر کرده است؛ صفحه را تازه و انتخاب را دوباره بررسی کنید.'});
      }
    }
    if(permissions!==undefined){const error=permissionPatchError(permissions,targetCfg?.permissions);if(error)return res.status(400).json({error});}
    const isBuiltIn = ['REQUESTER', 'APPROVER', 'ACCOUNTING', 'TREASURY', 'ADMIN'].includes(cleanRoleKey);
    const isCreatingNew = !targetCfg;

    if (!targetCfg) {
      const cleanTitle = String(title || '').trim();
      if (!cleanTitle) {
        return res.status(400).json({ error: 'عنوان فارسی نقش جدید الزامی است.' });
      }
      if (db.roleConfigs.some((r) => r.title.trim() === cleanTitle)) {
        return res.status(400).json({ error: 'نقشی با این عنوان قبلاً در سامانه ثبت شده است.' });
      }
      const template: BuiltInRole = ['REQUESTER', 'APPROVER', 'ACCOUNTING', 'TREASURY', 'ADMIN'].includes(
        String(baseTemplateRole || '').toUpperCase()
      )
        ? (String(baseTemplateRole).toUpperCase() as BuiltInRole)
        : 'REQUESTER';

      targetCfg = {
        role: cleanRoleKey,
        title: cleanTitle,
        description: String(description || 'نقش سازمانی سفارشی تعریف‌شده در سامانه').trim(),
        isCustom: !isBuiltIn,
        baseTemplateRole: template,
        defaultLandingSection: defaultLandingSection || 'REQUESTER',
        accessScope: accessScope || 'SELF_ONLY',
        allowedCompanies:
          Array.isArray(allowedCompanies)
            ? allowedCompanies
            : [],
        approvalLimitRial: Math.max(0, Number(approvalLimitRial) || 0),
        paymentLimitRial: Math.max(0, Number(paymentLimitRial) || 0),
        permissions: normalizeRolePermissionSet(permissions, cleanRoleKey, template),
        updatedAt: `${getTodayJalali()} - ${new Date().toTimeString().slice(0, 5)}`,
        updatedBy: actor.name,
      };
      db.roleConfigs.push(targetCfg);
    } else {
      if (title && String(title).trim()) {
        targetCfg.title = String(title).trim();
      }
      if (description !== undefined && String(description).trim()) {
        targetCfg.description = String(description).trim();
      }
      if (defaultLandingSection) {
        targetCfg.defaultLandingSection = defaultLandingSection;
      }
      if (accessScope) targetCfg.accessScope = accessScope;
      if (Array.isArray(allowedCompanies)) {
        targetCfg.allowedCompanies = allowedCompanies;
      }

      if (approvalLimitRial !== undefined) {
        targetCfg.approvalLimitRial = Math.max(0, Number(approvalLimitRial) || 0);
      }
      if (paymentLimitRial !== undefined) {
        targetCfg.paymentLimitRial = Math.max(0, Number(paymentLimitRial) || 0);
      }
      if (permissions && typeof permissions === 'object') {
        targetCfg.permissions = normalizeRolePermissionSet(
          {...normalizeRolePermissionSet(targetCfg.permissions,targetCfg.role,targetCfg.baseTemplateRole),...permissions},
          targetCfg.role,
          targetCfg.baseTemplateRole
        );
      }
      if (cleanRoleKey === 'ADMIN') {
        targetCfg.permissions.canManageUsers = true;
        targetCfg.permissions.canManageRoles = true;
      }

      targetCfg.updatedAt = `${getTodayJalali()} - ${new Date().toTimeString().slice(0, 5)}`;
      targetCfg.updatedBy = actor.name;
    }

    pushSecurityAuditLog(db, {
      actionType: 'ROLE_CONFIG_UPDATED',
      actorId: actor.id,
      actorName: actor.name,
      targetUserId: null,
      targetUserName: targetCfg.title,
      description: isCreatingNew
        ? `ایجاد نقش سازمانی جدید «${targetCfg.title}» (${targetCfg.role}) با محدوده ${targetCfg.accessScope}`
        : `بروزرسانی دسترسی‌ها و حدود اختیار نقش «${targetCfg.title}» (محدوده: ${targetCfg.accessScope}، سقف تأیید: ${targetCfg.approvalLimitRial.toLocaleString('fa-IR')} ریال، سقف پرداخت: ${targetCfg.paymentLimitRial.toLocaleString('fa-IR')} ریال)`+(allowedCompanies!==undefined&&JSON.stringify(previousRoleCompanies)!==JSON.stringify(targetCfg.allowedCompanies)?`؛ تغییر شرکت‌های مجاز: ${previousRoleCompanies.length} به ${targetCfg.allowedCompanies.length}`:''),
    });

    saveDb(db);
    res.json({ success: true, roleConfig: targetCfg, state: sanitizeDbForClient(db) });
  });

  // 3e. Delete Custom Role (if not assigned to any user)
  mutations.post('/api/roles/delete', (req, res) => {
    const db = loadDb();
    const { user: sessionUser } = resolveSessionUser(req, db);
    const actorId = sessionUser?.id || req.body?.actorId || 'usr-admin';
    const actor = db.users.find((u) => u.id === actorId);

    if (!actor || actor.isActive === false) {
      return res.status(401).json({ error: 'کاربر مدیر معتبر نیست.' });
    }
    const actorAuth = computeEffectiveUserAuth(actor, db);
    if (
      actor.role !== 'ADMIN' &&
      !actorAuth.effectivePermissions.canManageUsers &&
      !actorAuth.effectivePermissions.canManageRoles
    ) {
      return res.status(403).json({ error: 'شما مجوز حذف نقش را ندارید.' });
    }

    const { role } = req.body;
    const builtInRoles = ['REQUESTER', 'APPROVER', 'ACCOUNTING', 'TREASURY', 'ADMIN'];
    if (builtInRoles.includes(String(role))) {
      return res.status(400).json({ error: 'نقش‌های پایه و استاندارد سیستم قابل حذف نیستند؛ می‌توانید تنظیمات آن‌ها را بازنشانی کنید.' });
    }

    const assignedUsers = (db.users || []).filter((u) => getUserRoles(u).includes(role));
    if (assignedUsers.length > 0) {
      return res.status(409).json({
        error: `این نقش به ${assignedUsers.length} کاربر اختصاص داده شده است. ابتدا نقش آن کاربران را تغییر دهید.`,
      });
    }

    if (!db.roleConfigs || db.roleConfigs.length === 0) {
      db.roleConfigs = getDefaultRoleConfigs();
    }

    const targetCfg = db.roleConfigs.find((r) => r.role === role);
    if (!targetCfg) {
      return res.status(404).json({ error: 'نقش مورد نظر یافت نشد.' });
    }

    db.roleConfigs = db.roleConfigs.filter((r) => r.role !== role);
    pushSecurityAuditLog(db, {
      actionType: 'ROLE_CONFIG_UPDATED',
      actorId: actor.id,
      actorName: actor.name,
      targetUserId: null,
      targetUserName: targetCfg.title,
      description: `حذف نقش سفارشی «${targetCfg.title}» (${targetCfg.role})`,
    });

    saveDb(db);
    res.json({ success: true, state: sanitizeDbForClient(db) });
  });

  // 3f. Reset Role(s) to Default Standard Presets
  mutations.post('/api/roles/reset-defaults', (req, res) => {
    const db = loadDb();
    const { user: sessionUser } = resolveSessionUser(req, db);
    const actorId = sessionUser?.id || req.body?.actorId || 'usr-admin';
    const actor = db.users.find((u) => u.id === actorId);

    if (!actor || actor.isActive === false) {
      return res.status(401).json({ error: 'کاربر مدیر معتبر نیست.' });
    }
    const actorAuth = computeEffectiveUserAuth(actor, db);
    if (
      actor.role !== 'ADMIN' &&
      !actorAuth.effectivePermissions.canManageUsers &&
      !actorAuth.effectivePermissions.canManageRoles
    ) {
      return res.status(403).json({ error: 'شما مجوز بازنشانی تنظیمات پیش‌فرض نقش‌ها را ندارید.' });
    }

    const { role } = req.body; // optional: if omitted, resets all built-in roles
    const defaults = getDefaultRoleConfigs();
    const nowStamp = `${getTodayJalali()} - ${new Date().toTimeString().slice(0, 5)}`;

    if (!db.roleConfigs || db.roleConfigs.length === 0) {
      db.roleConfigs = getDefaultRoleConfigs();
    }

    if (role) {
      const idx = db.roleConfigs.findIndex((r) => r.role === role);
      if (idx === -1) {
        return res.status(404).json({ error: 'نقش مورد نظر یافت نشد.' });
      }
      const existing = db.roleConfigs[idx];
      const defaultMatch = defaults.find((d) => d.role === role);
      if (defaultMatch) {
        db.roleConfigs[idx] = {
          ...defaultMatch,
          updatedAt: nowStamp,
          updatedBy: actor.name,
        };
      } else {
        const tmpl = existing.baseTemplateRole || 'REQUESTER';
        const tmplDefault = defaults.find((d) => d.role === tmpl) || defaults[0];
        db.roleConfigs[idx] = {
          ...existing,
          accessScope: tmplDefault.accessScope,
          approvalLimitRial: tmplDefault.approvalLimitRial,
          paymentLimitRial: tmplDefault.paymentLimitRial,
          defaultLandingSection: tmplDefault.defaultLandingSection,
          permissions: getDefaultPermissionsForRole(existing.role, tmpl),
          updatedAt: nowStamp,
          updatedBy: actor.name,
        };
      }
      pushSecurityAuditLog(db, {
        actionType: 'ROLE_CONFIG_UPDATED',
        actorId: actor.id,
        actorName: actor.name,
        targetUserId: null,
        targetUserName: db.roleConfigs[idx].title,
        description: `بازنشانی دسترسی‌ها و حدود اختیار نقش «${db.roleConfigs[idx].title}» به تنظیمات پیش‌فرض استاندارد`,
      });
    } else {
      const customRoles = db.roleConfigs.filter(
        (r) => !['REQUESTER', 'APPROVER', 'ACCOUNTING', 'TREASURY', 'ADMIN'].includes(r.role)
      );
      db.roleConfigs = [
        ...defaults.map((d) => ({ ...d, updatedAt: nowStamp, updatedBy: actor.name })),
        ...customRoles.map((c) => ({
          ...c,
          permissions: getDefaultPermissionsForRole(c.role, c.baseTemplateRole || 'REQUESTER'),
          updatedAt: nowStamp,
          updatedBy: actor.name,
        })),
      ];
      pushSecurityAuditLog(db, {
        actionType: 'ROLE_CONFIG_UPDATED',
        actorId: actor.id,
        actorName: actor.name,
        targetUserId: null,
        targetUserName: 'کلیه نقش‌های سامانه',
        description: 'بازنشانی کلیه نقش‌های سازمانی به تنظیمات پیش‌فرض استاندارد سامانه',
      });
    }

    saveDb(db);
    res.json({ success: true, state: sanitizeDbForClient(db) });
  });

  mutations.delete('/api/users/:id', (req, res) => {
    const db = loadDb();
    const { id } = req.params;
    const target = db.users.find((u) => u.id === id);
    if (!target) {
      return res.status(404).json({ error: 'کاربر یافت نشد.' });
    }
    if (target.role === 'ADMIN') {
      const otherActiveAdmins = db.users.filter((u) => u.id !== id && u.role === 'ADMIN' && u.isActive !== false);
      if (otherActiveAdmins.length === 0) {
        return res.status(400).json({ error: 'امکان حذف آخرین مدیر فعال سامانه وجود ندارد.' });
      }
    }
    // Check if user has any financial/request history; if so, prevent destructive delete and advise deactivation
    const hasHistory =
      db.advanceRequests.some((a) => a.requesterId === id || a.supervisorId === id || a.accountingId === id || a.treasuryId === id) ||
      db.paymentRequests.some((p) => p.requesterId === id || p.supervisorId === id || p.accountingId === id || p.treasuryId === id) ||
      db.batchPayments.some((b) => b.requesterId === id || b.supervisorId === id);

    if (hasHistory) {
      return res.status(400).json({
        error: 'این کاربر دارای سابقه درخواست یا عملیات مالی در سامانه است. برای حفظ تمامیت سوابق، به‌جای حذف، حساب کاربر را غیرفعال کنید.',
      });
    }

    db.users = db.users.filter((u) => u.id !== id);
    saveDb(db);
    res.json({ success: true, state: sanitizeDbForClient(db) });
  });

  // 4. Reset database to demo state
  mutations.post('/api/reset', (_req, res) => {
    const initial = getInitialSeedState();
    saveDb(initial);
    const reloaded = loadDb();
    res.json(sanitizeDbForClient(reloaded));
  });

  function syncBatchStatus(batch: BatchPaymentRequest) {
    if (!batch.items || batch.items.length === 0) return;
    if(batch.items.some(it=>['Rejected','Closed'].includes(it.status||''))){
      batch.status=batch.items.every(it=>it.status==='Rejected')?'Rejected':batch.items.every(it=>it.status==='Closed')?'Closed':'Mixed';
      batch.totalAmount=batch.items.reduce((sum,it)=>sum+(it.approvedAmount??it.amount),0);batch.itemCount=batch.items.length;return;
    }
    const allPaid = batch.items.every((it) => it.status === 'Paid');
    const allInPaymentOrPaid =
      batch.items.every((it) => it.status === 'In_Payment' || it.status === 'Paid') &&
      batch.items.some((it) => it.status === 'In_Payment');
    const allTreasury = batch.items.every(
      (it) =>
        it.status === 'Pending_Treasury' ||
        it.status === 'In_Payment' ||
        it.status === 'Paid'
    );
    const allAccounting = batch.items.every(
      (it) =>
        it.status === 'Pending_Accounting' ||
        it.status === 'Pending_Treasury' ||
        it.status === 'In_Payment' ||
        it.status === 'Paid'
    );
    const anyNeedsRevision = batch.items.some((it) => it.status === 'Needs_Revision');

    if (allPaid) {
      batch.status = 'Paid';
    } else if (allInPaymentOrPaid) {
      batch.status = 'In_Payment';
    } else if (allTreasury) {
      batch.status = 'Pending_Treasury';
    } else if (allAccounting) {
      batch.status = 'Pending_Accounting';
    } else if (anyNeedsRevision) {
      batch.status = 'Needs_Revision';
    } else {
      batch.status = 'Pending_Approver';
    }
    batch.totalAmount = batch.items.reduce((sum, it) => sum + (it.approvedAmount ?? it.amount), 0);
    batch.itemCount = batch.items.length;
  }

  // 5. Submit Advance Request (Single)
  mutations.post('/api/advance-requests', (req, res) => {
    const dateError=normalizeFormDates(req.body,['suggestedDate'],true);if(dateError)return res.status(400).json({error:dateError});
    const db: TreasuryDatabaseState = res.locals.commandDb;
    const { requesterId, requestedMonth, amount, suggestedDate, reason, attachments } = req.body;

    const user = db.users.find((u) => u.id === requesterId) || db.users[0];
    const supUser = user.supervisorId ? db.users.find((u) => u.id === user.supervisorId) : null;
    const initialStatus: RequestStatus = user.supervisorId ? 'Pending_Approver' : 'Pending_Accounting';

    const nextNum = 101 + db.advanceRequests.length;
    const numAmount = Number(amount) || 0;
    const registrationAt = new Date();
    const newReq: AdvanceRequest = {
      createdAtIso: registrationAt.toISOString(),
      id: `adv-${Date.now()}`,
      trackingCode: `ADV-${getTodayJalali().slice(0,4)}-${nextNum}`,
      requestedMonth: requestedMonth || currentJalaliMonth(),
      amount: numAmount,
      initialAmount: numAmount,
      suggestedDate: suggestedDate || getTodayJalali(),
      reason: reason || '',
      hasPreviousAdvance: null,
      approvedAmount: null,
      accountingNote: null,
      approverNote: null,
      rejectionReason: null,
      returnedReason: null,
      status: initialStatus,
      version: 1,
      comments: [],
      auditHistory: [
        {
          id: `aud-${Date.now()}`,
          action: 'ثبت اولیه درخواست مساعده',
          changedBy: user.name,
          changedAt: `${getTodayJalali()} - ${new Date().toTimeString().slice(0, 5)}`,
          newAmount: numAmount,
        },
      ],
      attachments: attachments || [],
      requesterId: user.id,
      ...requestCompanySnapshot(user,db),
      requesterName: user.name,
      requesterPersonnelCode: user.personnelCode,
      department: user.department,
      supervisorId: user.supervisorId || null,
      supervisorName: supUser?.name || user.supervisorName || null,
      accountingId: null,
      accountingName: null,
      treasuryId: null,
      treasuryName: null,
      paidBankName: null,
      paidAt: null,
      paidDateJalali: null,
      dailyCoverId: null,
      createdAt: getTodayJalali(registrationAt),
    };

    db.advanceRequests.unshift(newReq);
    pushAppNotification(db, {
      eventType: 'REQUEST_SUBMITTED',
      title: `ثبت درخواست مساعده (${newReq.trackingCode})`,
      body: `درخواست مساعده ${newReq.requesterName} به مبلغ ${numAmount.toLocaleString('fa-IR')} ریال جهت بررسی ${newReq.supervisorId ? 'سرپرست' : 'حسابداری'} ثبت شد.`,
      trackingCode: newReq.trackingCode,
      requestId: newReq.id,
      itemType: 'ADVANCE',
      recipientUserId: newReq.supervisorId || null,
      recipientRole: newReq.supervisorId ? 'APPROVER' : 'ACCOUNTING',
      actorName: user.name,
      targetSection: newReq.supervisorId ? 'APPROVER' : 'ACCOUNTING',
    });
    const committedState=saveDb(db);
    res.json({ success: true, item: newReq, state: committedState });
  });

  // 6. Submit Payment Request (Single)
  const submitSinglePayment = (req:express.Request,res:express.Response,external=false) => {
    if(external){const error=externalInputError(req.body,false);if(error)return res.status(400).json({error});}
    const dateError=normalizeFormDates(req.body,['dueDate'],!external);if(dateError)return res.status(400).json({error:dateError});
    const bankError=bankFieldsError(req.body,true);if(bankError)return res.status(400).json({error:bankError});
    req.body=normalizedBankFields(req.body);
    const db: TreasuryDatabaseState = res.locals.commandDb;
    const maker=res.locals.viewer as User,operation=external?entryOperation(req.body,false,maker):undefined;
    if(operation){const previous=previousEntry(db,operation,false,maker);if(previous.error)return res.status(previous.status!).json({error:previous.error});if(previous.row){if(!canSeeRequest(previous.row as PaymentRequest,maker,db,computeEffectiveUserAuth(maker,db)))return res.status(403).json({error:'دسترسی به نتیجه این ثبت مجاز نیست.'});return res.json({success:true,item:previous.row,state:db});}}
    if(external){const error=normalizeFormDates(req.body,['dueDate'],true);if(error)return res.status(400).json({error});}
    const requiredText=(value:unknown)=>typeof value==='string'&&Boolean(value.trim());
    if(!requiredText(req.body.description))return res.status(400).json({error:'شرح و بابت پرداخت را وارد کنید.'});
    if(!requiredText(req.body.payeeName))return res.status(400).json({error:'نام گیرنده (صاحب حساب) را وارد کنید.'});
    if(req.body.amount===undefined)return res.status(400).json({error:'مبلغ پرداخت را وارد کنید.'});
    const policy=companyPolicy(res.locals.viewer as User,db);
    if(!requiredText(req.body.costCenter)||!(db.costCenters||[]).some(cc=>cc.name===req.body.costCenter&&cc.isActive!==false&&policy.entity(cc)))return res.status(400).json({error:'مرکز هزینه فعال و مجاز را از فهرست انتخاب کنید.'});
    const {
      requesterId,
      dueDate,
      priority,
      costCenter,
      description,
      amount,
      payeeName,
      accountOrCard,
      iban,
      bankName,
      invoiceNumber,
      attachments,
    } = req.body;

    const user = external?maker:db.users.find((u) => u.id === requesterId) || db.users[0];
    const supervisorId=external?null:user.supervisorId;
    const supUser = supervisorId ? db.users.find((u) => u.id === supervisorId) : null;

    const nextNum = 201 + db.paymentRequests.length;
    const numAmount = Number(amount) || 0;
    const registrationAt = new Date();
    const newPay: PaymentRequest = {
      ...(operation?{entryOperation:operation,externalOrder:{orderedBy:req.body.orderedBy.trim(),origin:'PHONE_OR_WRITTEN' as const}}:{}),
      createdAtIso: registrationAt.toISOString(),
      id: `pay-${Date.now()}`,
      trackingCode: `PAY-${getTodayJalali().slice(0,4)}-${nextNum}`,
      dueDate: dueDate || getTodayJalali(),
      priority: priority === 'Urgent' ? 'Urgent' : 'Normal',
      costCenter,
      description: description.trim(),
      amount: numAmount,
      initialAmount: numAmount,
      payeeName: payeeName.trim(),
      accountOrCard: accountOrCard || '',
      iban: iban || '',
      bankName: bankName || '',
      invoiceNumber: invoiceNumber || `INV-${nextNum}`,
      batchId: null,
      batchTitle: null,
      accountingNote: null,
      approverNote: null,
      rejectionReason: null,
      returnedReason: null,
      status: supervisorId ? 'Pending_Approver' : 'Pending_Accounting',
      version: 1,
      comments: [],
      auditHistory: [
        {
          id: `aud-${Date.now()}`,
          action: external?'ثبت دستور خارج سامانه برای تأیید حسابداری':'ثبت اولیه دستور پرداخت تکی',
          changedBy: user.name,
          changedAt: `${getTodayJalali()} - ${new Date().toTimeString().slice(0, 5)}`,
          newAmount: numAmount,
        },
      ],
      attachments: attachments || [],
      requesterId: user.id,
      ...requestCompanySnapshot(user,db),
      requesterName: user.name,
      requesterPersonnelCode: user.personnelCode,
      department: user.department,
      supervisorId: supervisorId || null,
      supervisorName: external?null:supUser?.name || user.supervisorName || null,
      accountingId: null,
      accountingName: null,
      treasuryId: null,
      treasuryName: null,
      paidBankName: null,
      paidAt: null,
      paidDateJalali: null,
      dailyCoverId: null,
      createdAt: getTodayJalali(registrationAt),
    };

    db.paymentRequests.unshift(newPay);
    pushAppNotification(db, {
      eventType: 'REQUEST_SUBMITTED',
      title: `ثبت دستور پرداخت تکی (${newPay.trackingCode})`,
      body: `دستور پرداخت در وجه «${newPay.payeeName}» به مبلغ ${numAmount.toLocaleString('fa-IR')} ریال توسط ${user.name} ثبت شد.`,
      trackingCode: newPay.trackingCode,
      requestId: newPay.id,
      itemType: 'PAYMENT',
      recipientUserId: newPay.supervisorId || null,
      recipientRole: newPay.supervisorId ? 'APPROVER' : 'ACCOUNTING',
      actorName: user.name,
      targetSection: newPay.supervisorId ? 'APPROVER' : 'ACCOUNTING',
    });
    const committedState=saveDb(db);
    res.json({ success: true, item: newPay, state: committedState });
  };
  mutations.post('/api/payment-requests',(req,res)=>submitSinglePayment(req,res));
  mutations.post('/api/treasury/external-order',(req,res)=>submitSinglePayment(req,res,true));

  // 7. Submit Batch / Aggregate Request (Payment or Advance)
  mutations.post('/api/batch-payments', (req, res) => {
    for(const [i,row] of (req.body.items||[]).entries()){const error=bankFieldsError(row,req.body.batchType!=='ADVANCE');if(error)return res.status(400).json({error:`ردیف ${i+1}: ${error}`});}
    req.body.items=(req.body.items||[]).map((row:any)=>normalizedBankFields(row));
    const db: TreasuryDatabaseState = res.locals.commandDb;
    const { requesterId, title, batchType = 'PAYMENT', items, attachments } = req.body;

    const user = db.users.find((u) => u.id === requesterId) || db.users[0];
    const supUser = user.supervisorId ? db.users.find((u) => u.id === user.supervisorId) : null;

    const nextBatchNum = 101 + db.batchPayments.length;
    const batchTrackingCode = `${batchType === 'ADVANCE' ? 'BAT-ADV' : 'BAT'}-1403-${nextBatchNum}`;
    const batchId = `bat-${Date.now()}`;

    const parsedItems = (items || []).map((it: any, index: number) => {
      const amt = Number(it.amount) || 0;
      return {
        id: `item-${Date.now()}-${index}`,
        itemType: (batchType as 'PAYMENT' | 'ADVANCE'),
        payeeName: it.payeeName || `گیرنده وجه ${index + 1}`,
        amount: amt,
        initialAmount: amt,
        approvedAmount: amt,
        accountOrCard: it.accountOrCard || '',
        iban: it.iban || '',
        bankName: it.bankName || '',
        description: it.description || title || 'پرداخت تجمیعی',
        invoiceNumber: it.invoiceNumber || `INV-B${nextBatchNum}-${index + 1}`,
        costCenter: it.costCenter || user.department,
        requestedMonth: it.requestedMonth || currentJalaliMonth(),
        status: (user.supervisorId ? 'Pending_Approver' : 'Pending_Accounting') as RequestStatus,
        version: 1,
        comments: [],
        auditHistory: [
          {
            id: `aud-${Date.now()}-${index}`,
            action: 'ثبت اولیه ردیف در گروه',
            changedBy: user.name,
            changedAt: `${getTodayJalali()} - ${new Date().toTimeString().slice(0, 5)}`,
            newAmount: amt,
          },
        ],
        attachments: it.attachments || [],
      };
    });

    const totalAmount = parsedItems.reduce((sum: number, it: any) => sum + it.amount, 0);

    const registrationAt = new Date();
    const newBatch: BatchPaymentRequest = {
      createdAtIso: registrationAt.toISOString(),
      id: batchId,
      trackingCode: batchTrackingCode,
      batchType: batchType as 'PAYMENT' | 'ADVANCE',
      title: title || `${batchType === 'ADVANCE' ? 'درخواست مساعده گروهی' : 'دستور پرداخت تجمیعی'} شماره ${nextBatchNum}`,
      totalAmount,
      itemCount: parsedItems.length,
      requesterId: user.id,
      ...requestCompanySnapshot(user,db),
      requesterName: user.name,
      requesterPersonnelCode: user.personnelCode,
      department: user.department,
      supervisorId: user.supervisorId || null,
      supervisorName: supUser?.name || user.supervisorName || null,
      approverNote: null,
      accountingNote: null,
      rejectionReason: null,
      returnedReason: null,
      status: user.supervisorId ? 'Pending_Approver' : 'Pending_Accounting',
      paidBankName: null,
      paidAt: null,
      paidDateJalali: null,
      createdAt: getTodayJalali(registrationAt),
      attachments: attachments || [],
      items: parsedItems,
    };

    db.batchPayments.unshift(newBatch);
    pushAppNotification(db, {
      eventType: 'REQUEST_SUBMITTED',
      title: `ثبت لیست گروهی جدید (${newBatch.trackingCode})`,
      body: `لیست «${newBatch.title}» شامل ${newBatch.itemCount} ردیف با جمع ${totalAmount.toLocaleString('fa-IR')} ریال توسط ${user.name} ثبت شد.`,
      trackingCode: newBatch.trackingCode,
      requestId: newBatch.id,
      itemType: 'BATCH',
      recipientUserId: newBatch.supervisorId || null,
      recipientRole: newBatch.supervisorId ? 'APPROVER' : 'ACCOUNTING',
      actorName: user.name,
      targetSection: newBatch.supervisorId ? 'APPROVER' : 'ACCOUNTING',
    });
    const committedState=saveDb(db);
    res.json({ success: true, batch: newBatch, state: committedState });
  });

  // Owner amendment uses the same serialized write turn as review; never advances workflow.
  mutations.post('/api/requests/edit-submitted',(req,res)=>{
    const db=loadDb();
    const {itemType,requestId,rowId,changes,requesterId}=req.body;
    if (!['ADVANCE','PAYMENT','BATCH_ITEM'].includes(itemType) || Object.keys(req.body).some(key=>!['requesterId','itemType','requestId','rowId','expectedVersion','changes'].includes(key))) return res.status(400).json({error:'فرمان ویرایش معتبر نیست.'});
    const batch=itemType==='BATCH_ITEM' ? db.batchPayments.find(b=>b.id===requestId) : undefined;
    const row=itemType==='BATCH_ITEM' ? batch?.items.find(item=>item.id===rowId) : itemType==='ADVANCE' ? db.advanceRequests.find(r=>r.id===requestId) : db.paymentRequests.find(r=>r.id===requestId);
    if (!row) return res.status(404).json({error:'درخواست یا ردیف یافت نشد.'});
    const error=validateSubmittedChanges(changes,itemType,row,itemType==='PAYMENT'||itemType==='BATCH_ITEM'&&batch?.batchType!=='ADVANCE');
    if(error)return res.status(400).json({error});
    applySubmittedChanges(row,changes,itemType,requesterId);
    if(batch)syncBatchStatus(batch);
    const committedState=saveDb(db);
    return res.json({success:true,item:row,state:committedState});
  });

  mutations.post('/api/requests/delete-submitted',(req,res)=>{
    const db=loadDb(),{itemType,requestId,rowId,requesterId}=req.body;
    const batch=itemType==='BATCH_ITEM'?db.batchPayments.find(b=>b.id===requestId):undefined;
    const row=batch?batch.items.find(r=>r.id===rowId):itemType==='ADVANCE'?db.advanceRequests.find(r=>r.id===requestId):db.paymentRequests.find(r=>r.id===requestId);
    if(!row)return res.status(404).json({error:'درخواست یا ردیف یافت نشد.'});
    const actor=db.users.find(u=>u.id===requesterId)!,at=new Date().toISOString();markRequesterDeleted(row,actor,at);
    if(batch){(batch.deletedItems||=[]).push(row as typeof batch.items[number]);batch.items=batch.items.filter(r=>r.id!==rowId);if(batch.items.length)syncBatchStatus(batch);else{batch.status='Closed';batch.totalAmount=0;batch.itemCount=0;batch.requesterDeletedAt=at;batch.requesterDeletedBy=actor.id;}}
    const committedState=saveDb(db);return res.json({success:true,state:committedState});
  });

  // 8. Individual Row Review Action (Approve, Return for Revision, Edit Amount & Comment)
  function rejectionTarget(db:TreasuryDatabaseState,target:{itemType:string;requestId:string;rowId?:string}){
    const batch=target.itemType==='BATCH_ITEM'?db.batchPayments.find(b=>b.id===target.requestId):undefined;
    const row:ReviewRow|undefined=batch?batch.items.find(it=>it.id===target.rowId):target.itemType==='ADVANCE'?db.advanceRequests.find(r=>r.id===target.requestId):target.itemType==='PAYMENT'?db.paymentRequests.find(r=>r.id===target.requestId):undefined;
    const parent=batch||row as AdvanceRequest|PaymentRequest|undefined;return {row,batch,parent};
  }
  function rejectionTransition(db:TreasuryDatabaseState,target:{itemType:'BATCH_ITEM'|'ADVANCE'|'PAYMENT';requestId:string;rowId?:string},reviewer:User,action:'REJECT'|'CLOSE_REJECTED'|'APPROVE',reason:string){
    const {row,batch,parent}=rejectionTarget(db,target);if(!row||!parent)throw Error('Review target not found');
    const stage=action==='REJECT'?(row.status==='Pending_Accounting'?'ACCOUNTING':'APPROVER'):row.reviewRejection!.stage;
    const at=`${getTodayJalali()} - ${new Date().toTimeString().slice(0,5)}`;
    applyRejectionDecision(row,action,stage,reviewer,reason,at);if(batch)syncBatchStatus(batch);
    const approved=action==='APPROVE',treasury=approved&&row.status==='Pending_Treasury';
    pushAppNotification(db,{eventType:approved?(treasury?'FINAL_APPROVED_ACCOUNTING':'APPROVED_SUPERVISOR'):action==='REJECT'?'REQUEST_REJECTED':'REQUEST_CLOSED',title:approved?'تأیید مجدد درخواست':action==='REJECT'?'رد درخواست؛ منتظر تصمیم بررسی‌کننده':'بستن نهایی درخواست',body:approved?'درخواست به مرحله بعد ارسال شد.':reason,trackingCode:parent.trackingCode,requestId:parent.id,rowId:batch?row.id:undefined,itemType:target.itemType,recipientUserId:approved?undefined:parent.requesterId,recipientRole:approved?(treasury?'TREASURY':'ACCOUNTING'):'REQUESTER',actorName:reviewer.name,targetSection:approved?(treasury?'TREASURY':'ACCOUNTING'):'REQUESTER'});
    return row;
  }
  mutations.post('/api/review/row-action', (req, res) => {
    const db: TreasuryDatabaseState = res.locals.commandDb;
    const {
      reviewerId,
      itemType, // 'BATCH_ITEM' | 'PAYMENT' | 'ADVANCE'
      requestId, // batch id, payment id, or advance id
      rowId, // item id in batch
      action, // 'APPROVE' | 'RETURN_FOR_REVISION' | 'UPDATE_AMOUNT_COMMENT' | 'UPDATE_AND_APPROVE'
      comment,
      returnReason,
      newAmount,
      amountChangeReason,
    } = req.body;

    const reviewer = db.users.find((u) => u.id === reviewerId);
    if (!reviewer || reviewer.isActive === false) {
      return res.status(401).json({ error: 'کاربر بررسی‌کننده معتبر یا فعال نیست.' });
    }
    const reviewerAuth = computeEffectiveUserAuth(reviewer, db);
    const rejection=rejectionTarget(db,{itemType,requestId,rowId});
    if(action==='REJECT'||action==='CLOSE_REJECTED'||(action==='APPROVE'&&rejection.row?.status==='Rejected')){
      if(!rejection.row)return res.status(404).json({error:'درخواست یافت نشد.'});
      const item=rejectionTransition(db,{itemType,requestId,rowId},reviewer,action,String(returnReason||'').trim());
      const committedState=saveDb(db);return res.json({success:true,item,state:committedState});
    }

    if ((action === 'APPROVE' || action === 'UPDATE_AND_APPROVE') && !reviewerAuth.effectivePermissions.canApprove) {
      return res.status(403).json({ error: 'شما مجوز تأیید درخواست‌های مالی را ندارید.' });
    }
    if (action === 'RETURN_FOR_REVISION' && !reviewerAuth.effectivePermissions.canReturnForRevision) {
      return res.status(403).json({ error: 'شما مجوز برگشت درخواست برای اصلاح را ندارید.' });
    }
    if (
      (action === 'UPDATE_AMOUNT_COMMENT' || (action === 'UPDATE_AND_APPROVE' && newAmount !== undefined)) &&
      !reviewerAuth.effectivePermissions.canEditAmount
    ) {
      return res.status(403).json({ error: 'شما مجوز ویرایش مبلغ درخواست را ندارید.' });
    }

    const editError=reviewEditError(action,newAmount,amountChangeReason,comment);
    if(editError)return res.status(400).json({error:editError});
    let centerChange:ReturnType<typeof prepareReviewCostCenter>;
    try{centerChange=prepareReviewCostCenter(db,reviewer,req.body,rejection.parent,rejection.row);}catch(e){if(e instanceof ReviewCostCenterError)return res.status(e.status).json({error:e.message});throw e;}
    const todayDate = `${getTodayJalali()} - ${new Date().toTimeString().slice(0, 5)}`;

    if (itemType === 'BATCH_ITEM') {
      const batch = db.batchPayments.find((b) => b.id === requestId);
      if (!batch) return res.status(404).json({ error: 'گروه درخواست یافت نشد' });
      const item = batch.items.find((it) => it.id === rowId);
      if (!item) return res.status(404).json({ error: 'ردیف مورد نظر در گروه یافت نشد' });

      // Strict self-approval prevention across non-admin roles
      if (batch.requesterId === reviewerId && reviewer.role !== 'ADMIN') {
        return res.status(403).json({ error: 'امکان تایید یا بررسی درخواست توسط شخص درخواست‌دهنده وجود ندارد.' });
      }

      const effectiveItemAmt =
        newAmount !== undefined ? Number(newAmount) : item.approvedAmount ?? item.amount;
      if (
        (action === 'APPROVE' || action === 'UPDATE_AND_APPROVE') &&
        reviewerAuth.effectiveApprovalLimitRial > 0 &&
        effectiveItemAmt > reviewerAuth.effectiveApprovalLimitRial
      ) {
        return res.status(403).json({
          error: `مبلغ این ردیف (${effectiveItemAmt.toLocaleString('fa-IR')} ریال) بیش از سقف مجاز تأیید مالی شما (${reviewerAuth.effectiveApprovalLimitRial.toLocaleString('fa-IR')} ریال) است.`,
        });
      }

      if (!item.comments) item.comments = [];
      if (!item.auditHistory) item.auditHistory = [];

      if (comment && comment.trim()) {
        item.comments.push({
          id: `cmt-${Date.now()}`,
          authorId: reviewer.id,
          authorName: reviewer.name,
          authorRole: reviewer.role,
          text: comment.trim(),
          createdAt: todayDate,
        });
      }

      if (action === 'RETURN_FOR_REVISION') {
        if (!returnReason || !returnReason.trim()) {
          return res.status(400).json({ error: 'ذکر علت برگشت جهت اصلاح الزامی است' });
        }
        const stageRole = item.status === 'Pending_Accounting' ? 'ACCOUNTING' : 'APPROVER';
        item.status = 'Needs_Revision';
        item.returnedReason = returnReason.trim();
        item.returnedByUserId = reviewer.id;
        item.returnedByRole = stageRole;
        item.returnedByName = reviewer.name;
        item.returnedAt = todayDate;
        item.auditHistory.push({
          id: `aud-${Date.now()}`,
          action: `برگشت جهت اصلاح توسط ${reviewer.name} (${reviewer.role})`,
          changedBy: reviewer.name,
          changedAt: todayDate,
          reason: returnReason.trim(),
        });
      } else if (action === 'APPROVE') {
        item.returnedReason = null;
        item.returnedByUserId = null;
        item.returnedByRole = null;
        item.returnedByName = null;
        item.returnedAt = null;
        item.invalidatedPriorApproval = false;
        if (item.status === 'Pending_Approver') {
          item.status = 'Pending_Accounting';
          item.approverNote = comment || 'تایید سرپرست/تاییدکننده';
          item.approvedBySupervisorUserId = reviewer.id;
          item.approvedBySupervisorName = reviewer.name;
          item.approvedBySupervisorAt = todayDate;
        } else if (item.status === 'Pending_Accounting') {
          item.status = 'Pending_Treasury';
          item.accountingNote = comment || 'تایید حسابداری';
          item.approvedByAccountingUserId = reviewer.id;
          item.approvedByAccountingName = reviewer.name;
          item.approvedByAccountingAt = todayDate;
        }
        item.auditHistory.push({
          id: `aud-${Date.now()}`,
          action: `تایید در مرحله ${reviewer.role}`,
          changedBy: reviewer.name,
          changedAt: todayDate,
          comment: comment || undefined,
        });
      } else if (action === 'UPDATE_AMOUNT_COMMENT' || action === 'UPDATE_AND_APPROVE') {
        const oldAmt = item.approvedAmount ?? item.amount;
        if (newAmount !== undefined && Number(newAmount) !== oldAmt) {
          item.approvedAmount = Number(newAmount);
          item.amount = Number(newAmount);
          item.version = (item.version || 1) + 1;
        }
        item.auditHistory.push(reviewEditEntry(reviewer,item.status==='Pending_Accounting'?'ACCOUNTING':'APPROVER',todayDate,oldAmt,Number(newAmount),amountChangeReason,comment));
        applyReviewCostCenter(item,centerChange,reviewer,item.status==='Pending_Accounting'?'ACCOUNTING':'APPROVER',todayDate,amountChangeReason);
        if (action === 'UPDATE_AND_APPROVE') {
          item.returnedReason = null;
          item.returnedByUserId = null;
          item.returnedByRole = null;
          item.returnedByName = null;
          item.returnedAt = null;
          item.invalidatedPriorApproval = false;
          if (item.status === 'Pending_Approver') {
            item.status = 'Pending_Accounting';
            item.approverNote = comment || 'تایید پس از اصلاح مبلغ';
            item.approvedBySupervisorUserId = reviewer.id;
            item.approvedBySupervisorName = reviewer.name;
            item.approvedBySupervisorAt = todayDate;
          } else if (item.status === 'Pending_Accounting') {
            item.status = 'Pending_Treasury';
            item.accountingNote = comment || 'تایید حسابداری پس از اصلاح مبلغ';
            item.approvedByAccountingUserId = reviewer.id;
            item.approvedByAccountingName = reviewer.name;
            item.approvedByAccountingAt = todayDate;
          }
          item.auditHistory.push({
            id: `aud-${Date.now()}-app`,
            action: `تایید و ارسال به مرحله بعد (${reviewer.role})`,
            changedBy: reviewer.name,
            changedAt: todayDate,
          });
        }
      }

      syncBatchStatus(batch);

      if (action === 'RETURN_FOR_REVISION') {
        pushAppNotification(db, {
          eventType: 'RETURNED_FOR_REVISION',
          title: `برگشت ردیف جهت اصلاح (${batch.trackingCode})`,
          body: `ردیف «${item.payeeName}» توسط ${reviewer.name} جهت اصلاح برگشت داده شد. علت: ${returnReason}`,
          trackingCode: batch.trackingCode,
          requestId: batch.id,
          rowId: item.id,
          itemType: 'BATCH_ITEM',
          recipientUserId: batch.requesterId,
          recipientRole: 'REQUESTER',
          actorName: reviewer.name,
          targetSection: 'REQUESTER',
        });
      } else if (action === 'APPROVE' || action === 'UPDATE_AND_APPROVE') {
        if (item.status === 'Pending_Treasury') {
          pushAppNotification(db, {
            eventType: 'FINAL_APPROVED_ACCOUNTING',
            title: `تایید نهایی ردیف پرداخت (${batch.trackingCode})`,
            body: `ردیف «${item.payeeName}» به مبلغ ${(item.approvedAmount ?? item.amount).toLocaleString('fa-IR')} ریال تایید نهایی شد و به صف خزانه ارسال گردید.`,
            trackingCode: batch.trackingCode,
            requestId: batch.id,
            rowId: item.id,
            itemType: 'BATCH_ITEM',
            recipientUserId: batch.requesterId,
            recipientRole: 'TREASURY',
            actorName: reviewer.name,
            targetSection: 'TREASURY',
          });
        } else {
          pushAppNotification(db, {
            eventType: 'APPROVED_SUPERVISOR',
            title: `تایید سرپرست واحد (${batch.trackingCode})`,
            body: `ردیف «${item.payeeName}» توسط ${reviewer.name} تایید و به کارتابل حسابداری ارجاع شد.`,
            trackingCode: batch.trackingCode,
            requestId: batch.id,
            rowId: item.id,
            itemType: 'BATCH_ITEM',
            recipientUserId: batch.requesterId,
            recipientRole: 'ACCOUNTING',
            actorName: reviewer.name,
            targetSection: 'ACCOUNTING',
          });
        }
      } else if (action === 'UPDATE_AMOUNT_COMMENT') {
        pushAppNotification(db, {
          eventType: 'AMOUNT_MODIFIED',
          title: `ویرایش مبلغ / یادداشت (${batch.trackingCode})`,
          body: `ردیف «${item.payeeName}» توسط ${reviewer.name} بروزرسانی شد (مبلغ فعلی: ${(item.approvedAmount ?? item.amount).toLocaleString('fa-IR')} ریال).`,
          trackingCode: batch.trackingCode,
          requestId: batch.id,
          rowId: item.id,
          itemType: 'BATCH_ITEM',
          recipientUserId: batch.requesterId,
          recipientRole: 'REQUESTER',
          actorName: reviewer.name,
          targetSection: 'REQUESTER',
        });
      }

      markReviewStarted(item);
      const committedState=saveDb(db);
      return res.json({ success: true, item, batch, state: committedState });
    }

    if (itemType === 'PAYMENT') {
      const target = db.paymentRequests.find((r) => r.id === requestId);
      if (!target) return res.status(404).json({ error: 'دستور پرداخت یافت نشد' });
      if (target.requesterId === reviewerId && reviewer.role !== 'ADMIN') {
        return res.status(403).json({ error: 'امکان تایید یا بررسی درخواست توسط شخص درخواست‌دهنده وجود ندارد.' });
      }
      const effectivePayAmt = newAmount !== undefined ? Number(newAmount) : target.amount;
      if (
        (action === 'APPROVE' || action === 'UPDATE_AND_APPROVE') &&
        reviewerAuth.effectiveApprovalLimitRial > 0 &&
        effectivePayAmt > reviewerAuth.effectiveApprovalLimitRial
      ) {
        return res.status(403).json({
          error: `مبلغ این دستور پرداخت (${effectivePayAmt.toLocaleString('fa-IR')} ریال) بیش از سقف مجاز تأیید مالی شما (${reviewerAuth.effectiveApprovalLimitRial.toLocaleString('fa-IR')} ریال) است.`,
        });
      }

      if (!target.comments) target.comments = [];
      if (!target.auditHistory) target.auditHistory = [];

      if (comment && comment.trim()) {
        target.comments.push({
          id: `cmt-${Date.now()}`,
          authorId: reviewer.id,
          authorName: reviewer.name,
          authorRole: reviewer.role,
          text: comment.trim(),
          createdAt: todayDate,
        });
      }

      if (action === 'RETURN_FOR_REVISION') {
        if (!returnReason || !returnReason.trim()) {
          return res.status(400).json({ error: 'ذکر علت برگشت جهت اصلاح الزامی است' });
        }
        const stageRole = target.status === 'Pending_Accounting' ? 'ACCOUNTING' : 'APPROVER';
        target.status = 'Needs_Revision';
        target.returnedReason = returnReason.trim();
        target.returnedByUserId = reviewer.id;
        target.returnedByRole = stageRole;
        target.returnedByName = reviewer.name;
        target.returnedAt = todayDate;
        target.auditHistory.push({
          id: `aud-${Date.now()}`,
          action: `برگشت جهت اصلاح توسط ${reviewer.name}`,
          changedBy: reviewer.name,
          changedAt: todayDate,
          reason: returnReason.trim(),
        });
      } else if (action === 'APPROVE') {
        target.returnedReason = null;
        target.returnedByUserId = null;
        target.returnedByRole = null;
        target.returnedByName = null;
        target.returnedAt = null;
        target.invalidatedPriorApproval = false;
        if (target.status === 'Pending_Approver') {
          target.status = 'Pending_Accounting';
          target.approverNote = comment || 'تایید سرپرست';
          target.supervisorId = reviewer.id;
          target.supervisorName = reviewer.name;
          target.approvedBySupervisorUserId = reviewer.id;
          target.approvedBySupervisorName = reviewer.name;
          target.approvedBySupervisorAt = todayDate;
        } else if (target.status === 'Pending_Accounting') {
          target.status = 'Pending_Treasury';
          target.accountingNote = comment || 'تایید حسابداری';
          target.accountingId = reviewer.id;
          target.accountingName = reviewer.name;
          target.approvedByAccountingUserId = reviewer.id;
          target.approvedByAccountingName = reviewer.name;
          target.approvedByAccountingAt = todayDate;
        }
        target.auditHistory.push({
          id: `aud-${Date.now()}`,
          action: `تایید مرحله ${reviewer.role}`,
          changedBy: reviewer.name,
          changedAt: todayDate,
        });
      } else if (action === 'UPDATE_AMOUNT_COMMENT' || action === 'UPDATE_AND_APPROVE') {
        const oldAmt = target.amount;
        if (newAmount !== undefined && Number(newAmount) !== oldAmt) {
          target.amount = Number(newAmount);
          target.version = (target.version || 1) + 1;
        }
        target.auditHistory.push(reviewEditEntry(reviewer,target.status==='Pending_Accounting'?'ACCOUNTING':'APPROVER',todayDate,oldAmt,Number(newAmount),amountChangeReason,comment));
        applyReviewCostCenter(target,centerChange,reviewer,target.status==='Pending_Accounting'?'ACCOUNTING':'APPROVER',todayDate,amountChangeReason);
        if (action === 'UPDATE_AND_APPROVE') {
          target.returnedReason = null;
          target.returnedByUserId = null;
          target.returnedByRole = null;
          target.returnedByName = null;
          target.returnedAt = null;
          target.invalidatedPriorApproval = false;
          if (target.status === 'Pending_Approver') {
            target.status = 'Pending_Accounting';
            target.approvedBySupervisorUserId = reviewer.id;
            target.approvedBySupervisorName = reviewer.name;
            target.approvedBySupervisorAt = todayDate;
          } else if (target.status === 'Pending_Accounting') {
            target.status = 'Pending_Treasury';
            target.approvedByAccountingUserId = reviewer.id;
            target.approvedByAccountingName = reviewer.name;
            target.approvedByAccountingAt = todayDate;
          }
        }
      }

      if (action === 'RETURN_FOR_REVISION') {
        pushAppNotification(db, {
          eventType: 'RETURNED_FOR_REVISION',
          title: `برگشت دستور پرداخت جهت اصلاح (${target.trackingCode})`,
          body: `دستور پرداخت در وجه «${target.payeeName}» توسط ${reviewer.name} برگشت داده شد. علت: ${returnReason}`,
          trackingCode: target.trackingCode,
          requestId: target.id,
          itemType: 'PAYMENT',
          recipientUserId: target.requesterId,
          recipientRole: 'REQUESTER',
          actorName: reviewer.name,
          targetSection: 'REQUESTER',
        });
      } else if (action === 'APPROVE' || action === 'UPDATE_AND_APPROVE') {
        if (target.status === 'Pending_Treasury') {
          pushAppNotification(db, {
            eventType: 'FINAL_APPROVED_ACCOUNTING',
            title: `تایید نهایی دستور پرداخت (${target.trackingCode})`,
            body: `دستور پرداخت در وجه «${target.payeeName}» به مبلغ ${target.amount.toLocaleString('fa-IR')} ریال تایید نهایی شد و به صف پرداخت خزانه منتقل گردید.`,
            trackingCode: target.trackingCode,
            requestId: target.id,
            itemType: 'PAYMENT',
            recipientUserId: target.requesterId,
            recipientRole: 'TREASURY',
            actorName: reviewer.name,
            targetSection: 'TREASURY',
          });
        } else {
          pushAppNotification(db, {
            eventType: 'APPROVED_SUPERVISOR',
            title: `تایید سرپرست واحد (${target.trackingCode})`,
            body: `دستور پرداخت «${target.payeeName}» توسط ${reviewer.name} تایید و به حسابداری ارسال شد.`,
            trackingCode: target.trackingCode,
            requestId: target.id,
            itemType: 'PAYMENT',
            recipientUserId: target.requesterId,
            recipientRole: 'ACCOUNTING',
            actorName: reviewer.name,
            targetSection: 'ACCOUNTING',
          });
        }
      } else if (action === 'UPDATE_AMOUNT_COMMENT') {
        pushAppNotification(db, {
          eventType: 'AMOUNT_MODIFIED',
          title: `اصلاح مبلغ / یادداشت (${target.trackingCode})`,
          body: `دستور پرداخت «${target.payeeName}» توسط ${reviewer.name} بروزرسانی شد (مبلغ: ${target.amount.toLocaleString('fa-IR')} ریال).`,
          trackingCode: target.trackingCode,
          requestId: target.id,
          itemType: 'PAYMENT',
          recipientUserId: target.requesterId,
          recipientRole: 'REQUESTER',
          actorName: reviewer.name,
          targetSection: 'REQUESTER',
        });
      }

      markReviewStarted(target);
      const committedState=saveDb(db);
      return res.json({ success: true, item: target, state: committedState });
    }

    if (itemType === 'ADVANCE') {
      const target = db.advanceRequests.find((r) => r.id === requestId);
      if (!target) return res.status(404).json({ error: 'درخواست مساعده یافت نشد' });
      if (target.requesterId === reviewerId && reviewer.role !== 'ADMIN') {
        return res.status(403).json({ error: 'امکان تایید یا بررسی درخواست توسط شخص درخواست‌دهنده وجود ندارد.' });
      }
      const effectiveAdvAmt =
        newAmount !== undefined ? Number(newAmount) : target.approvedAmount ?? target.amount;
      if (
        (action === 'APPROVE' || action === 'UPDATE_AND_APPROVE') &&
        reviewerAuth.effectiveApprovalLimitRial > 0 &&
        effectiveAdvAmt > reviewerAuth.effectiveApprovalLimitRial
      ) {
        return res.status(403).json({
          error: `مبلغ این مساعده (${effectiveAdvAmt.toLocaleString('fa-IR')} ریال) بیش از سقف مجاز تأیید مالی شما (${reviewerAuth.effectiveApprovalLimitRial.toLocaleString('fa-IR')} ریال) است.`,
        });
      }

      if (!target.comments) target.comments = [];
      if (!target.auditHistory) target.auditHistory = [];

      if (comment && comment.trim()) {
        target.comments.push({
          id: `cmt-${Date.now()}`,
          authorId: reviewer.id,
          authorName: reviewer.name,
          authorRole: reviewer.role,
          text: comment.trim(),
          createdAt: todayDate,
        });
      }

      if (action === 'RETURN_FOR_REVISION') {
        if (!returnReason || !returnReason.trim()) {
          return res.status(400).json({ error: 'ذکر علت برگشت جهت اصلاح الزامی است' });
        }
        const stageRole = target.status === 'Pending_Accounting' ? 'ACCOUNTING' : 'APPROVER';
        target.status = 'Needs_Revision';
        target.returnedReason = returnReason.trim();
        target.returnedByUserId = reviewer.id;
        target.returnedByRole = stageRole;
        target.returnedByName = reviewer.name;
        target.returnedAt = todayDate;
        target.auditHistory.push({
          id: `aud-${Date.now()}`,
          action: `برگشت جهت اصلاح توسط ${reviewer.name}`,
          changedBy: reviewer.name,
          changedAt: todayDate,
          reason: returnReason.trim(),
        });
      } else if (action === 'APPROVE') {
        target.returnedReason = null;
        target.returnedByUserId = null;
        target.returnedByRole = null;
        target.returnedByName = null;
        target.returnedAt = null;
        target.invalidatedPriorApproval = false;
        if (target.status === 'Pending_Approver') {
          target.status = 'Pending_Accounting';
          target.approverNote = comment || 'تایید سرپرست';
          target.supervisorId = reviewer.id;
          target.supervisorName = reviewer.name;
          target.approvedBySupervisorUserId = reviewer.id;
          target.approvedBySupervisorName = reviewer.name;
          target.approvedBySupervisorAt = todayDate;
        } else if (target.status === 'Pending_Accounting') {
          target.status = 'Pending_Treasury';
          target.accountingNote = comment || 'تایید حسابداری';
          target.accountingId = reviewer.id;
          target.accountingName = reviewer.name;
          target.approvedByAccountingUserId = reviewer.id;
          target.approvedByAccountingName = reviewer.name;
          target.approvedByAccountingAt = todayDate;
        }
        target.auditHistory.push({
          id: `aud-${Date.now()}`,
          action: `تایید مرحله ${reviewer.role}`,
          changedBy: reviewer.name,
          changedAt: todayDate,
        });
      } else if (action === 'UPDATE_AMOUNT_COMMENT' || action === 'UPDATE_AND_APPROVE') {
        const oldAmt = target.approvedAmount ?? target.amount;
        if (newAmount !== undefined && Number(newAmount) !== oldAmt) {
          target.approvedAmount = Number(newAmount);
          target.version = (target.version || 1) + 1;
        }
        target.auditHistory.push(reviewEditEntry(reviewer,target.status==='Pending_Accounting'?'ACCOUNTING':'APPROVER',todayDate,oldAmt,Number(newAmount),amountChangeReason,comment));
        applyReviewCostCenter(target,centerChange,reviewer,target.status==='Pending_Accounting'?'ACCOUNTING':'APPROVER',todayDate,amountChangeReason);
        if (action === 'UPDATE_AND_APPROVE') {
          target.returnedReason = null;
          target.returnedByUserId = null;
          target.returnedByRole = null;
          target.returnedByName = null;
          target.returnedAt = null;
          target.invalidatedPriorApproval = false;
          if (target.status === 'Pending_Approver') {
            target.status = 'Pending_Accounting';
            target.approvedBySupervisorUserId = reviewer.id;
            target.approvedBySupervisorName = reviewer.name;
            target.approvedBySupervisorAt = todayDate;
          } else if (target.status === 'Pending_Accounting') {
            target.status = 'Pending_Treasury';
            target.approvedByAccountingUserId = reviewer.id;
            target.approvedByAccountingName = reviewer.name;
            target.approvedByAccountingAt = todayDate;
          }
        }
      }

      if (action === 'RETURN_FOR_REVISION') {
        pushAppNotification(db, {
          eventType: 'RETURNED_FOR_REVISION',
          title: `برگشت درخواست مساعده جهت اصلاح (${target.trackingCode})`,
          body: `درخواست مساعده ${target.requesterName} توسط ${reviewer.name} جهت اصلاح برگشت داده شد. علت: ${returnReason}`,
          trackingCode: target.trackingCode,
          requestId: target.id,
          itemType: 'ADVANCE',
          recipientUserId: target.requesterId,
          recipientRole: 'REQUESTER',
          actorName: reviewer.name,
          targetSection: 'REQUESTER',
        });
      } else if (action === 'APPROVE' || action === 'UPDATE_AND_APPROVE') {
        if (target.status === 'Pending_Treasury') {
          pushAppNotification(db, {
            eventType: 'FINAL_APPROVED_ACCOUNTING',
            title: `تایید نهایی مساعده (${target.trackingCode})`,
            body: `درخواست مساعده ${target.requesterName} به مبلغ ${(target.approvedAmount ?? target.amount).toLocaleString('fa-IR')} ریال تایید نهایی شد و آماده پرداخت در خزانه است.`,
            trackingCode: target.trackingCode,
            requestId: target.id,
            itemType: 'ADVANCE',
            recipientUserId: target.requesterId,
            recipientRole: 'TREASURY',
            actorName: reviewer.name,
            targetSection: 'TREASURY',
          });
        } else {
          pushAppNotification(db, {
            eventType: 'APPROVED_SUPERVISOR',
            title: `تایید سرپرست برای مساعده (${target.trackingCode})`,
            body: `درخواست مساعده ${target.requesterName} توسط ${reviewer.name} تایید و به حسابداری ارسال شد.`,
            trackingCode: target.trackingCode,
            requestId: target.id,
            itemType: 'ADVANCE',
            recipientUserId: target.requesterId,
            recipientRole: 'ACCOUNTING',
            actorName: reviewer.name,
            targetSection: 'ACCOUNTING',
          });
        }
      } else if (action === 'UPDATE_AMOUNT_COMMENT') {
        pushAppNotification(db, {
          eventType: 'AMOUNT_MODIFIED',
          title: `ویرایش مبلغ / یادداشت مساعده (${target.trackingCode})`,
          body: `درخواست مساعده ${target.requesterName} توسط ${reviewer.name} بروزرسانی شد.`,
          trackingCode: target.trackingCode,
          requestId: target.id,
          itemType: 'ADVANCE',
          recipientUserId: target.requesterId,
          recipientRole: 'REQUESTER',
          actorName: reviewer.name,
          targetSection: 'REQUESTER',
        });
      }

      markReviewStarted(target);
      const committedState=saveDb(db);
      return res.json({ success: true, item: target, state: committedState });
    }

    return res.status(400).json({ error: 'نوع درخواست مشخص نیست' });
  });

  // 9. Bulk Row Review Action (Approve or Return selected rows in one transaction)
  mutations.post('/api/review/bulk-action', (req, res) => {
    const db: TreasuryDatabaseState = res.locals.commandDb;
    const { reviewerId, action, returnReason, items } = req.body;

    const reviewer = db.users.find((u) => u.id === reviewerId);
    if (!reviewer || reviewer.isActive === false) {
      return res.status(401).json({ error: 'کاربر بررسی‌کننده معتبر یا فعال نیست.' });
    }
    const reviewerAuth = computeEffectiveUserAuth(reviewer, db);
    if(action==='REJECT'){
      if(!Array.isArray(items)||!items.length||items.length>200)return res.status(400).json({error:'بین۱تا۲۰۰ردیف انتخاب کنید.'});
      const allowed=['itemType','requestId','rowId','expectedVersion','expectedStatus','reviewStage'];
      if(items.some(it=>!it||Object.keys(it).some(key=>!allowed.includes(key))||!rejectionTarget(db,it).row))return res.status(400).json({error:'ردیف صریح معتبر لازم است؛ هیچ ردیفی تغییر نکرد.'});
      // Admission already checked every row inside this same write turn; commit only once.
      for(const item of items)rejectionTransition(db,item,reviewer,'REJECT',String(returnReason).trim());
      const committedState=saveDb(db);return res.json({success:true,successCount:items.length,failedCount:0,state:committedState,succeededUids:items.map(it=>`${it.itemType}:${it.requestId}${it.rowId?':'+it.rowId:''}`)});
    }
    if (action === 'APPROVE' && !reviewerAuth.effectivePermissions.canApprove) {
      return res.status(403).json({ error: 'شما مجوز تأیید درخواست‌های مالی را ندارید.' });
    }
    if (action === 'RETURN_FOR_REVISION' && !reviewerAuth.effectivePermissions.canReturnForRevision) {
      return res.status(403).json({ error: 'شما مجوز برگشت درخواست برای اصلاح را ندارید.' });
    }

    if (action === 'RETURN_FOR_REVISION' && (!returnReason || !returnReason.trim())) {
      return res.status(400).json({ error: 'ذکر علت برگشت الزامی است' });
    }

    const todayDate = `${getTodayJalali()} - ${new Date().toTimeString().slice(0, 5)}`;
    let successCount = 0;
    let failedCount = 0;
    const failures: Array<{ id: string; reason: string }> = [];
    const modifiedBatches = new Set<BatchPaymentRequest>();
    let anyFinalApproved = false;
    const changedRows:Array<{parent:any;row:any;itemType:AppNotification['itemType']}>=[];

    for (const it of items || []) {
      if (it.itemType === 'BATCH_ITEM') {
        const batch = db.batchPayments.find((b) => b.id === it.requestId);
        if (!batch) {
          failedCount++;
          failures.push({ id: it.rowId, reason: 'گروه یافت نشد' });
          continue;
        }
        const row = batch.items.find((item) => item.id === it.rowId);
        if (!row) {
          failedCount++;
          failures.push({ id: it.rowId, reason: 'ردیف در گروه یافت نشد' });
          continue;
        }
        if (batch.requesterId === reviewerId && reviewer.role !== 'ADMIN') {
          failedCount++;
          failures.push({ id: it.rowId, reason: 'منع خودتأییدی' });
          continue;
        }
        const rowAmt = row.approvedAmount ?? row.amount;
        if (
          action === 'APPROVE' &&
          reviewerAuth.effectiveApprovalLimitRial > 0 &&
          rowAmt > reviewerAuth.effectiveApprovalLimitRial
        ) {
          failedCount++;
          failures.push({ id: it.rowId, reason: 'فراتر از سقف مجاز تأیید مالی' });
          continue;
        }

        if (!row.comments) row.comments = [];
        if (!row.auditHistory) row.auditHistory = [];

        if (action === 'APPROVE') {
          row.returnedReason = null;
          row.returnedByUserId = null;
          row.returnedByRole = null;
          row.returnedByName = null;
          row.returnedAt = null;
          row.invalidatedPriorApproval = false;
          if (row.status === 'Pending_Approver') {
            row.status = 'Pending_Accounting';
            row.approverNote = 'تایید گروهی ردیف‌های انتخابی';
            row.approvedBySupervisorUserId = reviewer.id;
            row.approvedBySupervisorName = reviewer.name;
            row.approvedBySupervisorAt = todayDate;
          } else if (row.status === 'Pending_Accounting') {
            row.status = 'Pending_Treasury';
            row.accountingNote = 'تایید مالی گروهی';
            row.approvedByAccountingUserId = reviewer.id;
            row.approvedByAccountingName = reviewer.name;
            row.approvedByAccountingAt = todayDate;
            anyFinalApproved = true;
          }
          row.auditHistory.push({
            id: `aud-${Date.now()}-${row.id}`,
            action: `تایید گروهی در مرحله ${reviewer.role}`,
            changedBy: reviewer.name,
            changedAt: todayDate,
          });
        } else if (action === 'RETURN_FOR_REVISION') {
          const stageRole = row.status === 'Pending_Accounting' ? 'ACCOUNTING' : 'APPROVER';
          row.status = 'Needs_Revision';
          row.returnedReason = returnReason.trim();
          row.returnedByUserId = reviewer.id;
          row.returnedByRole = stageRole;
          row.returnedByName = reviewer.name;
          row.returnedAt = todayDate;
          row.auditHistory.push({
            id: `aud-${Date.now()}-${row.id}`,
            action: 'برگشت گروهی جهت اصلاح',
            changedBy: reviewer.name,
            changedAt: todayDate,
            reason: returnReason.trim(),
          });
        }
        markReviewStarted(row);
        modifiedBatches.add(batch);
        changedRows.push({parent:batch,row,itemType:'BATCH_ITEM'});
        successCount++;
      } else if (it.itemType === 'PAYMENT') {
        const pay = db.paymentRequests.find((p) => p.id === it.requestId);
        if (!pay) {
          failedCount++;
          failures.push({ id: it.requestId, reason: 'دستور پرداخت یافت نشد' });
          continue;
        }
        if (pay.requesterId === reviewerId && reviewer.role !== 'ADMIN') {
          failedCount++;
          failures.push({ id: it.requestId, reason: 'منع خودتأییدی' });
          continue;
        }
        if (
          action === 'APPROVE' &&
          reviewerAuth.effectiveApprovalLimitRial > 0 &&
          pay.amount > reviewerAuth.effectiveApprovalLimitRial
        ) {
          failedCount++;
          failures.push({ id: it.requestId, reason: 'فراتر از سقف مجاز تأیید مالی' });
          continue;
        }
        if (!pay.auditHistory) pay.auditHistory = [];

        if (action === 'APPROVE') {
          pay.returnedReason = null;
          pay.returnedByUserId = null;
          pay.returnedByRole = null;
          pay.returnedByName = null;
          pay.returnedAt = null;
          pay.invalidatedPriorApproval = false;
          if (pay.status === 'Pending_Approver') {
            pay.status = 'Pending_Accounting';
            pay.supervisorId = reviewer.id;
            pay.supervisorName = reviewer.name;
            pay.approvedBySupervisorUserId = reviewer.id;
            pay.approvedBySupervisorName = reviewer.name;
            pay.approvedBySupervisorAt = todayDate;
          } else if (pay.status === 'Pending_Accounting') {
            pay.status = 'Pending_Treasury';
            pay.accountingId = reviewer.id;
            pay.accountingName = reviewer.name;
            pay.approvedByAccountingUserId = reviewer.id;
            pay.approvedByAccountingName = reviewer.name;
            pay.approvedByAccountingAt = todayDate;
            anyFinalApproved = true;
          }
        } else if (action === 'RETURN_FOR_REVISION') {
          const stageRole = pay.status === 'Pending_Accounting' ? 'ACCOUNTING' : 'APPROVER';
          pay.status = 'Needs_Revision';
          pay.returnedReason = returnReason.trim();
          pay.returnedByUserId = reviewer.id;
          pay.returnedByRole = stageRole;
          pay.returnedByName = reviewer.name;
          pay.returnedAt = todayDate;
        }
        markReviewStarted(pay);
        pay.auditHistory.push({
          id: `aud-${Date.now()}-${pay.id}`,
          action: `${action === 'APPROVE' ? 'تایید' : 'برگشت'} انتخابی توسط ${reviewer.name}`,
          changedBy: reviewer.name,
          changedAt: todayDate,
        });
        changedRows.push({parent:pay,row:pay,itemType:'PAYMENT'});
        successCount++;
      } else if (it.itemType === 'ADVANCE') {
        const adv = db.advanceRequests.find((a) => a.id === it.requestId);
        if (!adv) {
          failedCount++;
          failures.push({ id: it.requestId, reason: 'مساعده یافت نشد' });
          continue;
        }
        if (adv.requesterId === reviewerId && reviewer.role !== 'ADMIN') {
          failedCount++;
          failures.push({ id: it.requestId, reason: 'منع خودتأییدی' });
          continue;
        }
        const advAmt = adv.approvedAmount ?? adv.amount;
        if (
          action === 'APPROVE' &&
          reviewerAuth.effectiveApprovalLimitRial > 0 &&
          advAmt > reviewerAuth.effectiveApprovalLimitRial
        ) {
          failedCount++;
          failures.push({ id: it.requestId, reason: 'فراتر از سقف مجاز تأیید مالی' });
          continue;
        }
        if (!adv.auditHistory) adv.auditHistory = [];

        if (action === 'APPROVE') {
          adv.returnedReason = null;
          adv.returnedByUserId = null;
          adv.returnedByRole = null;
          adv.returnedByName = null;
          adv.returnedAt = null;
          adv.invalidatedPriorApproval = false;
          if (adv.status === 'Pending_Approver') {
            adv.status = 'Pending_Accounting';
            adv.supervisorId = reviewer.id;
            adv.supervisorName = reviewer.name;
            adv.approvedBySupervisorUserId = reviewer.id;
            adv.approvedBySupervisorName = reviewer.name;
            adv.approvedBySupervisorAt = todayDate;
          } else if (adv.status === 'Pending_Accounting') {
            adv.status = 'Pending_Treasury';
            adv.accountingId = reviewer.id;
            adv.accountingName = reviewer.name;
            adv.approvedByAccountingUserId = reviewer.id;
            adv.approvedByAccountingName = reviewer.name;
            adv.approvedByAccountingAt = todayDate;
            anyFinalApproved = true;
          }
        } else if (action === 'RETURN_FOR_REVISION') {
          const stageRole = adv.status === 'Pending_Accounting' ? 'ACCOUNTING' : 'APPROVER';
          adv.status = 'Needs_Revision';
          adv.returnedReason = returnReason.trim();
          adv.returnedByUserId = reviewer.id;
          adv.returnedByRole = stageRole;
          adv.returnedByName = reviewer.name;
          adv.returnedAt = todayDate;
        }
        markReviewStarted(adv);
        adv.auditHistory.push({
          id: `aud-${Date.now()}-${adv.id}`,
          action: `${action === 'APPROVE' ? 'تایید' : 'برگشت'} انتخابی توسط ${reviewer.name}`,
          changedBy: reviewer.name,
          changedAt: todayDate,
        });
        changedRows.push({parent:adv,row:adv,itemType:'ADVANCE'});
        successCount++;
      }
    }

    modifiedBatches.forEach((b) => syncBatchStatus(b));

    for(const target of changedRows)pushAppNotification(db,reviewedNotification(target.parent,target.row,target.itemType,action,reviewer.name,returnReason||''));

    const committedState=saveDb(db);
    res.json({
      success: true,
      successCount,
      failedCount,
      failures,
      state: committedState,
    });
  });

  // 10. Resubmit Request / Row after Revision
  mutations.post('/api/treasury/return-for-correction',(req,res)=>{
    const db:TreasuryDatabaseState=res.locals.commandDb,{row,parent,batch}=correctionTarget(db,req.body),actor:User=res.locals.viewer;
    const id=correctionRecipientId(parent,row!,req.body.recipientStage),recipient=db.users.find(u=>u.id===id);
    if(!recipient||!correctionStageAllowed(recipient,req.body.recipientStage,computeEffectiveUserAuth(recipient,db))||!canSeeRequest(parent as any,recipient,db,computeEffectiveUserAuth(recipient,db)))return res.status(403).json({error:'گیرندهٔ واقعی این مرحله موجود، فعال یا دارای مجوز جاری نیست؛ شخص دیگری خودکار جایگزین نمی‌شود.'});
    const at=new Date().toISOString();applyTreasuryReturn(row!,parent,actor,recipient,req.body.recipientStage,req.body.reason.trim(),at);if(batch)syncBatchStatus(batch);
    pushAppNotification(db,{eventType:'RETURNED_FOR_REVISION',title:'عودت فنی خزانه برای اصلاح',body:'مشخصات فنی را اصلاح و مستقیم به خزانه ارسال کنید؛ اطلاعات مالی و تأییدها ثابت می‌مانند.',trackingCode:parent!.trackingCode,requestId:parent!.id,rowId:batch?row!.id:undefined,itemType:req.body.itemType,recipientUserId:recipient.id,actorName:actor.name,targetSection:'REQUESTER'});
    const state=saveDb(db);return res.json({success:true,state});
  });
  mutations.post('/api/requests/resubmit', (req, res) => {
    const draft:TreasuryDatabaseState=res.locals.commandDb,technical=correctionTarget(draft,req.body);
    if(technical.row&&openTreasuryCorrection(technical.row)){
      const {row,parent,batch}=technical,actor:User=res.locals.viewer,assignment=row.treasuryCorrection!,treasury=draft.users.find(u=>u.id===assignment.byUserId);
      if(!treasury||treasury.isActive===false||treasury.mustChangePassword||!computeEffectiveUserAuth(treasury,draft).effectivePermissions.canExecutePayment||!canSeeRequest(parent as any,treasury,draft,computeEffectiveUserAuth(treasury,draft)))return res.status(403).json({error:'مجوز جاری خزانه‌دار ارجاع‌دهنده معتبر نیست؛ اصلاح ارسال نشد.'});
      applyTreasuryCorrection(row,req.body,actor,new Date().toISOString());if(batch)syncBatchStatus(batch);
      pushAppNotification(draft,{eventType:'REQUEST_RESUBMITTED',title:'بازگشت اصلاح فنی به خزانه',body:'مشخصات فنی اصلاح شد؛ درخواست بدون تکرار تأیید در صف خزانه آماده بررسی است.',trackingCode:parent!.trackingCode,requestId:parent!.id,rowId:batch?row.id:undefined,itemType:req.body.itemType,recipientUserId:treasury.id,actorName:actor.name,targetSection:'TREASURY'});
      const state=saveDb(draft);return res.json({success:true,returnedToTreasury:true,state});
    }
    const bankError=bankFieldsError(req.body);if(bankError)return res.status(400).json({error:bankError});
    req.body=normalizedBankFields(req.body);
    const db = loadDb();
    const {
      requesterId,
      itemType,
      requestId,
      rowId,
      amount,
      description,
      accountOrCard,
      iban,
      bankName,
      newAttachments,
    } = req.body;

    const user = db.users.find((u) => u.id === requesterId);
    const todayDate = `${getTodayJalali()} - ${new Date().toTimeString().slice(0, 5)}`;

    if (itemType === 'BATCH_ITEM') {
      const batch = db.batchPayments.find((b) => b.id === requestId);
      if (!batch) return res.status(404).json({ error: 'گروه یافت نشد' });
      const item = batch.items.find((it) => it.id === rowId);
      if (!item) return res.status(404).json({ error: 'ردیف در گروه یافت نشد' });
      const error=bankFieldsError({...item,...req.body},batch.batchType!=='ADVANCE');if(error)return res.status(400).json({error});

      const sensitiveChanged =
        (amount !== undefined && Number(amount) !== Number(item.amount)) ||
        bankIdentifierChanged(accountOrCard,item.accountOrCard,'CARD') ||
        bankIdentifierChanged(iban,item.iban,'IBAN') ||
        (bankName !== undefined && String(bankName).trim() !== String(item.bankName || '').trim()) ||
        (Array.isArray(newAttachments) && newAttachments.length > 0);

      const hadPriorSupApproval = Boolean(item.approvedBySupervisorUserId);
      const wasReturnedByAccounting = item.returnedByRole === 'ACCOUNTING';
      const invalidatedPrior = hadPriorSupApproval && sensitiveChanged;

      if (amount !== undefined) {
        item.amount = Number(amount);
        item.approvedAmount = Number(amount);
      }
      if (description !== undefined) item.description = description;
      if (accountOrCard !== undefined) item.accountOrCard = accountOrCard;
      if (iban !== undefined) item.iban = iban;
      if (bankName !== undefined) item.bankName = bankName;
      if (newAttachments) {
        item.attachments = [...(item.attachments || []), ...newAttachments];
      }

      if (invalidatedPrior) {
        item.approvedBySupervisorUserId = null;
        item.approvedBySupervisorName = null;
        item.approvedBySupervisorAt = null;
      }

      const nextStatus: RequestStatus =
        !batch.supervisorId || (wasReturnedByAccounting && !sensitiveChanged && hadPriorSupApproval) ? 'Pending_Accounting' : 'Pending_Approver';

      item.status = nextStatus;
      item.version = (item.version || 1) + 1;
      item.isResubmitted = true;
      item.resubmittedAt = todayDate;
      item.invalidatedPriorApproval = invalidatedPrior;
      item.returnedReason = null;
      item.returnedByUserId = null;
      item.returnedByRole = null;
      item.returnedByName = null;
      item.returnedAt = null;
      if (!item.auditHistory) item.auditHistory = [];
      item.auditHistory.push({
        id: `aud-${Date.now()}`,
        action: `ارسال مجدد توسط متقاضی پس از ویرایش و تکمیل مدارک (نسخه ${item.version})${invalidatedPrior ? ' — به دلیل تغییر فیلدهای حساس، تأیید قبلی ابطال و نیازمند تأیید مجدد است' : ''}`,
        changedBy: user?.name || 'متقاضی',
        changedAt: todayDate,
        newAmount: item.amount,
      });

      syncBatchStatus(batch);
      pushAppNotification(db, {
        eventType: 'REQUEST_RESUBMITTED',
        title: `ارسال مجدد درخواست اصلاح‌شده (${batch.trackingCode})`,
        body: `ردیف «${item.payeeName}» پس از اصلاح توسط ${user?.name || batch.requesterName} (نسخه ${item.version}) مجدداً به صف تایید ارسال شد.`,
        trackingCode: batch.trackingCode,
        requestId: batch.id,
        rowId: item.id,
        itemType: 'BATCH_ITEM',
        recipientUserId: nextStatus === 'Pending_Accounting' ? null : batch.supervisorId || null,
        recipientRole: nextStatus === 'Pending_Accounting' ? 'ACCOUNTING' : 'APPROVER',
        actorName: user?.name || batch.requesterName,
        targetSection: nextStatus === 'Pending_Accounting' ? 'ACCOUNTING' : 'APPROVER',
      });
      saveDb(db);
      return res.json({ success: true, item, batch, state: db });
    }

    if (itemType === 'PAYMENT') {
      const target = db.paymentRequests.find((p) => p.id === requestId);
      if (!target) return res.status(404).json({ error: 'دستور پرداخت یافت نشد' });
      const error=bankFieldsError({...target,...req.body},true);if(error)return res.status(400).json({error});

      const sensitiveChanged =
        (amount !== undefined && Number(amount) !== Number(target.amount)) ||
        bankIdentifierChanged(accountOrCard,target.accountOrCard,'CARD') ||
        bankIdentifierChanged(iban,target.iban,'IBAN') ||
        (bankName !== undefined && String(bankName).trim() !== String(target.bankName || '').trim()) ||
        (Array.isArray(newAttachments) && newAttachments.length > 0);

      const hadPriorSupApproval = Boolean(target.approvedBySupervisorUserId);
      const wasReturnedByAccounting = target.returnedByRole === 'ACCOUNTING';
      const invalidatedPrior = hadPriorSupApproval && sensitiveChanged;

      if (amount !== undefined) target.amount = Number(amount);
      if (description !== undefined) target.description = description;
      if (accountOrCard !== undefined) target.accountOrCard = accountOrCard;
      if (iban !== undefined) target.iban = iban;
      if (bankName !== undefined) target.bankName = bankName;
      if (newAttachments) {
        target.attachments = [...(target.attachments || []), ...newAttachments];
      }

      if (invalidatedPrior) {
        target.approvedBySupervisorUserId = null;
        target.approvedBySupervisorName = null;
        target.approvedBySupervisorAt = null;
      }

      const nextStatus: RequestStatus =
        !target.supervisorId || (wasReturnedByAccounting && !sensitiveChanged && hadPriorSupApproval) ? 'Pending_Accounting' : 'Pending_Approver';

      target.status = nextStatus;
      target.version = (target.version || 1) + 1;
      target.isResubmitted = true;
      target.resubmittedAt = todayDate;
      target.invalidatedPriorApproval = invalidatedPrior;
      target.returnedReason = null;
      target.returnedByUserId = null;
      target.returnedByRole = null;
      target.returnedByName = null;
      target.returnedAt = null;
      if (!target.auditHistory) target.auditHistory = [];
      target.auditHistory.push({
        id: `aud-${Date.now()}`,
        action: `ارسال مجدد توسط متقاضی پس از اصلاح (نسخه ${target.version})${invalidatedPrior ? ' — به دلیل تغییر فیلدهای حساس، تأیید قبلی ابطال شد' : ''}`,
        changedBy: user?.name || 'متقاضی',
        changedAt: todayDate,
        newAmount: target.amount,
      });

      pushAppNotification(db, {
        eventType: 'REQUEST_RESUBMITTED',
        title: `ارسال مجدد دستور پرداخت (${target.trackingCode})`,
        body: `دستور پرداخت در وجه «${target.payeeName}» به مبلغ ${target.amount.toLocaleString('fa-IR')} ریال پس از اصلاح توسط ${user?.name || target.requesterName} (نسخه ${target.version}) مجدداً ارسال گردید.`,
        trackingCode: target.trackingCode,
        requestId: target.id,
        itemType: 'PAYMENT',
        recipientUserId: nextStatus === 'Pending_Accounting' ? null : target.supervisorId || null,
        recipientRole: nextStatus === 'Pending_Accounting' ? 'ACCOUNTING' : 'APPROVER',
        actorName: user?.name || target.requesterName,
        targetSection: nextStatus === 'Pending_Accounting' ? 'ACCOUNTING' : 'APPROVER',
      });
      saveDb(db);
      return res.json({ success: true, item: target, state: db });
    }

    if (itemType === 'ADVANCE') {
      const target = db.advanceRequests.find((a) => a.id === requestId);
      if (!target) return res.status(404).json({ error: 'مساعده یافت نشد' });

      const sensitiveChanged =
        (amount !== undefined && Number(amount) !== Number(target.amount)) ||
        (Array.isArray(newAttachments) && newAttachments.length > 0);

      const hadPriorSupApproval = Boolean(target.approvedBySupervisorUserId);
      const wasReturnedByAccounting = target.returnedByRole === 'ACCOUNTING';
      const invalidatedPrior = hadPriorSupApproval && sensitiveChanged;

      if (amount !== undefined) {
        target.amount = Number(amount);
        target.approvedAmount = Number(amount);
      }
      if (description !== undefined) target.reason = description;
      if (newAttachments) {
        target.attachments = [...(target.attachments || []), ...newAttachments];
      }

      if (invalidatedPrior) {
        target.approvedBySupervisorUserId = null;
        target.approvedBySupervisorName = null;
        target.approvedBySupervisorAt = null;
      }

      const nextStatus: RequestStatus =
        !target.supervisorId || (wasReturnedByAccounting && !sensitiveChanged && hadPriorSupApproval) ? 'Pending_Accounting' : 'Pending_Approver';

      target.status = nextStatus;
      target.version = (target.version || 1) + 1;
      target.isResubmitted = true;
      target.resubmittedAt = todayDate;
      target.invalidatedPriorApproval = invalidatedPrior;
      target.returnedReason = null;
      target.returnedByUserId = null;
      target.returnedByRole = null;
      target.returnedByName = null;
      target.returnedAt = null;
      if (!target.auditHistory) target.auditHistory = [];
      target.auditHistory.push({
        id: `aud-${Date.now()}`,
        action: `ارسال مجدد توسط متقاضی پس از اصلاح مدارک (نسخه ${target.version})${invalidatedPrior ? ' — به دلیل تغییر مبلغ/مدرک، تأیید قبلی ابطال شد' : ''}`,
        changedBy: user?.name || 'متقاضی',
        changedAt: todayDate,
        newAmount: target.amount,
      });

      pushAppNotification(db, {
        eventType: 'REQUEST_RESUBMITTED',
        title: `ارسال مجدد درخواست مساعده (${target.trackingCode})`,
        body: `درخواست مساعده ${target.requesterName} به مبلغ ${target.amount.toLocaleString('fa-IR')} ریال پس از اصلاح (نسخه ${target.version}) مجدداً به صف تایید ارسال شد.`,
        trackingCode: target.trackingCode,
        requestId: target.id,
        itemType: 'ADVANCE',
        recipientUserId: nextStatus === 'Pending_Accounting' ? null : target.supervisorId || null,
        recipientRole: nextStatus === 'Pending_Accounting' ? 'ACCOUNTING' : 'APPROVER',
        actorName: user?.name || target.requesterName,
        targetSection: nextStatus === 'Pending_Accounting' ? 'ACCOUNTING' : 'APPROVER',
      });
      saveDb(db);
      return res.json({ success: true, item: target, state: db });
    }

    return res.status(400).json({ error: 'نوع درخواست نامعتبر است' });
  });

  // 11. Legacy Approver & Accounting Review wrappers (backward compatibility)
  mutations.post('/api/approver/review', (req, res) => {
    const db = loadDb();
    const { requestType, requestId, action, approverId, note } = req.body;
    const approver = db.users.find((u) => u.id === approverId);

    if (requestType === 'ADVANCE') {
      const target = db.advanceRequests.find((r) => r.id === requestId);
      if (target) {
        if (target.requesterId === approverId && approver?.role !== 'ADMIN') {
          return res.status(400).json({ error: 'امکان تایید درخواست توسط شخص درخواست‌دهنده وجود ندارد' });
        }
        markReviewStarted(target);
        target.supervisorId = approverId;
        target.supervisorName = approver?.name || target.supervisorName;
        if (action === 'APPROVE') {
          target.status = 'Pending_Accounting';
          target.approverNote = note || 'تایید سرپرست/تاییدکننده مستقیم';
        } else {
          target.status = 'Needs_Revision';
          target.returnedReason = note || 'رد شده توسط سرپرست';
          target.returnedByRole = 'APPROVER';
          target.returnedByName = approver?.name || 'سرپرست';
        }
      }
    } else if (requestType === 'PAYMENT') {
      const target = db.paymentRequests.find((r) => r.id === requestId);
      if (target) {
        if (target.requesterId === approverId && approver?.role !== 'ADMIN') {
          return res.status(400).json({ error: 'امکان تایید درخواست توسط شخص درخواست‌دهنده وجود ندارد' });
        }
        markReviewStarted(target);
        target.supervisorId = approverId;
        target.supervisorName = approver?.name || target.supervisorName;
        if (action === 'APPROVE') {
          target.status = 'Pending_Accounting';
          target.approverNote = note || 'تایید سرپرست/تاییدکننده مستقیم';
        } else {
          target.status = 'Needs_Revision';
          target.returnedReason = note || 'رد شده توسط سرپرست';
          target.returnedByRole = 'APPROVER';
          target.returnedByName = approver?.name || 'سرپرست';
        }
      }
    } else if (requestType === 'BATCH') {
      const target = db.batchPayments.find((b) => b.id === requestId);
      if (target) {
        if (target.requesterId === approverId && approver?.role !== 'ADMIN') {
          return res.status(400).json({ error: 'امکان تایید درخواست توسط شخص درخواست‌دهنده وجود ندارد' });
        }
        target.supervisorId = approverId;
        target.supervisorName = approver?.name || target.supervisorName;
        if (action === 'APPROVE') {
          target.status = 'Pending_Accounting';
          target.approverNote = note || 'تایید کلیه ردیف‌های تجمیعی توسط تاییدکننده';
          target.items.forEach((it) => {
            if (it.status === 'Pending_Approver') {markReviewStarted(it);it.status = 'Pending_Accounting';}
          });
        } else {
          target.status = 'Needs_Revision';
          target.returnedReason = note || 'رد شده توسط سرپرست';
          target.items.forEach((it) => {
            if (it.status === 'Pending_Approver') {
              markReviewStarted(it);
              it.status = 'Needs_Revision';
              it.returnedReason = note || 'رد شده توسط سرپرست';
            }
          });
        }
        syncBatchStatus(target);
      }
    }

    saveDb(db);
    res.json({ success: true, state: db });
  });

  mutations.post('/api/accounting/review', (req, res) => {
    const db = loadDb();
    const {
      requestType,
      requestId,
      action,
      accountingId,
      hasPreviousAdvance,
      approvedAmount,
      accountingNote,
    } = req.body;

    const accUser = db.users.find((u) => u.id === accountingId);

    if (requestType === 'ADVANCE') {
      const target = db.advanceRequests.find((r) => r.id === requestId);
      if (target) {
        markReviewStarted(target);
        target.accountingId = accountingId;
        target.accountingName = accUser?.name || 'حسابداری';
        target.hasPreviousAdvance = Boolean(hasPreviousAdvance);
        target.approvedAmount =
          approvedAmount !== undefined && approvedAmount !== null ? Number(approvedAmount) : target.amount;
        target.accountingNote = accountingNote || 'کنترل حسابداری انجام شد.';
        target.status = action === 'APPROVE' ? 'Pending_Treasury' : 'Needs_Revision';
        if (action !== 'APPROVE') {
          target.returnedReason = accountingNote || 'رد حسابداری';
          target.returnedByRole = 'ACCOUNTING';
        }
      }
    } else if (requestType === 'PAYMENT') {
      const target = db.paymentRequests.find((r) => r.id === requestId);
      if (target) {
        markReviewStarted(target);
        target.accountingId = accountingId;
        target.accountingName = accUser?.name || 'حسابداری';
        target.accountingNote = accountingNote || 'اسناد بررسی و تایید شد.';
        target.status = action === 'APPROVE' ? 'Pending_Treasury' : 'Needs_Revision';
        if (action !== 'APPROVE') {
          target.returnedReason = accountingNote || 'رد حسابداری';
          target.returnedByRole = 'ACCOUNTING';
        }
      }
    } else if (requestType === 'BATCH') {
      const target = db.batchPayments.find((b) => b.id === requestId);
      if (target) {
        target.accountingNote = accountingNote || 'بررسی مالی لیست تجمیعی انجام شد.';
        target.status = action === 'APPROVE' ? 'Pending_Treasury' : 'Needs_Revision';
        target.items.forEach((it) => {
          if (it.status === 'Pending_Accounting') {
            markReviewStarted(it);
            it.status = action === 'APPROVE' ? 'Pending_Treasury' : 'Needs_Revision';
            if (action !== 'APPROVE') it.returnedReason = accountingNote || 'رد حسابداری';
          }
        });
        syncBatchStatus(target);
      }
    }

    saveDb(db);
    res.json({ success: true, state: db });
  });

  // 11b. Move Treasury Items Between Queue (Pending_Treasury) and In-Payment Pool (In_Payment)
  mutations.post('/api/treasury/move-pool', (req, res) => {
    const db = loadDb();
    const {
      items, // canonical targets validated by authorization
      targetPool, // 'IN_PAYMENT' | 'QUEUE'
      treasuryUserId,
      reason,
    } = req.body;

    const trsUser = db.users.find((u) => u.id === treasuryUserId);
    if (!trsUser || (trsUser.role !== 'TREASURY' && trsUser.role !== 'ADMIN')) {
      return res.status(403).json({ error: 'دسترسی غیرمجاز: فقط مسئول خزانه‌داری یا مدیر مجاز به جابجایی مخزن پرداخت است' });
    }

    const newStatus: RequestStatus = targetPool === 'IN_PAYMENT' ? 'In_Payment' : 'Pending_Treasury';
    const todayDate = `${getTodayJalali()} - ${new Date().toTimeString().slice(0, 5)}`;
    const actionLabel =
      targetPool === 'IN_PAYMENT'
        ? reason || 'انتقال از صف انتظار به مخزن در حال پرداخت (جهت اقدام و پرداخت)'
        : reason || 'بازگردانی از مخزن در حال پرداخت به صف انتظار خزانه';

    let movedCount = 0;

    for (const item of items || []) {
      if (item.type === 'ADVANCE') {
        const adv = db.advanceRequests.find((r) => r.id === item.id);
        if (adv && (adv.status === 'Pending_Treasury' || adv.status === 'In_Payment')) {
          adv.status = newStatus;
          adv.inPaymentAt = targetPool === 'IN_PAYMENT' ? todayDate : null;
          adv.inPaymentBy = targetPool === 'IN_PAYMENT' ? trsUser.name : null;
          if (!adv.auditHistory) adv.auditHistory = [];
          adv.auditHistory.push({
            id: `aud-${Date.now()}-${movedCount}`,
            action: actionLabel,
            changedBy: trsUser.name,
            changedAt: todayDate,
            newAmount: adv.approvedAmount ?? adv.amount,
          });
          movedCount++;
        }
      } else if (item.type === 'PAYMENT') {
        const pay = db.paymentRequests.find((r) => r.id === item.id);
        if (pay && (pay.status === 'Pending_Treasury' || pay.status === 'In_Payment')) {
          pay.status = newStatus;
          pay.inPaymentAt = targetPool === 'IN_PAYMENT' ? todayDate : null;
          pay.inPaymentBy = targetPool === 'IN_PAYMENT' ? trsUser.name : null;
          if (!pay.auditHistory) pay.auditHistory = [];
          pay.auditHistory.push({
            id: `aud-${Date.now()}-${movedCount}`,
            action: actionLabel,
            changedBy: trsUser.name,
            changedAt: todayDate,
            newAmount: pay.amount,
          });
          movedCount++;
        }
      } else if (item.type === 'BATCH') {
        const bat = db.batchPayments.find((b) => b.id === item.id);
        if (
          bat &&
          (bat.status === 'Pending_Treasury' ||
            bat.status === 'In_Payment' ||
            bat.items.some((it) => it.status === 'Pending_Treasury' || it.status === 'In_Payment'))
        ) {
          bat.status = newStatus;
          bat.inPaymentAt = targetPool === 'IN_PAYMENT' ? todayDate : null;
          bat.inPaymentBy = targetPool === 'IN_PAYMENT' ? trsUser.name : null;
          bat.items.forEach((it, idx) => {
            if (it.status === 'Pending_Treasury' || it.status === 'In_Payment' || !it.status) {
              it.status = newStatus;
              it.inPaymentAt = targetPool === 'IN_PAYMENT' ? todayDate : null;
              it.inPaymentBy = targetPool === 'IN_PAYMENT' ? trsUser.name : null;
              if (!it.auditHistory) it.auditHistory = [];
              it.auditHistory.push({
                id: `aud-${Date.now()}-${movedCount}-${idx}`,
                action: actionLabel,
                changedBy: trsUser.name,
                changedAt: todayDate,
                newAmount: it.approvedAmount ?? it.amount,
              });
            }
          });
          syncBatchStatus(bat);
          movedCount++;
        }
      } else if (item.type === 'BATCH_ITEM' && item.batchId) {
        const bat = db.batchPayments.find((b) => b.id === item.batchId);
        if (bat) {
          const row = bat.items.find((it) => it.id === item.id);
          if (row && (row.status === 'Pending_Treasury' || row.status === 'In_Payment')) {
            row.status = newStatus;
            row.inPaymentAt = targetPool === 'IN_PAYMENT' ? todayDate : null;
            row.inPaymentBy = targetPool === 'IN_PAYMENT' ? trsUser.name : null;
            if (!row.auditHistory) row.auditHistory = [];
            row.auditHistory.push({
              id: `aud-${Date.now()}-${movedCount}`,
              action: actionLabel,
              changedBy: trsUser.name,
              changedAt: todayDate,
              newAmount: row.approvedAmount ?? row.amount,
            });
            syncBatchStatus(bat);
            movedCount++;
          }
        }
      }
    }

    const committedState=saveDb(db);
    res.json({ success: true, movedCount, targetPool, state: committedState });
  });

  mutations.post('/api/treasury/execute-payment', (req, res) => {
    const dateError=normalizeFormDates(req.body,['dateJalali']);if(dateError)return res.status(400).json({error:dateError});
    const db: TreasuryDatabaseState = res.locals.commandDb;
    const {
      items, // array of { id: string, type: 'ADVANCE' | 'PAYMENT' | 'BATCH' | 'BATCH_ITEM', batchId?: string }
      sourceBankAccountId,
      bankRefNumber,
      dateJalali,
      treasuryUserId,
      receiptFileUrl,
      receiptFileName,
      partialAmount,
      paymentAmount,
      paymentMethod,
      idempotencyKey,
    } = req.body;

    const { user: sessionUser } = resolveSessionUser(req, db);
    const effectiveTreasuryUserId = sessionUser?.id || treasuryUserId;
    const trsUser = db.users.find((u) => u.id === effectiveTreasuryUserId);
    if (!trsUser || trsUser.isActive === false) {
      return res.status(401).json({ error: 'کاربر خزانه‌داری معتبر یا فعال نیست.' });
    }
    const trsAuth = computeEffectiveUserAuth(trsUser, db);
    if (!trsAuth.effectivePermissions.canExecutePayment) {
      return res.status(403).json({ error: 'شما مجوز ثبت و اجرای پرداخت در خزانه‌داری را ندارید.' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'هیچ ردیفی برای ثبت پرداخت انتخاب نشده است.' });
    }

    const cleanSourceId = String(sourceBankAccountId || '').trim();
    if (!cleanSourceId) {
      return res.status(400).json({
        error: 'انتخاب حساب بانکی مبدأ از فهرست حساب‌های تعریف‌شده شرکت الزامی است. تایپ آزاد نام بانک مجاز نیست.',
      });
    }
    const sourceAccount = (db.companyBankAccounts || []).find((a) => a.id === cleanSourceId);
    if (!sourceAccount) {
      return res.status(400).json({ error: 'حساب بانکی مبدأ انتخاب‌شده در فهرست حساب‌های شرکت یافت نشد.' });
    }
    if (sourceAccount.status === 'INACTIVE' || sourceAccount.isActive === false) {
      return res.status(400).json({
        error: 'حساب بانکی مبدأ انتخاب‌شده غیرفعال است و امکان ثبت پرداخت جدید با آن وجود ندارد.',
      });
    }

    // Idempotency check against duplicate payment execution
    if (idempotencyKey) {
      const cleanIdemp = String(idempotencyKey).trim();
      const hasDupInAdvances = db.advanceRequests.some((a) =>
        (a.paymentHistory || a.paymentExecutions || []).some((ph) => ph.idempotencyKey === cleanIdemp)
      );
      const hasDupInPayments = db.paymentRequests.some((p) =>
        (p.paymentHistory || p.paymentExecutions || []).some((ph) => ph.idempotencyKey === cleanIdemp)
      );
      const hasDupInBatches = db.batchPayments.some((b) =>
        b.items.some((it) =>
          (it.paymentHistory || it.paymentExecutions || []).some((ph) => ph.idempotencyKey === cleanIdemp)
        )
      );
      if (hasDupInAdvances || hasDupInPayments || hasDupInBatches) {
        return res.status(409).json({
          error: 'این تراکنش پرداخت قبلاً با همین کلید یکتا ثبت شده است (جلوگیری از ثبت تکراری همزمان).',
        });
      }
    }

    const sourceAccountSnapshot = buildSourceAccountSnapshot(sourceAccount);
    const bankName = formatSourceAccountDisplay(sourceAccount);
    const executionDate = dateJalali || getTodayJalali();
    const nowIso = new Date().toISOString();
    const todayDateTime = `${executionDate} - ${new Date().toTimeString().slice(0, 5)}`;

    const parsedPayment=treasuryInput(req.body,db,true);
    if(parsedPayment.error)return res.status(400).json({error:parsedPayment.error});
    const requestedPartial=parsedPayment.partial;

    if (items.length > 1 && requestedPartial !== undefined) {
      return res.status(400).json({
        error: 'پرداخت جزئی فقط برای تسویه تکی یک ردیف مجاز است؛ در تسویه گروهی کل مانده هر ردیف پرداخت می‌شود.',
      });
    }

    // Pre-calculate total amount and validate remaining payable to prevent overpayment or duplicate concurrent payment
    let estimatedTotal = 0;
    for (const item of items) {
      if (item.type === 'BATCH_ITEM' && item.batchId) {
        const batch = db.batchPayments.find((b) => b.id === item.batchId);
        const row = batch?.items.find((it) => it.id === item.id);
        if (!row) return res.status(404).json({ error: 'ردیف انتخابی در گروه یافت نشد.' });
        if (row.status === 'Paid') {
          return res.status(400).json({ error: `ردیف «${row.payeeName}» قبلاً تسویه شده است (جلوگیری از پرداخت تکراری).` });
        }
        const totalApproved = row.approvedAmount ?? row.amount;
        const alreadyPaid = row.paidAmountSoFar ?? row.paidAmount ?? 0;
        const rem = Math.max(0, totalApproved - alreadyPaid);
        const payNow = requestedPartial !== undefined ? requestedPartial : rem;
        if (!validPaymentAllocation(totalApproved,alreadyPaid,payNow)) {
          return res.status(400).json({
            error: `مبلغ پرداخت (${payNow.toLocaleString('fa-IR')} ریال) نامعتبر است یا از مانده قابل پرداخت ردیف (${rem.toLocaleString('fa-IR')} ریال) بیشتر است.`,
          });
        }
        estimatedTotal += payNow;
      } else if (item.type === 'ADVANCE') {
        const adv = db.advanceRequests.find((r) => r.id === item.id);
        if (!adv) return res.status(404).json({ error: 'درخواست مساعده یافت نشد.' });
        if (adv.status === 'Paid') {
          return res.status(400).json({ error: `مساعده «${adv.trackingCode}» قبلاً تسویه شده است (جلوگیری از پرداخت تکراری).` });
        }
        const totalApproved = adv.approvedAmount ?? adv.amount;
        const alreadyPaid = adv.paidAmountSoFar ?? adv.paidAmount ?? 0;
        const rem = Math.max(0, totalApproved - alreadyPaid);
        const payNow = requestedPartial !== undefined ? requestedPartial : rem;
        if (!validPaymentAllocation(totalApproved,alreadyPaid,payNow)) {
          return res.status(400).json({
            error: `مبلغ پرداخت (${payNow.toLocaleString('fa-IR')} ریال) بیش از مانده قابل پرداخت (${rem.toLocaleString('fa-IR')} ریال) است.`,
          });
        }
        estimatedTotal += payNow;
      } else if (item.type === 'PAYMENT') {
        const pay = db.paymentRequests.find((r) => r.id === item.id);
        if (!pay) return res.status(404).json({ error: 'دستور پرداخت یافت نشد.' });
        if (pay.status === 'Paid') {
          return res.status(400).json({ error: `دستور پرداخت «${pay.trackingCode}» قبلاً تسویه شده است (جلوگیری از پرداخت تکراری).` });
        }
        const totalApproved = pay.amount;
        const alreadyPaid = pay.paidAmountSoFar ?? pay.paidAmount ?? 0;
        const rem = Math.max(0, totalApproved - alreadyPaid);
        const payNow = requestedPartial !== undefined ? requestedPartial : rem;
        if (!validPaymentAllocation(totalApproved,alreadyPaid,payNow)) {
          return res.status(400).json({
            error: `مبلغ پرداخت (${payNow.toLocaleString('fa-IR')} ریال) بیش از مانده قابل پرداخت (${rem.toLocaleString('fa-IR')} ریال) است.`,
          });
        }
        estimatedTotal += payNow;
      }
    }

    if (!Number.isSafeInteger(estimatedTotal)||estimatedTotal<=0) return res.status(400).json({error:'جمع مانده پرداخت معتبر نیست.'});
    if (trsAuth.effectivePaymentLimitRial > 0 && estimatedTotal > trsAuth.effectivePaymentLimitRial) {
      return res.status(403).json({
        error: `جمع مبلغ انتخابی جهت پرداخت (${estimatedTotal.toLocaleString('fa-IR')} ریال) بیش از سقف مجاز اجرای پرداخت شما (${trsAuth.effectivePaymentLimitRial.toLocaleString('fa-IR')} ریال) است.`,
      });
    }

    let totalPaidAmount = 0;
    const relatedIds: string[] = [];
    const relatedCodes: string[] = [];
    const payeeNames: string[] = [];
    const modifiedBatches = new Set<BatchPaymentRequest>();

    const refNo = normalizeDigitsServer(bankRefNumber || '') || `${Math.floor(1000000000 + Math.random() * 9000000000)}`;
    const receiptId = `rcp-${Date.now()}`;
    const cleanIdempKey = idempotencyKey ? String(idempotencyKey).trim() : `idemp-${Date.now()}`;

    for (const item of items) {
      if (item.type === 'BATCH_ITEM' && item.batchId) {
        const batch = db.batchPayments.find((b) => b.id === item.batchId);
        if (batch) {
          const row = batch.items.find((it) => it.id === item.id);
          if (
            row &&
            (row.status === 'Pending_Treasury' ||
              row.status === 'In_Payment')
          ) {
            const totalApproved = row.approvedAmount ?? row.amount;
            const alreadyPaid = row.paidAmountSoFar ?? row.paidAmount ?? 0;
            const remBefore = Math.max(0, totalApproved - alreadyPaid);
            const payNow = requestedPartial !== undefined ? requestedPartial : remBefore;
            const newPaid = alreadyPaid + payNow;
            const newRem = Math.max(0, totalApproved - newPaid);
            const isFullyPaid = newRem === 0;

            const execRec: PaymentExecutionRecord = {
              id: `pex-${Date.now()}-${row.id}`,
              idempotencyKey: cleanIdempKey,
              amount: payNow,
              paymentMethod: paymentMethod || 'PAYA',
              paidAt: nowIso,
              executedAt: nowIso,
              paidDateJalali: executionDate,
              executedDateJalali: executionDate,
              bankRefNumber: refNo,
              receiptId,
              treasuryUserId: trsUser.id,
              treasuryUserName: trsUser.name,
              executedByUserId: trsUser.id,
              executedByUserName: trsUser.name,
              sourceBankAccountId: sourceAccount.id,
              sourceAccountSnapshot,
            };

            row.paidAmount = newPaid;
            row.paidAmountSoFar = newPaid;
            row.remainingAmount = newRem;
            row.remainingPayableAmount = newRem;
            const updatedHist = [...(row.paymentHistory || row.paymentExecutions || []), execRec];
            row.paymentExecutions = updatedHist;
            row.paymentHistory = updatedHist;
            row.sourceBankAccountId = sourceAccount.id;
            row.sourceAccountSnapshot = sourceAccountSnapshot;
            row.paidBankName = bankName;
            row.paidAt = nowIso;
            row.paidDateJalali = executionDate;
            row.receiptId = receiptId;
            if (isFullyPaid) {
              row.status = 'Paid';
            }
            if (!row.auditHistory) row.auditHistory = [];
            row.auditHistory.push({
              id: `aud-${Date.now()}-${row.id}`,
              action: `${isFullyPaid ? 'ثبت پرداخت قطعی و تسویه کامل' : `ثبت پرداخت جزئی (${payNow.toLocaleString('fa-IR')} ریال — مانده: ${newRem.toLocaleString('fa-IR')} ریال)`} از حساب مبدأ «${bankName}» (شماره مرجع: ${refNo})`,
              changedBy: trsUser?.name || 'خزانه‌داری',
              changedAt: todayDateTime,
              newAmount: payNow,
            });
            totalPaidAmount += payNow;
            relatedIds.push(row.id);
            relatedCodes.push(`${batch.trackingCode}-${row.id.slice(-4)}`);
            payeeNames.push(row.payeeName);
            modifiedBatches.add(batch);
          }
        }
      } else if (item.type === 'ADVANCE') {
        const adv = db.advanceRequests.find((r) => r.id === item.id);
        if (adv && (adv.status === 'Pending_Treasury' || adv.status === 'In_Payment')) {
          const totalApproved = adv.approvedAmount ?? adv.amount;
          const alreadyPaid = adv.paidAmountSoFar ?? adv.paidAmount ?? 0;
          const remBefore = Math.max(0, totalApproved - alreadyPaid);
          const payNow = requestedPartial !== undefined ? requestedPartial : remBefore;
          const newPaid = alreadyPaid + payNow;
          const newRem = Math.max(0, totalApproved - newPaid);
          const isFullyPaid = newRem === 0;

          const execRec: PaymentExecutionRecord = {
            id: `pex-${Date.now()}-${adv.id}`,
            idempotencyKey: cleanIdempKey,
            amount: payNow,
            paymentMethod: paymentMethod || 'PAYA',
            paidAt: nowIso,
            executedAt: nowIso,
            paidDateJalali: executionDate,
            executedDateJalali: executionDate,
            bankRefNumber: refNo,
            receiptId,
            treasuryUserId: trsUser.id,
            treasuryUserName: trsUser.name,
            executedByUserId: trsUser.id,
            executedByUserName: trsUser.name,
            sourceBankAccountId: sourceAccount.id,
            sourceAccountSnapshot,
          };

          adv.paidAmount = newPaid;
          adv.paidAmountSoFar = newPaid;
          adv.remainingAmount = newRem;
          adv.remainingPayableAmount = newRem;
          const updatedHist = [...(adv.paymentHistory || adv.paymentExecutions || []), execRec];
          adv.paymentExecutions = updatedHist;
          adv.paymentHistory = updatedHist;
          adv.treasuryId = trsUser?.id || null;
          adv.treasuryName = trsUser?.name || null;
          adv.sourceBankAccountId = sourceAccount.id;
          adv.sourceAccountSnapshot = sourceAccountSnapshot;
          adv.paidBankName = bankName;
          adv.paidAt = nowIso;
          adv.paidDateJalali = executionDate;
          adv.receiptId = receiptId;
          if (isFullyPaid) {
            adv.status = 'Paid';
          }
          if (!adv.auditHistory) adv.auditHistory = [];
          adv.auditHistory.push({
            id: `aud-${Date.now()}-${adv.id}`,
            action: `${isFullyPaid ? 'ثبت پرداخت قطعی و تسویه کامل' : `ثبت پرداخت جزئی (${payNow.toLocaleString('fa-IR')} ریال — مانده: ${newRem.toLocaleString('fa-IR')} ریال)`} از حساب مبدأ «${bankName}» (شماره مرجع: ${refNo})`,
            changedBy: trsUser?.name || 'خزانه‌داری',
            changedAt: todayDateTime,
            newAmount: payNow,
          });
          totalPaidAmount += payNow;
          relatedIds.push(adv.id);
          relatedCodes.push(adv.trackingCode);
          payeeNames.push(adv.requesterName);
        }
      } else if (item.type === 'PAYMENT') {
        const pay = db.paymentRequests.find((r) => r.id === item.id);
        if (pay && (pay.status === 'Pending_Treasury' || pay.status === 'In_Payment')) {
          const totalApproved = pay.amount;
          const alreadyPaid = pay.paidAmountSoFar ?? pay.paidAmount ?? 0;
          const remBefore = Math.max(0, totalApproved - alreadyPaid);
          const payNow = requestedPartial !== undefined ? requestedPartial : remBefore;
          const newPaid = alreadyPaid + payNow;
          const newRem = Math.max(0, totalApproved - newPaid);
          const isFullyPaid = newRem === 0;

          const execRec: PaymentExecutionRecord = {
            id: `pex-${Date.now()}-${pay.id}`,
            idempotencyKey: cleanIdempKey,
            amount: payNow,
            paymentMethod: paymentMethod || 'PAYA',
            paidAt: nowIso,
            executedAt: nowIso,
            paidDateJalali: executionDate,
            executedDateJalali: executionDate,
            bankRefNumber: refNo,
            receiptId,
            treasuryUserId: trsUser.id,
            treasuryUserName: trsUser.name,
            executedByUserId: trsUser.id,
            executedByUserName: trsUser.name,
            sourceBankAccountId: sourceAccount.id,
            sourceAccountSnapshot,
          };

          pay.paidAmount = newPaid;
          pay.paidAmountSoFar = newPaid;
          pay.remainingAmount = newRem;
          pay.remainingPayableAmount = newRem;
          const updatedHist = [...(pay.paymentHistory || pay.paymentExecutions || []), execRec];
          pay.paymentExecutions = updatedHist;
          pay.paymentHistory = updatedHist;
          pay.treasuryId = trsUser?.id || null;
          pay.treasuryName = trsUser?.name || null;
          pay.sourceBankAccountId = sourceAccount.id;
          pay.sourceAccountSnapshot = sourceAccountSnapshot;
          pay.paidBankName = bankName;
          pay.paidAt = nowIso;
          pay.paidDateJalali = executionDate;
          pay.receiptId = receiptId;
          if (isFullyPaid) {
            pay.status = 'Paid';
          }
          if (!pay.auditHistory) pay.auditHistory = [];
          pay.auditHistory.push({
            id: `aud-${Date.now()}-${pay.id}`,
            action: `${isFullyPaid ? 'ثبت پرداخت قطعی و تسویه کامل' : `ثبت پرداخت جزئی (${payNow.toLocaleString('fa-IR')} ریال — مانده: ${newRem.toLocaleString('fa-IR')} ریال)`} از حساب مبدأ «${bankName}» (شماره مرجع: ${refNo})`,
            changedBy: trsUser?.name || 'خزانه‌داری',
            changedAt: todayDateTime,
            newAmount: payNow,
          });
          totalPaidAmount += payNow;
          relatedIds.push(pay.id);
          relatedCodes.push(pay.trackingCode);
          payeeNames.push(pay.payeeName);
        }
      }
    }

    modifiedBatches.forEach((b) => syncBatchStatus(b));

    const generatedUrl =
      receiptFileUrl ||
      createSampleReceiptSvgDataUrl(
        refNo,
        totalPaidAmount,
        payeeNames.join('، ') || 'پرداخت خزانه',
        bankName,
        executionDate
      );

    const newReceipt: ReceiptArchive = {
      id: receiptId,
      fileUrl: generatedUrl,
      fileName: receiptFileName || `receipt_${refNo}.svg`,
      bankRefNumber: refNo,
      paymentType: (items?.length || 0) > 1 ? 'BATCH' : items?.[0]?.type === 'BATCH_ITEM' ? 'BATCH' : items?.[0]?.type || 'PAYMENT',
      relatedPaymentIds: relatedIds,
      relatedTrackingCodes: relatedCodes,
      amount: totalPaidAmount,
      bankName,
      sourceBankAccountId: sourceAccount.id,
      sourceAccountSnapshot,
      uploadedBy: trsUser?.name || 'خزانه‌داری',
      uploadedAt: `${executionDate} - ${new Date().toTimeString().slice(0, 5)}`,
      dateJalali: executionDate,
    };

    db.receiptArchives.unshift(newReceipt);
    for(const notice of paymentNotificationDrafts(db,newReceipt,trsUser.name))pushAppNotification(db,notice);
    const committedState=saveDb(db);
    res.json({ ok: true, success: true, receipt: newReceipt, state: sanitizeDbForClient(committedState) });
  });

  // 11. Treasury Manual / Phone Payments
  mutations.post('/api/treasury/manual-payment', (req, res) => {
    const inputError=externalInputError(req.body,true);if(inputError)return res.status(400).json({error:inputError});
    const dateError=normalizeFormDates(req.body,['date']);if(dateError)return res.status(400).json({error:dateError});
    const db = loadDb();
    const {
      amount,
      payee,
      description,
      sourceBankAccountId,
      date,
      orderedBy,
      createdById,
      bankRefNumber,
      receiptFileUrl,
      receiptFileName,
    } = req.body;

    const { user: sessionUser } = resolveSessionUser(req, db);
    const trsUser = sessionUser!;
    const operation=entryOperation(req.body,true,trsUser),previous=previousEntry(db,operation,true,trsUser);
    if(previous.error)return res.status(previous.status!).json({error:previous.error});
    if(previous.row){if(!companyPolicy(trsUser,db).manual(previous.row as ManualPayment))return res.status(403).json({error:'دسترسی به نتیجه این ثبت مجاز نیست.'});return res.json({ok:true,success:true,manualPayment:previous.row,state:db});}
    const cleanSourceId = String(sourceBankAccountId || '').trim();
    if (!cleanSourceId) {
      return res.status(400).json({
        error: 'انتخاب حساب بانکی مبدأ از فهرست حساب‌های تعریف‌شده شرکت الزامی است.',
      });
    }
    const sourceAccount = (db.companyBankAccounts || []).find((a) => a.id === cleanSourceId);
    if (!sourceAccount) {
      return res.status(400).json({ error: 'حساب بانکی مبدأ انتخاب‌شده یافت نشد.' });
    }
    if (sourceAccount.status === 'INACTIVE' || sourceAccount.isActive === false) {
      return res.status(400).json({ error: 'حساب بانکی مبدأ انتخاب‌شده غیرفعال است.' });
    }

    const sourceAccountSnapshot = buildSourceAccountSnapshot(sourceAccount);
    const chosenBank = formatSourceAccountDisplay(sourceAccount);
    const nextNum = 301 + db.manualPayments.length;
    const payDate = date || getTodayJalali();
    const numericAmount = Number(amount) || 0;

    const registrationAt = new Date();
    const newManual: ManualPayment = {
      entryOperation:operation,
      createdAtIso: registrationAt.toISOString(),
      id: `man-${Date.now()}`,
      trackingCode: `MAN-${getTodayJalali().slice(0,4)}-${nextNum}`,
      amount: numericAmount,
      payee: payee || '',
      description: description || '',
      bankName: chosenBank,
      sourceBankAccountId: sourceAccount.id,
      sourceAccountSnapshot,
      date: payDate,
      orderedBy: orderedBy || 'دستور تلفنی مدیریت',
      createdById: trsUser?.id || 'usr-trs-1',
      createdByName: trsUser?.name || 'کیوان فرهمند (مسئول خزانه‌داری)',
      dailyCoverId: null,
      createdAt: `${payDate} - ${new Date().toTimeString().slice(0, 5)}`,
    };

    db.manualPayments.unshift(newManual);

    const refNo = normalizeDigitsServer(bankRefNumber || '') || `${Math.floor(1000000000 + Math.random() * 9000000000)}`;
    const newReceipt: ReceiptArchive = {
      id: `rcp-${Date.now()}`,
      fileUrl:receiptFileUrl,
      fileName: receiptFileName,
      bankRefNumber: refNo,
      paymentType: 'MANUAL',
      relatedPaymentIds: [newManual.id],
      relatedTrackingCodes: [newManual.trackingCode],
      amount: numericAmount,
      bankName: chosenBank,
      sourceBankAccountId: sourceAccount.id,
      sourceAccountSnapshot,
      uploadedBy: trsUser?.name || 'خزانه‌داری',
      uploadedAt: newManual.createdAt,
      dateJalali: payDate,
    };

    db.receiptArchives.unshift(newReceipt);
    saveDb(db);
    res.json({ ok: true, success: true, manualPayment: newManual, state: sanitizeDbForClient(db) });
  });

  // 11c. Company Source Bank Accounts Management (Create / Edit / Toggle Status / Set Default)
  for(const operation of ['import-preview','import'])mutations.post('/api/treasury/bank-accounts/'+operation,(req,res)=>{
    const db=loadDb(),{user}=resolveSessionUser(req,db);
    if(!user)return res.status(401).json({error:'نشست معتبر لازم است.'});
    const body=req.body||{},allowed=['rows','actorId','actorUserId','treasuryUserId',...(operation==='import'?['previewToken']:[])];
    if(Object.keys(body).some(key=>!allowed.includes(key)))return res.status(400).json({error:'فیلد ناشناخته در ورود گروهی وجود دارد.'});
    const shapeError=bankImportShapeError(body.rows);if(shapeError)return res.status(400).json({error:shapeError});
    const rows=body.rows as BankImportInput[],accounts=db.companyBankAccounts||[],report=assessBankImport(rows,accounts);
    // Optimistic review fingerprint, not an authorization token. Admission is checked on every queued turn.
    const previewToken=crypto.createHash('sha256').update(JSON.stringify({actor:user.id,accounts,report})).digest('hex');
    if(operation==='import-preview')return res.json({ok:true,report,previewToken});
    if(typeof body.previewToken!=='string'||body.previewToken!==previewToken)return res.status(409).json({error:'فایل یا حساب‌ها پس از بازبینی تغییر کرده‌اند؛ دوباره بازبینی کنید.'});
    if(report.errorCount)return res.status(400).json({error:'تا اصلاح همه ردیف‌های خطادار، هیچ حسابی ثبت نمی‌شود.',report});
    const now=getTodayJalali(),created:CompanyBankAccount[]=report.rows.filter(row=>row.status==='NEW').map(row=>({...row.account!,id:'cba-'+crypto.randomUUID(),createdAt:now,createdBy:user.id,updatedAt:now,updatedBy:user.id}));
    if(created.length){
      db.companyBankAccounts=[...accounts,...created];
      pushSecurityAuditLog(db,{actionType:'MASTER_DATA_CHANGED',actorId:user.id,actorName:user.name,description:`ورود گروهی حساب‌ها: ${created.length} جدید، ${report.duplicateCount} تکراری بدون تغییر`});
      saveDb(db);
    }
    return res.json({ok:true,createdCount:created.length,skippedCount:report.duplicateCount,report,state:sanitizeDbForClient(db)});
  });

  mutations.post('/api/treasury/bank-accounts/save', (req, res) => {
    const db = loadDb();
    const { user: sessionUser } = resolveSessionUser(req, db);
    const { actorId, actorUserId, account } = req.body || {};
    const effectiveActorId = sessionUser?.id || actorId || actorUserId;
    const actor = db.users.find((u) => u.id === effectiveActorId);
    if (!actor || actor.isActive === false) {
      return res.status(401).json({ error: 'کاربر معتبر نیست.' });
    }
    const actorAuth = computeEffectiveUserAuth(actor, db);
    if (
      actor.role !== 'TREASURY' &&
      actor.role !== 'ACCOUNTING' &&
      actor.role !== 'ADMIN' &&
      !actorAuth.effectivePermissions.canExecutePayment &&
      !actorAuth.effectivePermissions.canManageUsers
    ) {
      return res.status(403).json({ error: 'شما مجوز تعریف یا ویرایش حساب‌های بانکی مبدأ شرکت را ندارید.' });
    }

    const bankError=bankFieldsError(account || req.body || {});if(bankError)return res.status(400).json({error:bankError});
    const payload = normalizedBankFields(account || req.body || {});
    const id = payload.id ? String(payload.id).trim() : '';
    const bankName = String(payload.bankName || '').trim();
    const accountTitle = String(payload.accountTitle || '').trim();
    const companyName = String(payload.companyName || payload.company || 'هلدینگ مرکزی آریا').trim();
    const accountHolderName = String(payload.accountHolderName || companyName).trim();
    const accountNumber = normalizeDigitsServer(payload.accountNumber || '').trim();
    const rawIban = normalizeDigitsServer(payload.iban || '')
      .replace(/[\s-]/g, '')
      .toUpperCase();
    const ibanDigits = rawIban.replace(/^IR/i, '');
    const formattedIban = ibanDigits ? `IR${ibanDigits}` : '';
    const cardNumber = normalizeDigitsServer(payload.cardNumber || '').replace(/[\s-]/g, '');
    const branchName = String(payload.branchName || '').trim() || undefined;
    const branchCode = normalizeDigitsServer(payload.branchCode || '').trim() || undefined;
    const accountType = String(payload.accountType || 'جاری').trim();
    const currency = 'IRR' as const;
    const allowedPaymentMethods: PaymentMethodType[] =
      Array.isArray(payload.allowedPaymentMethods) && payload.allowedPaymentMethods.length > 0
        ? payload.allowedPaymentMethods
        : Array.isArray(payload.supportedMethods) && payload.supportedMethods.length > 0
        ? payload.supportedMethods
        : ['PAYA', 'SATNA', 'CARD'];
    const isActive =
      payload.isActive !== undefined
        ? Boolean(payload.isActive)
        : payload.status !== 'INACTIVE';
    const status: 'ACTIVE' | 'INACTIVE' = isActive ? 'ACTIVE' : 'INACTIVE';
    const isDefault = Boolean(payload.isDefault) && isActive;
    const description = String(payload.description || '').trim() || undefined;

    if (!bankName || !accountTitle || !accountNumber) {
      return res.status(400).json({ error: 'نام بانک، عنوان حساب و شماره حساب مبدأ الزامی هستند.' });
    }
    if (!/^\d{5,26}$/.test(accountNumber)) {
      return res.status(400).json({
        error: 'شماره حساب باید فقط شامل ارقام معتبر (حداقل ۵ رقم، با حفظ صفر ابتدایی) باشد.',
      });
    }
    if (ibanDigits && !/^\d{24}$/.test(ibanDigits)) {
      return res.status(400).json({ error: 'شماره شبا باید دقیقاً ۲۴ رقم (یا IR همراه با ۲۴ رقم) باشد.' });
    }
    if (cardNumber && !/^\d{16}$/.test(cardNumber)) {
      return res.status(400).json({ error: 'شماره کارت بانکی باید دقیقاً ۱۶ رقم باشد.' });
    }

    const accounts = db.companyBankAccounts || [];
    const duplicateAcc = accounts.find(
      (a) => a.id !== id && a.accountNumber === accountNumber && bankAccountBankName(a.bankName) === bankAccountBankName(bankName)
    );
    if (duplicateAcc) {
      return res.status(400).json({
        error: 'شناسه حساب بانکی با حساب ثبت‌شده تعارض دارد؛ حساب قبلی تغییر نمی‌کند.',
      });
    }
    if (formattedIban) {
      const duplicateIban = accounts.find(
        (a) =>
          a.id !== id &&
          a.iban &&
          a.iban.toUpperCase().replace(/^IR/i, '') === ibanDigits
      );
      if (duplicateIban) {
        return res.status(400).json({
          error: 'شناسه شبا با حساب ثبت‌شده تعارض دارد؛ حساب قبلی تغییر نمی‌کند.',
        });
      }
    }
    if (cardNumber) {
      const duplicateCard = accounts.find((a) => a.id !== id && a.cardNumber && a.cardNumber === cardNumber);
      if (duplicateCard) {
        return res.status(400).json({
          error: 'شناسه کارت با حساب ثبت‌شده تعارض دارد؛ حساب قبلی تغییر نمی‌کند.',
        });
      }
    }

    const todayDate = getTodayJalali();
    if (isDefault) {
      for (const acc of accounts) {
        acc.isDefault = false;
      }
    }

    let savedAccount: CompanyBankAccount;
    if (id) {
      const existingIdx = accounts.findIndex((a) => a.id === id);
      if (existingIdx === -1) {
        return res.status(404).json({ error: 'حساب بانکی مورد نظر برای ویرایش یافت نشد.' });
      }
      savedAccount = {
        ...accounts[existingIdx],
        bankName,
        accountTitle,
        company: companyName,
        companyName,
        accountHolderName,
        accountNumber,
        iban: formattedIban || undefined,
        cardNumber: cardNumber || undefined,
        branchName,
        branchCode,
        accountType,
        currency,
        supportedMethods: allowedPaymentMethods,
        allowedPaymentMethods,
        status,
        isActive,
        isDefault: !isActive ? false : isDefault,
        description,
        updatedAt: todayDate,
      };
      accounts[existingIdx] = savedAccount;
    } else {
      savedAccount = {
        id: `cba-${Date.now()}`,
        company: companyName,
        companyName,
        bankName,
        accountTitle,
        accountHolderName,
        accountNumber,
        iban: formattedIban || undefined,
        cardNumber: cardNumber || undefined,
        branchName,
        branchCode,
        accountType,
        currency,
        supportedMethods: allowedPaymentMethods,
        allowedPaymentMethods,
        status,
        isActive,
        isDefault,
        description,
        createdAt: todayDate,
        updatedAt: todayDate,
      };
      accounts.push(savedAccount);
    }

    if (!accounts.some((a) => a.isDefault && a.isActive !== false && a.status !== 'INACTIVE')) {
      const firstActive = accounts.find((a) => a.isActive !== false && a.status !== 'INACTIVE');
      if (firstActive) firstActive.isDefault = true;
    }

    db.companyBankAccounts = accounts;
    saveDb(db);
    return res.json({
      ok: true,
      success: true,
      account: savedAccount,
      companyBankAccounts: db.companyBankAccounts,
      state: sanitizeDbForClient(db),
    });
  });

  mutations.post('/api/treasury/bank-accounts/toggle-status', (req, res) => {
    const db = loadDb();
    const { user: sessionUser } = resolveSessionUser(req, db);
    const { actorId, actorUserId, accountId, isActive: requestedIsActive } = req.body || {};
    const effectiveActorId = sessionUser?.id || actorId || actorUserId;
    const actor = db.users.find((u) => u.id === effectiveActorId);
    if (!actor || actor.isActive === false) {
      return res.status(401).json({ error: 'کاربر معتبر نیست.' });
    }
    const actorAuth = computeEffectiveUserAuth(actor, db);
    if (
      actor.role !== 'TREASURY' &&
      actor.role !== 'ACCOUNTING' &&
      actor.role !== 'ADMIN' &&
      !actorAuth.effectivePermissions.canExecutePayment &&
      !actorAuth.effectivePermissions.canManageUsers
    ) {
      return res.status(403).json({ error: 'شما مجوز تغییر وضعیت حساب‌های بانکی شرکت را ندارید.' });
    }

    const accounts = db.companyBankAccounts || [];
    const target = accounts.find((a) => a.id === accountId);
    if (!target) {
      return res.status(404).json({ error: 'حساب بانکی مورد نظر یافت نشد.' });
    }

    const nextActive =
      requestedIsActive !== undefined ? Boolean(requestedIsActive) : target.status === 'INACTIVE' || target.isActive === false;
    target.isActive = nextActive;
    target.status = nextActive ? 'ACTIVE' : 'INACTIVE';
    if (!nextActive) {
      target.isDefault = false;
    }
    target.updatedAt = getTodayJalali();

    if (!accounts.some((a) => a.isDefault && a.isActive !== false && a.status !== 'INACTIVE')) {
      const firstActive = accounts.find((a) => a.isActive !== false && a.status !== 'INACTIVE');
      if (firstActive) firstActive.isDefault = true;
    }

    db.companyBankAccounts = accounts;
    saveDb(db);
    return res.json({
      ok: true,
      success: true,
      account: target,
      companyBankAccounts: db.companyBankAccounts,
      state: sanitizeDbForClient(db),
    });
  });

  mutations.post('/api/treasury/bank-accounts/set-default', (req, res) => {
    const db = loadDb();
    const { user: sessionUser } = resolveSessionUser(req, db);
    const { actorId, actorUserId, accountId } = req.body || {};
    const effectiveActorId = sessionUser?.id || actorId || actorUserId;
    const actor = db.users.find((u) => u.id === effectiveActorId);
    if (!actor || actor.isActive === false) {
      return res.status(401).json({ error: 'کاربر معتبر نیست.' });
    }
    const actorAuth = computeEffectiveUserAuth(actor, db);
    if (
      actor.role !== 'TREASURY' &&
      actor.role !== 'ACCOUNTING' &&
      actor.role !== 'ADMIN' &&
      !actorAuth.effectivePermissions.canExecutePayment &&
      !actorAuth.effectivePermissions.canManageUsers
    ) {
      return res.status(403).json({ error: 'شما مجوز تغییر حساب پیش‌فرض خزانه را ندارید.' });
    }

    const accounts = db.companyBankAccounts || [];
    const target = accounts.find((a) => a.id === accountId);
    if (!target) {
      return res.status(404).json({ error: 'حساب بانکی مورد نظر یافت نشد.' });
    }
    if (target.status === 'INACTIVE' || target.isActive === false) {
      return res.status(400).json({ error: 'حساب غیرفعال را نمی‌توان به عنوان حساب پیش‌فرض انتخاب کرد.' });
    }

    for (const acc of accounts) {
      acc.isDefault = acc.id === target.id;
      if (acc.id === target.id) acc.updatedAt = getTodayJalali();
    }

    db.companyBankAccounts = accounts;
    saveDb(db);
    return res.json({
      ok: true,
      success: true,
      companyBankAccounts: db.companyBankAccounts,
      state: sanitizeDbForClient(db),
    });
  });

  // 12. Close Daily Cover (NO BANK BALANCES - purely totals in/out)
  mutations.post('/api/treasury/daily-cover', (req, res) => {
    const dateError=normalizeFormDates(req.body,['date']);if(dateError)return res.status(400).json({error:dateError});
    const db = loadDb();
    const { date, bankName, totalIn, bankFee, note, closedByUserId } = req.body;

    const trsUser = db.users.find((u) => u.id === closedByUserId);
    const targetDate = date || getTodayJalali();
    const chosenBank = bankName || 'کلیه بانک‌ها';

    const matchingAdvances = db.advanceRequests.filter(
      (a) =>
        a.status === 'Paid' &&
        a.paidDateJalali === targetDate &&
        (chosenBank === 'کلیه بانک‌ها' || a.paidBankName === chosenBank)
    );
    const matchingPayments = db.paymentRequests.filter(
      (p) =>
        p.status === 'Paid' &&
        p.paidDateJalali === targetDate &&
        (chosenBank === 'کلیه بانک‌ها' || p.paidBankName === chosenBank)
    );
    const matchingManuals = db.manualPayments.filter(
      (m) =>
        m.date === targetDate &&
        (chosenBank === 'کلیه بانک‌ها' || m.bankName === chosenBank)
    );

    if(!trsUser)return res.status(401).json({error:'نشست معتبر برای بستن روکش لازم است.'});
    const company=companyPolicy(trsUser,db),auth=computeEffectiveUserAuth(trsUser,db);
    const permitted=(row:AdvanceRequest|PaymentRequest)=>canSeeRequest(row,trsUser,db,auth,undefined,company.financial);
    if(!matchingAdvances.every(permitted)||!matchingPayments.every(permitted)||!matchingManuals.every(r=>canSeeNotificationTarget(r.id,trsUser,db,auth)))return res.status(403).json({error:'روکش شامل اطلاعات خارج از محدودهٔ دسترسی فعلی شماست؛ هیچ رکوردی تغییر نکرد.'});

    const sumAdvances = matchingAdvances.reduce(
      (acc, item) => acc + (item.approvedAmount ?? item.amount),
      0
    );
    const sumPayments = matchingPayments.reduce((acc, item) => acc + item.amount, 0);
    const sumManuals = matchingManuals.reduce((acc, item) => acc + item.amount, 0);
    const parsedFee = Number(bankFee) || 0;
    const parsedTotalIn = Number(totalIn) || 0;
    const calculatedTotalOut = sumAdvances + sumPayments + sumManuals + parsedFee;

    const coverId = `cov-${Date.now()}`;
    const coverNumber = `COV-${targetDate.replace(/\//g, '')}-0${db.dailyCovers.length + 1}`;

    const newCover: DailyCover = {
      id: coverId,
      coverNumber,
      date: targetDate,
      bankName: chosenBank,
      totalIn: parsedTotalIn,
      totalOut: calculatedTotalOut,
      bankFee: parsedFee,
      note: note || 'روکش روزانه پس از کنترل اسناد و فیش‌ها بسته شد.',
      status: 'Closed',
      closedBy: trsUser?.name || 'کیوان فرهمند',
      closedAt: `${targetDate} - ${new Date().toTimeString().slice(0, 5)}`,
      advanceRequestIds: matchingAdvances.map((a) => a.id),
      paymentRequestIds: matchingPayments.map((p) => p.id),
      manualPaymentIds: matchingManuals.map((m) => m.id),
    };

    matchingAdvances.forEach((a) => {
      a.dailyCoverId = coverId;
    });
    matchingPayments.forEach((p) => {
      p.dailyCoverId = coverId;
    });
    matchingManuals.forEach((m) => {
      m.dailyCoverId = coverId;
    });

    db.dailyCovers.unshift(newCover);
    saveDb(db);
    res.json({ success: true, cover: newCover, state: sanitizeDbForClient(db) });
  });

  // ============================================================================
  // 13. Master Data Management (Admin Only): Companies, Departments, Cost Centers
  // ============================================================================
  function requireAdminMasterDataAccess(
    req: express.Request,
    db: TreasuryDatabaseState
  ): { actor?: User; errorStatus?: number; errorMessage?: string } {
    const { user: sessionUser } = resolveSessionUser(req, db);
    const actorId = sessionUser?.id || req.body?.actorId;
    const actor = db.users.find((u) => u.id === actorId);
    if (!actor || actor.isActive === false) {
      return { errorStatus: 401, errorMessage: 'نشست کاربری معتبر نیست. لطفاً مجدداً وارد شوید.' };
    }
    const actorAuth = computeEffectiveUserAuth(actor, db);
    const requiredPermission = req.path.includes('/companies/') ? 'canManageCompanies' : req.path.includes('/departments/') ? 'canManageDepartments' : req.path.includes('/cost-centers/') ? 'canManageCostCenters' : 'canManageSmsGateway';
    if (actor.role !== 'ADMIN' && !actorAuth.effectivePermissions[requiredPermission]) {
      return { errorStatus: 403, errorMessage: 'شما مجوز مدیریت اطلاعات پایه و تنظیمات سامانه را ندارید.' };
    }
    return { actor };
  }

  function isCompanyUsed(
    db: TreasuryDatabaseState,
    comp: OrganizationCompany
  ): { used: boolean; reasons: string[] } {
    const reasons: string[] = [];
    if ((db.users || []).some((u) => u.company === comp.name)) {
      reasons.push('کاربران سازمان');
    }
    if ((db.departments || []).some((d) => d.companyId === comp.id || d.companyName === comp.name)) {
      reasons.push('واحدهای سازمانی');
    }
    if ((db.costCenters || []).some((cc) => cc.companyId === comp.id || cc.companyName === comp.name)) {
      reasons.push('مراکز هزینه');
    }
    if (
      (db.companyBankAccounts || []).some(
        (b) => b.company === comp.name || b.companyName === comp.name
      )
    ) {
      reasons.push('حساب‌های بانکی خزانه');
    }
    if (
      (db.advanceRequests || []).some((a) => a.company === comp.name) ||
      (db.paymentRequests || []).some((p) => p.company === comp.name) ||
      (db.batchPayments || []).some((b) => b.company === comp.name)
    ) {
      reasons.push('سوابق درخواست‌های مالی');
    }
    return { used: reasons.length > 0, reasons };
  }

  function isDepartmentUsed(
    db: TreasuryDatabaseState,
    dept: OrganizationalDepartment
  ): { used: boolean; reasons: string[] } {
    const reasons: string[] = [];
    if ((db.users || []).some((u) => u.department === dept.name)) {
      reasons.push('کاربران سازمان');
    }
    if (
      (db.costCenters || []).some(
        (cc) => cc.departmentId === dept.id || cc.departmentName === dept.name
      )
    ) {
      reasons.push('مراکز هزینه مرتبط');
    }
    if (
      (db.advanceRequests || []).some((a) => a.department === dept.name) ||
      (db.paymentRequests || []).some((p) => p.department === dept.name) ||
      (db.batchPayments || []).some((b) => b.department === dept.name)
    ) {
      reasons.push('سوابق درخواست‌های مالی');
    }
    return { used: reasons.length > 0, reasons };
  }

  function isCostCenterUsed(
    db: TreasuryDatabaseState,
    cc: CostCenterItem
  ): { used: boolean; reasons: string[] } {
    const reasons: string[] = [];
    if ((db.paymentRequests || []).some((p) => p.costCenter === cc.name)) {
      reasons.push('دستورهای پرداخت تکی');
    }
    if (
      (db.batchPayments || []).some((b) =>
        (b.items || []).some((it) => it.costCenter === cc.name)
      )
    ) {
      reasons.push('ردیف‌های درخواست گروهی');
    }
    return { used: reasons.length > 0, reasons };
  }

  // 13a. Save (Create / Edit) Company / Organization
  mutations.post('/api/master-data/companies/save', (req, res) => {
    const db = loadDb();
    const authCheck = requireAdminMasterDataAccess(req, db);
    if (!authCheck.actor) {
      return res.status(authCheck.errorStatus || 403).json({ error: authCheck.errorMessage });
    }
    const actor = authCheck.actor;
    const { id, code, name, nationalId, description, isActive, isDefault } = req.body || {};

    let cleanCode:string;
    try {cleanCode=id?immutableMasterDataCode(db.companies?.find(c=>c.id===id),code):allocateMasterDataCode(db,'companies');}
    catch(error){return res.status(400).json({error:(error as Error).message});}
    const cleanName = String(name || '').trim();
    const cleanNationalId = normalizeDigitsServer(nationalId || '').trim();
    const cleanDesc = String(description || '').trim();

    if (!cleanCode || !cleanName) {
      return res.status(400).json({ error: 'کد شرکت/سازمان و نام شرکت الزامی هستند.' });
    }

    const companies = db.companies || [];
    const dupCode = companies.find((c) => c.id !== id && c.code.toLowerCase() === cleanCode.toLowerCase());
    if (dupCode) {
      return res.status(400).json({ error: `کد شرکت «${cleanCode}» تکراری است و قبلاً برای «${dupCode.name}» ثبت شده است.` });
    }
    const dupName = companies.find((c) => c.id !== id && c.name === cleanName);
    if (dupName) {
      return res.status(400).json({ error: `نام شرکت/سازمان «${cleanName}» تکراری است.` });
    }

    const today = getTodayJalali();
    const nextActive = isActive !== undefined ? Boolean(isActive) : true;
    const nextDefault = Boolean(isDefault) && nextActive;

    if (nextDefault) {
      for (const c of companies) c.isDefault = false;
    }

    if (id) {
      const existing = companies.find((c) => c.id === id);
      if (!existing) {
        return res.status(404).json({ error: 'شرکت/سازمان مورد نظر یافت نشد.' });
      }
      if (!nextActive) {
        const otherActive = companies.filter((c) => c.id !== id && c.isActive !== false);
        if (otherActive.length === 0) {
          return res.status(400).json({ error: 'امکان غیرفعال‌سازی تنها شرکت فعال سامانه وجود ندارد.' });
        }
      }
      const prevName = existing.name;
      existing.code = cleanCode;
      existing.name = cleanName;
      existing.nationalId = cleanNationalId || undefined;
      existing.description = cleanDesc || undefined;
      existing.isActive = nextActive;
      existing.isDefault = nextDefault ? true : existing.isDefault && nextActive;
      existing.updatedAt = today;

      // Keep active master-data references in sync if company name changed (historical requests keep their original snapshot!)
      if (prevName !== cleanName) {
        // Pin legacy ownership before renaming users; keep the historical label.
        for(const row of [...db.paymentRequests,...db.advanceRequests,...db.batchPayments])if(!row.companyId&&(row.company===prevName||!row.company&&db.users.find(u=>u.id===row.requesterId)?.company===prevName))row.companyId=existing.id;
        for (const d of db.departments || []) {
          if (d.companyId === existing.id || d.companyName === prevName) {
            d.companyName = cleanName;
          }
        }
        for (const cc of db.costCenters || []) {
          if (cc.companyId === existing.id || cc.companyName === prevName) {
            cc.companyName = cleanName;
          }
        }
        for (const u of db.users || []) {
          if (u.company === prevName) u.company = cleanName;
        }
        for (const r of db.roleConfigs || []) {
          if (r.allowedCompanies) {
            r.allowedCompanies = r.allowedCompanies.map((cn) => (cn === prevName ? cleanName : cn));
          }
        }
        for (const b of db.companyBankAccounts || []) {
          if (b.company === prevName) b.company = cleanName;
          if (b.companyName === prevName) b.companyName = cleanName;
        }
      }

      pushSecurityAuditLog(db, {
        actionType: 'MASTER_DATA_CHANGED',
        actorId: actor.id,
        actorName: actor.name,
        description: `ویرایش اطلاعات پایه شرکت/سازمان «${cleanName}» (کد: ${cleanCode})`,
      });
    } else {
      const newComp: OrganizationCompany = {
        id: `cmp-${crypto.randomUUID()}`,
        code: cleanCode,
        name: cleanName,
        nationalId: cleanNationalId || undefined,
        description: cleanDesc || undefined,
        isActive: nextActive,
        isDefault: nextDefault,
        createdAt: today,
        updatedAt: today,
      };
      companies.push(newComp);
      // A new company must not silently expand other roles' approved scope.
      for (const r of (db.roleConfigs || []).filter(r=>r.role==='ADMIN')) {
        if (!r.allowedCompanies.includes(cleanName)) {
          r.allowedCompanies.push(cleanName);
        }
      }
      pushSecurityAuditLog(db, {
        actionType: 'MASTER_DATA_CHANGED',
        actorId: actor.id,
        actorName: actor.name,
        description: `افزودن شرکت/سازمان جدید «${cleanName}» (کد: ${cleanCode})`,
      });
    }

    if (!companies.some((c) => c.isDefault && c.isActive !== false)) {
      const firstActive = companies.find((c) => c.isActive !== false);
      if (firstActive) firstActive.isDefault = true;
    }

    db.companies = companies;
    saveDb(db);
    res.json({ success: true, state: sanitizeDbForClient(db) });
  });

  mutations.post('/api/master-data/companies/toggle-status', (req, res) => {
    const db = loadDb();
    const authCheck = requireAdminMasterDataAccess(req, db);
    if (!authCheck.actor) {
      return res.status(authCheck.errorStatus || 403).json({ error: authCheck.errorMessage });
    }
    const actor = authCheck.actor;
    const { id, isActive } = req.body || {};
    const companies = db.companies || [];
    const target = companies.find((c) => c.id === id);
    if (!target) {
      return res.status(404).json({ error: 'شرکت مورد نظر یافت نشد.' });
    }
    const nextActive = isActive !== undefined ? Boolean(isActive) : !target.isActive;
    if (!nextActive) {
      const otherActive = companies.filter((c) => c.id !== target.id && c.isActive !== false);
      if (otherActive.length === 0) {
        return res.status(400).json({ error: 'امکان غیرفعال‌سازی تنها شرکت فعال سامانه وجود ندارد.' });
      }
      target.isDefault = false;
    }
    target.isActive = nextActive;
    target.updatedAt = getTodayJalali();
    if (!companies.some((c) => c.isDefault && c.isActive !== false)) {
      const firstActive = companies.find((c) => c.isActive !== false);
      if (firstActive) firstActive.isDefault = true;
    }
    pushSecurityAuditLog(db, {
      actionType: 'MASTER_DATA_CHANGED',
      actorId: actor.id,
      actorName: actor.name,
      description: `${nextActive ? 'فعال‌سازی' : 'غیرفعال‌سازی'} شرکت/سازمان «${target.name}»`,
    });
    saveDb(db);
    res.json({ success: true, state: sanitizeDbForClient(db) });
  });

  mutations.post('/api/master-data/companies/delete', (req, res) => {
    const db = loadDb();
    const authCheck = requireAdminMasterDataAccess(req, db);
    if (!authCheck.actor) {
      return res.status(authCheck.errorStatus || 403).json({ error: authCheck.errorMessage });
    }
    const actor = authCheck.actor;
    const { id } = req.body || {};
    const companies = db.companies || [];
    const target = companies.find((c) => c.id === id);
    if (!target) {
      return res.status(404).json({ error: 'شرکت مورد نظر یافت نشد.' });
    }
    const usage = isCompanyUsed(db, target);
    if (usage.used) {
      return res.status(409).json({
        error: `حذف فیزیکی شرکت «${target.name}» مجاز نیست زیرا در سوابق یا اطلاعات پایه (${usage.reasons.join('، ')}) استفاده شده است. برای جلوگیری از انتخاب در درخواست‌های جدید، وضعیت آن را «غیرفعال» کنید.`,
        used: true,
        reasons: usage.reasons,
      });
    }
    if (companies.length <= 1) {
      return res.status(400).json({ error: 'حداقل یک شرکت باید در سامانه باقی بماند.' });
    }
    try{retainMasterDataHighWater(db,'companies');}catch(error){return res.status(400).json({error:(error as Error).message});}
    db.companies = companies.filter((c) => c.id !== id);
    pushSecurityAuditLog(db, {
      actionType: 'MASTER_DATA_CHANGED',
      actorId: actor.id,
      actorName: actor.name,
      description: `حذف شرکت/سازمان بلااستفاده «${target.name}» (کد: ${target.code})`,
    });
    saveDb(db);
    res.json({ success: true, state: sanitizeDbForClient(db) });
  });

  // 13b. Save (Create / Edit) Organizational Department (واحد سازمانی)
  mutations.post('/api/master-data/departments/save', (req, res) => {
    const db = loadDb();
    const authCheck = requireAdminMasterDataAccess(req, db);
    if (!authCheck.actor) {
      return res.status(authCheck.errorStatus || 403).json({ error: authCheck.errorMessage });
    }
    const actor = authCheck.actor;
    const { id, code, name, companyId, description, isActive } = req.body || {};

    let cleanCode:string;
    try {cleanCode=id?immutableMasterDataCode(db.departments?.find(d=>d.id===id),code):'';}
    catch(error){return res.status(400).json({error:(error as Error).message});}
    const cleanName = String(name || '').trim();
    const cleanDesc = String(description || '').trim();
    const companies = db.companies || [];
    const comp = companies.find((c) => c.id === companyId) || companies[0];

    if (!cleanName || !comp) {
      return res.status(400).json({ error: 'کد واحد، نام واحد سازمانی و شرکت وابسته الزامی هستند.' });
    }

    const departments = db.departments || [];
    const dupCode = departments.find((d) => d.id !== id && d.code.toLowerCase() === cleanCode.toLowerCase());
    if (dupCode) {
      return res.status(400).json({ error: `کد واحد سازمانی «${cleanCode}» تکراری است و قبلاً برای «${dupCode.name}» ثبت شده است.` });
    }
    const dupName = departments.find(
      (d) => d.id !== id && d.companyId === comp.id && d.name === cleanName
    );
    if (dupName) {
      return res.status(400).json({ error: `واحد سازمانی «${cleanName}» در شرکت «${comp.name}» قبلاً تعریف شده است.` });
    }

    const today = getTodayJalali();
    const nextActive = isActive !== undefined ? Boolean(isActive) : true;

    if (id) {
      const existing = departments.find((d) => d.id === id);
      if (!existing) {
        return res.status(404).json({ error: 'واحد سازمانی مورد نظر یافت نشد.' });
      }
      const prevName = existing.name;
      existing.code = cleanCode;
      existing.name = cleanName;
      existing.companyId = comp.id;
      existing.companyName = comp.name;
      existing.description = cleanDesc || undefined;
      existing.isActive = nextActive;
      existing.updatedAt = today;

      if (prevName !== cleanName) {
        for (const u of db.users || []) {
          if (u.department === prevName) u.department = cleanName;
        }
        for (const cc of db.costCenters || []) {
          if (cc.departmentId === existing.id || cc.departmentName === prevName) {
            cc.departmentName = cleanName;
          }
        }
      }

      pushSecurityAuditLog(db, {
        actionType: 'MASTER_DATA_CHANGED',
        actorId: actor.id,
        actorName: actor.name,
        description: `ویرایش واحد سازمانی «${cleanName}» (کد: ${cleanCode} — شرکت: ${comp.name})`,
      });
    } else {
      try {const created=createMasterDataRow(db,'departments',{name:cleanName,companyId,description:cleanDesc,isActive:nextActive},today);cleanCode=created.code;}
      catch(error){return res.status(400).json({error:(error as Error).message});}
      pushSecurityAuditLog(db, {
        actionType: 'MASTER_DATA_CHANGED',
        actorId: actor.id,
        actorName: actor.name,
        description: `افزودن واحد سازمانی جدید «${cleanName}» (کد: ${cleanCode} — شرکت: ${comp.name})`,
      });
    }

    if(id)db.departments = departments;
    saveDb(db);
    res.json({ success: true, state: sanitizeDbForClient(db) });
  });

  mutations.post('/api/master-data/departments/toggle-status', (req, res) => {
    const db = loadDb();
    const authCheck = requireAdminMasterDataAccess(req, db);
    if (!authCheck.actor) {
      return res.status(authCheck.errorStatus || 403).json({ error: authCheck.errorMessage });
    }
    const actor = authCheck.actor;
    const { id, isActive } = req.body || {};
    const departments = db.departments || [];
    const target = departments.find((d) => d.id === id);
    if (!target) {
      return res.status(404).json({ error: 'واحد سازمانی مورد نظر یافت نشد.' });
    }
    const nextActive = isActive !== undefined ? Boolean(isActive) : !target.isActive;
    target.isActive = nextActive;
    target.updatedAt = getTodayJalali();
    pushSecurityAuditLog(db, {
      actionType: 'MASTER_DATA_CHANGED',
      actorId: actor.id,
      actorName: actor.name,
      description: `${nextActive ? 'فعال‌سازی' : 'غیرفعال‌سازی'} واحد سازمانی «${target.name}»`,
    });
    saveDb(db);
    res.json({ success: true, state: sanitizeDbForClient(db) });
  });

  mutations.post('/api/master-data/departments/delete', (req, res) => {
    const db = loadDb();
    const authCheck = requireAdminMasterDataAccess(req, db);
    if (!authCheck.actor) {
      return res.status(authCheck.errorStatus || 403).json({ error: authCheck.errorMessage });
    }
    const actor = authCheck.actor;
    const { id } = req.body || {};
    const departments = db.departments || [];
    const target = departments.find((d) => d.id === id);
    if (!target) {
      return res.status(404).json({ error: 'واحد سازمانی مورد نظر یافت نشد.' });
    }
    const usage = isDepartmentUsed(db, target);
    if (usage.used) {
      return res.status(409).json({
        error: `حذف فیزیکی واحد سازمانی «${target.name}» مجاز نیست زیرا در سوابق یا اطلاعات پایه (${usage.reasons.join('، ')}) استفاده شده است. برای جلوگیری از انتخاب در موارد جدید، وضعیت آن را «غیرفعال» کنید.`,
        used: true,
        reasons: usage.reasons,
      });
    }
    try{retainMasterDataHighWater(db,'departments');}catch(error){return res.status(400).json({error:(error as Error).message});}
    db.departments = departments.filter((d) => d.id !== id);
    pushSecurityAuditLog(db, {
      actionType: 'MASTER_DATA_CHANGED',
      actorId: actor.id,
      actorName: actor.name,
      description: `حذف واحد سازمانی بلااستفاده «${target.name}» (کد: ${target.code})`,
    });
    saveDb(db);
    res.json({ success: true, state: sanitizeDbForClient(db) });
  });

  // 13c. Save (Create / Edit) Cost Center (مرکز هزینه)
  mutations.post('/api/master-data/cost-centers/save', (req, res) => {
    const db = loadDb();
    const authCheck = requireAdminMasterDataAccess(req, db);
    if (!authCheck.actor) {
      return res.status(authCheck.errorStatus || 403).json({ error: authCheck.errorMessage });
    }
    const actor = authCheck.actor;
    const { id, code, name, companyId, departmentId, budgetCategory, description, isActive } = req.body || {};

    let cleanCode:string;
    try {cleanCode=id?immutableMasterDataCode(db.costCenters?.find(c=>c.id===id),code):'';}
    catch(error){return res.status(400).json({error:(error as Error).message});}
    const cleanName = String(name || '').trim();
    const cleanCategory = String(budgetCategory || '').trim();
    const cleanDesc = String(description || '').trim();

    const companies = db.companies || [];
    const comp = companies.find((c) => c.id === companyId) || companies[0];
    if (!cleanName || !comp) {
      return res.status(400).json({ error: 'کد مرکز هزینه، عنوان مرکز هزینه و شرکت مرتبط الزامی هستند.' });
    }

    const departments = db.departments || [];
    const dept = departmentId ? departments.find((d) => d.id === departmentId) : null;

    const costCenters = db.costCenters || [];
    const dupCode = costCenters.find((cc) => cc.id !== id && cc.code.toLowerCase() === cleanCode.toLowerCase());
    if (dupCode) {
      return res.status(400).json({ error: `کد مرکز هزینه «${cleanCode}» تکراری است و قبلاً برای «${dupCode.name}» ثبت شده است.` });
    }
    const dupName = costCenters.find((cc) => cc.id !== id && cc.companyId === comp.id && cc.name === cleanName);
    if (dupName) {
      return res.status(400).json({ error: `مرکز هزینه «${cleanName}» در شرکت «${comp.name}» قبلاً تعریف شده است.` });
    }

    const today = getTodayJalali();
    const nextActive = isActive !== undefined ? Boolean(isActive) : true;

    if (id) {
      const existing = costCenters.find((cc) => cc.id === id);
      if (!existing) {
        return res.status(404).json({ error: 'مرکز هزینه مورد نظر یافت نشد.' });
      }
      existing.code = cleanCode;
      existing.name = cleanName;
      existing.companyId = comp.id;
      existing.companyName = comp.name;
      existing.departmentId = dept ? dept.id : null;
      existing.departmentName = dept ? dept.name : null;
      existing.budgetCategory = cleanCategory || undefined;
      existing.description = cleanDesc || undefined;
      existing.isActive = nextActive;
      existing.updatedAt = today;

      pushSecurityAuditLog(db, {
        actionType: 'MASTER_DATA_CHANGED',
        actorId: actor.id,
        actorName: actor.name,
        description: `ویرایش مرکز هزینه «${cleanName}» (کد: ${cleanCode} — شرکت: ${comp.name})`,
      });
    } else {
      try {const created=createMasterDataRow(db,'cost-centers',{name:cleanName,companyId,departmentId,budgetCategory:cleanCategory,description:cleanDesc,isActive:nextActive},today);cleanCode=created.code;}
      catch(error){return res.status(400).json({error:(error as Error).message});}
      pushSecurityAuditLog(db, {
        actionType: 'MASTER_DATA_CHANGED',
        actorId: actor.id,
        actorName: actor.name,
        description: `افزودن مرکز هزینه جدید «${cleanName}» (کد: ${cleanCode} — شرکت: ${comp.name})`,
      });
    }

    if(id)db.costCenters = costCenters;
    saveDb(db);
    res.json({ success: true, state: sanitizeDbForClient(db) });
  });

  for(const kind of ['departments','cost-centers'] as const)mutations.post(`/api/master-data/${kind}/bulk-create`,(req,res)=>{
    const db=loadDb(),auth=requireAdminMasterDataAccess(req,db);if(!auth.actor)return res.status(auth.errorStatus||403).json({error:auth.errorMessage});
    const {rows}=req.body||{};
    if(!Array.isArray(rows)||!rows.length||rows.length>200)return res.status(400).json({error:'گروه باید بین۱تا۲۰۰ردیف داشته باشد.'});
    const created:Array<OrganizationalDepartment|CostCenterItem>=[];
    for(let i=0;i<rows.length;i++){
      try {if(rows[i]?.isActive!==undefined)throw Error('گروه فقط رکورد جدید فعال می‌سازد.');created.push(createMasterDataRow(db,kind,rows[i],getTodayJalali()));}
      catch(error){return res.status(400).json({error:`ردیف ${i+1}: ${(error as Error).message} هیچ ردیفی از این گروه ثبت نشد.`,rowIndex:i});}
    }
    pushSecurityAuditLog(db,{actionType:'MASTER_DATA_CHANGED',actorId:auth.actor.id,actorName:auth.actor.name,description:`ثبت گروهی ${created.length} ${kind==='departments'?'واحد سازمانی':'مرکز هزینه'} با کد خودکار`});
    saveDb(db);return res.json({success:true,created,state:sanitizeDbForClient(db)});
  });

  mutations.post('/api/master-data/cost-centers/toggle-status', (req, res) => {
    const db = loadDb();
    const authCheck = requireAdminMasterDataAccess(req, db);
    if (!authCheck.actor) {
      return res.status(authCheck.errorStatus || 403).json({ error: authCheck.errorMessage });
    }
    const actor = authCheck.actor;
    const { id, isActive } = req.body || {};
    const costCenters = db.costCenters || [];
    const target = costCenters.find((cc) => cc.id === id);
    if (!target) {
      return res.status(404).json({ error: 'مرکز هزینه مورد نظر یافت نشد.' });
    }
    const nextActive = isActive !== undefined ? Boolean(isActive) : !target.isActive;
    target.isActive = nextActive;
    target.updatedAt = getTodayJalali();
    pushSecurityAuditLog(db, {
      actionType: 'MASTER_DATA_CHANGED',
      actorId: actor.id,
      actorName: actor.name,
      description: `${nextActive ? 'فعال‌سازی' : 'غیرفعال‌سازی'} مرکز هزینه «${target.name}» (${target.code})`,
    });
    saveDb(db);
    res.json({ success: true, state: sanitizeDbForClient(db) });
  });

  mutations.post('/api/master-data/cost-centers/delete', (req, res) => {
    const db = loadDb();
    const authCheck = requireAdminMasterDataAccess(req, db);
    if (!authCheck.actor) {
      return res.status(authCheck.errorStatus || 403).json({ error: authCheck.errorMessage });
    }
    const actor = authCheck.actor;
    const { id } = req.body || {};
    const costCenters = db.costCenters || [];
    const target = costCenters.find((cc) => cc.id === id);
    if (!target) {
      return res.status(404).json({ error: 'مرکز هزینه مورد نظر یافت نشد.' });
    }
    const usage = isCostCenterUsed(db, target);
    if (usage.used) {
      return res.status(409).json({
        error: `حذف فیزیکی مرکز هزینه «${target.name}» مجاز نیست زیرا در اسناد مالی (${usage.reasons.join('، ')}) استفاده شده است. برای جلوگیری از انتخاب در درخواست‌های جدید، وضعیت آن را «غیرفعال» کنید.`,
        used: true,
        reasons: usage.reasons,
      });
    }
    try{retainMasterDataHighWater(db,'cost-centers');}catch(error){return res.status(400).json({error:(error as Error).message});}
    db.costCenters = costCenters.filter((cc) => cc.id !== id);
    pushSecurityAuditLog(db, {
      actionType: 'MASTER_DATA_CHANGED',
      actorId: actor.id,
      actorName: actor.name,
      description: `حذف مرکز هزینه بلااستفاده «${target.name}» (کد: ${target.code})`,
    });
    saveDb(db);
    res.json({ success: true, state: sanitizeDbForClient(db) });
  });

  // ============================================================================
  // 14. SMS Gateway Configuration & Real Test Dispatch (Admin Only)
  // ============================================================================
  mutations.post('/api/sms/config', (req, res) => {
    const db = loadDb();
    const authCheck = requireAdminMasterDataAccess(req, db);
    if (!authCheck.actor) {
      return res.status(authCheck.errorStatus || 403).json({ error: authCheck.errorMessage });
    }
    const actor = authCheck.actor;
    const {
      enabled,
      provider,
      senderNumber,
      apiKey,
      apiUrl,
      username,
      password,
      domain,
      events,
      clearSecrets,
    } = req.body || {};

    const current = db.smsConfig || getDefaultSmsConfig();
    const cleanSender = normalizeDigitsServer(senderNumber ?? current.senderNumber).trim();
    const cleanUrl = String(apiUrl ?? current.apiUrl ?? '').trim();
    const cleanUser = String(username ?? current.username ?? '').trim();
    const cleanDomain = String(domain ?? current.domain ?? '').trim();

    let nextApiKey = current.apiKey || '';
    if (clearSecrets) {
      nextApiKey = '';
    } else if (apiKey !== undefined && String(apiKey).trim() !== '' && !String(apiKey).includes('••••')) {
      nextApiKey = String(apiKey).trim();
    }

    let nextPassword = current.password || '';
    if (clearSecrets) {
      nextPassword = '';
    } else if (password !== undefined && String(password).trim() !== '' && !String(password).includes('••••')) {
      nextPassword = String(password).trim();
    }

    const wantEnabled = Boolean(enabled);
    if (wantEnabled && !cleanSender) {
      return res.status(400).json({ error: 'برای فعال‌سازی درگاه پیامک، وارد کردن شماره خط ارسال‌کننده الزامی است.' });
    }
    if (wantEnabled && !nextApiKey && (!cleanUser || !nextPassword)) {
      return res.status(400).json({
        error: 'برای فعال‌سازی درگاه پیامک، وارد کردن کلید وب‌سرویس (API Key) یا نام کاربری و رمز وب‌سرویس الزامی است.',
      });
    }

    const today = `${getTodayJalali()} - ${new Date().toTimeString().slice(0, 5)}`;
    const updatedCfg: SmsGatewayConfig = {
      ...current,
      enabled: wantEnabled,
      provider: provider || current.provider || 'KAVENEGAR',
      senderNumber: cleanSender,
      apiKey: nextApiKey,
      hasApiKey: Boolean(nextApiKey || nextPassword),
      apiUrl: cleanUrl,
      username: cleanUser || undefined,
      password: nextPassword || undefined,
      domain: cleanDomain || undefined,
      events: {
        sendOtpOnRecovery: events?.sendOtpOnRecovery !== undefined ? Boolean(events.sendOtpOnRecovery) : current.events.sendOtpOnRecovery,
        sendOnAdminPasswordReset: events?.sendOnPasswordReset !== undefined ? Boolean(events.sendOnPasswordReset) : current.events.sendOnAdminPasswordReset ?? true,
        sendOnPasswordReset: events?.sendOnPasswordReset !== undefined ? Boolean(events.sendOnPasswordReset) : current.events.sendOnPasswordReset ?? true,
        sendOnRequestSubmitted: events?.sendOnPendingApproval !== undefined ? Boolean(events.sendOnPendingApproval) : current.events.sendOnRequestSubmitted ?? false,
        sendOnPendingApproval: events?.sendOnPendingApproval !== undefined ? Boolean(events.sendOnPendingApproval) : current.events.sendOnPendingApproval ?? true,
        sendOnReturnedForRevision: events?.sendOnRevisionOrReject !== undefined ? Boolean(events.sendOnRevisionOrReject) : current.events.sendOnReturnedForRevision ?? true,
        sendOnRevisionOrReject: events?.sendOnRevisionOrReject !== undefined ? Boolean(events.sendOnRevisionOrReject) : current.events.sendOnRevisionOrReject ?? true,
        sendOnFinalApproval: current.events.sendOnFinalApproval ?? true,
        sendOnPaymentExecuted: events?.sendOnPaymentExecuted !== undefined ? Boolean(events.sendOnPaymentExecuted) : current.events.sendOnPaymentExecuted,
      },
      updatedAt: today,
      updatedBy: actor.name,
    };
    db.smsConfig = updatedCfg;

    pushSecurityAuditLog(db, {
      actionType: 'SMS_CONFIG_UPDATED',
      actorId: actor.id,
      actorName: actor.name,
      description: `بروزرسانی تنظیمات درگاه پیامک (${updatedCfg.provider} — وضعیت: ${wantEnabled ? 'فعال' : 'غیرفعال'} — خط: ${cleanSender || 'ثبت‌نشده'})`,
    });

    saveDb(db);
    res.json({
      success: true,
      state: sanitizeDbForClient(db),
    });
  });

  mutations.post('/api/sms/test', async (req, res) => {
    const db = loadDb();
    const authCheck = requireAdminMasterDataAccess(req, db);
    if (!authCheck.actor) {
      return res.status(authCheck.errorStatus || 403).json({ error: authCheck.errorMessage });
    }
    const actor = authCheck.actor;
    const { recipientPhone, testMessage } = req.body || {};
    const cleanPhone = normalizeDigitsServer(recipientPhone || '').trim();
    if (!cleanPhone || !/^09\d{9}$/.test(cleanPhone)) {
      return res.status(400).json({ error: 'لطفاً شماره موبایل معتبر ۱۱ رقمی (با شروع ۰۹) برای تست ارسال وارد کنید.' });
    }

    const msgText =
      String(testMessage || '').trim() ||
      `پرتال مالی و خزانه‌داری شاهراه - پیامک تست اتصال درگاه توسط «${actor.name}»`;

    const result = await dispatchRealSms(db, {
      eventType: 'ADMIN_TEST',
      recipientName: actor.name,
      recipientPhone: cleanPhone,
      message: msgText,
    });

    const nowStr = `${getTodayJalali()} - ${new Date().toTimeString().slice(0, 5)}`;
    if (!db.smsConfig) db.smsConfig = getDefaultSmsConfig();
    db.smsConfig.lastTestedAt = nowStr;
    db.smsConfig.lastTestStatus = result.ok ? 'SUCCESS' : 'FAILED';
    db.smsConfig.lastTestMessage = result.ok
      ? `ارسال موفق به ${cleanPhone} (${result.providerResponse || 'OK'})`
      : `خطا در ارسال به ${cleanPhone}: ${result.error || 'عدم پاسخ درگاه'}`;

    pushSecurityAuditLog(db, {
      actionType: 'SMS_TEST_DISPATCHED',
      actorId: actor.id,
      actorName: actor.name,
      description: `تست ارسال پیامک به شماره ${cleanPhone} — نتیجه: ${result.ok ? 'موفق' : `ناموفق (${result.error})`}`,
    });

    saveDb(db);
    return res.json({
      success: result.ok,
      status: result.status,
      error: result.error,
      providerResponse: result.providerResponse,
      state: sanitizeDbForClient(db),
    });
  });

  app.use('/api', (_req, res) => res.status(404).json({ error: 'مسیر درخواست یافت نشد.' }));

  if (process.env.NODE_ENV !== 'production') {
    const {createServer: createViteServer} = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, HOST, () => {
    console.log(`\n  Khazaneh server ready (${process.env.NODE_ENV || 'development'})\n`);
    console.log(`  ➜  Local:   http://localhost:${PORT}/`);
    console.log(`  ➜  Network: http://${HOST}:${PORT}/\n`);
    console.log(`Treasury & Financial Portal Server listening on http://${HOST}:${PORT}`);
  });

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Request failed:', error instanceof Error ? error.message : 'unknown error');
    if (!res.headersSent) res.status(500).json({ error: 'خطای سرور؛ عملیات انجام نشد. لطفاً دوباره تلاش کنید.' });
  });

  const shutdown = () => {
    bankInquiry.stop();wakeBankInquiry=()=>{};
    void stopServer(server,mutations,backgroundWrites).then(()=>process.exit(0)).catch(()=>{console.error('Graceful shutdown failed; process retained for recovery.');process.exitCode=1;});
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

// Initialization rejects before HTTP admission. A referenced supervisor IPC
// channel must not retain an unready process and its store lease as "online".
// Graceful shutdown after admission remains the separate drain path above.
startServer().catch(error => { console.error(error.message); process.exit(1); });
