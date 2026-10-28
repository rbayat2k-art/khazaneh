import{isPersonnelAdvance,destinationRecipient}from'../utils/financial-party';
import crypto from 'node:crypto';
import type {TreasuryDatabaseState,User} from '../types/treasury';
import type {EffectiveAccess} from './access-control';
import {canSeeRequest} from './access-control';
import {companyPolicy} from './company-access';
import {correctionTarget} from './treasury-correction';
import {hasDeletionFinancialLinks} from '../utils/request-deletion';
import {normalizeCard,normalizeIban} from '../utils/bank-identifiers';
import {inquiryDefaults,inquiryTargetKey,inquiryEligible,invalidateBankInquiry,type InquiryTarget,type InquiryJob,type InquiryConfig,type InquirySource} from '../utils/bank-inquiry';
import type {InquiryClient} from './inquiry-client';

export type {InquiryClient} from './inquiry-client';
type Auth=(user:User,db:TreasuryDatabaseState)=>EffectiveAccess;
type Write=(work:(db:TreasuryDatabaseState)=>boolean)=>Promise<void>;
export type InquiryContext={source:InquirySource;generation:string;providerId?:string;connectionId?:string};
type ServiceOptions={manualOnly?:boolean;context?:()=>InquiryContext;snapshot?:()=>{client:InquiryClient;context:InquiryContext};authorized?:(db:TreasuryDatabaseState)=>boolean};
export class InquiryError extends Error {status:number;code:string;constructor(status:number,code:string){super(code);this.status=status;this.code=code;}}
const reject=(status:number,code:string):never=>{throw new InquiryError(status,code);};
export const cardFingerprint=(card:string)=>crypto.createHash('sha256').update(normalizeCard(card)).digest('hex');
const now=()=>new Date().toISOString(),day=(at:string)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(at));
const normalizedName=(s:string)=>s.normalize('NFKC').replace(/[يى]/g,'ی').replace(/ك/g,'ک').replace(/[\u064b-\u065f\u0670]/g,'').replace(/\s+/g,' ').trim();
export function inquiryRows(db:TreasuryDatabaseState){
 const rows:Array<{target:InquiryTarget;row:any;parent:any}>=[];
 for(const [itemType,list] of [['PAYMENT',db.paymentRequests],['ADVANCE',db.advanceRequests]] as const)for(const row of list)if(!row.requesterDeletedAt)rows.push({target:{itemType,requestId:row.id,expectedVersion:row.version||1},row,parent:row});
 for(const parent of db.batchPayments)if(!parent.requesterDeletedAt)for(const row of parent.items)if(!row.requesterDeletedAt)rows.push({target:{itemType:'BATCH_ITEM',requestId:parent.id,rowId:row.id,expectedVersion:row.version||1},row,parent});
 return rows;
}
function companyEnabled(db:TreasuryDatabaseState,parent:any){const c=parent.companyId?db.companies?.find(c=>c.id===parent.companyId):db.companies?.find(c=>c.name===(parent.company||db.users.find(u=>u.id===parent.requesterId)?.company));return !!c&&c.isActive!==false&&!!db.bankInquiryConfig?.companyIds.includes(c.id);}
function targetRow(db:TreasuryDatabaseState,target:InquiryTarget){if(!target||!['PAYMENT','ADVANCE','BATCH_ITEM'].includes(target.itemType)||typeof target.requestId!=='string'||!target.requestId||Object.keys(target).some(k=>!['itemType','requestId','rowId','expectedVersion'].includes(k)))return reject(400,'INVALID_TARGET');const found=correctionTarget(db,target);if(!found.row||!found.parent)return reject(404,'NOT_FOUND');return {...found,row:found.row as any,parent:found.parent as any};}
function ready(db:TreasuryDatabaseState,target:InquiryTarget,actor:User,auth:Auth,permission:'canInquireBankDetails'|'canConfirmBankOwner'='canInquireBankDetails'){
 const found=targetRow(db,target),a=auth(actor,db);
 if(actor.isActive===false||actor.mustChangePassword||!a.effectivePermissions[permission]||!canSeeRequest(found.parent,actor,db,a))return reject(403,'FORBIDDEN');
 if(!inquiryEligible(found.row,found.parent)||hasDeletionFinancialLinks(db,found.row.id))return reject(409,'NOT_UNPAID');
 if(!Number.isSafeInteger(target.expectedVersion)||target.expectedVersion!==(found.row.version||1))return reject(409,'STALE_RESULT');
 if(!db.bankInquiryConfig?.enabled||!companyEnabled(db,found.parent))return reject(409,'DISABLED');
 return found;
}
export function manageInquiryAllowed(db:TreasuryDatabaseState,user:User,auth:Auth){return user.isActive!==false&&!user.mustChangePassword&&!!auth(user,db).effectivePermissions.canManageBankInquiry&&companyPolicy(user,db).all;}
export function inquiryOperationResult(db:TreasuryDatabaseState,user:User,auth:Auth,key:unknown){
 if(typeof key!=='string'||!/^pay-idem-[a-f0-9-]{36}$/.test(key))return reject(400,'OPERATION_REQUIRED');const op=db.bankInquiryOperations?.find(o=>o.key===key);if(!op)return reject(404,'NOT_FOUND');const a=auth(user,db);
 if(op.actorId!==user.id||user.isActive===false||user.mustChangePassword||!a.effectivePermissions.canInquireBankDetails||op.targets.some(t=>!canSeeRequest(targetRow(db,t).parent,user,db,a)))return reject(403,'FORBIDDEN');
 return {found:true,key:op.key,jobs:op.jobIds.map(id=>{const j=db.bankInquiryJobs?.find(j=>j.id===id);return {id,status:j?.status||'UNKNOWN'};})};
}
export function saveInquiryConfig(db:TreasuryDatabaseState,user:User,auth:Auth,body:any,client:InquiryClient){
 if(!manageInquiryAllowed(db,user,auth))return reject(403,'FORBIDDEN');
 if(!body||Object.keys(body).some(k=>!['enabled','automatic','companyIds','dailyLimit','expectedRevision'].includes(k))||typeof body.enabled!=='boolean'||typeof body.automatic!=='boolean'||!Array.isArray(body.companyIds)||new Set(body.companyIds).size!==body.companyIds.length||body.companyIds.some((id:any)=>typeof id!=='string'||!db.companies?.some(c=>c.id===id&&c.isActive!==false))||!Number.isInteger(body.dailyLimit)||body.dailyLimit<1||body.dailyLimit>10000)return reject(400,'INVALID_CONFIG');
 const previous=db.bankInquiryConfig||inquiryDefaults();if(body.expectedRevision!==previous.revision)return reject(409,'STALE_CONFIG');
 if(body.enabled&&(!client.configured()||!body.companyIds.length))return reject(400,'NOT_CONFIGURED');
 db.bankInquiryConfig={enabled:body.enabled,automatic:body.automatic,companyIds:[...body.companyIds],dailyLimit:body.dailyLimit,revision:previous.revision+1,configuredBy:user.id};
}
export function enqueueInquiry(db:TreasuryDatabaseState,user:User,auth:Auth,targets:InquiryTarget[],retry=false,automatic=false,operationKey?:string,context?:InquiryContext):string[]{
 if(!Array.isArray(targets)||!targets.length||targets.length>50||targets.some(t=>!t||typeof t!=='object'||Object.keys(t).some(k=>!['itemType','requestId','rowId','expectedVersion'].includes(k)))||new Set(targets.map(inquiryTargetKey)).size!==targets.length)return reject(400,'INVALID_TARGETS');
 const fingerprint=crypto.createHash('sha256').update(JSON.stringify({retry,targets:targets.map(t=>[inquiryTargetKey(t),t.expectedVersion]).sort((a,b)=>String(a[0]).localeCompare(String(b[0])))})).digest('hex');
 if(operationKey!==undefined){
  if(!/^pay-idem-[a-f0-9-]{36}$/.test(operationKey))return reject(400,'OPERATION_REQUIRED');
  const previous=db.bankInquiryOperations?.find(o=>o.key===operationKey);
  if(previous){if(previous.actorId!==user.id)return reject(403,'FORBIDDEN');if(previous.fingerprint!==fingerprint)return reject(409,'OPERATION_CONFLICT');
   const a=auth(user,db);if(user.isActive===false||user.mustChangePassword||!a.effectivePermissions.canInquireBankDetails||previous.targets.some(t=>!canSeeRequest(targetRow(db,t).parent,user,db,a)))return reject(403,'FORBIDDEN');return [...previous.jobIds];
  }
  if((db.bankInquiryOperations||[]).filter(o=>o.actorId===user.id&&day(o.createdAt)===day(now())).length>=Math.max(1000,(db.bankInquiryConfig?.dailyLimit||100)*2))return reject(429,'RATE_LIMITED');
 }
 // Validate the entire batch before changing its first child.
 const selected=targets.map(t=>{const f=ready(db,t,user,auth);if(typeof f.row.accountOrCard!=='string'||!/^\d{16}$/.test(normalizeCard(f.row.accountOrCard)))return reject(400,'CARD_REQUIRED');return {t,...f};});
 const ids:string[]=[];
 for(const {t,row} of selected){const fingerprint=cardFingerprint(row.accountOrCard),old=row.bankInquiry;
  const sameContext=!context||old?.source===context.source&&db.bankInquiryJobs?.find(j=>j.id===old.jobId)?.generation===context.generation;
  if(sameContext&&old?.fingerprint===fingerprint&&(['QUEUED','RUNNING','FOUND'].includes(old.status)||!retry)){ids.push(old.jobId);continue;}
  const job:InquiryJob={id:crypto.randomUUID(),target:{...t},fingerprint,actorId:user.id,automatic,configRevision:db.bankInquiryConfig!.revision,status:'QUEUED',createdAt:now(),...context};
  (db.bankInquiryJobs||=[]).push(job);row.bankInquiry={status:'QUEUED',jobId:job.id,fingerprint,...(context?{source:context.source,providerId:context.providerId,connectionId:context.connectionId}:{}),destinationReviewRequired:!!old?.destinationReviewRequired||old?.status==='REVIEW'||!!old&&(old.fingerprint!==fingerprint||!sameContext)};ids.push(job.id);
 }
 if(operationKey)(db.bankInquiryOperations||=[]).push({key:operationKey,actorId:user.id,fingerprint,targets:targets.map(t=>({...t})),jobIds:[...ids],createdAt:now()});
 return ids;
}
export function completeInquiryCard(db:TreasuryDatabaseState,user:User,auth:Auth,target:InquiryTarget,input:unknown){const {row}=ready(db,target,user,auth);if(typeof input!=='string'||!/^\d{16}$/.test(normalizeCard(input)))return reject(400,'CARD_REQUIRED');const card=normalizeCard(input);if(card===row.accountOrCard)return;if(typeof row.accountOrCard==='string'&&/^\d{16}$/.test(normalizeCard(row.accountOrCard)))return reject(409,'CARD_CHANGE_REQUIRES_RETURN');invalidateBankInquiry(row,{accountOrCard:card});row.accountOrCard=card;row.version=(row.version||1)+1;}
export function confirmInquiryOwner(db:TreasuryDatabaseState,user:User,auth:Auth,target:InquiryTarget,jobId:unknown,reason:unknown){
 const {row,parent}=ready(db,target,user,auth,'canConfirmBankOwner'),r=row.bankInquiry,advance=isPersonnelAdvance(target.itemType,parent,row);
 if(typeof reason!=='string'||!reason.trim()||reason.length>4000)return reject(400,'REASON_REQUIRED');
 if(!r||r.status!=='FOUND'||r.jobId!==jobId||r.fingerprint!==cardFingerprint(row.accountOrCard||'')||!r.ownerNames||!['02','03'].includes(r.depositStatus)||normalizeIban(row.iban||'')!==r.iban)return reject(409,'STALE_RESULT');
 if(r.ownerConfirmed)return;
 const previousName=destinationRecipient(target.itemType,parent,row);
 (row.bankOwnerConfirmations||=[]).push({previousName,bankName:r.ownerNames,reason:reason.trim(),byId:user.id,byName:user.name,at:now(),jobId:r.jobId});
 (row.auditHistory||=[]).push({id:crypto.randomUUID(),action:'تأیید نام بانکی مقصد توسط خزانه',actorId:user.id,actorRole:user.role,changedBy:user.name,changedAt:now(),stage:'TREASURY',reason:reason.trim(),comment:`نام ثبت‌شده: ${previousName} ← نام بانکی تأییدشده: ${r.ownerNames}`});
 // A salary requester identity must never be replaced with the holder's identity.
 // Store a separate destination label; other requests retain the original in history.
 if(advance)row.bankPayeeName=r.ownerNames;else row.payeeName=r.ownerNames;
 r.ownerConfirmed=true;row.version=(row.version||1)+1;
}

