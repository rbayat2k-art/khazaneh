import type {Express,Request,Response} from 'express';
import type {TreasuryDatabaseState,User} from '../types/treasury';
import type {EffectiveAccess} from './access-control';
import {companyPolicy} from './company-access';
import {CardinfoClient} from './cardinfo';
import path from 'node:path';
import crypto from 'node:crypto';
import {InquiryConnections} from './inquiry-connections';
import {providerDefinition} from './inquiry-providers';
import {BankInquiryService,InquiryError,saveInquiryConfig,enqueueInquiry,completeInquiryCard,confirmInquiryOwner,manageInquiryAllowed,inquiryOperationResult,type InquiryClient,type InquiryContext} from './bank-inquiry';
import {inquiryDefaults,inquiryLabels} from '../utils/bank-inquiry';

export function inquiryRuntimeClient(env:NodeJS.ProcessEnv):{client:InquiryClient;mode:'MOCK'|'LIVE'|'DISABLED'|'CARDINFO_TEST';connections?:InquiryConnections;snapshot?:()=>{client:InquiryClient;context:InquiryContext}}{
 const data=String(env.TREASURY_DATA_DIR||'').replaceAll('\\','/'),synthetic=data.startsWith('C:/Users/reza/Desktop/پروژه‌ها/انتشار موقت khazaneh/work/')||!!env.SHAHRAH_STAGING_ROOT&&data===String(env.SHAHRAH_STAGING_ROOT).replaceAll('\\','/')+'/data'&&data.startsWith('C:/Users/reza/Desktop/پروژه‌ها/انتشار موقت khazaneh/private/');
 if(env.DISABLE_EXTERNAL_INTEGRATIONS==='true'){
  if(env.SHAHRAH_STAGING_CARDINFO_REAL==='true'){
   const transport=(globalThis as any)[Symbol.for('shahrah.cardinfo.transport')],root=env.SHAHRAH_STAGING_ROOT;
   if(!synthetic||!root||typeof transport!=='function'||path.resolve(env.TREASURY_CARDINFO_VAULT_DIR||'')!==path.join(path.resolve(root),'secrets'))return {client:new CardinfoClient(''),mode:'DISABLED'};
   const connections=new InquiryConnections(env.TREASURY_CARDINFO_VAULT_DIR);
   const snapshot=()=>{const p=connections.snapshot();return {client:providerDefinition(p.providerId).create(p.settings,p.credentials,transport),context:{source:'CARDINFO_TEST' as const,generation:p.generation,providerId:p.providerId,connectionId:p.id}};};
   return {mode:'CARDINFO_TEST',connections,snapshot,client:{configured:()=>{try{return snapshot().client.configured();}catch{return false;}},lookup:card=>snapshot().client.lookup(card),credits:()=>snapshot().client.credits()}};
  }
  if(env.TREASURY_BANK_INQUIRY_MOCK!=='true'||!synthetic)return {client:new CardinfoClient(''),mode:'DISABLED'};
  return {mode:'MOCK',client:{configured:()=>true,credits:async()=>({kind:'CREDITS',packages:[{name:'TEST — بدون اعتبار واقعی',credit:'100000',orderedAt:'TEST',expiresAt:'TEST'}]}),lookup:async card=>{
   if(card.endsWith('0004'))return {kind:'REVIEW',code:'ACCOUNT_STATUS',depositStatus:'04'};
   if(card.endsWith('0006'))return {kind:'UNKNOWN'};
   const bban='017'+card.padStart(19,'0'),iban='IR'+String(98n-BigInt(bban+'182700')%97n).padStart(2,'0')+bban;
   return {kind:'FOUND',iban,deposit:'00000'+card,bankName:'TEST BANK',ownerNames:'TEST BANK OWNER',depositStatus:card.endsWith('0003')?'03':'02'};
  }}};
 }
 const client=new CardinfoClient(env.CARDINFO_API_KEY||'');return {client,mode:client.configured()?'LIVE':'DISABLED'};
}
type Hooks={read:()=>TreasuryDatabaseState;load:()=>TreasuryDatabaseState;save:(db:TreasuryDatabaseState)=>unknown;auth:(u:User,db:TreasuryDatabaseState)=>EffectiveAccess;session:(req:Request,db:TreasuryDatabaseState)=>{user?:User|null};run:<T>(work:()=>T|Promise<T>)=>Promise<T>;post:(route:string,handler:(req:Request,res:Response)=>unknown)=>void};
export function installBankInquiry(app:Express,h:Hooks,env=process.env){
 const {client,mode,connections,snapshot}=inquiryRuntimeClient(env),manualOnly=mode==='CARDINFO_TEST',context=()=>snapshot?snapshot().context:({source:(mode==='DISABLED'?'LIVE':mode) as 'MOCK'|'LIVE'|'CARDINFO_TEST',generation:mode}),service=new BankInquiryService(h.read,async work=>h.run(()=>{const db=h.load();if(work(db))h.save(db);}),h.auth,client,{manualOnly,context,snapshot});
 const connectionVersion=()=>crypto.createHash('sha256').update(context().generation).digest('hex');
 const error=(res:Response,e:unknown)=>res.status(e instanceof InquiryError?e.status:500).json({ok:false,code:e instanceof InquiryError?e.code:'NOT_SAVED',error:e instanceof InquiryError?(inquiryLabels[e.code]||({FORBIDDEN:'مجوز جاری برای این اقدام کافی نیست.',CARD_REQUIRED:'کارت مقصد کاملِ ۱۶رقمی لازم است.',REASON_REQUIRED:'دلیل تأیید نام بانکی الزامی است.',NOT_UNPAID:'فقط ردیف کاملاً پرداخت‌نشده قابل اصلاح است.',DISABLED:'استعلام برای این شرکت غیرفعال است.',STALE_CONFIG:'تنظیمات تغییر کرده؛ تازه‌سازی کنید.'} as Record<string,string>)[e.code]||'هدف یا اطلاعات استعلام معتبر نیست.'):'نتیجه ذخیره نشد؛ فهرست را تازه‌سازی و نتیجه قبلی را بررسی کنید.'});
 const only=(body:any,keys:string[])=>{if(!body||Object.keys(body).some(k=>!keys.includes(k)))throw new InquiryError(400,'INVALID_INPUT');};
 const connectionError=(res:Response,e:unknown)=>{if(e instanceof Error&&e.message==='SECRET_REVISION_CONFLICT')error(res,new InquiryError(409,'SECRET_REVISION_CONFLICT'));else if(e instanceof Error&&['INVALID_SECRET','INVALID_CONNECTION'].includes(e.message))error(res,new InquiryError(400,'INVALID_CONNECTION'));else error(res,e);};
 h.post('/api/bank-inquiry/credential',(req,res)=>{try{const db=h.read();if(!manageInquiryAllowed(db,res.locals.viewer,h.auth))throw new InquiryError(403,'FORBIDDEN');if(!connections||!manualOnly)throw new InquiryError(403,'SECRET_UNAVAILABLE');only(req.body,['apiKey','expectedRevision']);const m=connections.saveLegacyKey(req.body.apiKey,req.body.expectedRevision),p=m.profiles.find(p=>p.id===m.activeConnectionId)!;res.json({ok:true,credential:{available:true,hasKey:p.hasCredentials,revision:m.revision}});}catch(e){connectionError(res,e);}finally{if(req.body)req.body.apiKey='';}});
 h.post('/api/bank-inquiry/connections',(req,res)=>{try{const db=h.read();if(!manageInquiryAllowed(db,res.locals.viewer,h.auth))throw new InquiryError(403,'FORBIDDEN');if(!connections||!manualOnly)throw new InquiryError(403,'SECRET_UNAVAILABLE');only(req.body,['action','connectionId','profile','expectedRevision']);const b=req.body;let result;
  if(b.action==='CREATE'&&b.connectionId===undefined)result=connections.create(b.profile,b.expectedRevision);
  else if(b.action==='UPDATE')result=connections.update(b.connectionId,b.profile,b.expectedRevision);
  else if(b.action==='SELECT'&&b.profile===undefined)result=connections.select(b.connectionId,b.expectedRevision);
  else throw new InquiryError(400,'INVALID_CONNECTION');res.json({ok:true,connections:result});
 }catch(e){connectionError(res,e);}finally{if(req.body?.profile?.credentials)req.body.profile.credentials={};}});
 app.get('/api/bank-inquiry/result',(req,res)=>{try{const db=h.read(),u=h.session(req,db).user;if(!u)throw new InquiryError(401,'FORBIDDEN');res.json({ok:true,...inquiryOperationResult(db,u,h.auth,req.query.key)});}catch(e){error(res,e);}});
 app.get('/api/bank-inquiry/config',(req,res)=>{try{const db=h.read(),u=h.session(req,db).user;if(!u)throw new InquiryError(401,'FORBIDDEN');const p=h.auth(u,db).effectivePermissions,canManage=manageInquiryAllowed(db,u,h.auth),scope=companyPolicy(u,db);if(!canManage&&!p.canInquireBankDetails&&!p.canConfirmBankOwner)throw new InquiryError(403,'FORBIDDEN');const config=db.bankInquiryConfig||inquiryDefaults(),m=connections?.metadata(),selected=m?.profiles.find(p=>p.id===m.activeConnectionId);res.json({ok:true,mode,manualOnly,configured:client.configured(),canManage,connectionVersion:manualOnly?connectionVersion():undefined,connection:selected?{id:selected.id,name:selected.name,providerId:selected.providerId}:undefined,...(canManage?{connections:m,credential:m?{available:m.available,hasKey:!!selected?.hasCredentials,revision:m.revision}:{available:false,hasKey:false,revision:0}}:{}),config:canManage?config:{...config,companyIds:config.companyIds.filter(id=>scope.has(id)),configuredBy:''},companies:(db.companies||[]).filter(c=>scope.has(c.id)||scope.has(c.name))});}catch(e){error(res,e);}});
 app.get('/api/bank-inquiry/credits',async(req,res)=>{try{const before=h.read(),u=h.session(req,before).user;if(!u||!manageInquiryAllowed(before,u,h.auth))throw new InquiryError(403,'FORBIDDEN');const selected=snapshot?.(),result=await (selected?.client||client).credits(),db=h.read(),current=h.session(req,db).user;if(!current||!manageInquiryAllowed(db,current,h.auth))throw new InquiryError(403,'FORBIDDEN');if(selected&&selected.context.generation!==context().generation)throw new InquiryError(409,'STALE_CONNECTION');res.json({ok:result.kind==='CREDITS',mode,result});}catch(e){error(res,e);}});
 h.post('/api/bank-inquiry/config',(req,res)=>{try{const db=h.load();if(manualOnly&&req.body?.automatic!==false)throw new InquiryError(400,'MANUAL_TEST_ONLY');saveInquiryConfig(db,res.locals.viewer,h.auth,req.body,client);const state=h.save(db);service.wake(true);res.json({ok:true,state});}catch(e){error(res,e);}});
 h.post('/api/bank-inquiry/enqueue',(req,res)=>{try{only(req.body,['targets','retry','acknowledgeCredit','operationKey','connectionVersion']);if(typeof req.body.operationKey!=='string')throw new InquiryError(400,'OPERATION_REQUIRED');if((manualOnly||req.body.retry===true)&&req.body.acknowledgeCredit!==true)throw new InquiryError(400,'CREDIT_ACK_REQUIRED');if(manualOnly&&(!Array.isArray(req.body.targets)||req.body.targets.length!==1))throw new InquiryError(400,'SINGLE_TEST_ONLY');const db=h.load();
  // Definitive input rejection BEFORE any job/receipt/write, not an ambiguous
  // operation conflict. Existing operation handles still follow scoped replay.
  if(manualOnly&&req.body.connectionVersion!==connectionVersion()&&!db.bankInquiryOperations?.some(o=>o.key===req.body.operationKey))throw new InquiryError(400,'STALE_CONNECTION');const ids=enqueueInquiry(db,res.locals.viewer,h.auth,req.body.targets,req.body.retry===true,false,req.body.operationKey,context());const state=h.save(db);service.wake(true);res.json({ok:true,queued:true,jobIds:ids,state});}catch(e){error(res,e);}});
 h.post('/api/bank-inquiry/complete-card',(req,res)=>{try{only(req.body,['target','card']);const db=h.load();completeInquiryCard(db,res.locals.viewer,h.auth,req.body.target,req.body.card);const state=h.save(db);service.wake(true);res.json({ok:true,state});}catch(e){error(res,e);}});
 h.post('/api/bank-inquiry/confirm-owner',(req,res)=>{try{only(req.body,['target','jobId','reason']);const db=h.load();confirmInquiryOwner(db,res.locals.viewer,h.auth,req.body.target,req.body.jobId,req.body.reason);const state=h.save(db);res.json({ok:true,state});}catch(e){error(res,e);}});
 return {wake:()=>service.wake(),start:()=>service.recover(),stop:()=>service.stop(),mode};
}
