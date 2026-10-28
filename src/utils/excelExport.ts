import{destinationRecipient}from'./financial-party';
import * as XLSX from 'xlsx';
import type {
  AdvanceRequest,
  PaymentRequest,
  BatchPaymentRequest,
  BatchItem,
  ManualPayment,
  ReceiptArchive,
  RequestStatus,
  SourceBankAccountSnapshot,
  PaymentExecutionRecord,
} from '../types/treasury';
import { getStatusLabel, getPriorityLabel } from './sorting';
import {requestTimeFields,type RequestTimeFields} from './record-time';
import {inquiryReportFields} from './bank-inquiry';
import {manualCompanyIdentity} from './manual-company';

// Excel rounds numeric cells after 15 significant digits. Keep larger integer
// rials as explicit text; ordinary bank/report amounts retain numeric cells.
function excelRial(value:number|bigint):number|string {
  if(typeof value==='number'&&(!Number.isSafeInteger(value)||value<0))throw Error('مبلغ گزارش باید ریال صحیح و در محدوده دقت مجاز باشد.');
  const exact=BigInt(value);return exact>999999999999999n?String(exact):Number(exact);
}

export interface UnifiedTreasuryItem extends Partial<RequestTimeFields> {
  completedEntry?:{executionId?:string;rowId?:string;approvedAmount:number;index:number;count:number;legacy?:boolean;issue?:string};
  paymentExecution?:PaymentExecutionRecord;
  createdAtIso?:string;
  uid: string;
  id: string;
  type: 'ADVANCE' | 'PAYMENT' | 'BATCH' | 'MANUAL';
  typeLabel: string;
  trackingCode: string;
  title: string;
  payeeName: string;
  requesterName: string;
  requesterPersonnelCode: string;
  department: string;
  company?: string;
  costCenter: string;
  departmentOrCenter: string;
  description: string;
  initialAmount: number;
  amount: number; // approved / payable amount
  paidAmountSoFar: number;
  remainingAmount: number;
  dueDate: string;
  requestedMonth: string;
  priority?: string;
  priorityLabel: string;
  hasPreviousAdvanceLabel: string;
  destinationBank: string;
  accountOrCard: string;
  iban: string;
  ibanOrCode: string;
  cardNumber?: string;
  invoiceNumber: string;
  supervisorName: string;
  approverNote: string;
  accountingName: string;
  accountingNote: string;
  createdAt: string;
  status: RequestStatus;
  inPaymentAt?: string | null;
  inPaymentBy?: string | null;
  sourceBankAccountId?: string | null;
  sourceAccountSnapshot?: SourceBankAccountSnapshot | null;
  paymentExecutions?: PaymentExecutionRecord[];
  paymentHistory?: PaymentExecutionRecord[];
  paidBankName?: string | null;
  paidDateJalali?: string | null;
  paidAt?: string | null;
  bankRefNumber?: string | null;
  treasuryName?: string | null;
  receiptId?: string | null;
  receiptObj?: ReceiptArchive | null;
  batchItems?: BatchItem[];
  rawPayment?: PaymentRequest;
  rawAdvance?: AdvanceRequest;
  rawBatch?: BatchPaymentRequest;
  rawManual?: ManualPayment;
}

/**
 * Generates and downloads a comprehensive .xlsx Excel file containing all form fields
 * for the selected treasury items.
 * Preserves leading zeros on card numbers, account numbers, IBANs, invoice numbers, and personnel codes.
 */
