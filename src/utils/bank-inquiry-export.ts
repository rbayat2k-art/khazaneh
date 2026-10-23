import * as XLSX from 'xlsx';
import {validIranIban,normalizeIban} from './bank-identifiers';
import {fullyUnpaid} from './treasury-correction';
import {requestTimeFields} from './record-time';
import {inquirySourceLabel,type InquirySource} from './bank-inquiry';
type Entry={row:any;trackingCode:string;payee:string};
export function bankInquiryExportError(rows:any[],requiredSource?:InquirySource):string|null{
 if(!rows.length)return 'برای خروجی شبا یک یا چند ردیف انتخاب کنید.';
 if(rows.some(r=>!fullyUnpaid(r)))return 'فقط ردیف‌های کاملاً پرداخت‌نشده قابل خروجی شبا هستند.';
 if(requiredSource&&rows.some(r=>r.bankInquiry?.source!==requiredSource||r.bankInquiry.status!=='FOUND'||!r.bankInquiry.checkedAt||!Number.isFinite(Date.parse(r.bankInquiry.checkedAt))))return 'برای خروجی تست واقعی، نتیجه موفق واقعی همین محیط لازم است؛ نتیجه مصنوعی،نامشخص یا قدیمی معتبر نیست.';
 if(rows.some(r=>!validIranIban(normalizeIban(r.iban||''))))return 'خروجی شبا صادر نشد؛ شبای معتبر همه ردیف‌های انتخابی را تکمیل کنید.';
 if(rows.some(row=>{const r=row.bankInquiry;if(!r)return false;if(r.destinationReviewRequired||r.code==='STALE_RESULT')return true;
  // A failed optional lookup must not revoke an existing valid manual IBAN.
  if(['QUEUED','RUNNING','ERROR','UNKNOWN'].includes(r.status)&&!r.iban&&!r.depositStatus)return false;
  return r.status!=='FOUND'||!r.ownerConfirmed||!['02','03'].includes(r.depositStatus)||r.iban!==normalizeIban(row.iban||'');}))return 'خروجی شبا صادر نشد؛ نتیجه استعلام یا اختلاف نام/شبا هنوز تعیین تکلیف نشده است.';
 return null;
}
export function bankInquiryWorkbook(entries:Entry[],requiredSource?:InquirySource){
 const error=bankInquiryExportError(entries.map(e=>e.row),requiredSource);if(error)throw Error(error);
 const header=['ردیف','کد درخواست','نام صاحب حساب','شماره شبا','مبلغ ریال','بانک مقصد','شرح','وضعیت حساب بانکی','تاریخ استعلام','ساعت استعلام','منبع استعلام'];
 const values=entries.map(({row,trackingCode,payee},i)=>{const amount=row.approvedAmount??row.amount;if(!Number.isSafeInteger(amount)||amount<=0)throw Error('مبلغ خروجی باید ریال صحیح مثبت باشد.');const r=row.bankInquiry,time=r?.checkedAt?requestTimeFields({createdAtIso:r.checkedAt}):null;return [i+1,trackingCode,payee,normalizeIban(row.iban),amount>999999999999999?String(amount):amount,r?.bankName||row.bankName||'',row.description||row.reason||'',r?.depositStatus||'واردشده دستی',time?.registrationDate||'',time?.registrationTime||'',inquirySourceLabel(r?.source)];});
 const sheet=XLSX.utils.aoa_to_sheet([header,...values]);for(const [name,cell] of Object.entries(sheet))if(!name.startsWith('!')&&cell&&typeof cell==='object'&&typeof cell.v==='string'){cell.t='s';cell.z='@';delete cell.f;}
 sheet['!cols']=header.map((_,i)=>({wch:[7,22,32,31,24,22,40,20,16,12,32][i]}));sheet['!views']=[{rightToLeft:true}];const book=XLSX.utils.book_new();book.Workbook={Views:[{RTL:true}]};XLSX.utils.book_append_sheet(book,sheet,'پرداخت با شبا');return book;
}
export function exportBankInquiryRows(entries:Entry[],requiredSource?:InquirySource){const book=bankInquiryWorkbook(entries,requiredSource);XLSX.writeFile(book,`shahrah-iban-${new Date().toISOString().slice(0,10)}.xlsx`);}
