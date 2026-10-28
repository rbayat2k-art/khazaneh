import type{AccountInquiry,AccountInformation,AccountInquiryAudit}from'../types/account-inquiry';
import type{User,TreasuryDatabaseState as DB}from'../types/treasury';
import{ACCOUNT_INFORMATION_LABELS}from'../types/account-inquiry';
import{linkedInquiryEditable}from'../utils/account-inquiry-linked';
import{inquiryPerm,inquiryFail,type InquiryAuth}from'./account-inquiry-policy';
import{inquiryText,inquiryDate}from'./account-inquiry-input';
type Audit=(actor:User,action:string,reason?:string)=>AccountInquiryAudit;
export function editLinkedInquiry(db:DB,q:AccountInquiry,u:User,b:any,auth:InquiryAuth,audit:Audit){
 if(!inquiryPerm(u,db,auth,'canRequestLinkedAccountInquiry')||q.requesterId!==u.id||q.origin!=='FINANCIAL_REVIEW')inquiryFail(403,'INQUIRY_EDIT_FORBIDDEN','فقط ثبت‌کنندهٔ مجاز می‌تواند استعلام متصل خودش را اصلاح کند.');
 if(!linkedInquiryEditable(q,u.id))inquiryFail(409,'INQUIRY_EDIT_LOCKED','پس از اولین پاسخ حسابداری، درخواست اولیه تغییر نمی‌کند؛ پرسش تکمیلی را در گفتگو ثبت کنید.');
 if(!Number.isSafeInteger(b.expectedVersion)||b.expectedVersion!==q.version)inquiryFail(409,'STALE_INQUIRY','استعلام تغییر کرده است؛ اطلاعات تازه را ببینید.');
 const allowed=new Set(['operationId','inquiryId','expectedVersion','information','asOf','fromDate','toDate','rows']);if(Object.keys(b).some(k=>!allowed.has(k)))inquiryFail(400,'INVALID_EDIT','فقط اطلاعات موردنیاز، تاریخ‌ها و توضیحات استعلام قابل اصلاح‌اند.');
 if(!Array.isArray(b.information))inquiryFail(400,'INVALID_INFORMATION','اطلاعات موردنیاز را انتخاب کنید.');const information=[...new Set(b.information)]as AccountInformation[];if(!information.length||information.some(v=>!['BALANCE','STATEMENT','EXPLANATION'].includes(v)))inquiryFail(400,'INVALID_INFORMATION','اطلاعات موردنیاز معتبر نیست.');
 const asOf=inquiryDate(b.asOf),fromDate=inquiryDate(b.fromDate),toDate=inquiryDate(b.toDate);if(fromDate&&toDate&&fromDate>toDate)inquiryFail(400,'INVALID_RANGE','ابتدای بازه بعد از انتهای آن است.');
 if(!Array.isArray(b.rows)||b.rows.length!==q.rows.length||new Set(b.rows.map((r:any)=>r?.id)).size!==q.rows.length||b.rows.some((r:any)=>!r||Object.keys(r).some(k=>!['id','question'].includes(k))||!q.rows.some(row=>row.id===r.id)))inquiryFail(400,'INVALID_EDIT_ROWS','همهٔ ردیف‌های همین استعلام باید بدون تغییر هویت ارسال شوند.');
 const questions=new Map<string,string>(b.rows.map((r:any)=>[r.id,inquiryText(r.question,'شرح استعلام',false)]));
 const labels=(v:AccountInformation[])=>v.map(x=>ACCOUNT_INFORMATION_LABELS[x]).join('، '),old=`اطلاعات قبلی: ${labels(q.information)}؛ تاریخ مبنا: ${q.asOf||'—'}؛ از: ${q.fromDate||'—'}؛ تا: ${q.toDate||'—'}`,next=`اطلاعات تازه: ${labels(information)}؛ تاریخ مبنا: ${asOf||'—'}؛ از: ${fromDate||'—'}؛ تا: ${toDate||'—'}`;
 q.audit.push(audit(u,'EDIT_REQUEST',old+'\n'+next));q.information=information;q.asOf=asOf;q.fromDate=fromDate;q.toDate=toDate;q.version++;q.updatedAt=new Date().toISOString();
 for(const row of q.rows){const question=questions.get(row.id)!;row.audit.push(audit(u,'EDIT_REQUEST',`شرح پیش از اصلاح: ${row.question||'—'}\nشرح اصلاح‌شده: ${question||'—'}`));row.audit.push({...audit(u,'متن استعلام پس از اصلاح اولیه'),reason:question});row.question=question;row.version++;}
}
