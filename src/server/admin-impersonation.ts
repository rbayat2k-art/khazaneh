import crypto from 'node:crypto';
import {AsyncLocalStorage} from 'node:async_hooks';
import {current,isDraft} from 'immer';
import type {Request,Response} from 'express';
import type {TreasuryDatabaseState,User,UserSessionRecord,SecurityAuditLogEntry,AdminSessionProvenance} from '../types/treasury';

const parentHash=(token:string)=>crypto.createHash('sha256').update(token).digest('hex');
const active=(s:UserSessionRecord|undefined,now:number):s is UserSessionRecord=>!!s&&!s.revoked&&s.expiresAt>now;
export function resolvePortalSession(token:string|null,db:TreasuryDatabaseState,now=Date.now()):{user:User|null;session:UserSessionRecord|null}{
 const session=token?db.sessions?.find(s=>s.token===token):undefined;
 if(!active(session,now))return {user:null,session:null};
 const user=db.users.find(u=>u.id===session.userId&&u.isActive!==false);
 if(!user)return {user:null,session:null};
 if(session.impersonation){
  const link=session.impersonation,admin=db.users.find(u=>u.id===link.adminId&&u.role==='ADMIN'&&u.isActive!==false&&!u.mustChangePassword);
  const parent=db.sessions?.find(s=>parentHash(s.token)===link.parentSessionHash);
  if(!admin||!active(parent,now)||parent.userId!==admin.id||parent.impersonation)return {user:null,session:null};
 }
 return {user,session};
}
export function impersonationRequestError(session:UserSessionRecord,route:string,body:any,method='POST'):string|undefined{
 if(!session.impersonation)return;
 // Express accepts case and trailing-slash aliases for the same handler.
 route=route.toLowerCase().replace(/\/+$/,'');
 if(route.startsWith('/auth/impersonation/')||['/auth/change-password','/auth/logout-other-sessions'].includes(route)||method!=='GET'&&['/bank-inquiry/credential','/bank-inquiry/connections'].includes(route)||route==='/auth/preferences'&&(body?.twoFactorEnabled!==undefined||body?.twoFactorPin!==undefined))return 'برای تغییر امنیت حساب، کلیدهای اتصال یا ورود مدیریتی، ابتدا به حساب مدیر بازگردید.';
}
export function publicImpersonation(session:UserSessionRecord,db:TreasuryDatabaseState){
 const p=session.impersonation;if(!p)return null;
 return {id:p.id,adminName:db.users.find(u=>u.id===p.adminId)?.name||'مدیر سامانه',targetName:db.users.find(u=>u.id===session.userId)?.name||'',reason:p.reason,startedAt:session.createdAt,expiresAt:session.expiresAt};
}
type Context={provenance:AdminSessionProvenance;route:string;response:Response};
const context=new AsyncLocalStorage<Context|undefined>();
export function withImpersonationAction(req:Request,res:Response,run:()=>unknown){
 const p=(res.locals.session as UserSessionRecord|undefined)?.impersonation;
 const db=res.locals.commandDb as TreasuryDatabaseState|undefined;
 const admin=p&&db?.users.find(u=>u.id===p.adminId);
 return context.run(p&&admin?{provenance:{id:p.id,adminId:admin.id,adminName:admin.name,reason:p.reason,userId:res.locals.viewer.id,userName:res.locals.viewer.name},route:req.path,response:res}:undefined,run);
}
/** Event attribution and the command log are part of the SAME durable commit. */
export function stampImpersonatedCommit(db:TreasuryDatabaseState,base:TreasuryDatabaseState|undefined){
 const ctx=context.getStore();if(!ctx||ctx.response.headersSent)return;
 const p=ctx.provenance,resources:Array<{collection:string;id:string}>=[];
 const visit=(row:any,old:any)=>{
  if(!row||typeof row!=='object')return;
  for(const key of ['auditHistory','paymentHistory','comments','bankOwnerConfirmations','audit','replies','accountingRevisions'])if(Array.isArray(row[key])){
   const existing=new Set((old?.[key]||[]).map((e:any)=>e.id||JSON.stringify(e)));
   for(const e of row[key])if(!existing.has(e.id||JSON.stringify(e))){e.adminSession={...p};if(key==='auditHistory'&&!e.actorId){e.actorId=p.userId;e.actorRole=(ctx.response.locals.viewer as User).role;}}
  }
  if(Array.isArray(row.items))for(const child of row.items)visit(child,old?.items?.find((x:any)=>x.id===child.id));
  if(Array.isArray(row.rows))for(const child of row.rows)visit(child,old?.rows?.find((x:any)=>x.id===child.id));
 };
 for(const collection of ['advanceRequests','paymentRequests','batchPayments','manualPayments','receiptArchives','companyBankAccounts','dailyCovers','bankInquiryJobs','bankInquiryOperations','accountInquiries','accountInquiryFiles','accountInquiryOperations','personnelBalanceRequests','personnelBalanceOperations'] as const){
  const oldRows=new Map<string,any>((base?.[collection]||[]).map((r:any)=>[r.id||r.key,r]));
  for(const row of (db[collection]||[]) as any[]){const old=oldRows.get(row.id||row.key);if((isDraft(row)?current(row):row)===old)continue;visit(row,old);if(!old)row.adminSession={...p};resources.push({collection,id:row.id||row.key});}
 }
 for(const log of db.securityAuditLogs||[])if(!base?.securityAuditLogs?.some(e=>e.id===log.id))log.adminSession={...p};
 (db.securityAuditLogs||=[]).unshift({id:crypto.randomUUID(),actionType:'IMPERSONATED_ACTION',actorId:p.adminId,actorName:p.adminName,targetUserId:(ctx.response.locals.viewer as User).id,targetUserName:(ctx.response.locals.viewer as User).name,description:'اقدام مدیر در پرتال کاربر: '+ctx.route,createdAt:new Date().toISOString(),adminSession:{...p},resources});
 db.securityAuditLogs=db.securityAuditLogs.slice(0,300);
}
type Options={post:(path:string,handler:(req:Request,res:Response)=>unknown)=>unknown;load:()=>TreasuryDatabaseState;save:(db:TreasuryDatabaseState)=>unknown;resolve:(req:Request,db:TreasuryDatabaseState)=>{user:User|null;session:UserSessionRecord|null};log:(db:TreasuryDatabaseState,entry:Omit<SecurityAuditLogEntry,'id'|'createdAt'>)=>unknown};
export function installAdminImpersonation(o:Options){
 const admin=(req:Request,res:Response,db:TreasuryDatabaseState)=>{const a=o.resolve(req,db);if(!a.user||!a.session||a.user.role!=='ADMIN'||a.user.mustChangePassword||a.session.impersonation){res.status(403).json({error:'ورود به دسترسی کاربران فقط برای مدیر اصلی سامانه مجاز است.'});return;}return a as {user:User;session:UserSessionRecord};};
 o.post('/api/auth/impersonation/start',(req,res)=>{
  const db=o.load(),a=admin(req,res,db);if(!a)return;
  const {targetUserId,reason,operationId}=req.body||{};
  if(typeof operationId!=='string'||!/^[-a-f0-9]{36}$/.test(operationId)||typeof reason!=='string'||reason.trim().length<3||reason.trim().length>500)return res.status(400).json({error:'دلیل ورود (۳ تا ۵۰۰ نویسه) و شناسه معتبر عملیات لازم است.'});
  const target=db.users.find(u=>u.id===targetUserId);
  if(!target||target.isActive===false||target.id===a.user.id||target.role==='ADMIN')return res.status(400).json({error:'یک کاربر فعال غیر از مدیر سامانه انتخاب کنید.'});
  let child=db.sessions?.find(s=>s.impersonation?.id===operationId);
  if(child){if(child.impersonation!.parentSessionHash!==parentHash(a.session.token)||child.userId!==target.id||child.impersonation!.reason!==reason.trim()||!resolvePortalSession(child.token,db).user)return res.status(409).json({error:'این شناسه ورود قبلاً استفاده شده است؛ ورود تازه‌ای آغاز کنید.'});}
  else{
   const now=Date.now();if((db.sessions||[]).filter(s=>s.impersonation?.parentSessionHash===parentHash(a.session.token)&&active(s,now)).length>=10)return res.status(429).json({error:'ابتدا یکی از ورودهای مدیریتی باز را ببندید.'});
   child={token:crypto.randomBytes(32).toString('hex'),userId:target.id,createdAt:now,expiresAt:Math.min(now+30*60*1000,a.session.expiresAt),revoked:false,impersonation:{id:operationId,adminId:a.user.id,parentSessionHash:parentHash(a.session.token),reason:reason.trim()}};
   (db.sessions||=[]).push(child);o.log(db,{actionType:'IMPERSONATION_STARTED',actorId:a.user.id,actorName:a.user.name,targetUserId:target.id,targetUserName:target.name,description:'ورود مدیر به پرتال کاربر؛ دلیل: '+reason.trim(),adminSession:{id:operationId,adminId:a.user.id,adminName:a.user.name,reason:reason.trim()}});o.save(db);
  }
  return res.json({success:true,token:child.token,user:target,impersonation:publicImpersonation(child,db)});
 });
 o.post('/api/auth/impersonation/end',(req,res)=>{
  const db=o.load(),a=admin(req,res,db);if(!a)return;
  const child=db.sessions?.find(s=>s.impersonation?.id===req.body?.impersonationId&&s.impersonation?.parentSessionHash===parentHash(a.session.token));
  if(!child)return res.status(404).json({error:'ورود مدیریتی متعلق به این نشست یافت نشد.'});
  if(!child.revoked){child.revoked=true;child.revokedReason='IMPERSONATION_ENDED';o.log(db,{actionType:'IMPERSONATION_ENDED',actorId:a.user.id,actorName:a.user.name,targetUserId:child.userId,description:'بازگشت مدیر از پرتال کاربر',adminSession:{id:child.impersonation!.id,adminId:a.user.id,adminName:a.user.name,reason:child.impersonation!.reason}});o.save(db);}
  return res.json({success:true});
 });
}
