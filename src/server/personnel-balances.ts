import crypto from 'node:crypto';
import type {Request,Response} from 'express';
import type {TreasuryDatabaseState as DB,User,PaymentRequest,AppNotification} from '../types/treasury';
import type {PersonnelBalanceRequest as Balance,PersonnelBalanceAudit} from '../types/personnel-balance';
import {balanceCanRead,balanceAccountant,balanceSummary,type BalanceAuth} from './personnel-balance-policy';
import {companyPolicy} from './company-access';
import {requestCostCenters} from '../utils/request-cost-center';
import {bankFieldsError,normalizedBankFields} from '../utils/bank-identifiers';
import {jalaliFromEpoch} from '../utils/jalali-date';
import {reviewedNotification,type NotificationDraft} from './notification-routing';
import {BalanceAmendError,mayAmendBalance,balanceAmendmentState,amendBalancePayment} from './personnel-balance-amend';

class BalanceError extends Error{constructor(public status:number,public code:string,message:string){super(message);}}
function fail(status:number,code:string,message:string):never{throw new BalanceError(status,code,message);}
const text=(v:unknown,label:string,required=false,max=4000)=>{if(v===undefined&&!required)return '';if(typeof v!=='string'||v.length>max||required&&!v.trim())fail(400,'INVALID_INPUT',label+' را درست وارد کنید.');return (v as string).trim();};
const declaredAmount=(v:unknown,clear=false):number|undefined=>{if(v===undefined||clear&&v===null)return undefined;if(typeof v!=='number'||!Number.isSafeInteger(v)||v<=0)fail(400,'INVALID_REQUESTED_AMOUNT','مبلغ اعلامی باید عدد صحیح مثبت به ریال باشد؛ اگر مبلغ مشخص نیست، فیلد را خالی بگذارید.');return v;};
const now=()=>new Date().toISOString(),uuid=()=>crypto.randomUUID();
const canonical=(v:any):any=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
type Options={get:(p:string,h:(req:Request,res:Response)=>unknown)=>unknown;post:(p:string,h:(req:Request,res:Response)=>unknown)=>unknown;read:()=>DB;save:(db:DB)=>unknown;auth:BalanceAuth;enabled:boolean;notify:(db:DB,n:NotificationDraft)=>unknown};

