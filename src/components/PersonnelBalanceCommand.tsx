import {useEffect,useRef,useState}from'react';
import {activeAuthToken}from'../utils/admin-session';
import {AccountInquiryClientError}from'../utils/account-inquiry-client';
import {personnelBalanceRequest}from'../utils/personnel-balance-client';

// A pending command survives leaving/reopening this workspace in the same session.
// It never enters storage, a different session or another person's form.
let session:string|null=null;
const pending=new Map<string,{path:string;body:any}>();
function currentPending(scope:string){const token=activeAuthToken();if(token!==session){pending.clear();session=token;}return pending.get(scope);}
export const hasPendingPersonnelBalance=(scope:string)=>!!currentPending(scope);
export function usePersonnelBalanceCommand(scope:string){
 const[busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(!!currentPending(scope)),[error,setError]=useState(''),mounted=useRef(true),inFlight=useRef(false),token=useRef(activeAuthToken());
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 useEffect(()=>{if(!busy&&!uncertain)return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[busy,uncertain]);
 return{busy,uncertain,error,run:async(path:string,body:any,done:(r:any)=>void)=>{
  if(inFlight.current||activeAuthToken()!==token.current)return;inFlight.current=true;setBusy(true);setError('');
  const command=currentPending(scope)||{path,body:{...body,operationId:crypto.randomUUID()}};pending.set(scope,command);
  // Even an already committed command is replayed at the server: current scope,
  // account status and permission must be checked before displaying any result.
  try{const result=await personnelBalanceRequest(command.path,command.body);if(!mounted.current)return;if(session===token.current&&pending.get(scope)===command)pending.delete(scope);setUncertain(false);done(result);}
  catch(e){const unknown=!(e instanceof AccountInquiryClientError)||e.status===0||e.status>=500;if(!unknown&&session===token.current&&pending.get(scope)===command)pending.delete(scope);if(mounted.current){setUncertain(unknown);setError(unknown?'پاسخ ثبت دریافت نشد؛ با «پیگیری ثبت قبلی» نتیجه همان عملیات را بررسی کنید.':e instanceof Error?e.message:'ثبت ناموفق بود.');}}
  finally{inFlight.current=false;if(mounted.current)setBusy(false);}
 }};
}
