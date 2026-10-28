import type{AccountInquiryRow}from'../types/account-inquiry';
export function inquiryPersonnel(row:Pick<AccountInquiryRow,'financialIntent'|'financialSource'|'subject'>){return row.financialIntent==='ADVANCE'||!row.financialIntent&&(row.financialSource?.itemType==='ADVANCE'||row.subject.kind==='EMPLOYEE'&&row.financialSource?.itemType!=='PAYMENT');}
export function inquirySubjectLabel(row:Pick<AccountInquiryRow,'financialIntent'|'financialSource'|'subject'>){return inquiryPersonnel(row)?'نام پرسنل':'نام شخص / شرکت طرف‌حساب';}
