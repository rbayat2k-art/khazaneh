import type{AppNotification}from'../types/treasury';
import type{AccountInquiryTab}from'../types/account-inquiry';
export function accountInquiryNoticeTab(ref:NonNullable<AppNotification['accountInquiryRef']>):AccountInquiryTab{return ref.purpose==='APPROVE'?'APPROVAL':ref.purpose==='RESPOND'?'ACCOUNTING':ref.purpose==='RELEASE'?'RELEASE':ref.targetTab==='HISTORY'?'HISTORY':'MINE';}
