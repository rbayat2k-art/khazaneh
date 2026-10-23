/** Browser metadata only: no amount, account, file, token or successful result. */
export type PendingPayment={key:string;targets:string[];fingerprint:string};
type Store=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
export type PaymentOutcome={ok:boolean;error?:string;status?:number;code?:string;ambiguous?:boolean};
export type PaymentLock=<T>(name:string,work:()=>Promise<T>)=>Promise<T>;
const storeKey=(actor:string)=>'khazaneh.pending-payment.v1:'+encodeURIComponent(actor);
export function readPendingPayments(store:Store,actor:string):PendingPayment[]{
 const value=JSON.parse(store.getItem(storeKey(actor))||'[]');
 if(!Array.isArray(value)||value.length>200||value.some(p=>!p||Object.keys(p).some(k=>!['key','targets','fingerprint'].includes(k))||!/^pay-idem-[a-f0-9-]{36}$/.test(p.key)||!Array.isArray(p.targets)||!p.targets.length||p.targets.length>200||p.targets.some((t:unknown)=>typeof t!=='string'||t.length>500)||new Set(p.targets).size!==p.targets.length||!/^[a-f0-9]{64}$/.test(p.fingerprint)))throw Error('اطلاعات پیگیری ثبت خوانده نشد؛ برای جلوگیری از تکرار، ارسال متوقف شد.');
 return value;
}
function write(store:Store,actor:string,entries:PendingPayment[]):void {
 const encoded=JSON.stringify(entries);store.setItem(storeKey(actor),encoded);if(store.getItem(storeKey(actor))!==encoded)throw Error('نگهداری شناسه پیگیری ممکن نیست؛ پرداخت ارسال نشد.');
}
export const overlaps=(entry:PendingPayment,targets:string[])=>entry.targets.some(t=>targets.includes(t));
function canonical(value:any):any{return Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;}
export async function paymentFingerprint(payload:unknown):Promise<string>{const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(canonical(payload))));return Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,'0')).join('');}
export async function clearPendingPayment(store:Store,lock:PaymentLock,actor:string,key:string):Promise<void>{await lock('khazaneh:payment:'+actor,async()=>write(store,actor,readPendingPayments(store,actor).filter(p=>p.key!==key)));}
export async function trackedPayment(store:Store,lock:PaymentLock,actor:string,targets:string[],fingerprint:string,isCurrent:()=>boolean,send:(key:string)=>Promise<PaymentOutcome>,retainSuccess=false):Promise<PaymentOutcome>{
 return lock('khazaneh:payment:'+actor,async()=>{
  if(!isCurrent())return {ok:false,ambiguous:true};
  const entries=readPendingPayments(store,actor),found=entries.filter(p=>overlaps(p,targets));
  if(found.length>1||found[0]&&(found[0].fingerprint!==fingerprint||JSON.stringify([...found[0].targets].sort())!==JSON.stringify([...targets].sort())))return {ok:false,error:'ثبت قبلیِ نامشخص با اطلاعات دیگری برای این ردیف وجود دارد؛ ابتدا نتیجه قبلی را از سرور بررسی کنید.'};
  const entry=found[0]||{key:'pay-idem-'+crypto.randomUUID(),targets:[...targets].sort(),fingerprint};
  if(!found.length){if(entries.length>=200)throw Error('پیگیری‌های نامشخص باید ابتدا تعیین تکلیف شوند.');write(store,actor,[...entries,entry]);}
  let result:PaymentOutcome;try{result=await send(entry.key);}catch{return {ok:false,ambiguous:true,error:'نتیجه ثبت دریافت نشد؛ شناسه پیگیری حفظ شد.'};}
  if(!isCurrent())return {ok:false,ambiguous:true};
  // A new key has never been sent by another cooperating tab (the Web Lock is
  // held through the response). Unknown previous attempts are never cleared by
  // an absent history, failed refresh, scope change or a subsequent denial.
  // Creation forms retain a confirmed handle until explicit "new entry" so a
  // cooperating tab queued behind this success reuses the same operation.
  if(result.ok&&!retainSuccess||!found.length&&!result.ok&&!result.ambiguous&&([400,401,403,404].includes(result.status||0)||result.code==='STALE_PAYMENT_BALANCE')){
    try{write(store,actor,readPendingPayments(store,actor).filter(p=>p.key!==entry.key));}catch{return {ok:false,ambiguous:true,error:'پاک‌کردن پیگیری مرورگر ممکن نشد؛ نتیجه را از سرور بررسی کنید.'};}
  }
  return result;
 });
}
export function confirmedPayment(entry:PendingPayment,actor:string,rows:Array<{target:string;row:any}>,receipts:any[]):any|undefined {
 const selected=rows.filter(p=>entry.targets.includes(p.target)),allocations=selected.flatMap(p=>(p.row.paymentHistory||p.row.paymentExecutions||[]).filter((h:any)=>h.idempotencyKey===entry.key).map((h:any)=>({target:p.target,id:p.row.id,h}))),matches=allocations.map(a=>a.h);
 if(new Set(allocations.map(a=>a.target)).size!==entry.targets.length||new Set(allocations.map(a=>a.id)).size!==matches.length)return;
 if(!matches.length||matches.some(h=>h.treasuryUserId!==actor)||new Set(matches.map(h=>h.receiptId)).size!==1)return;
 const receipt=receipts.find(r=>r.id===matches[0].receiptId);
 if(!receipt||!Number.isSafeInteger(receipt.amount)||receipt.amount<=0||matches.some(h=>!Number.isSafeInteger(h.amount)||h.amount<=0||h.sourceBankAccountId!==receipt.sourceBankAccountId||h.bankRefNumber!==receipt.bankRefNumber)||matches.reduce((s,h)=>s+BigInt(h.amount),0n)!==BigInt(receipt.amount))return;
 const ids=new Set(allocations.map(a=>a.id));
 if(!Array.isArray(receipt.relatedPaymentIds)||receipt.relatedPaymentIds.some((id:string)=>!ids.has(id))||ids.size!==receipt.relatedPaymentIds.length)return;
 return receipt;
}
