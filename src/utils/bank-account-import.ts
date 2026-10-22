import type { CompanyBankAccount, PaymentMethodType } from '../types/treasury';
import {bankDigits,bankFieldsError,normalizeIban} from './bank-identifiers';
export {bankDigits} from './bank-identifiers';

// One catalogue for the existing form, import validation and the downloadable template.
export const BANK_ACCOUNT_BANKS=['بانک ملت','بانک ملی ایران','بانک تجارت','بانک پاسارگاد','بانک سامان','بانک صادرات ایران','بانک پارسیان','بانک سپه','بانک شهر','بانک آینده','بانک رفاه کارگران','بانک مسکن','بانک کشاورزی'];
export const BANK_ACCOUNT_TYPES=['جاری','کوتاه‌مدت','پشتیبان','تنخواه'];
export const BANK_ACCOUNT_METHODS: Array<{id:PaymentMethodType;label:string}>=[{id:'PAYA',label:'پایا'},{id:'SATNA',label:'ساتنا'},{id:'CARD',label:'کارت‌به‌کارت'},{id:'INTERNAL',label:'داخلی'},{id:'CHECK',label:'چک'}];
export const BANK_IMPORT_COLUMNS=[['bankName','نام بانک *'],['accountTitle','عنوان حساب *'],['companyName','شرکت / صاحب حساب *'],['accountNumber','شماره حساب *'],['iban','شماره شبا'],['cardNumber','شماره کارت'],['accountType','نوع حساب'],['branchName','نام شعبه'],['branchCode','کد شعبه'],['allowedPaymentMethods','روش‌های پرداخت مجاز'],['status','وضعیت حساب'],['isDefault','حساب پیش‌فرض'],['description','توضیحات حساب']] as const;
export type BankImportField=typeof BANK_IMPORT_COLUMNS[number][0];
export type BankImportInput={rowNumber:number;values:Partial<Record<BankImportField,string>>};
export type BankImportAccount=Pick<CompanyBankAccount,'bankName'|'accountTitle'|'company'|'companyName'|'accountHolderName'|'accountNumber'|'iban'|'cardNumber'|'accountType'|'branchName'|'branchCode'|'description'|'currency'|'status'|'supportedMethods'>&{isDefault:boolean;isActive:boolean;allowedPaymentMethods:PaymentMethodType[]};
export type BankImportReviewRow={rowNumber:number;status:'NEW'|'DUPLICATE'|'ERROR';reason:string;bankName:string;accountTitle:string;companyName:string;accountNumber:string;account?:BankImportAccount;providedFields:string[]};
export type BankImportReport={rows:BankImportReviewRow[];newCount:number;duplicateCount:number;errorCount:number};
export type BankImportReply={ok:boolean;error?:string;report?:BankImportReport;previewToken?:string;createdCount?:number;skippedCount?:number};
export const BANK_IMPORT_LIMIT=200;
export function bankText(value:string):string{return value.trim().replace(/ي/g,'ی').replace(/ك/g,'ک').replace(/\s+/g,' ');}
function bankIdentifier(value:string|undefined):string{return bankDigits(value||'').replace(/[\s-]/g,'').toUpperCase();}
const keys=BANK_IMPORT_COLUMNS.map(([key])=>key),required=keys.slice(0,4);
export function bankImportShapeError(rows:unknown):string|undefined{
  if(!Array.isArray(rows)||!rows.length||rows.length>BANK_IMPORT_LIMIT)return 'فایل باید بین۱ تا۲۰۰ ردیف حساب داشته باشد.';
  if(rows.some(row=>!row||typeof row!=='object'||Object.keys(row).some(k=>!['rowNumber','values'].includes(k))||!Number.isSafeInteger(row.rowNumber)||row.rowNumber<2||row.rowNumber>10000||!row.values||Array.isArray(row.values)||typeof row.values!=='object'))return 'قالب ردیف‌های ورود معتبر نیست.';
  if(new Set(rows.map(row=>row.rowNumber)).size!==rows.length)return 'شماره ردیف اکسل تکرار شده است.';
}
function normalizeRow(input:BankImportInput):{account?:BankImportAccount;error?:string}{
  const v=input.values;
  if(Object.keys(v).some(key=>!keys.includes(key as BankImportField)))return {error:'ستون ناشناخته وجود دارد؛ فقط قالب سامانه مجاز است.'};
  if(Object.entries(v).some(([key,value])=>typeof value!=='string'||value.length>(key==='description'?2000:300)))return {error:'مقدار ستون‌ها باید متن معتبر باشد؛ شماره حساب، شبا، کارت و کد شعبه را در اکسل Text وارد کنید.'};
  if(required.some(key=>!v[key]?.trim()))return {error:'نام بانک، عنوان حساب، شرکت/صاحب حساب و شماره حساب الزامی‌اند.'};
  const bankName=bankText(v.bankName!),accountNumber=bankDigits(v.accountNumber!).trim();
  const iban=normalizeIban(v.iban||''),cardNumber=bankIdentifier(v.cardNumber),branchCode=bankDigits(v.branchCode||'').trim();
  const identifierError=bankFieldsError({iban,cardNumber});if(identifierError)return {error:identifierError};
  if(!BANK_ACCOUNT_BANKS.includes(bankName))return {error:'بانک از فهرست انتخابی قالب انتخاب نشده است.'};
  if(!/^\d{5,26}$/.test(accountNumber))return {error:'شماره حساب باید۵ تا۲۶ رقم متنی با حفظ صفر ابتدایی باشد.'};
  if(iban&&!/^IR\d{24}$/.test(iban))return {error:'شماره شبا باید IR و۲۴ رقم باشد.'};
  if(cardNumber&&!/^\d{16}$/.test(cardNumber))return {error:'شماره کارت باید۱۶ رقم باشد.'};
  if(branchCode&&!/^\d{1,20}$/.test(branchCode))return {error:'کد شعبه باید متنی و فقط شامل رقم باشد.'};
  const accountType=bankText(v.accountType||'جاری')||'جاری',status=bankText(v.status||'فعال')||'فعال',defaultText=bankText(v.isDefault||'خیر')||'خیر';
  if(!BANK_ACCOUNT_TYPES.includes(accountType))return {error:'نوع حساب از فهرست قالب انتخاب نشده است.'};
  if(!['فعال','غیرفعال','غیر فعال'].includes(status)||!['بله','خیر'].includes(defaultText))return {error:'وضعیت حساب یا گزینهٔ پیش‌فرض معتبر نیست.'};
  const isActive=status==='فعال',isDefault=defaultText==='بله';if(isDefault&&!isActive)return {error:'حساب غیرفعال نمی‌تواند پیش‌فرض باشد.'};
  const methodParts=v.allowedPaymentMethods?.trim()?v.allowedPaymentMethods.split(/[,،;؛|]/).map(bankText):['PAYA','SATNA','CARD','INTERNAL'];
  const methods=methodParts.map(value=>BANK_ACCOUNT_METHODS.find(m=>m.id===value.toUpperCase()||m.label===value)?.id);
  if(!methods.length||methods.some(m=>!m))return {error:'روش پرداخت نامعتبر است؛ روش‌های مجاز را با «،» جدا کنید.'};
  const allowedPaymentMethods=BANK_ACCOUNT_METHODS.filter(m=>methods.includes(m.id)).map(m=>m.id),companyName=bankText(v.companyName!);
  return {account:{bankName,accountNumber,accountTitle:bankText(v.accountTitle!),companyName,company:companyName,accountHolderName:companyName,iban:iban||undefined,cardNumber:cardNumber||undefined,branchCode:branchCode||undefined,branchName:bankText(v.branchName||'')||undefined,accountType,description:bankText(v.description||'')||undefined,currency:'IRR',isActive,isDefault,status:isActive?'ACTIVE':'INACTIVE',allowedPaymentMethods,supportedMethods:allowedPaymentMethods}};
}
function matchesIdentity(a:CompanyBankAccount|BankImportAccount,b:BankImportAccount):boolean{
  return (bankText(a.bankName)===b.bankName&&bankDigits(a.accountNumber).trim()===b.accountNumber)||!!(b.iban&&normalizeIban(a.iban||'')===b.iban)||!!(b.cardNumber&&bankIdentifier(a.cardNumber)===b.cardNumber);
}
function sameExplicitFields(existing:CompanyBankAccount|BankImportAccount,account:BankImportAccount,values:BankImportInput['values']):boolean{
  if(bankText(existing.bankName)!==account.bankName||bankDigits(existing.accountNumber).trim()!==account.accountNumber||bankText(existing.accountTitle)!==account.accountTitle||bankText(existing.companyName||existing.company||existing.accountHolderName||'')!==account.companyName)return false;
  for(const field of ['iban','cardNumber','branchName','branchCode','accountType','description'] as const){
    if(!values[field]?.trim())continue;
    const oldValue=field==='iban'?normalizeIban(existing.iban||''):field==='cardNumber'?bankIdentifier(existing[field]):bankText(existing[field]||'');
    if(oldValue!==(account[field]||''))return false;
  }
  if(values.status?.trim()&&(existing.isActive!==false&&existing.status!=='INACTIVE')!==account.isActive)return false;
  if(values.isDefault?.trim()==='بله'&&!existing.isDefault)return false;
  if(values.allowedPaymentMethods?.trim()){
    const old=existing.allowedPaymentMethods?.length?existing.allowedPaymentMethods:existing.supportedMethods?.length?existing.supportedMethods:['PAYA','SATNA','CARD'];
    if([...new Set(old)].sort().join('|')!==[...account.allowedPaymentMethods].sort().join('|'))return false;
  }
  return true;
}
/** Pure preflight, reused for preview and commit; never writes or mutates an existing account. */
export function assessBankImport(inputs:BankImportInput[],existing:CompanyBankAccount[]):BankImportReport{
  const seen:Array<CompanyBankAccount|BankImportAccount>=[...existing];
  const rows=inputs.map(input=>{
    const values=input.values,normalized=normalizeRow(input);
    const row:BankImportReviewRow={rowNumber:input.rowNumber,status:'ERROR',reason:normalized.error||'',providedFields:Object.keys(values).sort(),bankName:typeof values.bankName==='string'?bankText(values.bankName):'',accountTitle:typeof values.accountTitle==='string'?bankText(values.accountTitle):'',companyName:typeof values.companyName==='string'?bankText(values.companyName):'',accountNumber:typeof values.accountNumber==='string'?bankDigits(values.accountNumber).trim():''};
    if(!normalized.account)return row;row.account=normalized.account;
    const matches=seen.filter(old=>matchesIdentity(old,normalized.account!));
    if(matches.length){
      if(matches.length!==1||!sameExplicitFields(matches[0],normalized.account,values)){row.reason='شناسه یا اطلاعات با حساب موجود/ردیف دیگر تعارض دارد؛ حساب قبلی تغییر نمی‌کند.';return row;}
      row.status='DUPLICATE';row.reason=existing.includes(matches[0] as CompanyBankAccount)?'قبلاً ثبت شده؛ بدون تغییر':'ردیف یکسان در همین فایل؛ یک بار ثبت می‌شود';return row;
    }
    if(normalized.account.isDefault&&existing.some(old=>old.isDefault)){row.reason='حساب پیش‌فرض قبلی تغییر نمی‌کند؛ گزینهٔ پیش‌فرض این ردیف را «خیر» کنید.';return row;}
    row.status='NEW';row.reason='آمادهٔ ثبت';seen.push(normalized.account);return row;
  });
  const defaults=rows.filter(row=>row.status==='NEW'&&row.account?.isDefault);
  if(defaults.length>1)for(const row of defaults){row.status='ERROR';row.reason='در هر ورود فقط یک حساب جدید می‌تواند پیش‌فرض باشد.';}
  return {rows,newCount:rows.filter(r=>r.status==='NEW').length,duplicateCount:rows.filter(r=>r.status==='DUPLICATE').length,errorCount:rows.filter(r=>r.status==='ERROR').length};
}
