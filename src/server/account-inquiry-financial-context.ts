import type{TreasuryDatabaseState as DB,User}from'../types/treasury';
import type{AccountInquiry,AccountInquiryRow,FinancialInquiryTarget}from'../types/account-inquiry';
import type{AccountInquiryView,InquiryRowView,InquiryView}from'../types/account-inquiry-view';
import{inquiryCanRead,inquiryCompany,inquiryProjection,inquiryFail,type InquiryAuth}from'./account-inquiry-policy';
import{canSeeRequest}from'./access-control';
import{companyPolicy}from'./company-access';
import{correctionTarget}from'./treasury-correction';
import{chainError,chainStateError,currentSupervisorId}from'../utils/request-approval-chain';
import{linkedInquiryRowMatches,inquiryTehranDay,initialInquiryQuestion}from'../utils/account-inquiry-linked';

function financial(db:DB,t:Pick<FinancialInquiryTarget,'itemType'|'requestId'|'rowId'>){const result=correctionTarget(db,t);if(!result.parent||!result.row||result.parent.requesterDeletedAt||result.row.requesterDeletedAt)return;return{...result,parent:result.parent,row:result.row};}
function sameCompany(q:AccountInquiry,parent:any){return !!parent&&(parent.companyId?parent.companyId===q.companyId:parent.company===q.companyName);}
/** A financial assignment never opens the entire original inquiry. */
export function conversionReplyIds(u:User,q:AccountInquiry,r:AccountInquiryRow,db:DB,resolve:InquiryAuth){
 const result=r.financialResult;if(!result||q.origin==='FINANCIAL_REVIEW'||q.origin==='SELF'&&u.id===q.requesterId||!r.replies.some(reply=>reply.id===result.replyId)||!inquiryCompany(u,q,db,resolve))return new Set<string>();
 const found=financial(db,result);if(!found||!sameCompany(q,found.parent))return new Set<string>();
 const{parent,row}=found,a=resolve(u,db),p=a.effectivePermissions;
 if(u.isActive===false||u.mustChangePassword||u.id===parent.requesterId||a.effectiveAccessScope==='SELF_ONLY'||!p.canRequestLinkedAccountInquiry||!p.canAccessApproverCartable||!p.canApprove||!p.canViewRequests||!companyPolicy(u,db).financial(parent)||!canSeeRequest(parent,u,db,a)||row.status!=='Pending_Approver'||currentSupervisorId(parent,row)!==u.id||chainError(row)||chainStateError(row))return new Set<string>();
 return new Set(r.replies.map(reply=>reply.id));
}
export function canReadInquiryRow(u:User,q:AccountInquiry,r:AccountInquiryRow,db:DB,resolve:InquiryAuth){return inquiryCanRead(u,q,db,resolve)||conversionReplyIds(u,q,r,db,resolve).size>0;}

