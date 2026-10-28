import {balanceAccountant,balanceCanRead} from './personnel-balance-policy';
import {chainStateError} from '../utils/request-approval-chain';
import type {Request,Response} from 'express';
import type {TreasuryDatabaseState,User,BatchPaymentRequest,SecurityAuditLogEntry,AppNotification} from '../types/treasury';
import {canSeeRequest} from './access-control';
import {type AuthResolver,openWorkFor,openWorkDto} from './open-work';
import {correctionTarget,correctionStageAllowed} from './treasury-correction';
import {hasDeletionFinancialLinks} from '../utils/request-deletion';
import {openTreasuryCorrection} from '../utils/treasury-correction';
import {applyRejectionDecision,ownsOpenRejection,rejectionEventId} from '../utils/review-rejection';
import {inquiryAccountant,inquiryReviewer} from './account-inquiry-policy';
import {REQUEST_APPROVAL_TYPES} from '../utils/request-approval-routing';

type Deps={loadDb:()=>TreasuryDatabaseState;resolveUser:(req:Request,db:TreasuryDatabaseState)=>User|undefined;auth:AuthResolver;saveDb:(db:TreasuryDatabaseState)=>TreasuryDatabaseState;syncBatchStatus:(batch:BatchPaymentRequest)=>void;pushSecurityAuditLog:(db:TreasuryDatabaseState,entry:Omit<SecurityAuditLogEntry,'id'|'createdAt'>)=>unknown;pushAppNotification:(db:TreasuryDatabaseState,entry:Omit<AppNotification,'id'|'createdAt'|'readByUserIds'>)=>unknown};
type Routes={post:(path:string,handler:(req:Request,res:Response)=>unknown)=>unknown};
export function installOpenWorkAdmin(routes:Routes,d:Deps){
 const admin=(req:Request,res:Response,db:TreasuryDatabaseState)=>{const user=d.resolveUser(req,db);if(!user||user.role!=='ADMIN'||user.isActive===false||user.mustChangePassword){res.status(403).json({error:'این اقدام موردی فقط برای مدیر اصلی سامانه مجاز است.'});return;}return user;};
 routes.post('/api/admin/open-work',(req,res)=>{
  const db=d.loadDb();if(!admin(req,res,db))return;
  if(Object.keys(req.body).some(k=>k!=='targetUserId')||typeof req.body.targetUserId!=='string')return res.status(400).json({error:'کاربر مشخصی را برای بررسی انتخاب کنید.'});
  const user=db.users.find(u=>u.id===req.body.targetUserId);if(!user)return res.status(404).json({error:'کاربر یافت نشد.'});
  const work=openWorkFor(db,user,d.auth(user,db)),configuredRoutes=db.users.flatMap(u=>REQUEST_APPROVAL_TYPES.filter(t=>u.requestApprovers?.[t.key]===user.id).map(t=>({userId:u.id,type:t.key,label:t.label})));
  const inquiryWork=(db.accountInquiries||[]).flatMap(q=>q.rows.filter(r=>!['CLOSED','REJECTED','ANSWERED','INTERNAL_HANDLING'].includes(r.status)).flatMap(r=>{const base={inquiryId:q.id,rowId:r.id,trackingCode:q.trackingCode};return[...(q.requesterId===user.id?[{...base,kind:'INQUIRY_OWNER',label:'ثبت‌کنندهٔ استعلام باز؛ تعیین تکلیف یا بستن با دلیل'}]:[]),...(q.approverId===user.id?[{...base,kind:'INQUIRY_APPROVER',label:r.status==='AWAITING_RELEASE'?'بررسی پاسخ و اجازهٔ نمایش':'مرجع بررسی استعلام؛ ادامهٔ رسیدگی یا جانشینی با دلیل'}]:[]),...(r.status==='PENDING_ACCOUNTING'&&inquiryAccountant(user,q,db,d.auth)?[{...base,kind:'INQUIRY_ACCOUNTING',label:'پاسخ‌گویی حسابداری'}]:[])];}));
  const inquiryRoutes=db.users.filter(u=>u.accountInquiryRoute?.mode==='APPROVER'&&u.accountInquiryRoute.userId===user.id).map(u=>({userId:u.id,type:'ACCOUNT_INQUIRY',label:'مانده حساب و صورت‌حساب'}));const allConfiguredRoutes=[...configuredRoutes,...inquiryRoutes];
  const personnelBalanceWork=(db.personnelBalanceRequests||[]).filter(q=>['PENDING_ACCOUNTING','NEEDS_REVISION'].includes(q.status)&&balanceCanRead(user,q,db,d.auth)&&(q.requesterId===user.id||balanceAccountant(user,q,db,d.auth))).map(q=>({trackingCode:q.trackingCode,requestId:q.id,label:q.requesterId===user.id?'ثبت‌کنندهٔ درخواست باز پرداخت پرسنلی':'تعیین مبلغ و بررسی حسابداری پرداخت پرسنلی'}));
  return res.json({personnelBalanceWork,accountInquiryWork:inquiryWork.slice(0,200),accountInquiryWorkCount:inquiryWork.length,items:work.slice(0,200).map(openWorkDto),total:work.length,subordinateCount:db.users.filter(u=>u.supervisorId===user.id).length,configuredRouteCount:allConfiguredRoutes.length,configuredRoutes:allConfiguredRoutes.slice(0,200)});
 });
 routes.post('/api/admin/resolve-open-work',(req,res)=>{
  const db=d.loadDb(),actor=admin(req,res,db);if(!actor)return;
  const body=req.body,allowed=['itemType','requestId','rowId','expectedVersion','expectedStatus','expectedOwnerId','expectedStage','expectedRejectionId','action','reason','side','newUserId'];
  if(Object.keys(body).some(k=>!allowed.includes(k))||!['PAYMENT','ADVANCE','BATCH_ITEM'].includes(body.itemType)||typeof body.requestId!=='string'||!body.requestId||(body.itemType==='BATCH_ITEM'?typeof body.rowId!=='string'||!body.rowId:body.rowId!==undefined)||typeof body.reason!=='string'||!body.reason.trim()||body.reason.length>4000||!['APPROVE_REJECTED','CLOSE_REJECTED','REASSIGN_CORRECTION'].includes(body.action))return res.status(400).json({error:'هدف ردیفی، اقدام و دلیل اجباری معتبر را وارد کنید؛ تغییر اطلاعات مالی مجاز نیست.'});
  const {row,parent,batch}=correctionTarget(db,body);if(!row||!parent)return res.status(404).json({error:'ردیف یافت نشد.'});const chain=chainStateError(row);if(chain)return res.status(409).json({error:chain});
  if(!Number.isSafeInteger(body.expectedVersion)||body.expectedVersion!==(row.version||1)||body.expectedStatus!==row.status)return res.status(409).json({error:'نسخه یا وضعیت تغییر کرده است؛ کارهای باز را تازه‌سازی کنید.'});
  const reason=body.reason.trim(),at=new Date().toISOString();let previousOwner:string;
  if(body.action==='REASSIGN_CORRECTION'){
   if(!openTreasuryCorrection(row)||!['RECIPIENT','REFERRER'].includes(body.side)||row.paidAmount||row.paidAmountSoFar||row.paymentHistory?.length||row.paymentExecutions?.length||hasDeletionFinancialLinks(db,row.id))return res.status(409).json({error:'فقط مسئولِ اصلاح فنی باز و کاملاً ناپرداخته قابل تغییر است.'});
   const assignment=row.treasuryCorrection!,key=body.side==='RECIPIENT'?'toUserId':'byUserId';previousOwner=assignment[key];
   if(body.expectedOwnerId!==previousOwner)return res.status(409).json({error:'مسئول اصلاح تغییر کرده است؛ فهرست را تازه‌سازی کنید.'});
   const replacement=db.users.find(u=>u.id===body.newUserId);
   if(!replacement||replacement.id===previousOwner||replacement.isActive===false||replacement.mustChangePassword)return res.status(403).json({error:'مسئول جدید باید فرد متفاوت، فعال و واجد صلاحیت باشد.'});
   const auth=d.auth(replacement,db),p=auth.effectivePermissions;
   if(!canSeeRequest(parent,replacement,db,auth)||(body.side==='REFERRER'?!p.canExecutePayment:!correctionStageAllowed(replacement,assignment.toStage,auth)))return res.status(403).json({error:'مسئول جدید از قبل باید مجوز شرکت، مشاهده و اقدام همین اصلاح را داشته باشد.'});
   assignment.reassignments||=[];assignment.reassignments.push({side:body.side,fromUserId:previousOwner,toUserId:replacement.id,byUserId:actor.id,reason,at});
   assignment[key]=replacement.id;if(body.side==='RECIPIENT')assignment.toName=replacement.name;else{assignment.byName=replacement.name;row.returnedById=replacement.id;row.returnedByUserId=replacement.id;row.returnedByName=replacement.name;}
   row.version=(row.version||1)+1;(row.auditHistory||=[]).push({id:crypto.randomUUID(),action:`تغییر موردی مسئول اصلاح توسط مدیر؛ ${body.side==='RECIPIENT'?'گیرنده':'ارجاع‌دهنده'} از ${previousOwner} به ${replacement.id}`,actorId:actor.id,actorRole:actor.role,changedBy:actor.name,changedAt:at,stage:'TREASURY',version:row.version,reason});
   if(body.side==='RECIPIENT'||row.approvalChain)d.pushAppNotification(db,{eventType:'RETURNED_FOR_REVISION',title:'ارجاع موردی اصلاح فنی توسط مدیر',body:body.side==='RECIPIENT'?'مسئولیت اصلاح فنی این ردیف با ثبت دلیل به شما منتقل شد.':'خزانه‌دارِ دریافت‌کنندهٔ اصلاح با دلیل مدیر تغییر کرد؛ اصلاح همچنان در اختیار شماست.',trackingCode:parent.trackingCode,requestId:parent.id,rowId:batch?row.id:undefined,itemType:body.itemType,recipientUserId:assignment.toUserId,targetSection:assignment.toStage==='REQUESTER'?'REQUESTER':assignment.toStage==='APPROVER'?'APPROVER':'ACCOUNTING',actorName:actor.name});
  }else{
   if(body.side!==undefined||body.newUserId!==undefined)return res.status(400).json({error:'تعیین تکلیف ردشده، انتقال مسئول یا ویرایش اطلاعات نیست.'});
   const rejection=row.reviewRejection;previousOwner=rejection?.byUserId||'';
   const eventId=rejectionEventId(row);
   if(!rejection||!eventId||body.expectedStage!==rejection.stage||body.expectedRejectionId!==eventId||body.expectedOwnerId!==previousOwner||!ownsOpenRejection(row,previousOwner,rejection.stage))return res.status(409).json({error:'رد باز با مالک، مرحله و شناسه رخداد فعلی لازم است؛ فهرست را تازه‌سازی کنید.'});
   // This new authority is explicit and local; general reviewer ownership stays closed.
   const action=body.action==='APPROVE_REJECTED'?'APPROVE':'CLOSE_REJECTED';
   const auth=d.auth(actor,db),p=auth.effectivePermissions;
   if(!['APPROVER','ACCOUNTING'].includes(rejection.stage)||!canSeeRequest(parent,actor,db,auth)||!p[rejection.stage==='APPROVER'?'canAccessApproverCartable':'canAccessAccountingCartable']||!(action==='APPROVE'?p.canApprove:p.canReturnForRevision))return res.status(403).json({error:'مدیر باید مجوز جاری اقدام در همین مرحله را داشته باشد.'});
   if(action==='APPROVE'&&(!Number.isSafeInteger(row.approvedAmount??row.amount)||Number(row.approvedAmount??row.amount)<=0))return res.status(409).json({error:'مبلغ فعلی معتبر نیست؛ تعیین تکلیف نیازمند بررسی جداگانه است.'});
   applyRejectionDecision(row,action,rejection.stage,actor,reason,at);row.reviewRejection!.adminResolution={actorId:actor.id,previousOwnerId:previousOwner,action,reason,at};
   if(action==='APPROVE'&&rejection.stage==='APPROVER')row.adminSupervisorApproval={actorId:actor.id,rejectionId:eventId,reason,at};
   const treasury=row.status==='Pending_Treasury';d.pushAppNotification(db,{eventType:action==='APPROVE'?(treasury?'FINAL_APPROVED_ACCOUNTING':'APPROVED_SUPERVISOR'):'REQUEST_CLOSED',title:'تعیین تکلیف موردی درخواست توسط مدیر',body:action==='APPROVE'?'درخواست با تصمیم ثبت‌شده مدیر به مرحله بعد رفت.':reason,trackingCode:parent.trackingCode,requestId:parent.id,rowId:batch?row.id:undefined,itemType:body.itemType,recipientUserId:parent.requesterId,recipientRole:action==='APPROVE'?(treasury?'TREASURY':'ACCOUNTING'):null,actorName:actor.name,targetSection:action==='APPROVE'?(treasury?'TREASURY':'ACCOUNTING'):'REQUESTER'});
  }
  if(batch)d.syncBatchStatus(batch);
  d.pushSecurityAuditLog(db,{actionType:'OPEN_WORK_RESOLVED',actorId:actor.id,actorName:actor.name,targetUserId:previousOwner,description:`اقدام موردی مدیر روی ${body.itemType} ${parent.id}${batch?' / '+row.id:''}؛ ${body.action}؛ دلیل در سابقهٔ خصوصی همان درخواست محفوظ است.`});
  const state=d.saveDb(db);return res.json({success:true,state});
 });
}
