import type{AccountInquiry,AccountInquiryReply,FinancialInquiryTarget}from'../types/account-inquiry';
/** Versions belong to the historical consultation snapshot, not to source identity. */
type FinancialIdentity=Pick<FinancialInquiryTarget,'itemType'|'requestId'|'rowId'>;
export function sameInquirySource(a:FinancialIdentity,b:FinancialIdentity){return a.itemType===b.itemType&&a.requestId===b.requestId&&(a.itemType!=='BATCH_ITEM'||!!a.rowId&&a.rowId===b.rowId);}
export function linkedInquiryRowMatches(row:AccountInquiry['rows'][number],targets:FinancialInquiryTarget[],origin:AccountInquiry['origin']){return targets.some(t=>origin==='FINANCIAL_REVIEW'&&!!row.financialSource&&sameInquirySource(row.financialSource,t)||origin!=='FINANCIAL_REVIEW'&&!!row.financialResult&&sameInquirySource(row.financialResult,t));}
export function linkedInquiryMatches(q:AccountInquiry,targets:FinancialInquiryTarget[]){return q.rows.some(r=>linkedInquiryRowMatches(r,targets,q.origin));}
export function compareLinkedInquiries(a:AccountInquiry,b:AccountInquiry){const latest=(q:AccountInquiry)=>q.rows.flatMap(r=>r.replies).map(r=>r.createdAt).sort().at(-1)||'',left=latest(a),right=latest(b);return left&&!right?-1:right&&!left?1:right.localeCompare(left)||b.createdAt.localeCompare(a.createdAt);}
const tehranCalendar=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'});
export function inquiryTehranDay(at:number){if(!Number.isFinite(at))return '';const p=tehranCalendar.formatToParts(new Date(at)),get=(key:string)=>p.find(p=>p.type===key)?.value||'';return get('year')+'-'+get('month')+'-'+get('day');}
export function conversionReplyFreshness(reply:Pick<AccountInquiryReply,'createdAt'|'asOf'|'balance'|'kind'>,today:string){const answered=inquiryTehranDay(Date.parse(reply.createdAt)),asOf=reply.asOf;if(reply.kind!=='COMPLETE'||!answered||!/^\d{4}-\d{2}-\d{2}$/.test(today)||reply.balance!==undefined&&!asOf)return 'UNKNOWN';if(answered>today||asOf&&asOf>today)return 'FUTURE';return answered===today&&(!asOf||asOf===today)?'TODAY':'OLDER';}
export function linkedInquiryEditable(q:AccountInquiry,userId:string){return q.origin==='FINANCIAL_REVIEW'&&q.requesterId===userId&&q.rows.length>0&&q.rows.every(r=>r.status==='PENDING_ACCOUNTING'&&r.replies.length===0);}
export function initialInquiryQuestion(row:AccountInquiry['rows'][number]){
 const firstMessage=row.audit.findIndex(a=>['FOLLOW_UP','RESUBMIT'].includes(a.action)),before=firstMessage<0?row.audit:row.audit.slice(0,firstMessage),edited=before.filter(a=>a.action==='متن استعلام پس از اصلاح اولیه').at(-1),registered=before.find(a=>a.action==='ثبت ردیف استعلام');
 if(edited)return{text:edited.reason||'',label:'درخواست ثبت‌شده'};
 if(registered)return{text:registered.reason||'',label:'درخواست ثبت‌شده'};
 const original=before.find(a=>['متن درخواست پیش از اصلاح','متن درخواست پیش از تغییر'].includes(a.action)&&a.reason);
 return original?{text:original.reason!,label:'درخواست پیش از مکاتبات'}:{text:row.question,label:firstMessage>=0?'متن جاری درخواست':'درخواست ثبت‌شده'};
}