export function buildTreasuryExportWorkbook(
  items: UnifiedTreasuryItem[],
  options?: {
    fileNamePrefix?: string;
    sheetTitle?: string;
    filterBatchItemStatus?: RequestStatus[];
  }
){
  const completed=items.some(i=>i.completedEntry);
  if(completed&&items.some(i=>!i.completedEntry))throw Error('گزارش پرداخت ثبت‌شده با صف پرداخت ترکیب نمی‌شود.');
  if(items.some(i=>i.completedEntry?.issue))throw Error('تاریخچه پرداخت ناسازگار است؛ پیش از خروجی، نیاز به بررسی دارد.');
  if(completed&&new Set(items.map(i=>i.uid)).size!==items.length)throw Error('نوبت پرداخت تکراری در گزارش پذیرفته نیست.');
  let detailRows: Record<string, string | number>[] = [];
  let rowIndex = 1;
  let totalExportedAmount = 0n;

  for (const item of items) {
    if (!completed && item.type === 'BATCH' && item.rawBatch && item.batchItems && item.batchItems.length > 0) {
      const batch = item.rawBatch;
      const relevantSubItems =
        options?.filterBatchItemStatus && options.filterBatchItemStatus.length > 0
          ? item.batchItems.filter((sub) =>
              options.filterBatchItemStatus!.includes((sub.status || batch.status) as RequestStatus)
            )
          : item.batchItems;

      const subItemsToExport = relevantSubItems.length > 0 ? relevantSubItems : item.batchItems;

      for (const sub of subItemsToExport) {
        const subPayableAmount = sub.approvedAmount ?? sub.amount;
        const subSnap = sub.sourceAccountSnapshot || batch.sourceAccountSnapshot || item.receiptObj?.sourceAccountSnapshot || null;
        excelRial(subPayableAmount);totalExportedAmount += BigInt(subPayableAmount);

        detailRows.push({
          'ردیف': rowIndex++,
          'کد رهگیری سند': String(batch.trackingCode || ''),
          'شناسه ردیف تجمیعی': String(sub.id || ''),
          'نوع درخواست': batch.batchType === 'ADVANCE' ? 'مساعده تجمیعی پرسنل' : 'دستور پرداخت تجمیعی',
          'عنوان / موضوع فرم': String(batch.title || sub.description || ''),
          'نام ذینفع / گیرنده وجه': String(sub.payeeName || ''),
          'واحد سازمانی': String(batch.department || ''),
          'مرکز هزینه': String(sub.costCenter || batch.department || ''),
          'مبلغ اولیه درخواستی (ریال)': excelRial(sub.initialAmount ?? sub.amount ?? 0),
          'مبلغ قابل پرداخت مصوب (ریال)': excelRial(subPayableAmount || 0),
          'واحد پول': 'ریال',
          'نام بانک مقصد': String(sub.bankName || ''),
          'شماره کارت / شماره حساب مقصد': String(sub.accountOrCard || '-'),
          'شماره شبا (IBAN)': String(sub.iban || '-'),
          'شماره فاکتور / سند مثبته': String(sub.invoiceNumber || '-'),
          'موعد پرداخت / سررسید': String(item.dueDate || 'فوری'),
          'ماه مورد تقاضا': String(sub.requestedMonth || '-'),
          'اولویت': String(item.priorityLabel || 'عادی'),
          'سابقه مساعده قبلی': '-',
          'شرح و بابت (توضیحات فرم)': String(sub.description || batch.title || ''),
          'نام درخواست‌کننده': String(batch.requesterName || ''),
          'کد پرسنلی درخواست‌کننده': String(batch.requesterPersonnelCode || ''),
          'سرپرست تاییدکننده': String(batch.supervisorName || '-'),
          'توضیحات سرپرست': String(sub.approverNote || batch.approverNote || '-'),
          'کارشناس حسابداری': 'واحد حسابداری',
          'توضیحات حسابداری': String(sub.accountingNote || batch.accountingNote || '-'),
          'تاریخ ثبت درخواست': requestTimeFields(batch,[sub]).registrationDate,
          'وضعیت فعلی': getStatusLabel((sub.status || batch.status) as RequestStatus),
          'زمان انتقال به مخزن در حال پرداخت': String(sub.inPaymentAt || batch.inPaymentAt || '-'),
          'بانک مبدأ پرداخت‌کننده (خزانه)': String(subSnap?.bankName || sub.paidBankName || batch.paidBankName || '-'),
          'عنوان حساب مبدأ شرکت': String(subSnap?.accountTitle || '-'),
          'شماره حساب / شبا مبدأ شرکت': String(subSnap ? `${subSnap.accountNumber || '-'} / ${subSnap.iban || '-'}` : '-'),
          'شماره پیگیری / مرجع بانکی': String(item.bankRefNumber || '-'),
          'تاریخ انجام پرداخت': String(sub.paidDateJalali || batch.paidDateJalali || '-'),
          'مسئول اجرای پرداخت': String(item.treasuryName || '-'),
          'ساعت ثبت درخواست': requestTimeFields(batch,[sub]).registrationTime,
          'تاریخ اقدام خزانه': requestTimeFields(batch,[sub]).treasuryActionDate,
          'ساعت اقدام خزانه': requestTimeFields(batch,[sub]).treasuryActionTime,
          ...inquiryReportFields(sub),
        });
      }
    } else {
      excelRial(item.amount);totalExportedAmount += BigInt(item.amount);
      const snap = item.sourceAccountSnapshot || (!completed?item.receiptObj?.sourceAccountSnapshot:null) || null;

      detailRows.push({
        'ردیف': rowIndex++,
        'کد رهگیری سند': String(item.trackingCode || ''),
        'شناسه ردیف تجمیعی': item.completedEntry?.rowId||'-',
        'نوع درخواست': String(item.typeLabel || ''),
        'عنوان / موضوع فرم': String(item.title || item.description || ''),
        'نام ذینفع / گیرنده وجه': String(item.payeeName || ''),
        'واحد سازمانی': String(item.department || ''),
        'مرکز هزینه': String(item.costCenter || item.department || ''),
        'مبلغ اولیه درخواستی (ریال)': excelRial(item.initialAmount ?? item.amount ?? 0),
        'مبلغ قابل پرداخت مصوب (ریال)': excelRial(item.amount || 0),
        'واحد پول': 'ریال',
        'نام بانک مقصد': String(item.destinationBank || ''),
        'شماره کارت / شماره حساب مقصد': String(item.accountOrCard || '-'),
        'شماره شبا (IBAN)': String(item.iban || '-'),
        'شماره فاکتور / سند مثبته': String(item.invoiceNumber || '-'),
        'موعد پرداخت / سررسید': String(item.dueDate || '-'),
        'ماه مورد تقاضا': String(item.requestedMonth || '-'),
        'اولویت': String(item.priorityLabel || 'عادی'),
        'سابقه مساعده قبلی': String(item.hasPreviousAdvanceLabel || '-'),
        'شرح و بابت (توضیحات فرم)': String(item.description || ''),
        'نام درخواست‌کننده': String(item.requesterName || ''),
        'کد پرسنلی درخواست‌کننده': String(item.requesterPersonnelCode || '-'),
        'سرپرست تاییدکننده': String(item.supervisorName || '-'),
        'توضیحات سرپرست': String(item.approverNote || '-'),
        'کارشناس حسابداری': String(item.accountingName || '-'),
        'توضیحات حسابداری': String(item.accountingNote || '-'),
        'تاریخ ثبت درخواست': String(item.registrationDate || item.createdAt || 'ثبت نشده'),
        'وضعیت فعلی': getStatusLabel(item.status),
        'زمان انتقال به مخزن در حال پرداخت': String(item.inPaymentAt || '-'),
        'بانک مبدأ پرداخت‌کننده (خزانه)': String(snap?.bankName || item.paidBankName || '-'),
        'عنوان حساب مبدأ شرکت': String(snap?.accountTitle || '-'),
        'شماره حساب / شبا مبدأ شرکت': String(snap ? `${snap.accountNumber || '-'} / ${snap.iban || '-'}` : '-'),
        'شماره پیگیری / مرجع بانکی': String(item.bankRefNumber || '-'),
        'تاریخ انجام پرداخت': String(item.paidDateJalali || '-'),
        'مسئول اجرای پرداخت': String(item.treasuryName || '-'),
        'ساعت ثبت درخواست': String(item.registrationTime || requestTimeFields(item).registrationTime),
        'تاریخ اقدام خزانه': String(item.treasuryActionDate || requestTimeFields(item).treasuryActionDate),
        'ساعت اقدام خزانه': String(item.treasuryActionTime || requestTimeFields(item).treasuryActionTime),
        ...inquiryReportFields(item.completedEntry?.rowId?item.batchItems?.[0]:item.rawPayment||item.rawAdvance),
        ...(completed?{'شناسه نوبت پرداخت':item.completedEntry?.executionId||'-','نوبت پرداخت':item.completedEntry?.legacy?'سابقه قدیمی؛ تفکیک نوبت ثبت نشده':`${item.completedEntry?.index} از ${item.completedEntry?.count}`,'مبلغ کل مصوب درخواست / ردیف (ریال)':excelRial(item.completedEntry!.approvedAmount),'روش پرداخت':item.paymentExecution?.paymentMethod||item.receiptObj?.paymentMethod||'-','شناسه فیش همین نوبت':item.receiptObj?.id||'-'}:{}),
      });
    }
  }

  // Original request metadata repeats on each execution; it is not additive.
  const uniqueOriginals=new Map(items.map(i=>[JSON.stringify([i.type,i.id,i.completedEntry?.rowId]),i]));
  const initialTotal=completed?[...uniqueOriginals.values()].reduce((sum,i)=>sum+BigInt(excelRial(i.initialAmount)),0n):detailRows.reduce((sum,r)=>sum+BigInt(r['مبلغ اولیه درخواستی (ریال)']||0),0n);
  if(completed)detailRows=detailRows.map(row=>Object.fromEntries(Object.entries(row).map(([key,value])=>[key==='مبلغ قابل پرداخت مصوب (ریال)'?'مبلغ پرداخت این نوبت (ریال)':key,value])));
  // Summary row at the bottom of the detail sheet
  detailRows.push({
    'ردیف': '',
    'کد رهگیری سند': 'جمع کل',
    'شناسه ردیف تجمیعی': `${detailRows.length} ردیف پرداختی`,
    'نوع درخواست': '',
    'عنوان / موضوع فرم': '',
    'نام ذینفع / گیرنده وجه': '',
    'واحد سازمانی': '',
    'مرکز هزینه': '',
    'مبلغ اولیه درخواستی (ریال)': excelRial(initialTotal),
    [completed?'مبلغ پرداخت این نوبت (ریال)':'مبلغ قابل پرداخت مصوب (ریال)']: excelRial(totalExportedAmount),
    ...(completed?{'مبلغ کل مصوب درخواست / ردیف (ریال)':excelRial([...uniqueOriginals.values()].reduce((sum,i)=>sum+BigInt(excelRial(i.completedEntry!.approvedAmount)),0n))}:{}),
    'واحد پول': 'ریال',
    'نام بانک مقصد': '',
    'شماره کارت / شماره حساب مقصد': '',
    'شماره شبا (IBAN)': '',
    'شماره فاکتور / سند مثبته': '',
    'موعد پرداخت / سررسید': '',
    'ماه مورد تقاضا': '',
    'اولویت': '',
    'سابقه مساعده قبلی': '',
    'شرح و بابت (توضیحات فرم)': '',
    'نام درخواست‌کننده': '',
    'کد پرسنلی درخواست‌کننده': '',
    'سرپرست تاییدکننده': '',
    'توضیحات سرپرست': '',
    'کارشناس حسابداری': '',
    'توضیحات حسابداری': '',
    'تاریخ ثبت درخواست': '',
    'ساعت ثبت درخواست': '',
    'تاریخ اقدام خزانه': '',
    'ساعت اقدام خزانه': '',
    'وضعیت فعلی': '',
    'زمان انتقال به مخزن در حال پرداخت': '',
    'بانک مبدأ پرداخت‌کننده (خزانه)': '',
    'عنوان حساب مبدأ شرکت': '',
    'شماره حساب / شبا مبدأ شرکت': '',
    'شماره پیگیری / مرجع بانکی': '',
    'تاریخ انجام پرداخت': '',
    'مسئول اجرای پرداخت': '',
  });

  const worksheet = XLSX.utils.json_to_sheet(detailRows);

  // Set generous column widths for readability in Excel
  worksheet['!cols'] = [
    { wch: 7 },  // ردیف
    { wch: 18 }, // کد رهگیری سند
    { wch: 16 }, // شناسه ردیف تجمیعی
    { wch: 22 }, // نوع درخواست
    { wch: 30 }, // عنوان / موضوع فرم
    { wch: 26 }, // نام ذینفع / گیرنده وجه
    { wch: 20 }, // واحد سازمانی
    { wch: 22 }, // مرکز هزینه
    { wch: 24 }, // مبلغ اولیه درخواستی (ریال)
    { wch: 26 }, // مبلغ قابل پرداخت مصوب (ریال)
    { wch: 10 }, // واحد پول
    { wch: 18 }, // نام بانک مقصد
    { wch: 24 }, // شماره کارت / شماره حساب مقصد
    { wch: 30 }, // شماره شبا (IBAN)
    { wch: 18 }, // شماره فاکتور / سند مثبته
    { wch: 16 }, // موعد پرداخت / سررسید
    { wch: 16 }, // ماه مورد تقاضا
    { wch: 15 }, // اولویت
    { wch: 16 }, // سابقه مساعده قبلی
    { wch: 38 }, // شرح و بابت
    { wch: 22 }, // نام درخواست‌کننده
    { wch: 18 }, // کد پرسنلی درخواست‌کننده
    { wch: 22 }, // سرپرست تاییدکننده
    { wch: 28 }, // توضیحات سرپرست
    { wch: 20 }, // کارشناس حسابداری
    { wch: 28 }, // توضیحات حسابداری
    { wch: 16 }, // تاریخ ثبت درخواست
    { wch: 24 }, // وضعیت فعلی
    { wch: 22 }, // زمان انتقال به مخزن در حال پرداخت
    { wch: 22 }, // بانک مبدأ پرداخت‌کننده
    { wch: 22 }, // شماره پیگیری بانکی
    { wch: 16 }, // تاریخ انجام پرداخت
    { wch: 22 }, // مسئول اجرای پرداخت
  ];

  // Configure RTL view for the sheet
  const headers=Object.keys(detailRows[0]||{});for(const name of ['تاریخ ثبت درخواست','ساعت ثبت درخواست','تاریخ اقدام خزانه','ساعت اقدام خزانه']){const index=headers.indexOf(name);if(index>=0)worksheet['!cols']![index]={wch:22};}
  for(const name of Object.keys(inquiryReportFields(undefined))){const index=headers.indexOf(name);if(index>=0)worksheet['!cols']![index]={wch:30};}
  if (!worksheet['!views']) worksheet['!views'] = [];
  worksheet['!views'].push({ rightToLeft: true });

  const workbook = XLSX.utils.book_new();
  if (!workbook.Workbook) workbook.Workbook = { Views: [{ RTL: true }] };

  const sheetName = (options?.sheetTitle || 'لیست پرداخت خزانه').slice(0, 31);
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const prefix = options?.fileNamePrefix || 'treasury-payment-export';
  const fileName = `${prefix}-${timestamp}.xlsx`;

  return {
    workbook,
    rowCount: detailRows.length - 1,
    totalAmount: totalExportedAmount<=BigInt(Number.MAX_SAFE_INTEGER)?Number(totalExportedAmount):totalExportedAmount,
    fileName,
  };
}

