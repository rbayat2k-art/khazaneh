import crypto from 'node:crypto';
import type{TreasuryDatabaseState as DB,User,PaymentRequest}from'../types/treasury';
import type{PersonnelBalanceRequest as Balance,PersonnelBalanceFinancialValues as Values}from'../types/personnel-balance';
import{balanceAccountant,type BalanceAuth}from'./personnel-balance-policy';
import{fullyUnpaid}from'../utils/treasury-correction';
import{requestCostCenters}from'../utils/request-cost-center';
import{normalizedBankFields,bankFieldsError}from'../utils/bank-identifiers';
import{invalidateBankInquiry}from'../utils/bank-inquiry';

export class BalanceAmendError extends Error{status:number;code:string;constructor(status:number,code:string,message:string){super(message);this.status=status;this.code=code;}}
const fail=(status:number,code:string,message:string):never=>{throw new BalanceAmendError(status,code,message);};
const text=(v:unknown,label:string,required=false,max=4000)=>{if(v===undefined&&!required)return'';if(typeof v!=='string'||v.length>max||required&&!v.trim())fail(400,'INVALID_INPUT',label+' را درست وارد کنید.');return(v as string).trim();};
export const balanceFinancialValues=(p:PaymentRequest):Values=>({amount:p.approvedAmount??p.amount,costCenter:p.costCenter,payeeName:p.payeeName||'',accountOrCard:p.accountOrCard||'',iban:p.iban||'',bankName:p.bankName||'',note:p.accountingNote||''});
export function mayAmendBalance(u:User,q:Balance,db:DB,auth:BalanceAuth){return balanceAccountant(u,q,db,auth)&&!!auth(u,db).effectivePermissions.canEditAmount;}
export function balanceAmendmentState(u:User,q:Balance,db:DB,auth:BalanceAuth){
 if(!q.financial||!mayAmendBalance(u,q,db,auth))return{allowed:false};
 const p=db.paymentRequests.find(p=>p.id===q.financial!.requestId);
 if(q.status!=='FORWARDED'||!p||p.personnelBalanceRef?.requestId!==q.id||p.personnelBalanceRef.schemaVersion!==1||p.requesterId!==q.requesterId||p.companyId!==q.companyId||p.company!==q.company||p.personnelBalanceRef.personnelName!==q.personnel.name||p.personnelBalanceRef.requestedAmount!==q.requestedAmount||p.initialAmount!==q.financial.initialAmount||p.amount!==q.financial.amount||(p.approvedAmount??p.amount)!==q.financial.amount)return{allowed:false,reason:'پیوند یا نسخهٔ مالی درخواست نیازمند بررسی مدیر است.'};
 const values={...balanceFinancialValues(p),paymentVersion:p.version||1,status:p.status};
 if(!fullyUnpaid(p)||p.dailyCoverId||(db.dailyCovers||[]).some(c=>c.paymentRequestIds.includes(p.id))||(db.receiptArchives||[]).some(r=>r.relatedPaymentIds.includes(p.id)))return{allowed:false,values,reason:'اصلاح فقط برای درخواست کاملاً پرداخت‌نشده در صف یا مخزن مجاز است؛ پرداخت، فیش یا روکش قبلی بازنویسی نمی‌شود.'};
 return{allowed:db.personnelBalanceReadOnly!==true,values,payment:p,reason:db.personnelBalanceReadOnly?'این بخش فعلاً فقط‌خواندنی است.':undefined};
}

/** Mutates only the command's private transaction draft. Caller saves both records,
 * histories, idempotency receipt and notifications in its existing atomic commit. */
