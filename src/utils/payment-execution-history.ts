import type {PaymentExecutionRecord,ReceiptArchive} from '../types/treasury';
type PaymentRow={amount:number;approvedAmount?:number|null;paidAmount?:number;paidAmountSoFar?:number;status?:string;paymentHistory?:PaymentExecutionRecord[];paymentExecutions?:PaymentExecutionRecord[]};
const stable=(v:any):string=>JSON.stringify(v,(_k,value)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.keys(value).sort().map(k=>[k,value[k]])):value);
/** Both names are aliases, not two ledgers. Never infer an execution from the last request snapshot. */
export function paymentExecutionHistory(row:PaymentRow){
 const history=row.paymentHistory||[],alias=row.paymentExecutions||[],entries=history.length?history:alias,unique=new Map<string,PaymentExecutionRecord>();let issue='';
 for(const e of entries){if(!e.id||!Number.isSafeInteger(e.amount)||e.amount<=0){issue='تاریخچه پرداخت نامعتبر است';continue;}const old=unique.get(e.id);if(old&&stable(old)!==stable(e))issue='شناسه تکراری با اطلاعات پرداخت متفاوت';else unique.set(e.id,e);}
 if(history.length&&alias.length){const signatures=(a:PaymentExecutionRecord[])=>[...new Set(a.map(stable))].sort().join('\n');if(signatures(history)!==signatures(alias))issue='دو نسخه تاریخچه پرداخت همخوان نیستند';}
 const approved=row.approvedAmount??row.amount,paid=row.paidAmount??row.paidAmountSoFar??(row.status==='Paid'?approved:0),sum=[...unique.values()].reduce((s,e)=>s+BigInt(e.amount),0n);
 if(!Number.isSafeInteger(approved)||approved<0||!Number.isSafeInteger(paid)||paid<0||paid>approved||row.paidAmount!==undefined&&row.paidAmountSoFar!==undefined&&row.paidAmount!==row.paidAmountSoFar||entries.length&&Number.isSafeInteger(paid)&&sum!==BigInt(paid))issue='جمع تاریخچه و مانده ثبت‌شده همخوان نیستند';
 return {entries:[...unique.values()],paid,approved,issue};
}
export function executionReceipt(receipts:ReceiptArchive[],execution:PaymentExecutionRecord,rowId:string){return receipts.find(r=>r.id===execution.receiptId&&r.relatedPaymentIds?.includes(rowId))||null;}
/** Request-local index of already authorized receipts; no cross-user/state cache. */
export function indexExecutionReceipts(receipts:ReceiptArchive[]){
 const byId=new Map<string,ReceiptArchive[]>();for(const receipt of receipts){const matches=byId.get(receipt.id)||[];matches.push(receipt);byId.set(receipt.id,matches);}
 return (execution:PaymentExecutionRecord,rowId:string)=>(byId.get(execution.receiptId as string)||[]).find(r=>r.relatedPaymentIds?.includes(rowId))||null;
}