export function exportTreasuryItemsToExcel(items:UnifiedTreasuryItem[],options?:Parameters<typeof buildTreasuryExportWorkbook>[1]){
 const {workbook,...result}=buildTreasuryExportWorkbook(items,options);XLSX.writeFile(workbook,result.fileName);return result;
}

/**
 * Helper to convert raw database entities into UnifiedTreasuryItem objects
 * with complete form details.
 */
export function buildUnifiedTreasuryItems(
  paramsOrBatchPayments:
    | {
        batchPayments: BatchPaymentRequest[];
        paymentRequests: PaymentRequest[];
        advanceRequests: AdvanceRequest[];
        manualPayments?: ManualPayment[];
        receiptArchives: ReceiptArchive[];
        targetStatuses: RequestStatus[];
        includeManuals?: boolean;
      }
    | BatchPaymentRequest[],
  argPaymentRequests?: PaymentRequest[],
  argAdvanceRequests?: AdvanceRequest[],
  argManualPayments?: ManualPayment[],
  argReceiptArchives?: ReceiptArchive[],
  argTargetStatuses?: RequestStatus[],
  argIncludeManuals?: boolean
): UnifiedTreasuryItem[] {
  const isArrayFirst = Array.isArray(paramsOrBatchPayments);
  const batchPayments = isArrayFirst ? paramsOrBatchPayments : paramsOrBatchPayments.batchPayments;
  const paymentRequests = isArrayFirst ? argPaymentRequests || [] : paramsOrBatchPayments.paymentRequests;
  const advanceRequests = isArrayFirst ? argAdvanceRequests || [] : paramsOrBatchPayments.advanceRequests;
  const manualPayments = isArrayFirst ? argManualPayments || [] : paramsOrBatchPayments.manualPayments || [];
  const receiptArchives = isArrayFirst ? argReceiptArchives || [] : paramsOrBatchPayments.receiptArchives;
  const targetStatuses = isArrayFirst ? argTargetStatuses || [] : paramsOrBatchPayments.targetStatuses;
  const includeManuals = isArrayFirst
    ? argIncludeManuals !== undefined
      ? argIncludeManuals
      : (argManualPayments?.length || 0) > 0 && (argTargetStatuses || []).includes('Paid')
    : paramsOrBatchPayments.includeManuals || false;

  const findReceipt = (receiptId?: string | null, itemId?: string, trackingCode?: string) => {
    if (receiptId) {
      const byId = receiptArchives.find((r) => r.id === receiptId);
      if (byId) return byId;
    }
    if (itemId) {
      const byRelId = receiptArchives.find((r) => r.relatedPaymentIds.includes(itemId));
      if (byRelId) return byRelId;
    }
    if (trackingCode) {
      const byCode = receiptArchives.find((r) => r.relatedTrackingCodes.includes(trackingCode));
      if (byCode) return byCode;
    }
    return null;
  };

  // 1. Batch Requests matching targetStatuses (either batch status or sub-items matching targetStatuses)
  const batches: UnifiedTreasuryItem[] = [];
  for (const b of batchPayments) {
    const matchingSubItems = (b.items || []).filter((it) =>
      targetStatuses.includes((it.status || b.status) as RequestStatus)
    );
    const isBatchStatusMatch = targetStatuses.includes(b.status);

    if (matchingSubItems.length > 0) {
      const effectiveItems = matchingSubItems;
      const effectiveAmount = effectiveItems.reduce(
        (sum, it) => sum + (it.approvedAmount ?? it.amount),
        0
      );
      const initialSum = effectiveItems.reduce(
        (sum, it) => sum + (it.initialAmount ?? it.amount),
        0
      );
      const firstReceipt =
        findReceipt(null, b.id, b.trackingCode) ||
        findReceipt(effectiveItems[0]?.receiptId, effectiveItems[0]?.id);

      const distinctBanks = Array.from(
        new Set(effectiveItems.map((i) => i.bankName).filter(Boolean))
      );
      const effectiveStatus: RequestStatus = isBatchStatusMatch
        ? b.status
        : ((effectiveItems[0]?.status || b.status) as RequestStatus);

      const paidSoFar = effectiveItems.reduce(
        (sum, it) =>
          sum +
          (it.paidAmount ??
            it.paidAmountSoFar ??
            (it.status === 'Paid' ? (it.approvedAmount ?? it.amount) : 0)),
        0
      );
      const remainingSum = Math.max(0, effectiveAmount - paidSoFar);
      const allExecs = effectiveItems.flatMap((it) => it.paymentExecutions || []);

      batches.push({
        uid: `BAT:${b.id}`,
        id: b.id,
        type: 'BATCH',
        typeLabel:
          b.batchType === 'ADVANCE'
            ? `مساعده تجمیعی (${effectiveItems.length} ردیف)`
            : `پرداخت تجمیعی (${effectiveItems.length} ردیف)`,
        trackingCode: b.trackingCode,
        title: b.title,
        payeeName:
          effectiveItems.length === 1
            ? `${b.title} — ${effectiveItems[0].payeeName}`
            : `${b.title} (${effectiveItems.length} ذینفع)`,
        requesterName: b.requesterName,
        requesterPersonnelCode: b.requesterPersonnelCode,
        department: b.department,
        company: b.company || 'هلدینگ مرکزی آریا',
        costCenter:
          Array.from(new Set(effectiveItems.map((i) => i.costCenter).filter(Boolean))).join('، ') ||
          b.department,
        departmentOrCenter: b.department,
        description: `لیست تجمیعی ${effectiveItems.length} ردیفه واحد ${b.department} — ${b.title}`,
        initialAmount: initialSum,
        amount: effectiveAmount,
        paidAmountSoFar: paidSoFar,
        remainingAmount: remainingSum,
        dueDate: 'فوری',
        requestedMonth: effectiveItems[0]?.requestedMonth || '-',
        priority: 'Normal',
        priorityLabel: 'تجمیعی پرسنل',
        hasPreviousAdvanceLabel: '-',
        destinationBank:
          distinctBanks.length === 1
            ? distinctBanks[0]
            : `حساب‌های متعدد (${distinctBanks.join('، ')})`,
        accountOrCard:
          effectiveItems.length === 1
            ? effectiveItems[0].accountOrCard
            : `${effectiveItems.length} شماره کارت/حساب در لیست`,
        iban:
          effectiveItems.length === 1
            ? effectiveItems[0].iban
            : `${effectiveItems.length} شماره شبا در لیست`,
        ibanOrCode:
          effectiveItems.length === 1
            ? effectiveItems[0].iban
            : `${effectiveItems.length} شماره شبا و کارت`,
        cardNumber:
          effectiveItems.length === 1 ? effectiveItems[0].accountOrCard : undefined,
        invoiceNumber:
          Array.from(new Set(effectiveItems.map((i) => i.invoiceNumber).filter(Boolean))).join(
            '، '
          ) || '-',
        supervisorName: b.supervisorName || '-',
        approverNote: b.approverNote || '-',
        accountingName: 'واحد حسابداری',
        accountingNote: b.accountingNote || '-',
        createdAt: b.createdAt,
        status: effectiveStatus,
        inPaymentAt: b.inPaymentAt || effectiveItems[0]?.inPaymentAt || null,
        inPaymentBy: b.inPaymentBy || effectiveItems[0]?.inPaymentBy || null,
        sourceBankAccountId:
          b.sourceBankAccountId || effectiveItems[0]?.sourceBankAccountId || firstReceipt?.sourceBankAccountId || null,
        sourceAccountSnapshot:
          b.sourceAccountSnapshot || effectiveItems[0]?.sourceAccountSnapshot || firstReceipt?.sourceAccountSnapshot || null,
        paymentExecutions: allExecs,
        paymentHistory: allExecs,
        paidBankName: b.paidBankName || effectiveItems[0]?.paidBankName || firstReceipt?.bankName || null,
        paidDateJalali: b.paidDateJalali || effectiveItems[0]?.paidDateJalali || firstReceipt?.dateJalali || null,
        paidAt: b.paidAt || effectiveItems[0]?.paidAt || null,
        bankRefNumber: firstReceipt?.bankRefNumber || null,
        treasuryName: firstReceipt?.uploadedBy || 'خزانه‌داری',
        receiptId: firstReceipt?.id || null,
        receiptObj: firstReceipt,
        batchItems: effectiveItems,
        rawBatch: b,
      });
    }
  }

  // 2. Single Payment Requests
  const pays: UnifiedTreasuryItem[] = paymentRequests
    .filter((p) => targetStatuses.includes(p.status))
    .map((p) => {
      const rcp = findReceipt(p.receiptId, p.id, p.trackingCode);
      const totalApproved = p.approvedAmount ?? p.amount;
      const paidSoFar = p.paidAmount ?? p.paidAmountSoFar ?? (p.status === 'Paid' ? totalApproved : 0);
      const remaining = Math.max(0, totalApproved - paidSoFar);
      return {
        uid: `PAY:${p.id}`,
        id: p.id,
        type: 'PAYMENT',
        typeLabel: p.externalOrder?'دستور خارج سامانه':'دستور پرداخت تکی',
        trackingCode: p.trackingCode,
        title: p.description,
        payeeName: p.payeeName,
        requesterName: p.requesterName,
        requesterPersonnelCode: p.requesterPersonnelCode,
        department: p.department,
        company: p.company || 'هلدینگ مرکزی آریا',
        costCenter: p.costCenter,
        departmentOrCenter: `${p.department} / ${p.costCenter}`,
        description: p.externalOrder?`${p.description}\nدستوردهنده خارج سامانه: ${p.externalOrder.orderedBy}`:p.description,
        initialAmount: p.initialAmount ?? p.amount,
        amount: totalApproved,
        paidAmountSoFar: paidSoFar,
        remainingAmount: remaining,
        dueDate: p.dueDate,
        requestedMonth: '-',
        priority: p.priority,
        priorityLabel: getPriorityLabel(p.priority),
        hasPreviousAdvanceLabel: '-',
        destinationBank: p.bankName,
        accountOrCard: p.accountOrCard,
        iban: p.iban,
        ibanOrCode: p.iban,
        cardNumber: p.accountOrCard,
        invoiceNumber: p.invoiceNumber || '-',
        supervisorName: p.supervisorName || '-',
        approverNote: p.approverNote || '-',
        accountingName: p.accountingName || 'واحد حسابداری',
        accountingNote: p.accountingNote || '-',
        createdAt: p.createdAt,
        status: p.status,
        inPaymentAt: p.inPaymentAt || null,
        inPaymentBy: p.inPaymentBy || null,
        sourceBankAccountId: p.sourceBankAccountId || rcp?.sourceBankAccountId || null,
        sourceAccountSnapshot: p.sourceAccountSnapshot || rcp?.sourceAccountSnapshot || null,
        paymentExecutions: p.paymentExecutions || [],
        paymentHistory: p.paymentExecutions || [],
        paidBankName: p.paidBankName || rcp?.bankName || null,
        paidDateJalali: p.paidDateJalali || rcp?.dateJalali || null,
        paidAt: p.paidAt || null,
        bankRefNumber: rcp?.bankRefNumber || null,
        treasuryName: p.treasuryName || rcp?.uploadedBy || null,
        receiptId: p.receiptId || rcp?.id || null,
        receiptObj: rcp,
        rawPayment: p,
      };
    });

  // 3. Single Advance Requests
  const advs: UnifiedTreasuryItem[] = advanceRequests
    .filter((a) => targetStatuses.includes(a.status))
    .map((a) => {
      const rcp = findReceipt(a.receiptId, a.id, a.trackingCode);
      const totalApproved = a.approvedAmount ?? a.amount;
      const paidSoFar = a.paidAmount ?? a.paidAmountSoFar ?? (a.status === 'Paid' ? totalApproved : 0);
      const remaining = Math.max(0, totalApproved - paidSoFar);
      return {
        uid: `ADV:${a.id}`,
        id: a.id,
        type: 'ADVANCE',
        typeLabel: 'مساعده حقوق پرسنل',
        trackingCode: a.trackingCode,
        title: `مساعده ${a.requestedMonth} — ${a.requesterName}`,
        payeeName: destinationRecipient('ADVANCE',a),
        requesterName: a.requesterName,
        requesterPersonnelCode: a.requesterPersonnelCode,
        department: a.department,
        company: a.company || 'هلدینگ مرکزی آریا',
        costCenter: a.department,
        departmentOrCenter: a.department,
        description: `مساعده ${a.requestedMonth} — ${a.reason}`,
        initialAmount: a.initialAmount ?? a.amount,
        amount: totalApproved,
        paidAmountSoFar: paidSoFar,
        remainingAmount: remaining,
        dueDate: a.suggestedDate,
        requestedMonth: a.requestedMonth,
        priority: 'Normal',
        priorityLabel: 'عادی',
        hasPreviousAdvanceLabel:
          a.hasPreviousAdvance === true
            ? 'دارد'
            : a.hasPreviousAdvance === false
            ? 'ندارد'
            : 'بررسی نشده',
        destinationBank: a.bankName||'حساب حقوق پرسنل',
        accountOrCard: a.accountOrCard||`حساب حقوق (${a.requesterPersonnelCode})`,
        iban: a.iban||`کد پرسنلی ${a.requesterPersonnelCode}`,
        ibanOrCode: a.iban||`کد پرسنلی ${a.requesterPersonnelCode}`,
        invoiceNumber: '-',
        supervisorName: a.supervisorName || '-',
        approverNote: a.approverNote || '-',
        accountingName: a.accountingName || 'واحد حسابداری',
        accountingNote: a.accountingNote || '-',
        createdAt: a.createdAt,
        status: a.status,
        inPaymentAt: a.inPaymentAt || null,
        inPaymentBy: a.inPaymentBy || null,
        sourceBankAccountId: a.sourceBankAccountId || rcp?.sourceBankAccountId || null,
        sourceAccountSnapshot: a.sourceAccountSnapshot || rcp?.sourceAccountSnapshot || null,
        paymentExecutions: a.paymentExecutions || [],
        paymentHistory: a.paymentExecutions || [],
        paidBankName: a.paidBankName || rcp?.bankName || null,
        paidDateJalali: a.paidDateJalali || rcp?.dateJalali || null,
        paidAt: a.paidAt || null,
        bankRefNumber: rcp?.bankRefNumber || null,
        treasuryName: a.treasuryName || rcp?.uploadedBy || null,
        receiptId: a.receiptId || rcp?.id || null,
        receiptObj: rcp,
        rawAdvance: a,
      };
    });

  // 4. Manual / Phone Payments (when building COMPLETED payments list)
  const manuals: UnifiedTreasuryItem[] = includeManuals
    ? manualPayments.map((m) => {
        const rcp = findReceipt(null, m.id, m.trackingCode);
        return {
          uid: `MAN:${m.id}`,
          id: m.id,
          type: 'MANUAL',
          typeLabel: 'پرداخت فوری تلفنی / کاغذی',
          trackingCode: m.trackingCode,
          title: m.description,
          payeeName: m.payee,
          requesterName: m.orderedBy,
          requesterPersonnelCode: '-',
          department: 'مدیریت / دستور مستقیم',
          company: manualCompanyIdentity(m)?.company ?? m.sourceAccountSnapshot?.company ?? 'هلدینگ مرکزی آریا',
          costCenter: m.orderedBy,
          departmentOrCenter: m.orderedBy,
          description: m.description,
          initialAmount: m.amount,
          amount: m.amount,
          paidAmountSoFar: m.amount,
          remainingAmount: 0,
          dueDate: m.date,
          requestedMonth: '-',
          priorityLabel: 'فوری و اضطراری',
          hasPreviousAdvanceLabel: '-',
          destinationBank: m.bankName,
          accountOrCard: 'پرداخت مستقیم خزانه',
          iban: '-',
          ibanOrCode: `دستور: ${m.orderedBy}`,
          invoiceNumber: '-',
          supervisorName: m.orderedBy,
          approverNote: 'دستور مستقیم پرداخت',
          accountingName: '-',
          accountingNote: '-',
          createdAt: m.createdAt,
          status: 'Paid',
          sourceBankAccountId: m.sourceBankAccountId || rcp?.sourceBankAccountId || null,
          sourceAccountSnapshot: m.sourceAccountSnapshot || rcp?.sourceAccountSnapshot || null,
          paidBankName: m.bankName,
          paidDateJalali: m.date,
          paidAt: m.createdAt,
          bankRefNumber: rcp?.bankRefNumber || '-',
          treasuryName: m.createdByName,
          receiptId: rcp?.id || null,
          receiptObj: rcp,
          rawManual: m,
        };
      })
    : [];

  return [...batches, ...pays, ...advs, ...manuals].map(item=>{
    const raw=item.rawBatch||item.rawPayment||item.rawAdvance||item.rawManual;
    const creation={createdAt:raw?.createdAt,createdAtIso:raw?.createdAtIso,createdAtIsValueDate:item.type==='MANUAL'};
    const payments=item.type==='BATCH'?item.batchItems||[]:item.type==='MANUAL'?[{status:'Paid',paidAt:item.rawManual?.createdAtIso}]:item.rawPayment?[item.rawPayment]:item.rawAdvance?[item.rawAdvance]:[];
    return {...item,createdAtIso:raw?.createdAtIso,...requestTimeFields(creation,payments)};
  });
}
