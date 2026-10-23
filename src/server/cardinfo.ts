import {normalizeCard,normalizeIban,validIranIban} from '../utils/bank-identifiers';
export {validIranIban} from '../utils/bank-identifiers';

import type {BankLookupResult,CreditResult} from './inquiry-client';
export type {BankLookupResult,CreditResult} from './inquiry-client';
type Transport=(input:string,init:RequestInit)=>Promise<Response>;
const endpoint='https://cardinfo.ir/inquiry/apiv1',limit=16*1024;
const shortText=(v:unknown,max:number):v is string=>typeof v==='string'&&v.trim().length>0&&v.length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v);

/** Provider responses/errors never leave this boundary as raw text. No retries:
 * after dispatch, a missing response may already have consumed provider credit. */
export class CardinfoClient {
 private readonly apiKey:string;private readonly transport:Transport;private readonly timeoutMs:number;
 constructor(apiKey:string,transport:Transport=(url,init)=>fetch(url,init),timeoutMs=8000){this.apiKey=apiKey;this.transport=transport;this.timeoutMs=timeoutMs;}
 configured(){return typeof this.apiKey==='string'&&this.apiKey.length>0&&this.apiKey.length<=4096&&/^[\x21-\x7e]+$/.test(this.apiKey);}
 private async request(query:Record<string,string>,method:'GET'|'POST'):Promise<{kind:'JSON';value:any}|Exclude<BankLookupResult,{kind:'FOUND'|'REVIEW'}>>{
  if(!this.configured())return {kind:'NOT_CONFIGURED'};
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),this.timeoutMs);let response:Response|undefined;
  try{
   const url=new URL(endpoint);for(const [k,v] of Object.entries(query))url.searchParams.set(k,v);
   response=await this.transport(url.href,{method,redirect:'error',headers:{Authorization:'Bearer '+this.apiKey,Accept:'application/json'},signal:controller.signal});
   if(response.status===401||response.status===403)return {kind:'UNAUTHORIZED'};
   if(response.status===429)return {kind:'RATE_LIMITED'};
   if(!response.ok)return {kind:'UNKNOWN'};
   if(Number(response.headers.get('content-length')||0)>limit)return {kind:'INVALID_RESPONSE'};
   const reader=response.body?.getReader();if(!reader)return {kind:'INVALID_RESPONSE'};
   let size=0;const chunks:Uint8Array[]=[];
   try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();return {kind:'INVALID_RESPONSE'};}chunks.push(value);}}finally{reader.releaseLock();}
   const bytes=new Uint8Array(size);let offset=0;for(const b of chunks){bytes.set(b,offset);offset+=b.byteLength;}
   try{return {kind:'JSON',value:JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))};}catch{return {kind:'INVALID_RESPONSE'};}
  }catch{return {kind:'UNKNOWN'};}finally{clearTimeout(timer);if(response?.body&&!response.bodyUsed&&!response.body.locked)void response.body.cancel().catch(()=>{});controller.abort();}
 }
 async lookup(input:string):Promise<BankLookupResult>{
  if(!this.configured())return {kind:'NOT_CONFIGURED'};
  if(typeof input!=='string')return {kind:'INVALID_INPUT'};const card=normalizeCard(input);if(!/^\d{16}$/.test(card))return {kind:'INVALID_INPUT'};
  const response=await this.request({api:'card_sheba',card},'POST');if(response.kind!=='JSON')return response;
  const value=response.value;if(!value||Array.isArray(value)||typeof value!=='object')return {kind:'INVALID_RESPONSE'};
  if(['04','05','06','07'].includes(value.depositStatus))return {kind:'REVIEW',code:'ACCOUNT_STATUS',depositStatus:value.depositStatus};
  if(!['02','03'].includes(value.depositStatus)||typeof value.card!=='string'||normalizeCard(value.card)!==card||typeof value.IBAN!=='string')return {kind:'INVALID_RESPONSE'};
  const iban=normalizeIban(value.IBAN);if(!validIranIban(iban)||!shortText(value.bankName,200)||!shortText(value.depositOwners,2000)||typeof value.deposit!=='string'||!/^\d[\d./-]{0,39}$/.test(value.deposit))return {kind:'INVALID_RESPONSE'};
  return {kind:'FOUND',iban,bankName:value.bankName.trim(),deposit:value.deposit,ownerNames:value.depositOwners.trim(),depositStatus:value.depositStatus};
 }
 async credits():Promise<CreditResult>{
  const response=await this.request({action:'listCredits'},'GET');if(response.kind!=='JSON')return response;
  if(!Array.isArray(response.value)||response.value.length>100)return {kind:'INVALID_RESPONSE'};
  const packages=[];
  for(const p of response.value){if(!p||!shortText(p.package_name,200)||!(typeof p.credit==='string'&&/^\d{1,30}$/.test(p.credit)||typeof p.credit==='number'&&Number.isSafeInteger(p.credit)&&p.credit>=0)||!shortText(p.order_time,30)||!shortText(p.expire_time,30))return {kind:'INVALID_RESPONSE'};packages.push({name:p.package_name,credit:String(p.credit),orderedAt:p.order_time,expiresAt:p.expire_time});}
  return {kind:'CREDITS',packages};
 }
}