export function installPersonnelBalances(o:Options){
 const ensure=(db:DB,write=false)=>{if(!o.enabled||db.personnelBalanceSchemaVersion!==3)fail(403,'BALANCES_DISABLED','درخواست پرداخت پرسنلی در این محیط فعال نیست.');if(write&&db.personnelBalanceReadOnly)fail(409,'BALANCES_READ_ONLY','این بخش فعلاً فقط‌خواندنی است.');};
 const projection=(db:DB,u:User)=>({enabled:true,readOnly:db.personnelBalanceReadOnly===true,requests:(db.personnelBalanceRequests||[]).filter(q=>balanceCanRead(u,q,db,o.auth)).map(q=>{const accountant=balanceAccountant(u,q,db,o.auth),edit=balanceAmendmentState(u,q,db,o.auth);return{...q,accountingRevisions:accountant?q.accountingRevisions:undefined,canReview:q.status==='PENDING_ACCOUNTING'&&accountant,canAmend:edit.allowed,financialValues:edit.values,amendBlockedReason:edit.reason};}),summary:balanceSummary(db,u,o.auth)});
 const find=(db:DB,key:unknown)=>{const q=db.personnelBalanceRequests!.find(q=>q.id===key);if(!q)fail(404,'NOT_FOUND','درخواست پیدا نشد.');return q!;};
 const requireRead=(db:DB,u:User,q:Balance)=>{if(!balanceCanRead(u,q,db,o.auth))fail(403,'FORBIDDEN','دسترسی به این درخواست مجاز نیست.');};
 const audit=(u:User,action:string,reason?:string):PersonnelBalanceAudit=>({id:uuid(),actorId:u.id,actorName:u.name,at:now(),action,...reason?{reason}:{}});
 const op=(db:DB,u:User,kind:string,b:any)=>{if(typeof b.operationId!=='string'||!/^[-a-f0-9]{36}$/.test(b.operationId))fail(400,'OPERATION_REQUIRED','شناسه ثابت عملیات لازم است.');const fingerprint=crypto.createHash('sha256').update(JSON.stringify(canonical({kind,...b}))).digest('hex'),previous=db.personnelBalanceOperations!.find(p=>p.id===b.operationId);if(previous&&(previous.actorId!==u.id||previous.fingerprint!==fingerprint))fail(409,'OPERATION_CONFLICT','شناسهٔ عملیات قبلاً برای اطلاعات دیگری استفاده شده است.');if(previous)requireRead(db,u,find(db,previous.requestId));return{previous,fingerprint};};
 const record=(db:DB,u:User,b:any,fingerprint:string,q:Balance)=>db.personnelBalanceOperations!.push({id:b.operationId,actorId:u.id,fingerprint,requestId:q.id,at:now()});
 const notify=(db:DB,q:Balance,actorId:string)=>{const recipients=q.status==='PENDING_ACCOUNTING'?db.users.filter(u=>balanceAccountant(u,q,db,o.auth)):[db.users.find(u=>u.id===q.requesterId)].filter((u):u is User=>!!u);for(const recipient of recipients){if(recipient.id===actorId||!balanceCanRead(recipient,q,db,o.auth))continue;const n:AppNotification={id:uuid(),eventType:'PERSONNEL_BALANCE',title:q.status==='PENDING_ACCOUNTING'?'پرداخت پرسنلی؛ منتظر تعیین مبلغ حسابداری':'وضعیت درخواست پرداخت پرسنلی تغییر کرد',body:'درخواست را برای مشاهده وضعیت و اقدام مجاز باز کنید.',trackingCode:q.trackingCode,requestId:q.id,itemType:'PERSONNEL_BALANCE',recipientUserId:recipient.id,recipientRole:null,actorName:'سامانه',createdAt:now(),readByUserIds:[],targetSection:'PERSONNEL_BALANCES',personnelBalanceRef:{requestId:q.id,version:q.version,purpose:q.status==='PENDING_ACCOUNTING'?'ACCOUNTING':'MINE'}};(db.notifications||=[]).unshift(n);}db.notifications=db.notifications?.slice(0,1000);};
 const finish=(db:DB,u:User,res:Response,q?:Balance)=>{o.save(db);return res.json({success:true,requestId:q?.id,...projection(db,u)});};
 const post=(suffix:string,fields:string[],handler:(req:Request,res:Response,db:DB,u:User,b:any)=>unknown)=>o.post('/api/personnel-balances/'+suffix,(req,res)=>{try{const db=res.locals.commandDb as DB,u=res.locals.viewer as User,b=req.body||{};ensure(db,true);if(Object.keys(b).some(k=>!fields.includes(k)))fail(400,'INVALID_FIELDS','فیلد یا وضعیت ارسالی مجاز نیست.');return handler(req,res,db,u,b);}catch(e){if(e instanceof BalanceError||e instanceof BalanceAmendError)return res.status(e.status).json({error:e.message,code:e.code});throw e;}});
 o.get('/api/personnel-balances',(req,res)=>{try{const db=o.read();ensure(db);return res.json(projection(db,res.locals.viewer));}catch(e){if(e instanceof BalanceError)return res.status(e.status).json({error:e.message,code:e.code});throw e;}});

 post('create',['operationId','companyId','personnel','description','requestedAmount'],(_req,res,db,u,b)=>{
  const p=o.auth(u,db).effectivePermissions;if(!p.canRequestPersonnelBalance||!p.canViewPersonnelBalances)fail(403,'FORBIDDEN','مجوز ثبت درخواست پرداخت پرسنلی را ندارید.');
  const begun=op(db,u,'CREATE',b);if(begun.previous)return res.json({success:true,replayed:true,requestId:begun.previous.requestId,...projection(db,u)});
  const c=db.companies?.find(c=>c.id===b.companyId&&c.isActive!==false);if(!c||!companyPolicy(u,db).has(c.id)||u.role!=='ADMIN'&&o.auth(u,db).effectiveAccessScope==='DEPARTMENT'&&c.name!==u.company)fail(403,'COMPANY_FORBIDDEN','شرکت انتخاب‌شده مجاز نیست.');
  if(!b.personnel||Object.keys(b.personnel).some(k=>!['name','code','userId'].includes(k)))fail(400,'INVALID_PERSONNEL','مشخصات پرسنل معتبر نیست.');
  let personnel:Balance['personnel'];
  if(b.personnel.userId){const person=db.users.find(p=>p.id===b.personnel.userId);if(!person||person.isActive===false||person.company!==c.name||person.id===u.id)fail(403,'PERSONNEL_FORBIDDEN','فرد دیگری از پرسنل مجاز را انتخاب کنید.');const scope=o.auth(u,db).effectiveAccessScope;if(u.role!=='ADMIN'&&scope==='SELF_ONLY')fail(403,'PERSONNEL_FORBIDDEN','محدودهٔ این کاربر فقط حساب خودش است.');if(scope==='DEPARTMENT'&&person.department!==u.department)fail(403,'PERSONNEL_FORBIDDEN','پرسنل خارج از واحد مجاز است.');if(scope==='ASSIGNED_AND_SUBORDINATES'){let next:User|undefined=person;const seen=new Set<string>();while(next&&next.id!==u.id&&!seen.has(next.id)){seen.add(next.id);next=db.users.find(p=>p.id===next!.supervisorId);}if(next?.id!==u.id)fail(403,'PERSONNEL_FORBIDDEN','فرد انتخاب‌شده زیرمجموعهٔ شما نیست.');}personnel={userId:person.id,name:person.name,code:person.personnelCode};}
  else{
   // The separate personnel grant may allow a group maker to submit a named
   // instruction while SELF_ONLY still limits reading to that maker's cases.
   // Selecting another portal identity retains the scope checks above.
   const groupMaker=p.canCreateRequest&&(p.canSubmitBatchAdvance||p.canSubmitBatchPayment);
   if(o.auth(u,db).effectiveAccessScope==='SELF_ONLY'&&u.role!=='ADMIN'&&!groupMaker)fail(403,'PERSONNEL_FORBIDDEN','ثبت برای دیگران به مجوز ثبت گروهی و پرداخت پرسنلی نیاز دارد.');
   personnel={name:text(b.personnel.name,'نام پرسنل',true,200),code:text(b.personnel.code,'کد پرسنلی',false,100)};
  }
  const requestedAmount=declaredAmount(b.requestedAmount),created=audit(u,'ثبت درخواست پرداخت پرسنلی؛ منتظر بررسی حسابداری');if(requestedAmount!==undefined)created.requestedAmountChange={before:null,after:requestedAmount};
  const at=now(),id=uuid(),q:Balance={id,trackingCode:'BAL-'+jalaliFromEpoch(Date.now()).slice(0,4)+'-'+id.slice(0,8).toUpperCase(),version:1,companyId:c.id,company:c.name,department:u.department,requesterId:u.id,requesterName:u.name,personnel,description:text(b.description,'شرح درخواست پرداخت',true),...requestedAmount!==undefined?{requestedAmount}:{},status:'PENDING_ACCOUNTING',createdAt:at,updatedAt:at,accountingRevisions:[],audit:[created]};
  if(!db.users.some(x=>balanceAccountant(x,q,db,o.auth)))fail(409,'NO_ACCOUNTANT','حسابدار دیگری با اختیار این شرکت و درخواست وجود ندارد؛ مدیر دسترسی را تکمیل کند.');
  db.personnelBalanceRequests!.unshift(q);record(db,u,b,begun.fingerprint,q);notify(db,q,u.id);return finish(db,u,res,q);
 });
 post('action',['operationId','requestId','expectedVersion','action','reason','description','requestedAmount'],(_req,res,db,u,b)=>{
  const q=find(db,b.requestId);requireRead(db,u,q);const own=q.requesterId===u.id&&o.auth(u,db).effectivePermissions.canRequestPersonnelBalance,accountant=balanceAccountant(u,q,db,o.auth),admin=u.role==='ADMIN'&&!res.locals.session?.impersonation&&o.auth(u,db).effectivePermissions.canManagePersonnelBalances;
  if(!own&&!accountant&&!admin)fail(403,'FORBIDDEN','اجازه این اقدام را ندارید.');const begun=op(db,u,'ACTION',b);if(begun.previous)return res.json({success:true,replayed:true,...projection(db,u)});if(b.expectedVersion!==q.version)fail(409,'STALE_REQUEST','درخواست تغییر کرده؛ تازه‌سازی کنید.');if(q.financial||!['PENDING_ACCOUNTING','NEEDS_REVISION'].includes(q.status))fail(409,'WRONG_STAGE','این درخواست دیگر قابل تغییر از فرم اولیه نیست.');
  const reason=text(b.reason,'دلیل اقدام',true);let requestedAmountChange:PersonnelBalanceAudit['requestedAmountChange'];
  if(b.action!=='RESUBMIT'&&Object.hasOwn(b,'requestedAmount'))fail(400,'INVALID_FIELDS','مبلغ اعلامی فقط هنگام اصلاح و ارسال مجدد قابل تغییر است.');
  if(b.action==='RESUBMIT'&&own&&q.status==='NEEDS_REVISION'){q.description=text(b.description,'شرح اصلاح‌شده',true);if(Object.hasOwn(b,'requestedAmount')){const next=declaredAmount(b.requestedAmount,true);if(next!==q.requestedAmount){requestedAmountChange={before:q.requestedAmount??null,after:next??null};if(next===undefined)delete q.requestedAmount;else q.requestedAmount=next;}}q.status='PENDING_ACCOUNTING';if(!db.users.some(x=>balanceAccountant(x,q,db,o.auth)))fail(409,'NO_ACCOUNTANT','حسابدار واجدصلاحیت وجود ندارد.');}
  else if((b.action==='RETURN'||b.action==='REJECT')&&accountant&&q.status==='PENDING_ACCOUNTING'){if(!o.auth(u,db).effectivePermissions.canReturnForRevision)fail(403,'FORBIDDEN','مجوز برگشت یا رد درخواست ندارید.');q.status=b.action==='RETURN'?'NEEDS_REVISION':'REJECTED';}
  else if(b.action==='CANCEL'&&(own||admin))q.status='CANCELLED';
  else fail(403,'INVALID_ACTION','اقدام در این مرحله مجاز نیست.');q.version++;q.updatedAt=now();q.audit.push({...audit(u,b.action,reason),...requestedAmountChange?{requestedAmountChange}:{}});record(db,u,b,begun.fingerprint,q);notify(db,q,u.id);return finish(db,u,res,q);
 });
 post('approve',['operationId','requestId','expectedVersion','amount','payeeName','accountOrCard','iban','bankName','costCenter','note','identityVerified','amountReason'],(_req,res,db,u,b)=>{
  const q=find(db,b.requestId);requireRead(db,u,q);if(!balanceAccountant(u,q,db,o.auth))fail(403,'NOT_ACCOUNTANT','تعیین مبلغ و تأیید باید توسط حسابدار مجاز دیگری انجام شود.');const begun=op(db,u,'APPROVE',b);if(begun.previous)return res.json({success:true,replayed:true,requestId:q.id,...projection(db,u)});
  if(b.expectedVersion!==q.version)fail(409,'STALE_REQUEST','درخواست تغییر کرده؛ تازه‌سازی کنید.');if(q.status!=='PENDING_ACCOUNTING'||q.financial)fail(409,'ALREADY_FORWARDED','برای این درخواست قبلاً تصمیم گرفته شده است.');
  if(!Number.isSafeInteger(b.amount)||b.amount<=0)fail(400,'INVALID_AMOUNT','مبلغ قطعی باید عدد صحیح مثبت به ریال باشد.');if(u.role!=='ADMIN'&&(o.auth(u,db).effectiveApprovalLimitRial<=0||b.amount>o.auth(u,db).effectiveApprovalLimitRial))fail(403,'LIMIT_EXCEEDED','مبلغ خارج از سقف اختیار تأیید حسابداری شماست.');
  const amountReason=text(b.amountReason,'دلیل تفاوت مبلغ',q.requestedAmount!==undefined&&b.amount!==q.requestedAmount);
  if(q.requestedAmount!==undefined&&b.amount!==q.requestedAmount&&!amountReason.replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g,'').trim())fail(400,'AMOUNT_REASON_REQUIRED','دلیل روشن و قابل خواندن برای تفاوت مبلغ لازم است.');
  if(b.identityVerified!==true)fail(400,'IDENTITY_REQUIRED','هویت پرسنل و حساب مورد تسویه را تطبیق و تأیید کنید.');
  const costCenter=text(b.costCenter,'مرکز هزینه',true,200);if(!requestCostCenters(db.costCenters||[],db.companies||[],q).some(c=>c.name===costCenter))fail(400,'INVALID_COST_CENTER','مرکز هزینه فعال همان شرکت را انتخاب کنید.');
  const bank=normalizedBankFields({accountOrCard:text(b.accountOrCard,'کارت مقصد',false,100),iban:text(b.iban,'شبا',false,100),bankName:text(b.bankName,'بانک',false,200)}),bankError=bankFieldsError(bank);if(bankError)fail(400,'INVALID_DESTINATION',bankError);
  const payeeName=text(b.payeeName,'نام گیرنده وجه / صاحب حساب مقصد',false,200),note=text(b.note,'توضیح حسابداری',false),decisionReason=[amountReason,note].filter(Boolean).join('\n'),at=now(),id=uuid();
  const owner=db.users.find(x=>x.id===q.requesterId);if(!owner)fail(409,'OWNER_MISSING','ثبت‌کننده پیدا نشد؛ مدیر موضوع را بررسی کند.');
  const payment:PaymentRequest={id,trackingCode:'PAY-BAL-'+id.slice(0,8).toUpperCase(),createdAt:jalaliFromEpoch(Date.now()),createdAtIso:at,companyId:q.companyId,company:q.company,department:q.department,requesterId:q.requesterId,requesterName:q.requesterName,requesterPersonnelCode:owner!.personnelCode,description:q.description,amount:b.amount,initialAmount:b.amount,approvedAmount:b.amount,payeeName,...bank,costCenter,dueDate:jalaliFromEpoch(Date.now()),priority:'Normal',invoiceNumber:'',accountingNote:note||null,approverNote:null,rejectionReason:null,status:'Pending_Treasury',version:1,supervisorId:null,supervisorName:null,accountingId:u.id,accountingName:u.name,treasuryId:null,treasuryName:null,accountingDecidedAt:at,accountingApprovedVersion:1,accountingDecisionVersion:1,approvedByAccountingUserId:u.id,approvedByAccountingName:u.name,approvedByAccountingAt:at,paidBankName:null,paidAt:null,paidDateJalali:null,dailyCoverId:null,attachments:[],comments:[],auditHistory:[{id:uuid(),action:'تعیین مبلغ قطعی و تأیید حسابداری برای پرداخت پرسنلی',actorId:u.id,actorRole:u.role,changedBy:u.name,changedAt:at,stage:'ACCOUNTING',decision:'APPROVE',newAmount:b.amount,version:1,...decisionReason?{reason:decisionReason}:{}}],personnelBalanceRef:{schemaVersion:1,requestId:q.id,trackingCode:q.trackingCode,personnelName:q.personnel.name,...q.requestedAmount!==undefined?{requestedAmount:q.requestedAmount}:{},...q.personnel.userId?{personnelUserId:q.personnel.userId}:{},...q.personnel.code?{personnelCode:q.personnel.code}:{}}};
  db.paymentRequests.unshift(payment);q.financial={requestId:id,trackingCode:payment.trackingCode,amount:b.amount,initialAmount:b.amount,accountantId:u.id,accountantName:u.name,at};q.status='FORWARDED';q.version++;q.updatedAt=at;q.audit.push({...audit(u,'تعیین مبلغ قطعی و تأیید؛ ارسال مستقیم به خزانه',decisionReason),...q.requestedAmount!==undefined?{requestedAmount:q.requestedAmount}:{},approvedAmount:b.amount});record(db,u,b,begun.fingerprint,q);notify(db,q,u.id);o.notify(db,reviewedNotification(payment,payment,'PAYMENT','APPROVE',u.name,''));return finish(db,u,res,q);
 });
 post('amend',['operationId','requestId','expectedVersion','expectedPaymentVersion','amount','payeeName','accountOrCard','iban','bankName','costCenter','note','identityVerified','reason'],(_req,res,db,u,b)=>{
  const q=find(db,b.requestId);requireRead(db,u,q);
  if(!mayAmendBalance(u,q,db,o.auth))fail(403,'NOT_ACCOUNTANT','اصلاح باید توسط حسابدار مجاز، با اختیار ویرایش مبلغ و تأیید انجام شود.');
  const begun=op(db,u,'AMEND',b);if(begun.previous)return res.json({success:true,replayed:true,requestId:q.id,...projection(db,u)});
  const payment=amendBalancePayment(db,u,q,b,o.auth);
  record(db,u,b,begun.fingerprint,q);notify(db,q,u.id);o.notify(db,reviewedNotification(payment,payment,'PAYMENT','APPROVE',u.name,''));
  return finish(db,u,res,q);
 });
}