/** Claim/apply share the existing writer; external I/O never holds that writer. */
export class BankInquiryService {
 private running=false;private stopped=false;private expedited=false;private timer:ReturnType<typeof setTimeout>|undefined;private read:()=>TreasuryDatabaseState;private write:Write;private auth:Auth;private client:InquiryClient;private options:ServiceOptions;
 constructor(read:()=>TreasuryDatabaseState,write:Write,auth:Auth,client:InquiryClient,options:ServiceOptions={}){this.read=read;this.write=write;this.auth=auth;this.client=client;this.options=options;}
 wake(explicit=false){if(this.stopped)return;if(this.running){this.expedited=true;return;}if(this.timer){if(!explicit)return;clearTimeout(this.timer);this.timer=undefined;}const db=this.read();if(!db.bankInquiryConfig?.enabled&&!(db.bankInquiryJobs||[]).some(j=>j.status==='QUEUED'||j.status==='RUNNING'))return;this.timer=setTimeout(()=>{this.timer=undefined;void this.process().catch(()=>{});},50);this.timer.unref();}
 stop(){this.stopped=true;if(this.timer)clearTimeout(this.timer);}
 async recover(){await this.write(db=>{let changed=false;for(const j of db.bankInquiryJobs||[])if(j.status==='RUNNING'){j.status='UNKNOWN';j.finishedAt=now();const row=correctionTarget(db,j.target).row as any;if(row?.bankInquiry?.jobId===j.id){row.bankInquiry.status='UNKNOWN';row.bankInquiry.code='UNKNOWN';}changed=true;}return changed;});this.wake();}
 private valid(db:TreasuryDatabaseState,j:InquiryJob){try{if(this.options.authorized&&!this.options.authorized(db))return;const context=this.options.context?.();if(this.options.manualOnly&&j.automatic||context&&(j.source!==context.source||j.generation!==context.generation))return;const actor=db.users.find(u=>u.id===j.actorId),manager=db.users.find(u=>u.id===db.bankInquiryConfig?.configuredBy);if(!actor||!manager||!manageInquiryAllowed(db,manager,this.auth)||db.bankInquiryConfig?.revision!==j.configRevision||!this.client.configured())return;const found=ready(db,j.target,actor,this.auth);if(cardFingerprint(found.row.accountOrCard||'')!==j.fingerprint||found.row.bankInquiry?.jobId!==j.id)return;return found;}catch{return;}}
 private async process(){if(this.running||this.stopped)return;this.running=true;this.expedited=false;
  try{for(let turn=0;turn<100&&!this.stopped;turn++){
   let claimed:InquiryJob|undefined,card='';
   await this.write(db=>{
    let changed=false;const cfg=db.bankInquiryConfig,manager=db.users.find(u=>u.id===cfg?.configuredBy);
    if((!this.options.authorized||this.options.authorized(db))&&!this.options.manualOnly&&cfg?.enabled&&cfg.automatic&&manager&&manageInquiryAllowed(db,manager,this.auth)&&this.auth(manager,db).effectivePermissions.canInquireBankDetails&&this.client.configured()){
     const targets=inquiryRows(db).filter(({row,parent})=>inquiryEligible(row,parent)&&!hasDeletionFinancialLinks(db,row.id)&&companyEnabled(db,parent)&&typeof row.accountOrCard==='string'&&/^\d{16}$/.test(normalizeCard(row.accountOrCard))&&(!row.bankInquiry||row.bankInquiry.fingerprint!==cardFingerprint(row.accountOrCard))).slice(0,50).map(r=>r.target);
     if(targets.length){enqueueInquiry(db,manager,this.auth,targets,false,true,undefined,this.options.context?.());changed=true;}
    }
    for(const j of db.bankInquiryJobs||[]){if(j.status!=='QUEUED')continue;const found=this.valid(db,j);if(!found){j.status='CANCELLED';j.finishedAt=now();const row=correctionTarget(db,j.target).row as any;if(row?.bankInquiry?.jobId===j.id){row.bankInquiry.status='ERROR';row.bankInquiry.code='STALE_RESULT';}changed=true;continue;}
     const dispatched=(db.bankInquiryJobs||[]).filter(x=>x.startedAt&&day(x.startedAt)===day(now())).length;
     if(dispatched>=cfg!.dailyLimit){if(found.row.bankInquiry.code!=='DAILY_LIMIT'){found.row.bankInquiry.code='DAILY_LIMIT';changed=true;}break;}
     j.status='RUNNING';j.startedAt=now();found.row.bankInquiry.status='RUNNING';delete found.row.bankInquiry.code;claimed={...j,target:{...j.target}};card=found.row.accountOrCard;changed=true;break;
    }return changed;
   });
   if(!claimed)break;
   // Recheck after the durable claim and before dispatch; requests already sent
   // cannot be recalled, but their stale result must never overwrite a record.
   if(this.stopped)return;
   const dispatch=this.options.snapshot?.();
   if(!this.valid(this.read(),claimed)||dispatch&&(dispatch.context.source!==claimed.source||dispatch.context.generation!==claimed.generation)){await this.write(db=>{const j=db.bankInquiryJobs?.find(j=>j.id===claimed!.id);if(!j||j.status!=='RUNNING')return false;j.status='CANCELLED';j.finishedAt=now();const row=correctionTarget(db,j.target).row as any;if(row?.bankInquiry?.jobId===j.id){row.bankInquiry.status='ERROR';row.bankInquiry.code='STALE_RESULT';}return true;});continue;}
   const result=await (dispatch?.client||this.client).lookup(card);card='';
   if(this.stopped)return;
   await this.write(db=>{const j=db.bankInquiryJobs?.find(x=>x.id===claimed!.id);if(!j||j.status!=='RUNNING')return false;const found=this.valid(db,j);if(!found){j.status='CANCELLED';j.finishedAt=now();const row=correctionTarget(db,j.target).row as any;if(row?.bankInquiry?.jobId===j.id){row.bankInquiry.status='ERROR';row.bankInquiry.code='STALE_RESULT';}return true;}
    const row=found.row,r=row.bankInquiry;r.checkedAt=now();j.finishedAt=r.checkedAt;
    if(result.kind==='FOUND'){
     Object.assign(r,result);delete r.kind;r.status='FOUND';
     const existing=normalizeIban(row.iban||'');if(existing&&existing!==result.iban){r.status='REVIEW';r.code='IBAN_CONFLICT';r.ownerConfirmed=false;}
     else{row.iban=result.iban;r.destinationReviewRequired=false;if(!row.bankName)row.bankName=result.bankName;r.ownerConfirmed=normalizedName(destinationRecipient(j.target.itemType,found.parent,row))===normalizedName(result.ownerNames);}
     j.status='DONE';
    }else{r.status=result.kind==='REVIEW'?'REVIEW':result.kind==='UNKNOWN'?'UNKNOWN':'ERROR';r.code=result.kind==='REVIEW'?result.code:result.kind;if(result.kind==='REVIEW')r.depositStatus=result.depositStatus;j.status=result.kind==='UNKNOWN'?'UNKNOWN':'DONE';}
    return true;
   });
  }}catch{if(!this.stopped)await this.recover().catch(()=>{});}finally{this.running=false;if(!this.stopped){if(this.expedited)this.wake();else if((this.read().bankInquiryJobs||[]).some(j=>j.status==='QUEUED')){this.timer=setTimeout(()=>{this.timer=undefined;this.wake();},60000);this.timer.unref();}}}
 }
}