export function linkedInquiryProjection(db:DB,u:User,resolve:InquiryAuth,body:any):AccountInquiryView{
 if(!body||Object.keys(body).some(k=>k!=='targets')||!Array.isArray(body.targets)||!body.targets.length||body.targets.length>50)inquiryFail(400,'INVALID_TARGETS','بین ۱ تا ۵۰ ردیف مالی انتخاب کنید.');
 const targets=body.targets as FinancialInquiryTarget[],seen=new Set<string>();
 for(const t of targets){
  if(!t||Object.keys(t).some(k=>!['itemType','requestId','rowId','expectedVersion','expectedStatus'].includes(k))||!['ADVANCE','PAYMENT','BATCH_ITEM'].includes(t.itemType)||typeof t.requestId!=='string'||!t.requestId||(t.itemType==='BATCH_ITEM'?typeof t.rowId!=='string'||!t.rowId:t.rowId!==undefined)||!Number.isSafeInteger(t.expectedVersion)||t.expectedVersion<1||t.expectedStatus!==undefined&&typeof t.expectedStatus!=='string')inquiryFail(400,'INVALID_TARGET','ردیف مالی معتبر انتخاب کنید.');
  const key=JSON.stringify([t.itemType,t.requestId,t.rowId]);if(seen.has(key))inquiryFail(400,'DUPLICATE_TARGET','ردیف مالی تکراری است.');seen.add(key);
  const found=financial(db,t);if(!found)inquiryFail(404,'NOT_FOUND','درخواست مالی پیدا نشد.');
  const{parent,row}=found!,a=resolve(u,db);
  if(u.isActive===false||u.mustChangePassword||!companyPolicy(u,db).financial(parent)||!canSeeRequest(parent,u,db,a))inquiryFail(403,'FINANCIAL_FORBIDDEN','دسترسی به این ردیف مالی مجاز نیست.');
  if((row.version||1)!==t.expectedVersion||t.expectedStatus!==undefined&&row.status!==t.expectedStatus||chainError(row)||chainStateError(row))inquiryFail(409,'STALE_FINANCIAL_REQUEST','ردیف مالی تغییر کرده است؛ فهرست را تازه‌سازی کنید.');
 }
 const base=inquiryProjection(db,u,resolve),today=inquiryTehranDay(Date.now()),inquiries:InquiryView[]=[];
 for(const q of db.accountInquiries||[]){
  const ordinary=base.inquiries.find(v=>v.id===q.id),rows:InquiryRowView[]=[];
  for(const r of q.rows.filter(r=>linkedInquiryRowMatches(r,targets,q.origin))){
   if(!r.financialResult){const visible=ordinary?.rows.find(v=>v.id===r.id);if(visible)rows.push(visible);continue;}
   const converted=r.financialResult,selected=targets.find(t=>t.itemType===converted.itemType&&t.requestId===converted.requestId&&(t.itemType!=='BATCH_ITEM'||t.rowId===converted.rowId));
   if(!selected||!sameCompany(q,financial(db,converted)?.parent)||!inquiryCompany(u,q,db,resolve))continue;
   // The owner approved later replies for the actual financial reviewer, while
   // personal requesters retain the ordinary version-specific release boundary.
   const visibleIds=new Set([...(ordinary?.rows.find(v=>v.id===r.id)?.replies||[]).map(reply=>reply.id),...conversionReplyIds(u,q,r,db,resolve)]);
   const reply=r.replies.find(reply=>reply.id===converted.replyId);if(!visibleIds.has(converted.replyId)||!reply)continue;
   const attachments=resolve(u,db).effectivePermissions.canViewAttachments;
   const question=initialInquiryQuestion({...r,audit:r.audit.filter(a=>a.at<=converted.at)}).text;
   // Reply history is authorized; private reviewer notes and subsequent questions are not.
   const audit=r.audit.filter(a=>['RESPOND','ساخت درخواست مالی مرتبط'].includes(a.action)).map(({reason,...a})=>a);
   const replies=r.replies.filter(reply=>visibleIds.has(reply.id)).map(reply=>({...reply,fileIds:attachments?reply.fileIds:[],files:attachments?(db.accountInquiryFiles||[]).filter(f=>!f.discardedAt&&f.inquiryId===q.id&&f.rowId===r.id&&reply.fileIds.includes(f.id)).map(({sha256,...f})=>f):[]}));
   rows.push({id:r.id,version:r.version,subject:{...(reply.subjectSnapshot||r.subject)},question,activeQuestion:question,status:r.status,financialIntent:reply.financialIntent||r.financialIntent,financialResult:{...converted},audit,releasedReplyIds:replies.map(reply=>reply.id),hiddenReplyCount:0,latestReplyVisible:true,stagedFiles:[],replies,conversionContext:{replyId:reply.id,financialTarget:{...selected},trackingCode:converted.trackingCode,convertedAt:converted.at,today}});
  }
  if(rows.length)inquiries.push({...q,title:rows.some(r=>r.conversionContext)?'استعلام مبدأ درخواست مالی':q.title,reviewerIds:[],audit:[],rows});
 }
 return{enabled:base.enabled,readOnly:base.readOnly,permissions:base.permissions,inquiries};
}