export function amendBalancePayment(db:DB,u:User,q:Balance,b:any,auth:BalanceAuth){
 const state=balanceAmendmentState(u,q,db,auth);
 if(!state.allowed||!state.payment)fail(409,'AMENDMENT_BLOCKED',state.reason||'اصلاح این درخواست در وضعیت فعلی مجاز نیست.');
 const p=state.payment!;
 if(b.expectedVersion!==q.version||b.expectedPaymentVersion!==(p.version||1))fail(409,'STALE_REQUEST','درخواست یا وضعیت خزانه تغییر کرده است؛ وضعیت تازه را دریافت کنید.');
 const reason=text(b.reason,'دلیل اصلاح حسابداری',true);
 if(!Number.isSafeInteger(b.amount)||b.amount<=0)fail(400,'INVALID_AMOUNT','مبلغ قطعی باید عدد صحیح مثبت به ریال باشد.');
 const a=auth(u,db);if(u.role!=='ADMIN'&&(a.effectiveApprovalLimitRial<=0||b.amount>a.effectiveApprovalLimitRial))fail(403,'LIMIT_EXCEEDED','مبلغ خارج از سقف اختیار تأیید حسابداری شماست.');
 if(b.identityVerified!==true)fail(400,'IDENTITY_REQUIRED','هویت پرسنل، حساب و مبلغ اصلاح‌شده را تطبیق و تأیید کنید.');
 const costCenter=text(b.costCenter,'مرکز هزینه',true,200);
 if(!requestCostCenters(db.costCenters||[],db.companies||[],q).some(c=>c.name===costCenter))fail(400,'INVALID_COST_CENTER','مرکز هزینه فعال همان شرکت را انتخاب کنید.');
 const bank=normalizedBankFields({accountOrCard:text(b.accountOrCard,'کارت مقصد',false,100),iban:text(b.iban,'شبا',false,100),bankName:text(b.bankName,'بانک',false,200)}),error=bankFieldsError(bank);
 if(error)fail(400,'INVALID_DESTINATION',error);
 const after:Values={amount:b.amount,costCenter,payeeName:text(b.payeeName,'نام صاحب حساب',false,200),accountOrCard:bank.accountOrCard||'',iban:bank.iban||'',bankName:bank.bankName||'',note:text(b.note,'توضیح حسابداری')};
 const before=balanceFinancialValues(p),at=new Date().toISOString(),requestVersion=q.version,paymentVersion=p.version||1,previousStatus=p.status;
 invalidateBankInquiry(p,after);
 if(p.bankInquiry&&before.payeeName!==after.payeeName){p.bankInquiry.ownerConfirmed=false;p.bankInquiry.destinationReviewRequired=true;}
 for(const job of db.bankInquiryJobs||[])if(job.target.itemType==='PAYMENT'&&job.target.requestId===p.id&&['QUEUED','RUNNING'].includes(job.status)){job.status='CANCELLED';job.finishedAt=at;if(p.bankInquiry?.jobId===job.id){p.bankInquiry.status='ERROR';p.bankInquiry.code='STALE_RESULT';p.bankInquiry.fingerprint='';p.bankInquiry.ownerConfirmed=false;p.bankInquiry.destinationReviewRequired=true;}}
 Object.assign(p,{amount:after.amount,approvedAmount:after.amount,costCenter:after.costCenter,payeeName:after.payeeName,accountOrCard:after.accountOrCard,iban:after.iban,bankName:after.bankName,accountingNote:after.note||null,status:'Pending_Treasury',version:paymentVersion+1,inPaymentAt:null,inPaymentBy:null,treasuryId:null,treasuryName:null,accountingId:u.id,accountingName:u.name,accountingDecidedAt:at,accountingApprovedVersion:paymentVersion+1,accountingDecisionVersion:paymentVersion+1,approvedByAccountingUserId:u.id,approvedByAccountingName:u.name,approvedByAccountingAt:at});
 (p.auditHistory||=[]).push({id:crypto.randomUUID(),action:'اصلاح اطلاعات حسابداری پیش از اولین پرداخت؛ بازگشت به صف خزانه',actorId:u.id,actorRole:u.role,changedBy:u.name,changedAt:at,stage:'ACCOUNTING',decision:'UPDATE_AMOUNT',previousStatus,previousAmount:before.amount,newAmount:after.amount,reason,version:p.version});
 q.accountingRevisions!.push({id:crypto.randomUUID(),actorId:u.id,actorName:u.name,at,reason,requestVersionBefore:requestVersion,requestVersionAfter:requestVersion+1,paymentVersionBefore:paymentVersion,paymentVersionAfter:paymentVersion+1,before,after});
 Object.assign(q.financial!,{amount:after.amount,accountantId:u.id,accountantName:u.name,at});q.version++;q.updatedAt=at;
 q.audit.push({id:crypto.randomUUID(),actorId:u.id,actorName:u.name,at,action:'اصلاح اطلاعات حسابداری و ارسال دوباره به صف انتظار خزانه',reason});
 return p;
}
