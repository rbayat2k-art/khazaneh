import crypto from 'node:crypto';
import type{TreasuryDatabaseState as DB,AppNotification}from'../types/treasury';
import type{AccountInquiry,AccountInquiryRow,AccountInquiryTab}from'../types/account-inquiry';
import{inquiryAccountant,inquiryCanRead,inquiryVisibleReplyIds,type InquiryAuth}from'./account-inquiry-policy';

type Purpose=NonNullable<AppNotification['accountInquiryRef']>['purpose'];
export function notifyInquiryCurrent(db:DB,q:AccountInquiry,row:AccountInquiryRow,auth:InquiryAuth,event='',actorId?:string){
 let purpose:Purpose,recipients:string[];
 if(row.status==='PENDING_APPROVER'){purpose='APPROVE';recipients=q.approverId?[q.approverId]:[];}
 else if(row.status==='PENDING_ACCOUNTING'){purpose='RESPOND';recipients=db.users.filter(u=>inquiryAccountant(u,q,db,auth)).map(u=>u.id);}
 else if(row.status==='AWAITING_RELEASE'){purpose='RELEASE';recipients=q.approverId?[q.approverId]:[];}
 else if(row.status==='NEEDS_REVISION'){purpose='REVISE';recipients=[q.requesterId];}
 else{purpose='VIEW';recipients=[q.requesterId,...q.approverId?[q.approverId]:[]];}
 for(const recipient of new Set(recipients)){
  const user=db.users.find(u=>u.id===recipient);if(!user||recipient===actorId||!inquiryCanRead(user,q,db,auth))continue;
  const latest=row.replies.at(-1),replyId=purpose==='VIEW'&&['RESPOND','RELEASE'].includes(event)&&latest&&inquiryVisibleReplyIds(user,q,row,db,auth).has(latest.id)?latest.id:undefined;
  const targetTab:AccountInquiryTab=purpose==='APPROVE'?'APPROVAL':purpose==='RESPOND'?'ACCOUNTING':purpose==='RELEASE'?'RELEASE':recipient===q.requesterId?'MINE':'HISTORY';
  const title=purpose==='APPROVE'?'استعلام؛ منتظر تأیید و ارجاع شما':purpose==='RESPOND'?(event==='FOLLOW_UP'?'پرسش تکمیلی استعلام؛ منتظر پاسخ حسابداری':event==='EDIT_REQUEST'?'استعلام اصلاح شده؛ منتظر پاسخ حسابداری':'استعلام؛ منتظر پاسخ حسابداری'):purpose==='RELEASE'?'پاسخ حسابداری؛ منتظر بررسی و اجازهٔ نمایش':purpose==='REVISE'?(event==='RESPOND'||event==='RELEASE'?'استعلام؛ اطلاعات تکمیلی لازم است':'استعلام برای اصلاح برگشت داده شد'):event==='CONVERT'?'درخواست مالی مرتبط با استعلام ثبت شد':event==='REJECT'?'استعلام رد شد':event==='CLOSE'?'استعلام بسته شد':event==='HANDLE_INTERNALLY'?'سرپرست رسیدگی به استعلام را برعهده گرفت':replyId?'پاسخ حسابداری برای بررسی شما آماده است':'به‌روزرسانی استعلام مانده و صورت‌حساب';
  (db.notifications||=[]).unshift({id:crypto.randomUUID(),eventType:'ACCOUNT_INQUIRY',title,body:'برای مشاهدهٔ وضعیت و اقدام مجاز، استعلام را باز کنید.',trackingCode:q.trackingCode,requestId:q.id,rowId:row.id,itemType:'ACCOUNT_INQUIRY',recipientUserId:recipient,recipientRole:null,actorName:'سامانه',createdAt:new Date().toISOString(),readByUserIds:[],targetSection:'ACCOUNT_INQUIRIES',accountInquiryRef:{inquiryId:q.id,rowId:row.id,rowVersion:row.version,purpose,targetTab,...replyId?{replyId}:{}}});
 }
 db.notifications=db.notifications?.slice(0,1000);
}
