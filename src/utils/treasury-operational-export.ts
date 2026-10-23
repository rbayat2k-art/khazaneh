import type {UnifiedTreasuryItem} from './excelExport';
import {rialCell,confirmedDestinationAccount,type ReportRow} from './report-cells';
import {reportWorkbook,downloadReportWorkbook} from './report-workbook';
import {requestTimeFields} from './record-time';

export function buildTreasuryOperationalWorkbook(items:UnifiedTreasuryItem[]){
 const completed=items.some(i=>i.completedEntry);
 if(items.some(i=>!!i.completedEntry!==completed)||new Set(items.map(i=>i.uid)).size!==items.length)throw Error('انتخاب خروجی خزانه معتبر نیست.');
 if(items.some(i=>i.completedEntry?.issue||completed&&i.type==='BATCH'&&(i.batchItems?.length!==1||i.completedEntry?.rowId!==i.batchItems[0].id)))throw Error('تاریخچه پرداخت ناسازگار است؛ خروجی تا بررسی مسدود است.');
 const rows:ReportRow[]=[];let total=0n;
 for(const item of items){
  const sources=item.type==='BATCH'?item.batchItems||[]:[item.rawPayment||item.rawAdvance||item.rawManual];
  for(const row of sources){
   if(!row)continue;
   const batch=item.type==='BATCH',manual=item.type==='MANUAL',raw:any=row,approved=raw.approvedAmount??raw.amount,paid=raw.paidAmount??raw.paidAmountSoFar??(raw.status==='Paid'?approved:0);
   rialCell(approved);rialCell(paid);if(paid>approved)throw Error('مانده پرداخت ناسازگار است.');
   const amount=completed?item.amount:approved-paid;if(!completed&&amount===0)continue;
   rialCell(amount);total+=BigInt(amount);
   const time=completed?item:requestTimeFields(item.rawBatch||raw,[raw]);
   rows.push({
    'ردیف':rows.length+1,'کد رهگیری سند':item.trackingCode||item.id,'شناسه ردیف گروهی':batch?raw.id:'',
    'نام دریافت‌کننده (صاحب حساب)':(batch?raw.bankPayeeName||raw.payeeName:item.payeeName)||'ثبت نشده',
    'شرح سند حسابداری / بابت پرداخت':batch?raw.description||item.rawBatch?.title||'':item.description||'',
    'مرکز هزینه':manual||item.type==='ADVANCE'?'':batch?raw.costCenter||'':item.costCenter||'',
    'بانک مقصد':manual?'':batch?raw.bankName||'':item.destinationBank||'',
    'شماره کارت مقصد':batch?raw.accountOrCard||'':item.cardNumber||item.rawPayment?.accountOrCard||item.rawAdvance?.accountOrCard||'',
    'شماره حساب مقصد':confirmedDestinationAccount(raw),'شماره شبا مقصد':batch?raw.iban||'':item.rawPayment?.iban||item.rawAdvance?.iban||'',
    [completed?'مبلغ پرداخت این نوبت (ریال)':'مبلغ نهایی قابل پرداخت (ریال)']:rialCell(amount),
    'تاریخ ثبت درخواست':time?.registrationDate||'ثبت نشده','ساعت ثبت درخواست':time?.registrationTime||'ثبت نشده',
    'تاریخ اقدام خزانه':time?.treasuryActionDate||'—','ساعت اقدام خزانه':time?.treasuryActionTime||'—',
    ...(completed?{
     'شناسه نوبت پرداخت':item.completedEntry?.executionId||'تفکیک ثبت نشده',
     'بانک مبدأ پرداخت‌کننده (خزانه)':item.paidBankName||'ثبت نشده',
     'عنوان حساب مبدأ':item.sourceAccountSnapshot?.accountTitle||'','شماره حساب مبدأ':item.sourceAccountSnapshot?.accountNumber||'',
     'تاریخ واقعی پرداخت':item.paidDateJalali||'ثبت نشده','شماره پیگیری / مرجع بانکی':item.bankRefNumber||''
    }:{'تاریخ نیاز پرداخت':item.dueDate||''})
   });
  }
 }
 const amountKey=completed?'مبلغ پرداخت این نوبت (ریال)':'مبلغ نهایی قابل پرداخت (ریال)';
 rows.push({'ردیف':'','کد رهگیری سند':'جمع کل',[amountKey]:rialCell(total)});
 return {workbook:reportWorkbook([{name:completed?'پرداخت‌های ثبت‌شده':'فهرست عملیاتی پرداخت',rows}]),rowCount:rows.length-1,totalAmount:total<=BigInt(Number.MAX_SAFE_INTEGER)?Number(total):total};
}
export function exportTreasuryOperational(items:UnifiedTreasuryItem[],options?:{fileNamePrefix?:string;sheetTitle?:string}){
 const {workbook,...result}=buildTreasuryOperationalWorkbook(items);
 return {...result,fileName:downloadReportWorkbook(workbook,options?.fileNamePrefix||'treasury-operational')};
}
