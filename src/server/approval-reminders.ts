import crypto from 'node:crypto';
import type {TreasuryDatabaseState as DB,User,SmsGatewayConfig} from '../types/treasury';
import {authorizeRequest,type EffectiveAccess} from './access-control';
import {financialWorkRows} from './open-work';
import {chainStateError,currentSupervisorId} from '../utils/request-approval-chain';
import {inquiryReviewer,type InquiryAuth} from './account-inquiry-policy';
import {smsRuntime} from './sms-transport';

export const REMINDER_GAP=45*60*1000;
export type ApprovalReminderConfig={enabled:boolean;startHour:number;endHour:number};
export type ApprovalReminderState={version:1;observations:Record<string,{userId:string;fingerprint:string;since:number}>;attempts:Array<{id:string;userId:string;phoneHash:string;at:number;day:string;status:'CLAIMED'|'SENT'|'UNKNOWN'}>};
type Target={key:string;userId:string;fingerprint:string};
const hash=(v:string)=>crypto.createHash('sha256').update(v).digest('hex');
const digits=(v:string)=>v.replace(/[۰-۹٠-٩]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.includes(c)?'۰۱۲۳۴۵۶۷۸۹'.indexOf(c):'٠١٢٣٤٥٦٧٨٩'.indexOf(c)));
const phone=(u:User)=>digits(String(u.phone||'')).trim();
export function reminderConfigError(v:unknown):string|undefined{
 if(!v||typeof v!=='object'||Array.isArray(v))return 'تنظیم یادآوری معتبر نیست.';
 const c=v as ApprovalReminderConfig;
 if(Object.keys(c).some(k=>!['enabled','startHour','endHour'].includes(k))||typeof c.enabled!=='boolean'||!Number.isInteger(c.startHour)||!Number.isInteger(c.endHour)||c.startHour<0||c.endHour>24||c.startHour>=c.endHour)return 'ساعت آغاز و پایان یادآوری را در یک روز و به وقت تهران مشخص کنید.';
}
export function tehranReminderTime(now:number){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(now),get=(k:string)=>parts.find(p=>p.type===k)!.value;
 return {day:get('year')+'-'+get('month')+'-'+get('day'),hour:Number(get('hour'))};
}
function ready(c:SmsGatewayConfig|undefined,env:Record<string,string|undefined>){return !!c?.approvalReminders?.enabled&&!reminderConfigError(c.approvalReminders)&&smsRuntime(c,env).ready&&smsRuntime(c,env).mode==='LIVE';}
export function approvalReminderTargets(db:DB,resolve:(u:User,db:DB)=>EffectiveAccess,inquiriesEnabled:boolean):Target[]{
 const targets:Target[]=[],users=new Map((db.users||[]).filter(u=>u.isActive!==false&&!u.mustChangePassword&&/^09\d{9}$/.test(phone(u))).map(u=>[u.id,u]));
 for(const work of financialWorkRows(db)){
  const {parent,row}=work;if((row.status||parent.status)!=='Pending_Approver'||chainStateError(row))continue;
  const id=currentSupervisorId(parent,row),u=id&&users.get(id);if(!u)continue;
  const auth=resolve(u,db),body=()=>({itemType:work.itemType,requestId:parent.id,...(work.itemType==='BATCH_ITEM'?{rowId:row.id}:{}),expectedVersion:row.version||1,expectedStatus:'Pending_Approver',reviewStage:'APPROVER'});
  if(['APPROVE','RETURN_FOR_REVISION'].every(action=>authorizeRequest({path:'/review/row-action',method:'POST',body:{...body(),action}},u,db,auth)!==null))continue;
  targets.push({key:'financial:'+work.itemType+':'+parent.id+':'+row.id,userId:u.id,fingerprint:hash(JSON.stringify([u.id,row.version||1,row.status||parent.status,row.approvalChain||null]))});
 }
 if(inquiriesEnabled&&db.accountInquirySchemaVersion===2&&!db.accountInquiryReadOnly)for(const q of db.accountInquiries||[]){const u=q.approverId&&users.get(q.approverId);if(!u||!inquiryReviewer(u,q,db,resolve as InquiryAuth))continue;const p=resolve(u,db).effectivePermissions;
  for(const row of q.rows)if(row.status==='PENDING_APPROVER'&&p.canShowInquiryApproval||row.status==='AWAITING_RELEASE'&&p.canShowInquiryRelease&&p.canReleaseAccountInquiry)targets.push({key:'inquiry:'+q.id+':'+row.id,userId:u.id,fingerprint:hash(JSON.stringify([u.id,row.version,row.status]))});
 }
 return targets;
}
function state(db:DB):ApprovalReminderState{
 const s=db.approvalReminderState;if(s===undefined)return {version:1,observations:{},attempts:[]};
 if(s.version!==1||!s.observations||Array.isArray(s.observations)||!Array.isArray(s.attempts)||Object.values(s.observations).some(o=>!o||typeof o.userId!=='string'||typeof o.fingerprint!=='string'||!Number.isFinite(o.since))||s.attempts.some(a=>!a||typeof a.userId!=='string'||typeof a.phoneHash!=='string'||!Number.isFinite(a.at)||typeof a.day!=='string'||!['CLAIMED','SENT','UNKNOWN'].includes(a.status)))throw Error('REMINDER_STATE_INCOMPATIBLE');
 return s;
}
type Dependencies={load:()=>DB;save:(db:DB)=>unknown;run:<T>(work:()=>T|Promise<T>)=>Promise<T>;auth:(u:User,db:DB)=>EffectiveAccess;send:(db:DB,user:User,count:number)=>Promise<{ok:boolean}>;now?:()=>number;env?:Record<string,string|undefined>;onError?:()=>void};
/** A durable claim precedes the external call. Uncertain attempts consume a slot. */
export class ApprovalReminderService{
 private d:Dependencies;private busy=false;private stopped=false;private timer?:ReturnType<typeof setInterval>;
 constructor(deps:Dependencies){this.d=deps;}
 private now(){return(this.d.now||Date.now)();}
 private targets(db:DB){return approvalReminderTargets(db,this.d.auth,(this.d.env||process.env).TREASURY_ACCOUNT_INQUIRIES_ENABLED==='true');}
 async tick(){
  if(this.busy||this.stopped)return;this.busy=true;
  try{
   const ids=await this.d.run(()=>{const db=this.d.load();if(!ready(db.smsConfig,this.d.env||process.env))return[];const s=state(db),now=this.now(),targets=this.targets(db),observations:ApprovalReminderState['observations']={};for(const t of targets){const old=s.observations[t.key];observations[t.key]=old?.fingerprint===t.fingerprint&&old.userId===t.userId?old:{userId:t.userId,fingerprint:t.fingerprint,since:now};}
    if(JSON.stringify(s.observations)!==JSON.stringify(observations)){db.approvalReminderState={...s,observations};this.d.save(db);}return [...new Set(targets.map(t=>t.userId))];});
   for(const id of ids){if(this.stopped)break;await this.d.run(async()=>{
    const db=this.d.load(),env=this.d.env||process.env;if(!ready(db.smsConfig,env))return;const now=this.now(),clock=tehranReminderTime(now),cfg=db.smsConfig!.approvalReminders!;if(clock.hour<cfg.startHour||clock.hour>=cfg.endHour)return;
    const s=state(db),u=db.users.find(u=>u.id===id);if(!u)return;const targets=this.targets(db).filter(t=>t.userId===id),oldEnough=targets.some(t=>{const o=s.observations[t.key];return o?.userId===id&&o.fingerprint===t.fingerprint&&now-o.since>=REMINDER_GAP;});if(!oldEnough)return;
    const phoneHash=hash(phone(u)),previous=s.attempts.filter(a=>a.userId===id||a.phoneHash===phoneHash);if(previous.filter(a=>a.day===clock.day).length>=2||previous.some(a=>now-a.at<REMINDER_GAP))return;
    const attempt:ApprovalReminderState['attempts'][number]={id:crypto.randomUUID(),userId:id,phoneHash,at:now,day:clock.day,status:'CLAIMED'};db.approvalReminderState={...s,attempts:[...s.attempts,attempt]};this.d.save(db);
    // Keep this single bounded send in the writer turn: assignment/phone cannot
    // change between the current authorization check and provider dispatch.
    const deliveryDb=this.d.load(),deliveryUser=deliveryDb.users.find(x=>x.id===id)!;
    let ok=false;try{ok=(await this.d.send(deliveryDb,deliveryUser,targets.length)).ok;}catch{}
    const recorded=deliveryDb.approvalReminderState!.attempts.find(a=>a.id===attempt.id)!;recorded.status=ok?'SENT':'UNKNOWN';this.d.save(deliveryDb);
   });}
  }catch{this.d.onError?.();}finally{this.busy=false;}
 }
 start(){this.timer=setInterval(()=>void this.tick(),30000);this.timer.unref();void this.tick();}
 stop(){this.stopped=true;if(this.timer)clearInterval(this.timer);}
}
